const {
  sequelize,
  Garden,
  Zone,
  SensorReading,
  CareTask,
  AutomationRule
} = require('../models');
const eventBus = require('./eventBus');
const alertService = require('./alertService');
const {
  getDialect,
  normalizeAffectedCount,
  escapeSqlLiteral,
  getLocalDateString
} = require('../utils/dbHelpers');

const VALID_METRICS = ['SOIL_MOISTURE', 'TEMPERATURE', 'HUMIDITY', 'LIGHT_LUX'];
const VALID_OPERATORS = ['LT', 'GT', 'EQ'];
const VALID_WEATHER_CONDITIONS = ['NO_RAIN', 'ANY'];
const VALID_ACTION_TYPES = ['CREATE_TASK', 'SEND_ALERT'];
const VALID_TASK_TYPES = ['WATER', 'FERTILIZE', 'PRUNE', 'REPOT', 'HARVEST', 'PEST_INSPECTION'];

const METRIC_TO_COLUMN = {
  SOIL_MOISTURE: 'soil_moisture',
  TEMPERATURE: 'temperature',
  HUMIDITY: 'humidity',
  LIGHT_LUX: 'light_lux'
};

/**
 * Sprint 2 stub — returns false. Replaced by F11 Weather Service in Sprint 3.
 */
async function rainLikely(_garden) {
  return false;
}

function compareMetric(value, operator, threshold) {
  if (!Number.isFinite(value) || !Number.isFinite(threshold)) return false;
  if (operator === 'LT') return value < threshold;
  if (operator === 'GT') return value > threshold;
  if (operator === 'EQ') return Math.abs(value - threshold) <= 0.5;
  return false;
}

function serializeRule(rule) {
  const raw = rule && rule.toJSON ? rule.toJSON() : { ...rule };
  return {
    ...raw,
    threshold_value: Number(raw.threshold_value),
    cooldown_minutes: Number(raw.cooldown_minutes),
    max_daily_executions: Number(raw.max_daily_executions),
    executions_today: Number(raw.executions_today || 0),
    is_active: Boolean(raw.is_active),
    task_type: raw.task_type || 'WATER'
  };
}

async function resetRuleDailyCounterIfNeeded(rule, localDate, now) {
  const dialect = getDialect(sequelize);
  const localDateSql = escapeSqlLiteral(localDate, dialect);
  const nowSql = escapeSqlLiteral(now, dialect);
  const ruleId = Number(rule.id);

  await sequelize.query(
    `UPDATE automation_rules ` +
    `SET executions_today = 0, last_execution_date = ${localDateSql}, updated_at = ${nowSql} ` +
    `WHERE id = ${ruleId} AND (last_execution_date IS NULL OR last_execution_date <> ${localDateSql});`
  );
}

const zoneEvalQueues = new Map();

async function withZoneLock(zoneId, fn) {
  const key = Number(zoneId);
  const prev = zoneEvalQueues.get(key) || Promise.resolve();
  let release;
  const next = new Promise((resolve) => {
    release = resolve;
  });
  const tail = prev.then(() => next, () => next);
  zoneEvalQueues.set(key, tail);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (zoneEvalQueues.get(key) === tail) {
      zoneEvalQueues.delete(key);
    }
  }
}

async function atomicClaimExecutionSlot(rule, localDate, now) {
  const dialect = getDialect(sequelize);
  const localDateSql = escapeSqlLiteral(localDate, dialect);
  const nowSql = escapeSqlLiteral(now, dialect);
  const trueSql = escapeSqlLiteral(true, dialect);
  const ruleId = Number(rule.id);
  const cooldownMinutes = Number(rule.cooldown_minutes || 0);
  let cooldownClause = '';
  if (cooldownMinutes > 0) {
    const cooldownCutoff = new Date(now.getTime() - cooldownMinutes * 60000);
    const cooldownCutoffSql = escapeSqlLiteral(cooldownCutoff, dialect);
    cooldownClause = `AND (last_triggered_at IS NULL OR last_triggered_at <= ${cooldownCutoffSql}) `;
  }

  const res = await sequelize.query(
    `UPDATE automation_rules ` +
    `SET executions_today = CASE WHEN last_execution_date = ${localDateSql} THEN executions_today + 1 ELSE 1 END, ` +
    `last_triggered_at = ${nowSql}, ` +
    `last_execution_date = ${localDateSql}, ` +
    `updated_at = ${nowSql} ` +
    `WHERE id = ${ruleId} ` +
    `AND is_active = ${trueSql} ` +
    cooldownClause +
    `AND (last_execution_date IS NULL OR last_execution_date <> ${localDateSql} OR executions_today < max_daily_executions);`
  );

  return normalizeAffectedCount(res) > 0;
}

async function evaluateAllRules(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const rainCheckFn = typeof options.rainLikelyFn === 'function' ? options.rainLikelyFn : rainLikely;
  const stalenessMinutes = Number(process.env.RULE_STALENESS_MINUTES || 120);
  const stalenessMs = stalenessMinutes * 60000;

  const activeRules = await AutomationRule.findAll({
    where: { is_active: true },
    order: [['id', 'ASC']]
  });

  let evaluated = 0;
  let triggered = 0;
  let skipped = 0;
  const details = [];

  for (const listedRule of activeRules) {
    evaluated++;
    const outcome = await withZoneLock(listedRule.zone_id, async () => {
      const rule = await AutomationRule.findByPk(listedRule.id);
      if (!rule || !rule.is_active) {
        return { status: 'skipped', detail: { ruleId: listedRule.id, status: 'skipped', reason: 'rule_inactive' } };
      }

      const zone = await Zone.findByPk(rule.zone_id);
      if (!zone) {
        return { status: 'skipped', detail: { ruleId: rule.id, status: 'skipped', reason: 'zone_not_found' } };
      }

      const garden = await Garden.findByPk(zone.garden_id);
      if (!garden) {
        return { status: 'skipped', detail: { ruleId: rule.id, status: 'skipped', reason: 'garden_not_found' } };
      }

      // Layer 1a: Cooldown Guard
      if (rule.last_triggered_at) {
        const lastTriggeredMs = new Date(rule.last_triggered_at).getTime();
        const cooldownMs = Number(rule.cooldown_minutes || 0) * 60000;
        if (now.getTime() - lastTriggeredMs < cooldownMs) {
          return { status: 'skipped', detail: { ruleId: rule.id, status: 'skipped', reason: 'cooldown' } };
        }
      }

      // Layer 1b: Dynamic Garden Timezone Local Date Reset & Cap Guard
      const localDate = getLocalDateString(garden.timezone || 'UTC', now);
      const ruleExecDate = rule.last_execution_date ? String(rule.last_execution_date).slice(0, 10) : null;
      if (ruleExecDate !== localDate) {
        await resetRuleDailyCounterIfNeeded(rule, localDate, now);
      }
      const effectiveExecutions = ruleExecDate === localDate ? Number(rule.executions_today || 0) : 0;
      if (effectiveExecutions >= Number(rule.max_daily_executions || 1)) {
        return { status: 'skipped', detail: { ruleId: rule.id, status: 'skipped', reason: 'daily_cap' } };
      }

      // Latest Reading & Staleness Check
      const recentReadings = await SensorReading.findAll({
        where: { zone_id: zone.id },
        order: [['recorded_at', 'DESC'], ['id', 'DESC']],
        limit: 5
      });
      if (!recentReadings || recentReadings.length === 0) {
        return { status: 'skipped', detail: { ruleId: rule.id, status: 'skipped', reason: 'no_reading' } };
      }
      recentReadings.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime() || b.id - a.id);
      const latestReading = recentReadings[0];
      const readingAgeMs = now.getTime() - new Date(latestReading.recorded_at).getTime();
      if (readingAgeMs > stalenessMs) {
        return { status: 'skipped', detail: { ruleId: rule.id, status: 'skipped', reason: 'stale_reading' } };
      }

      // Condition Evaluation
      const col = METRIC_TO_COLUMN[rule.metric];
      const val = col ? Number(latestReading[col]) : NaN;
      if (!compareMetric(val, rule.operator, Number(rule.threshold_value))) {
        return { status: 'skipped', detail: { ruleId: rule.id, status: 'skipped', reason: 'condition_not_met' } };
      }

      // Weather Guard (Sprint 2 stub: rainLikely returns false)
      if (rule.weather_condition === 'NO_RAIN' && Boolean(zone.is_outdoor)) {
        const isRain = await rainCheckFn(garden);
        if (isRain) {
          return { status: 'skipped', detail: { ruleId: rule.id, status: 'skipped', reason: 'rain_likely' } };
        }
      }

      // Layer 2: Check hasOpenTask BEFORE executing atomic SQL increment!
      if (rule.action_type === 'CREATE_TASK') {
        const taskType = rule.task_type || 'WATER';
        const openTask = await CareTask.findOne({
          where: {
            zone_id: rule.zone_id,
            task_type: taskType,
            is_completed: false
          }
        });
        if (openTask) {
          return { status: 'skipped', detail: { ruleId: rule.id, status: 'skipped', reason: 'open_task_exists' } };
        }
      }

      // Layer 3: Atomic Conditional SQL Increment (also enforces cooldown atomically)
      const claimed = await atomicClaimExecutionSlot(rule, localDate, now);
      if (!claimed) {
        return { status: 'skipped', detail: { ruleId: rule.id, status: 'skipped', reason: 'atomic_cap_reached' } };
      }

      // Dispatch Action
      if (rule.action_type === 'CREATE_TASK') {
        const taskType = rule.task_type || 'WATER';
        const task = await CareTask.create({
          zone_id: rule.zone_id,
          task_type: taskType,
          due_date: localDate,
          is_completed: false,
          source: 'RULE_ENGINE',
          notes: `Triggered automatically by rule: ${rule.name} (${rule.metric} ${rule.operator} ${rule.threshold_value}, reading=${val})`
        });

        eventBus.emitEvent(zone.garden_id, 'TASK_UPDATED', {
          taskId: task.id,
          zoneId: zone.id,
          taskType: task.task_type,
          isCompleted: false,
          completedBy: null,
          source: 'RULE_ENGINE'
        });
      } else if (rule.action_type === 'SEND_ALERT') {
        await alertService.triggerRuleAlert({
          zone,
          garden,
          rule,
          value: val,
          now
        });
      }

      return { status: 'triggered', detail: { ruleId: rule.id, status: 'triggered', action: rule.action_type } };
    });

    if (outcome.status === 'triggered') {
      triggered++;
    } else {
      skipped++;
    }
    details.push(outcome.detail);
  }

  return { evaluated, triggered, skipped, details };
}

module.exports = {
  VALID_METRICS,
  VALID_OPERATORS,
  VALID_WEATHER_CONDITIONS,
  VALID_ACTION_TYPES,
  VALID_TASK_TYPES,
  rainLikely,
  compareMetric,
  serializeRule,
  evaluateAllRules
};

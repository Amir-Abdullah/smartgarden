const { AutomationRule, Zone } = require('../models');
const { verifyJwt } = require('../middleware/auth');
const { resolveGardenAndRole } = require('../middleware/rbac');
const {
  VALID_METRICS,
  VALID_OPERATORS,
  VALID_WEATHER_CONDITIONS,
  VALID_ACTION_TYPES,
  VALID_TASK_TYPES,
  serializeRule
} = require('../services/ruleEngineService');

function validateRulePayload(body, isUpdate = false) {
  const errors = [];
  if (!isUpdate && (!body.name || typeof body.name !== 'string' || !body.name.trim())) {
    errors.push('name is required.');
  } else if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 100)) {
    errors.push('name must be 1-100 characters.');
  }

  if (!isUpdate && (!body.metric || !VALID_METRICS.includes(body.metric))) {
    errors.push(`metric must be one of: ${VALID_METRICS.join(', ')}`);
  } else if (body.metric !== undefined && !VALID_METRICS.includes(body.metric)) {
    errors.push(`metric must be one of: ${VALID_METRICS.join(', ')}`);
  }

  if (body.operator !== undefined && !VALID_OPERATORS.includes(body.operator)) {
    errors.push(`operator must be one of: ${VALID_OPERATORS.join(', ')}`);
  }

  if (!isUpdate && (body.threshold_value === undefined || body.threshold_value === null || !Number.isFinite(Number(body.threshold_value)))) {
    errors.push('threshold_value must be a finite number.');
  } else if (body.threshold_value !== undefined && !Number.isFinite(Number(body.threshold_value))) {
    errors.push('threshold_value must be a finite number.');
  }

  if (body.weather_condition !== undefined && !VALID_WEATHER_CONDITIONS.includes(body.weather_condition)) {
    errors.push(`weather_condition must be one of: ${VALID_WEATHER_CONDITIONS.join(', ')}`);
  }

  if (body.action_type !== undefined && !VALID_ACTION_TYPES.includes(body.action_type)) {
    errors.push(`action_type must be one of: ${VALID_ACTION_TYPES.join(', ')}`);
  }

  if (body.task_type !== undefined && !VALID_TASK_TYPES.includes(body.task_type)) {
    errors.push(`task_type must be one of: ${VALID_TASK_TYPES.join(', ')}`);
  }

  if (body.cooldown_minutes !== undefined) {
    const c = Number(body.cooldown_minutes);
    if (!Number.isInteger(c) || c < 0) errors.push('cooldown_minutes must be an integer >= 0.');
  }

  if (body.max_daily_executions !== undefined) {
    const m = Number(body.max_daily_executions);
    if (!Number.isInteger(m) || m < 1) errors.push('max_daily_executions must be an integer >= 1.');
  }

  return errors;
}

async function ruleRoutes(fastify) {
  // GET /api/zones/:zoneId/rules (OWNER & FAMILY only — GUEST gets 403)
  fastify.get('/zones/:zoneId/rules', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY'])]
  }, async (request, reply) => {
    const rules = await AutomationRule.findAll({
      where: { zone_id: Number(request.params.zoneId) },
      order: [['id', 'ASC']]
    });
    return reply.send({
      success: true,
      data: {
        rules: rules.map(serializeRule)
      }
    });
  });

  // POST /api/zones/:zoneId/rules (OWNER only)
  fastify.post('/zones/:zoneId/rules', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER'])]
  }, async (request, reply) => {
    const zone = await Zone.findByPk(request.params.zoneId);
    if (!zone) {
      return reply.code(404).send({
        success: false,
        error: { code: 'ZONE_NOT_FOUND', message: `Zone ${request.params.zoneId} not found`, statusCode: 404 }
      });
    }

    const body = request.body || {};
    const errors = validateRulePayload(body, false);
    if (errors.length > 0) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_RULE_PAYLOAD', message: errors.join(' '), statusCode: 400 }
      });
    }

    const rule = await AutomationRule.create({
      zone_id: zone.id,
      name: body.name.trim(),
      metric: body.metric,
      operator: body.operator || 'LT',
      threshold_value: Number(body.threshold_value),
      weather_condition: body.weather_condition || 'ANY',
      action_type: body.action_type || 'CREATE_TASK',
      task_type: body.task_type || 'WATER',
      cooldown_minutes: body.cooldown_minutes !== undefined ? Number(body.cooldown_minutes) : 180,
      max_daily_executions: body.max_daily_executions !== undefined ? Number(body.max_daily_executions) : 3,
      executions_today: 0,
      is_active: body.is_active !== undefined ? Boolean(body.is_active) : true
    });

    return reply.code(201).send({
      success: true,
      data: { rule: serializeRule(rule) }
    });
  });

  // PUT /api/zones/:zoneId/rules/:ruleId (OWNER only, compound scoped)
  fastify.put('/zones/:zoneId/rules/:ruleId', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER'])]
  }, async (request, reply) => {
    const rule = await AutomationRule.findOne({
      where: { id: Number(request.params.ruleId), zone_id: Number(request.params.zoneId) }
    });
    if (!rule) {
      return reply.code(404).send({
        success: false,
        error: { code: 'RULE_NOT_FOUND', message: `Automation rule ${request.params.ruleId} not found`, statusCode: 404 }
      });
    }

    const body = request.body || {};
    const errors = validateRulePayload(body, true);
    if (errors.length > 0) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_RULE_PAYLOAD', message: errors.join(' '), statusCode: 400 }
      });
    }

    if (body.name !== undefined) rule.name = body.name.trim();
    if (body.metric !== undefined) rule.metric = body.metric;
    if (body.operator !== undefined) rule.operator = body.operator;
    if (body.threshold_value !== undefined) rule.threshold_value = Number(body.threshold_value);
    if (body.weather_condition !== undefined) rule.weather_condition = body.weather_condition;
    if (body.action_type !== undefined) rule.action_type = body.action_type;
    if (body.task_type !== undefined) rule.task_type = body.task_type;
    if (body.cooldown_minutes !== undefined) rule.cooldown_minutes = Number(body.cooldown_minutes);
    if (body.max_daily_executions !== undefined) rule.max_daily_executions = Number(body.max_daily_executions);
    if (body.is_active !== undefined) rule.is_active = Boolean(body.is_active);

    await rule.save();

    return reply.send({
      success: true,
      data: { rule: serializeRule(rule) }
    });
  });

  // DELETE /api/zones/:zoneId/rules/:ruleId (OWNER only, compound scoped)
  fastify.delete('/zones/:zoneId/rules/:ruleId', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER'])]
  }, async (request, reply) => {
    const rule = await AutomationRule.findOne({
      where: { id: Number(request.params.ruleId), zone_id: Number(request.params.zoneId) }
    });
    if (!rule) {
      return reply.code(404).send({
        success: false,
        error: { code: 'RULE_NOT_FOUND', message: `Automation rule ${request.params.ruleId} not found`, statusCode: 404 }
      });
    }

    await rule.destroy();
    return reply.send({
      success: true,
      data: { message: 'Automation rule deleted.' }
    });
  });

  // PATCH /api/zones/:zoneId/rules/:ruleId/toggle (OWNER only, compound scoped)
  fastify.patch('/zones/:zoneId/rules/:ruleId/toggle', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER'])]
  }, async (request, reply) => {
    const rule = await AutomationRule.findOne({
      where: { id: Number(request.params.ruleId), zone_id: Number(request.params.zoneId) }
    });
    if (!rule) {
      return reply.code(404).send({
        success: false,
        error: { code: 'RULE_NOT_FOUND', message: `Automation rule ${request.params.ruleId} not found`, statusCode: 404 }
      });
    }

    const body = request.body || {};
    rule.is_active = body.is_active !== undefined ? Boolean(body.is_active) : !Boolean(rule.is_active);
    await rule.save();

    return reply.send({
      success: true,
      data: { rule: serializeRule(rule) }
    });
  });
}

module.exports = ruleRoutes;

const {
  sequelize,
  Sequelize,
  Garden,
  Zone,
  ZonePlant,
  CareTask,
  WaterUsageLog,
  User
} = require('../models');
const { Op } = Sequelize;
const eventBus = require('./eventBus');
const { getLocalDateString, addDaysToIsoDate } = require('../utils/dbHelpers');

const VALID_TASK_TYPES = ['WATER', 'FERTILIZE', 'PRUNE', 'REPOT', 'HARVEST', 'PEST_INSPECTION'];
const VALID_SOURCES = ['MANUAL', 'CARE_PLAN', 'RULE_ENGINE'];
const VALID_IRRIGATION_METHODS = ['MANUAL_HOSE', 'DRIP_IRRIGATION', 'SPRINKLER', 'WATERING_CAN', 'AUTOMATED_VALVE'];
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function createHttpError(statusCode, code, message, details = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

function isValidIsoDate(val) {
  if (!val || typeof val !== 'string' || !ISO_DATE_RE.test(val)) return false;
  const [y, m, d] = val.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function serializeTask(taskInstance, extra = {}) {
  const raw = taskInstance && taskInstance.toJSON ? taskInstance.toJSON() : { ...taskInstance };
  return {
    ...raw,
    is_completed: Boolean(raw.is_completed),
    recurrence_days: raw.recurrence_days !== null && raw.recurrence_days !== undefined ? Number(raw.recurrence_days) : null,
    water_volume_liters: raw.water_volume_liters !== null && raw.water_volume_liters !== undefined ? Number(raw.water_volume_liters) : null,
    ...extra
  };
}

function serializeWaterLog(logInstance, extra = {}) {
  const raw = logInstance && logInstance.toJSON ? logInstance.toJSON() : { ...logInstance };
  return {
    ...raw,
    liters_applied: raw.liters_applied !== null && raw.liters_applied !== undefined ? Number(raw.liters_applied) : 0,
    ...extra
  };
}

async function listZoneTasks(zoneId, query = {}) {
  const where = { zone_id: Number(zoneId) };

  if (query.is_completed !== undefined && query.is_completed !== '') {
    if (query.is_completed === true || query.is_completed === 'true' || query.is_completed === '1') {
      where.is_completed = true;
    } else if (query.is_completed === false || query.is_completed === 'false' || query.is_completed === '0') {
      where.is_completed = false;
    } else {
      throw createHttpError(400, 'INVALID_QUERY_PARAM', 'is_completed must be true or false.');
    }
  }

  if (query.due_before !== undefined && query.due_before !== '') {
    if (!isValidIsoDate(query.due_before)) {
      throw createHttpError(400, 'INVALID_QUERY_PARAM', 'due_before must be a valid YYYY-MM-DD date.');
    }
    where.due_date = { [Op.lte]: query.due_before };
  }

  const tasks = await CareTask.findAll({
    where,
    order: [['is_completed', 'ASC'], ['due_date', 'ASC'], ['id', 'ASC']]
  });

  return tasks.map((t) => serializeTask(t));
}

async function listGardenTasks(gardenId, query = {}) {
  const zones = await Zone.findAll({ where: { garden_id: Number(gardenId) } });
  if (!zones || zones.length === 0) {
    return [];
  }

  const zoneMap = new Map(zones.map((z) => [Number(z.id), z]));
  let targetZoneIds = zones.map((z) => Number(z.id));

  if (query.zone_id !== undefined && query.zone_id !== '') {
    const reqZoneId = Number(query.zone_id);
    if (!zoneMap.has(reqZoneId)) {
      return [];
    }
    targetZoneIds = [reqZoneId];
  }

  const where = targetZoneIds.length === 1
    ? { zone_id: targetZoneIds[0] }
    : { zone_id: { [Op.in]: targetZoneIds } };

  if (query.is_completed !== undefined && query.is_completed !== '') {
    if (query.is_completed === true || query.is_completed === 'true' || query.is_completed === '1') {
      where.is_completed = true;
    } else if (query.is_completed === false || query.is_completed === 'false' || query.is_completed === '0') {
      where.is_completed = false;
    } else {
      throw createHttpError(400, 'INVALID_QUERY_PARAM', 'is_completed must be true or false.');
    }
  }

  if (query.due_before !== undefined && query.due_before !== '') {
    if (!isValidIsoDate(query.due_before)) {
      throw createHttpError(400, 'INVALID_QUERY_PARAM', 'due_before must be a valid YYYY-MM-DD date.');
    }
    where.due_date = { [Op.lte]: query.due_before };
  }

  if (query.task_type) {
    if (!VALID_TASK_TYPES.includes(query.task_type)) {
      throw createHttpError(400, 'INVALID_QUERY_PARAM', `task_type must be one of: ${VALID_TASK_TYPES.join(', ')}`);
    }
    where.task_type = query.task_type;
  }

  if (query.assigned_to !== undefined && query.assigned_to !== '') {
    where.assigned_to = Number(query.assigned_to);
  }

  const tasks = await CareTask.findAll({
    where,
    order: [['is_completed', 'ASC'], ['due_date', 'ASC'], ['id', 'ASC']]
  });

  return tasks.map((t) => {
    const z = zoneMap.get(Number(t.zone_id));
    return serializeTask(t, { zone_name: z ? z.name : null });
  });
}

async function createTask(zoneId, payload = {}, actorUser = {}) {
  const zone = await Zone.findByPk(zoneId);
  if (!zone) {
    throw createHttpError(404, 'ZONE_NOT_FOUND', `Zone ${zoneId} not found`);
  }

  const task_type = payload.task_type || 'WATER';
  if (!VALID_TASK_TYPES.includes(task_type)) {
    throw createHttpError(400, 'INVALID_TASK_TYPE', `task_type must be one of: ${VALID_TASK_TYPES.join(', ')}`);
  }

  const due_date = payload.due_date;
  if (!isValidIsoDate(due_date)) {
    throw createHttpError(400, 'INVALID_DUE_DATE', 'due_date is required and must be YYYY-MM-DD.');
  }

  let recurrence_days = null;
  if (payload.recurrence_days !== undefined && payload.recurrence_days !== null && payload.recurrence_days !== '') {
    const rec = Number(payload.recurrence_days);
    if (!Number.isInteger(rec) || rec < 1) {
      throw createHttpError(400, 'INVALID_RECURRENCE', 'recurrence_days must be a positive integer.');
    }
    recurrence_days = rec;
  }

  const source = payload.source || 'MANUAL';
  if (!VALID_SOURCES.includes(source)) {
    throw createHttpError(400, 'INVALID_SOURCE', `source must be one of: ${VALID_SOURCES.join(', ')}`);
  }

  let zone_plant_id = null;
  if (payload.zone_plant_id !== undefined && payload.zone_plant_id !== null && payload.zone_plant_id !== '') {
    const plant = await ZonePlant.findOne({
      where: { id: Number(payload.zone_plant_id), zone_id: zone.id }
    });
    if (!plant) {
      throw createHttpError(404, 'PLANT_NOT_FOUND', `Plant ${payload.zone_plant_id} not found in zone ${zone.id}`);
    }
    zone_plant_id = plant.id;
  }

  let assigned_to = null;
  if (payload.assigned_to !== undefined && payload.assigned_to !== null && payload.assigned_to !== '') {
    const assignee = await User.findByPk(Number(payload.assigned_to));
    if (!assignee) {
      throw createHttpError(404, 'USER_NOT_FOUND', `Assigned user ${payload.assigned_to} not found.`);
    }
    assigned_to = assignee.id;
  }

  let water_volume_liters = null;
  if (payload.water_volume_liters !== undefined && payload.water_volume_liters !== null && payload.water_volume_liters !== '') {
    const vol = Number(payload.water_volume_liters);
    if (!Number.isFinite(vol) || vol < 0) {
      throw createHttpError(400, 'INVALID_WATER_VOLUME', 'water_volume_liters must be a non-negative number.');
    }
    water_volume_liters = vol;
  }

  const task = await CareTask.create({
    zone_id: zone.id,
    zone_plant_id,
    assigned_to,
    task_type,
    due_date,
    recurrence_days,
    is_completed: false,
    completed_at: null,
    completed_by: null,
    source,
    water_volume_liters,
    notes: payload.notes ? String(payload.notes).trim() : null
  });

  eventBus.emitEvent(zone.garden_id, 'TASK_UPDATED', {
    taskId: task.id,
    zoneId: zone.id,
    taskType: task.task_type,
    isCompleted: false,
    completedBy: null
  });

  return serializeTask(task);
}

async function updateOrCompleteTask(zoneId, taskId, payload = {}, actorUser = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const task = await CareTask.findOne({
    where: { id: Number(taskId), zone_id: Number(zoneId) }
  });
  if (!task) {
    throw createHttpError(404, 'TASK_NOT_FOUND', `Care task ${taskId} not found in zone ${zoneId}`);
  }

  const zone = await Zone.findByPk(zoneId);
  if (!zone) {
    throw createHttpError(404, 'ZONE_NOT_FOUND', `Zone ${zoneId} not found`);
  }
  const garden = await Garden.findByPk(zone.garden_id);

  if (payload.task_type !== undefined) {
    if (!VALID_TASK_TYPES.includes(payload.task_type)) {
      throw createHttpError(400, 'INVALID_TASK_TYPE', `task_type must be one of: ${VALID_TASK_TYPES.join(', ')}`);
    }
  }

  if (payload.due_date !== undefined) {
    if (!isValidIsoDate(payload.due_date)) {
      throw createHttpError(400, 'INVALID_DUE_DATE', 'due_date must be YYYY-MM-DD.');
    }
  }

  if (payload.recurrence_days !== undefined && payload.recurrence_days !== null && payload.recurrence_days !== '') {
    const rec = Number(payload.recurrence_days);
    if (!Number.isInteger(rec) || rec < 1) {
      throw createHttpError(400, 'INVALID_RECURRENCE', 'recurrence_days must be a positive integer.');
    }
  }

  let waterVolume = null;
  if (payload.water_volume_liters !== undefined && payload.water_volume_liters !== null && payload.water_volume_liters !== '') {
    const vol = Number(payload.water_volume_liters);
    if (!Number.isFinite(vol) || vol < 0) {
      throw createHttpError(400, 'INVALID_WATER_VOLUME', 'water_volume_liters must be a non-negative number.');
    }
    waterVolume = vol;
  }

  const irrigationMethod = payload.irrigation_method || 'MANUAL_HOSE';
  if (payload.irrigation_method !== undefined && !VALID_IRRIGATION_METHODS.includes(irrigationMethod)) {
    throw createHttpError(
      400,
      'INVALID_IRRIGATION_METHOD',
      `irrigation_method must be one of: ${VALID_IRRIGATION_METHODS.join(', ')}`
    );
  }

  if (payload.assigned_to !== undefined && payload.assigned_to !== null && payload.assigned_to !== '') {
    const assignee = await User.findByPk(Number(payload.assigned_to));
    if (!assignee) {
      throw createHttpError(404, 'USER_NOT_FOUND', `Assigned user ${payload.assigned_to} not found.`);
    }
  }

  const wasCompleted = Boolean(task.is_completed);
  const requestedComplete = payload.is_completed !== undefined ? Boolean(payload.is_completed) : wasCompleted;

  if (wasCompleted && payload.is_completed === true) {
    throw createHttpError(400, 'TASK_ALREADY_COMPLETED', 'Care task is already completed.');
  }

  let nextTask = null;
  let waterLog = null;

  await sequelize.transaction(async (t) => {
    if (payload.task_type !== undefined) task.task_type = payload.task_type;
    if (payload.due_date !== undefined) task.due_date = payload.due_date;
    if (payload.recurrence_days !== undefined) {
      task.recurrence_days = payload.recurrence_days === null || payload.recurrence_days === ''
        ? null
        : Number(payload.recurrence_days);
    }
    if (payload.assigned_to !== undefined) {
      task.assigned_to = payload.assigned_to === null || payload.assigned_to === '' ? null : Number(payload.assigned_to);
    }
    if (payload.notes !== undefined) {
      task.notes = payload.notes !== null ? String(payload.notes).trim() : null;
    }
    if (waterVolume !== null) {
      task.water_volume_liters = waterVolume;
    }

    if (!wasCompleted && requestedComplete) {
      task.is_completed = true;
      task.completed_at = now;
      task.completed_by = actorUser.id || null;

      await task.save({ transaction: t });

      const recDays = task.recurrence_days !== null && task.recurrence_days !== undefined
        ? Number(task.recurrence_days)
        : 0;
      if (recDays > 0) {
        const tz = (garden && garden.timezone) ? garden.timezone : 'UTC';
        const todayLocal = getLocalDateString(tz, now);
        const nextDueDate = addDaysToIsoDate(todayLocal, recDays);

        nextTask = await CareTask.create({
          zone_id: task.zone_id,
          zone_plant_id: task.zone_plant_id || null,
          assigned_to: task.assigned_to || null,
          task_type: task.task_type,
          due_date: nextDueDate,
          recurrence_days: recDays,
          is_completed: false,
          completed_at: null,
          completed_by: null,
          source: task.source || 'MANUAL',
          water_volume_liters: null,
          notes: task.notes || null
        }, { transaction: t });
      }

      if (task.task_type === 'WATER' && waterVolume !== null && waterVolume > 0) {
        waterLog = await WaterUsageLog.create({
          zone_id: task.zone_id,
          zone_plant_id: task.zone_plant_id || null,
          task_id: task.id,
          logged_by_user_id: actorUser.id || null,
          liters_applied: waterVolume,
          method: irrigationMethod,
          recorded_at: now,
          notes: payload.water_notes ? String(payload.water_notes).trim() : (task.notes || null)
        }, { transaction: t });
      }
    } else {
      if (wasCompleted && payload.is_completed === false) {
        task.is_completed = false;
        task.completed_at = null;
        task.completed_by = null;
      }
      await task.save({ transaction: t });
    }
  });

  eventBus.emitEvent(zone.garden_id, 'TASK_UPDATED', {
    taskId: task.id,
    zoneId: zone.id,
    taskType: task.task_type,
    isCompleted: Boolean(task.is_completed),
    completedBy: task.is_completed ? (actorUser.name || actorUser.email || null) : null,
    nextScheduledTaskId: nextTask ? nextTask.id : null
  });

  return {
    task: serializeTask(task, { next_scheduled_task_id: nextTask ? nextTask.id : null }),
    water_log: waterLog ? serializeWaterLog(waterLog) : null
  };
}

async function deleteTask(zoneId, taskId) {
  const task = await CareTask.findOne({
    where: { id: Number(taskId), zone_id: Number(zoneId) }
  });
  if (!task) {
    throw createHttpError(404, 'TASK_NOT_FOUND', `Care task ${taskId} not found in zone ${zoneId}`);
  }
  const zone = await Zone.findByPk(zoneId);
  await task.destroy();

  if (zone) {
    eventBus.emitEvent(zone.garden_id, 'TASK_UPDATED', {
      taskId: Number(taskId),
      zoneId: Number(zoneId),
      deleted: true
    });
  }

  return { message: 'Care task deleted.' };
}

async function createWaterLog(zoneId, payload = {}, actorUser = {}) {
  const zone = await Zone.findByPk(zoneId);
  if (!zone) {
    throw createHttpError(404, 'ZONE_NOT_FOUND', `Zone ${zoneId} not found`);
  }

  const liters = Number(payload.liters_applied);
  if (!Number.isFinite(liters) || liters <= 0) {
    throw createHttpError(400, 'INVALID_LITERS', 'liters_applied must be a positive number.');
  }

  const method = payload.method || 'MANUAL_HOSE';
  if (!VALID_IRRIGATION_METHODS.includes(method)) {
    throw createHttpError(
      400,
      'INVALID_IRRIGATION_METHOD',
      `method must be one of: ${VALID_IRRIGATION_METHODS.join(', ')}`
    );
  }

  let zone_plant_id = null;
  if (payload.zone_plant_id !== undefined && payload.zone_plant_id !== null && payload.zone_plant_id !== '') {
    const plant = await ZonePlant.findOne({
      where: { id: Number(payload.zone_plant_id), zone_id: zone.id }
    });
    if (!plant) {
      throw createHttpError(404, 'PLANT_NOT_FOUND', `Plant ${payload.zone_plant_id} not found in zone ${zone.id}`);
    }
    zone_plant_id = plant.id;
  }

  let task_id = null;
  if (payload.task_id !== undefined && payload.task_id !== null && payload.task_id !== '') {
    const task = await CareTask.findOne({
      where: { id: Number(payload.task_id), zone_id: zone.id }
    });
    if (!task) {
      throw createHttpError(404, 'TASK_NOT_FOUND', `Care task ${payload.task_id} not found in zone ${zone.id}`);
    }
    task_id = task.id;
  }

  let recorded_at = new Date();
  if (payload.recorded_at) {
    const parsed = new Date(payload.recorded_at);
    if (Number.isNaN(parsed.getTime())) {
      throw createHttpError(400, 'INVALID_RECORDED_AT', 'recorded_at must be a valid ISO timestamp.');
    }
    recorded_at = parsed;
  }

  const log = await WaterUsageLog.create({
    zone_id: zone.id,
    zone_plant_id,
    task_id,
    logged_by_user_id: actorUser.id || null,
    liters_applied: liters,
    method,
    recorded_at,
    notes: payload.notes ? String(payload.notes).trim().slice(0, 255) : null
  });

  return serializeWaterLog(log);
}

async function listGardenWaterLogs(gardenId, query = {}) {
  const zones = await Zone.findAll({ where: { garden_id: Number(gardenId) } });
  if (!zones || zones.length === 0) {
    return [];
  }

  const zoneMap = new Map(zones.map((z) => [Number(z.id), z]));
  let targetZoneIds = zones.map((z) => Number(z.id));
  if (query.zone_id !== undefined && query.zone_id !== '') {
    const reqZoneId = Number(query.zone_id);
    if (!zoneMap.has(reqZoneId)) return [];
    targetZoneIds = [reqZoneId];
  }

  const days = query.days !== undefined ? Number(query.days) : 30;
  if (!Number.isFinite(days) || days < 1 || days > 365) {
    throw createHttpError(400, 'INVALID_QUERY_PARAM', 'days must be between 1 and 365.');
  }

  const limit = query.limit !== undefined ? Number(query.limit) : 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    throw createHttpError(400, 'INVALID_QUERY_PARAM', 'limit must be an integer between 1 and 1000.');
  }

  const where = targetZoneIds.length === 1
    ? { zone_id: targetZoneIds[0] }
    : { zone_id: { [Op.in]: targetZoneIds } };

  const allLogs = await WaterUsageLog.findAll({
    where,
    order: [['recorded_at', 'DESC'], ['id', 'DESC']]
  });

  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const filtered = allLogs
    .filter((l) => new Date(l.recorded_at).getTime() >= cutoffMs)
    .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime() || b.id - a.id)
    .slice(0, limit);

  return filtered.map((l) => {
    const z = zoneMap.get(Number(l.zone_id));
    return serializeWaterLog(l, { zone_name: z ? z.name : null });
  });
}

module.exports = {
  VALID_TASK_TYPES,
  VALID_SOURCES,
  VALID_IRRIGATION_METHODS,
  listZoneTasks,
  listGardenTasks,
  createTask,
  updateOrCompleteTask,
  deleteTask,
  createWaterLog,
  listGardenWaterLogs,
  serializeTask,
  serializeWaterLog
};

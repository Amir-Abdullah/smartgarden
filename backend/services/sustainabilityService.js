const { Garden, Zone, WaterUsageLog, SustainabilityLog } = require('../models');
const { Op } = require('sequelize');

const VALID_LOG_TYPES = ['RAINWATER_HARVEST', 'COMPOST_ADDED', 'MULCH_SAVINGS', 'SOLAR_OFFSET'];

function createError(statusCode, code, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

function round(n, digits = 2) {
  const f = Math.pow(10, digits);
  return Math.round(Number(n || 0) * f) / f;
}

function deriveSavings(logType, quantity) {
  const q = Number(quantity || 0);
  switch (logType) {
    case 'RAINWATER_HARVEST':
      return { water_saved_l: round(q), co2_offset_kg: round(q * 0.002, 2), defaultUnit: 'liters' };
    case 'COMPOST_ADDED':
      return { water_saved_l: round(q * 4), co2_offset_kg: round(q * 1.8), defaultUnit: 'kg' };
    case 'MULCH_SAVINGS':
      return { water_saved_l: round(q * 12), co2_offset_kg: round(q * 0.45), defaultUnit: 'sq_m' };
    case 'SOLAR_OFFSET':
      return { water_saved_l: 0, co2_offset_kg: round(q * 0.7), defaultUnit: 'kWh' };
    default:
      return { water_saved_l: 0, co2_offset_kg: 0, defaultUnit: 'units' };
  }
}

async function getGardenSustainability(gardenId) {
  const garden = await Garden.findByPk(gardenId);
  if (!garden) {
    throw createError(404, 'GARDEN_NOT_FOUND', `Garden ${gardenId} not found.`);
  }

  const zones = await Zone.findAll({ where: { garden_id: garden.id }, attributes: ['id', 'name'] });
  const zoneIds = zones.map((z) => Number(z.id));
  const zoneNameById = new Map(zones.map((z) => [Number(z.id), z.name]));

  const [waterLogs, sustLogs] = await Promise.all([
    zoneIds.length > 0 ? WaterUsageLog.findAll({ where: { zone_id: { [Op.in]: zoneIds } } }) : [],
    SustainabilityLog.findAll({
      where: { garden_id: garden.id },
      order: [['recorded_date', 'DESC'], ['id', 'DESC']]
    })
  ]);

  let totalWaterAppliedL = 0;
  let efficientIrrigationL = 0;
  for (const w of waterLogs) {
    const liters = Number(w.liters_applied || 0);
    totalWaterAppliedL += liters;
    if (['DRIP_IRRIGATION', 'AUTOMATED_VALVE', 'WATERING_CAN'].includes(w.method)) {
      efficientIrrigationL += liters;
    }
  }

  // Overhead watering uses ~1.67x water of precision drip/can delivery -> 40% saved
  const dripSavingsL = round(efficientIrrigationL * (2 / 3));

  const byTypeMap = new Map(VALID_LOG_TYPES.map((t) => [t, { log_type: t, count: 0, quantity: 0, water_saved_l: 0, co2_offset_kg: 0 }]));
  let rainwaterHarvestedL = 0;
  let logWaterSavedL = 0;
  let totalCo2OffsetKg = 0;

  for (const log of sustLogs) {
    const q = Number(log.quantity || 0);
    const wSaved = Number(log.estimated_water_saved_l || 0);
    const co2 = Number(log.estimated_co2_offset_kg || 0);
    if (log.log_type === 'RAINWATER_HARVEST') {
      rainwaterHarvestedL += q;
    }
    logWaterSavedL += wSaved;
    totalCo2OffsetKg += co2;

    const bucket = byTypeMap.get(log.log_type);
    if (bucket) {
      bucket.count++;
      bucket.quantity = round(bucket.quantity + q);
      bucket.water_saved_l = round(bucket.water_saved_l + wSaved);
      bucket.co2_offset_kg = round(bucket.co2_offset_kg + co2);
    }
  }

  const totalWaterSavedL = round(dripSavingsL + logWaterSavedL);
  const precisionRatioPct = totalWaterAppliedL > 0 ? Math.round((efficientIrrigationL / totalWaterAppliedL) * 100) : 100;

  // Score from 0-100 across precision irrigation share + rainwater/compost/mulch practice depth
  const practicePoints = Math.min(50, sustLogs.length * 10 + Math.round(totalWaterSavedL / 25));
  const irrigationPoints = Math.round((precisionRatioPct / 100) * 50);
  const score = Math.min(100, Math.max(20, practicePoints + irrigationPoints));
  const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 68 ? 'B' : score >= 50 ? 'C' : 'D';

  return {
    garden: { id: Number(garden.id), name: garden.name },
    scorecard: {
      score,
      grade,
      total_water_applied_l: round(totalWaterAppliedL),
      drip_savings_l: dripSavingsL,
      rainwater_harvested_l: round(rainwaterHarvestedL),
      total_water_saved_l: totalWaterSavedL,
      total_co2_offset_kg: round(totalCo2OffsetKg),
      precision_irrigation_pct: precisionRatioPct
    },
    breakdown: Array.from(byTypeMap.values()),
    logs: sustLogs.map((l) => ({
      id: Number(l.id),
      garden_id: Number(l.garden_id),
      zone_id: l.zone_id ? Number(l.zone_id) : null,
      zone_name: l.zone_id ? zoneNameById.get(Number(l.zone_id)) || 'Zone' : 'Whole Garden',
      log_type: l.log_type,
      quantity: Number(l.quantity),
      unit: l.unit,
      estimated_water_saved_l: Number(l.estimated_water_saved_l),
      estimated_co2_offset_kg: Number(l.estimated_co2_offset_kg),
      recorded_date: String(l.recorded_date).slice(0, 10),
      notes: l.notes || null
    }))
  };
}

async function addSustainabilityLog(gardenId, userId, payload = {}) {
  const garden = await Garden.findByPk(gardenId);
  if (!garden) {
    throw createError(404, 'GARDEN_NOT_FOUND', `Garden ${gardenId} not found.`);
  }

  const logType = String(payload.log_type || '').trim().toUpperCase();
  if (!VALID_LOG_TYPES.includes(logType)) {
    throw createError(400, 'VALIDATION_ERROR', `log_type must be one of ${VALID_LOG_TYPES.join(', ')}.`);
  }

  const qty = Number(payload.quantity);
  if (!Number.isFinite(qty) || qty <= 0 || qty > 100000) {
    throw createError(400, 'VALIDATION_ERROR', 'quantity must be a positive finite number.');
  }

  let zoneId = null;
  if (payload.zone_id && payload.zone_id !== 'ALL' && payload.zone_id !== 'NONE') {
    const zone = await Zone.findOne({ where: { id: payload.zone_id, garden_id: garden.id } });
    if (!zone) {
      throw createError(404, 'ZONE_NOT_FOUND', `Zone ${payload.zone_id} not found in garden ${garden.id}.`);
    }
    zoneId = zone.id;
  }

  const derived = deriveSavings(logType, qty);
  const created = await SustainabilityLog.create({
    garden_id: garden.id,
    zone_id: zoneId,
    user_id: userId,
    log_type: logType,
    quantity: round(qty),
    unit: String(payload.unit || derived.defaultUnit).slice(0, 32),
    estimated_water_saved_l:
      payload.estimated_water_saved_l !== undefined ? round(payload.estimated_water_saved_l) : derived.water_saved_l,
    estimated_co2_offset_kg:
      payload.estimated_co2_offset_kg !== undefined ? round(payload.estimated_co2_offset_kg) : derived.co2_offset_kg,
    recorded_date: payload.recorded_date || new Date().toISOString().slice(0, 10),
    notes: payload.notes ? String(payload.notes).slice(0, 500) : null
  });

  return created;
}

async function deleteSustainabilityLog(gardenId, logId) {
  const row = await SustainabilityLog.findOne({ where: { id: logId, garden_id: gardenId } });
  if (!row) {
    throw createError(404, 'LOG_NOT_FOUND', `Sustainability log ${logId} not found.`);
  }
  await row.destroy();
  return { deleted: true, id: Number(logId) };
}

module.exports = {
  VALID_LOG_TYPES,
  getGardenSustainability,
  addSustainabilityLog,
  deleteSustainabilityLog
};

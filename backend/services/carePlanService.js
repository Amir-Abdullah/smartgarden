const {
  Garden,
  Zone,
  ZonePlant,
  PlantCatalog,
  CareTask
} = require('../models');
const eventBus = require('./eventBus');
const { getLocalDateString, addDaysToIsoDate } = require('../utils/dbHelpers');

const SOIL_WATER_MULTIPLIER = {
  SANDY: 0.75,
  CHALKY: 0.85,
  LOAM: 1.0,
  SILT: 1.1,
  PEAT: 1.15,
  CLAY: 1.3
};

const SUN_WATER_MULTIPLIER = {
  FULL_SUN: 0.85,
  PART_SHADE: 1.0,
  FULL_SHADE: 1.2
};

function createHttpError(statusCode, code, message, details = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

function buildCalibratedTasksForCrop(zone, garden, zonePlant, catalog, baseDateStr) {
  const soilType = String(zone.soil_type || 'LOAM').toUpperCase();
  const sunLevel = String(zone.sunlight_level || 'PART_SHADE').toUpperCase();
  const zoneType = String(zone.zone_type || 'OUTDOOR_BED').toUpperCase();

  const soilMult = SOIL_WATER_MULTIPLIER[soilType] ?? 1.0;
  const sunMult = SUN_WATER_MULTIPLIER[sunLevel] ?? 1.0;

  const baseWaterDays = Number(catalog.watering_freq_days || 3);
  const baseFertDays = Number(catalog.fertilizing_freq_days || 14);
  const basePruneDays = ['VEGETABLE', 'FRUIT'].includes(String(catalog.category || '').toUpperCase()) ? 10 : 14;

  const waterDays = zoneType === 'HYDROPONIC'
    ? 7
    : Math.max(1, Math.round(baseWaterDays * soilMult * sunMult));
  const fertilizeDays = Math.max(7, Math.round(baseFertDays * (soilType === 'SANDY' ? 0.85 : 1.0)));

  const spacing = Number(catalog.spacing_cm || 30);
  const rowSpacing = Number(catalog.row_spacing_cm || 45);
  const qty = Math.max(1, Number(zonePlant.quantity || 1));
  const footprintSqM = (spacing * rowSpacing) / 10000;
  const recommendedLiters = Math.max(1.0, Math.round(qty * footprintSqM * 18 * 10) / 10);

  const label = zonePlant.custom_nickname || catalog.common_name;
  const envNote = zoneType === 'HYDROPONIC'
    ? 'Hydroponic reservoir pH/EC balance check'
    : `Soil=${soilType} (x${soilMult}), Sun=${sunLevel} (x${sunMult})`;

  return [
    {
      zone_id: zone.id,
      zone_plant_id: zonePlant.id,
      crop_name: catalog.common_name,
      custom_nickname: label,
      task_type: 'WATER',
      due_date: addDaysToIsoDate(baseDateStr, 0),
      recurrence_days: waterDays,
      recommended_liters: recommendedLiters,
      calibration_factors: {
        base_days: baseWaterDays,
        soil_multiplier: soilMult,
        sun_multiplier: sunMult,
        zone_type: zoneType
      },
      notes: `[CarePlan] ${label}: water ${recommendedLiters}L every ${waterDays}d (${envNote}).`
    },
    {
      zone_id: zone.id,
      zone_plant_id: zonePlant.id,
      crop_name: catalog.common_name,
      custom_nickname: label,
      task_type: 'FERTILIZE',
      due_date: addDaysToIsoDate(baseDateStr, Math.min(3, Math.floor(fertilizeDays / 3))),
      recurrence_days: fertilizeDays,
      recommended_liters: null,
      calibration_factors: {
        base_days: baseFertDays,
        soil_multiplier: soilType === 'SANDY' ? 0.85 : 1.0,
        sun_multiplier: 1.0,
        zone_type: zoneType
      },
      notes: `[CarePlan] ${label}: feed balanced organic nutrients every ${fertilizeDays}d.`
    },
    {
      zone_id: zone.id,
      zone_plant_id: zonePlant.id,
      crop_name: catalog.common_name,
      custom_nickname: label,
      task_type: 'PRUNE',
      due_date: addDaysToIsoDate(baseDateStr, 5),
      recurrence_days: basePruneDays,
      recommended_liters: null,
      calibration_factors: {
        base_days: basePruneDays,
        soil_multiplier: 1.0,
        sun_multiplier: 1.0,
        zone_type: zoneType
      },
      notes: `[CarePlan] ${label}: inspect canopy, prune suckers/dead foliage every ${basePruneDays}d.`
    }
  ];
}

async function previewCarePlan(zoneId, options = {}) {
  const zone = await Zone.findByPk(zoneId);
  if (!zone) {
    throw createHttpError(404, 'ZONE_NOT_FOUND', `Zone ${zoneId} not found.`);
  }
  const garden = await Garden.findByPk(zone.garden_id);
  const timezone = (garden && garden.timezone) || 'UTC';
  const todayLocal = getLocalDateString(timezone);

  const zpWhere = { zone_id: zone.id };
  if (options.plantId) {
    zpWhere.id = Number(options.plantId);
  }
  const zonePlants = await ZonePlant.findAll({ where: zpWhere, order: [['id', 'ASC']] });
  if (options.plantId && zonePlants.length === 0) {
    throw createHttpError(404, 'PLANT_NOT_FOUND', `Plant ${options.plantId} not found in zone ${zone.id}.`);
  }

  const activePlants = zonePlants.filter((zp) => zp.status !== 'HARVESTED' && zp.status !== 'DEAD');
  const catalogList = await PlantCatalog.findAll();
  const catMap = new Map(catalogList.map((c) => [c.id, c]));

  const plannedTasks = [];
  for (const zp of activePlants) {
    const catalog = catMap.get(zp.plant_catalog_id);
    if (!catalog) continue;
    plannedTasks.push(...buildCalibratedTasksForCrop(zone, garden, zp, catalog, todayLocal));
  }

  return {
    zone: {
      id: zone.id,
      garden_id: zone.garden_id,
      name: zone.name,
      zone_type: zone.zone_type,
      soil_type: zone.soil_type,
      sunlight_level: zone.sunlight_level,
      is_outdoor: Boolean(zone.is_outdoor),
      soil_water_multiplier: SOIL_WATER_MULTIPLIER[String(zone.soil_type || 'LOAM').toUpperCase()] ?? 1.0,
      sun_water_multiplier: SUN_WATER_MULTIPLIER[String(zone.sunlight_level || 'PART_SHADE').toUpperCase()] ?? 1.0
    },
    timezone,
    active_plant_count: activePlants.length,
    planned_tasks: plannedTasks
  };
}

async function generateCarePlan(zoneId, options = {}, user = null) {
  const preview = await previewCarePlan(zoneId, options);
  const existingTasks = await CareTask.findAll({
    where: {
      zone_id: Number(zoneId),
      is_completed: false
    }
  });

  const createdTasks = [];
  const skippedExisting = [];

  for (const spec of preview.planned_tasks) {
    const duplicate = existingTasks.find((t) =>
      Number(t.zone_plant_id) === Number(spec.zone_plant_id) &&
      t.task_type === spec.task_type &&
      t.source === 'CARE_PLAN'
    );

    if (duplicate) {
      skippedExisting.push({
        id: duplicate.id,
        zone_plant_id: duplicate.zone_plant_id,
        task_type: duplicate.task_type,
        reason: 'ACTIVE_CARE_PLAN_TASK_EXISTS'
      });
      continue;
    }

    const created = await CareTask.create({
      zone_id: spec.zone_id,
      zone_plant_id: spec.zone_plant_id,
      assigned_to: user ? user.id : null,
      task_type: spec.task_type,
      due_date: spec.due_date,
      recurrence_days: spec.recurrence_days,
      is_completed: false,
      source: 'CARE_PLAN',
      water_volume_liters: spec.recommended_liters,
      notes: spec.notes
    });

    createdTasks.push(created.toJSON ? created.toJSON() : { ...created });
    existingTasks.push(created);

    eventBus.emitEvent(preview.zone.garden_id, 'TASK_UPDATED', {
      gardenId: preview.zone.garden_id,
      taskId: created.id,
      zoneId: created.zone_id,
      taskType: created.task_type,
      isCompleted: false,
      source: 'CARE_PLAN',
      timestamp: new Date().toISOString()
    });
  }

  return {
    zone: preview.zone,
    created_count: createdTasks.length,
    skipped_count: skippedExisting.length,
    created_tasks: createdTasks,
    skipped_existing: skippedExisting
  };
}

module.exports = {
  SOIL_WATER_MULTIPLIER,
  SUN_WATER_MULTIPLIER,
  previewCarePlan,
  generateCarePlan
};

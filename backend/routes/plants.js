const { Zone, ZonePlant, PlantCatalog } = require('../models');
const { verifyJwt } = require('../middleware/auth');
const { resolveGardenAndRole } = require('../middleware/rbac');

const VALID_PLANT_STATUSES = ['SEEDLING', 'GROWING', 'HARVEST_READY', 'HARVESTED', 'DEAD'];
const VALID_HEALTH_STATUSES = ['HEALTHY', 'NEEDS_ATTENTION', 'CRITICAL', 'DORMANT'];

function calculateZoneCapacity(zoneAreaSqM, zonePlants) {
  const area = Number(zoneAreaSqM || 0);
  if (!area || area <= 0) {
    return {
      zone_area_sq_m: 0.0,
      available_area_sq_m: 0.0,
      occupied_area_sq_m: 0.0,
      utilization_ratio: 0.0,
      status: 'OPTIMAL'
    };
  }

  const activePlants = (zonePlants || []).filter(zp => {
    const st = zp.status || 'GROWING';
    return st !== 'HARVESTED' && st !== 'DEAD';
  });

  const occupiedArea = activePlants.reduce((acc, zp) => {
    const catalog = zp.catalogPlant || zp.plant || {};
    const spacing = Number(catalog.spacing_cm || zp.spacing_cm || 30);
    const rowSpacing = Number(catalog.row_spacing_cm || zp.row_spacing_cm || 45);
    const footprintSqM = (spacing * rowSpacing) / 10000;
    return acc + (Number(zp.quantity || 0) * footprintSqM);
  }, 0);

  if (occupiedArea <= 0) {
    return {
      zone_area_sq_m: area,
      available_area_sq_m: area,
      occupied_area_sq_m: 0.0,
      utilization_ratio: 0.0,
      status: 'OPTIMAL'
    };
  }

  const ratio = Math.round((occupiedArea / area) * 100) / 100;
  let status = 'OPTIMAL';
  if (ratio > 1.00) {
    status = 'OVERCROWDED';
  } else if (ratio > 0.85) {
    status = 'DENSE';
  }

  return {
    zone_area_sq_m: area,
    available_area_sq_m: area,
    occupied_area_sq_m: Math.round(occupiedArea * 100) / 100,
    utilization_ratio: ratio,
    status
  };
}

function enrichZonePlant(zpInstance) {
  const raw = zpInstance.toJSON ? zpInstance.toJSON() : { ...zpInstance };
  const catalog = raw.catalogPlant || {};

  let daysSincePlanted = 0;
  if (raw.planted_date) {
    const plantedMs = new Date(raw.planted_date).getTime();
    if (!isNaN(plantedMs)) {
      daysSincePlanted = Math.max(0, Math.floor((Date.now() - plantedMs) / 86400000));
    }
  }

  let daysUntilHarvest = null;
  if (raw.expected_harvest_date) {
    const harvestMs = new Date(raw.expected_harvest_date).getTime();
    if (!isNaN(harvestMs)) {
      daysUntilHarvest = Math.ceil((harvestMs - Date.now()) / 86400000);
    }
  }

  return {
    ...raw,
    common_name: catalog.common_name || raw.common_name || null,
    scientific_name: catalog.scientific_name || raw.scientific_name || null,
    category: catalog.category || raw.category || null,
    spacing_cm: catalog.spacing_cm || raw.spacing_cm || 30,
    row_spacing_cm: catalog.row_spacing_cm || raw.row_spacing_cm || 45,
    days_since_planted: daysSincePlanted,
    days_until_harvest: daysUntilHarvest
  };
}

function evaluateZoneCompanions(zonePlants) {
  const goodMatches = [];
  const badMatches = [];
  const processedPairs = new Set();

  const active = (zonePlants || []).filter(zp => zp.status !== 'HARVESTED' && zp.status !== 'DEAD');

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const catA = active[i].catalogPlant || {};
      const catB = active[j].catalogPlant || {};
      const nameA = catA.common_name;
      const nameB = catB.common_name;
      if (!nameA || !nameB || nameA === nameB) continue;

      const pairKey = [active[i].plant_catalog_id, active[j].plant_catalog_id].sort().join('-');
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      const goodA = Array.isArray(catA.good_companions) ? catA.good_companions : [];
      const goodB = Array.isArray(catB.good_companions) ? catB.good_companions : [];
      const badA = Array.isArray(catA.bad_companions) ? catA.bad_companions : [];
      const badB = Array.isArray(catB.bad_companions) ? catB.bad_companions : [];

      if (goodA.includes(nameB) || goodB.includes(nameA)) {
        goodMatches.push({
          plantA: nameA,
          plantB: nameB,
          reason: `${nameA} and ${nameB} are mutually beneficial companions.`
        });
      }

      if (badA.includes(nameB) || badB.includes(nameA)) {
        badMatches.push({
          plantA: nameA,
          plantB: nameB,
          reason: `${nameA} and ${nameB} exhibit antagonistic growth or shared pest risk.`
        });
      }
    }
  }

  const rawScore = 70 + (10 * goodMatches.length) - (25 * badMatches.length);
  const overallCompatibilityScore = Math.max(0, Math.min(100, rawScore));

  return {
    synergies: goodMatches,
    conflicts: badMatches,
    overallCompatibilityScore
  };
}

async function plantRoutes(fastify, options) {
  // GET /api/zones/:zoneId/plants
  fastify.get('/:zoneId/plants', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const zone = await Zone.findByPk(request.params.zoneId);
    if (!zone) {
      return reply.code(404).send({
        success: false,
        error: { code: 'ZONE_NOT_FOUND', message: `Zone ${request.params.zoneId} not found`, statusCode: 404 }
      });
    }

    const rawPlants = await ZonePlant.findAll({
      where: { zone_id: zone.id },
      include: [{ model: PlantCatalog, as: 'catalogPlant' }],
      order: [['id', 'ASC']]
    });

    const plants = rawPlants.map(zp => enrichZonePlant(zp));
    const zoneUtilization = calculateZoneCapacity(zone.area_sq_m, rawPlants);
    const companionAnalysis = evaluateZoneCompanions(rawPlants);

    return reply.send({
      success: true,
      data: {
        plants,
        zone_utilization: zoneUtilization,
        companion_analysis: companionAnalysis
      }
    });
  });

  // POST /api/zones/:zoneId/plants
  fastify.post('/:zoneId/plants', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY'])]
  }, async (request, reply) => {
    const zone = await Zone.findByPk(request.params.zoneId);
    if (!zone) {
      return reply.code(404).send({
        success: false,
        error: { code: 'ZONE_NOT_FOUND', message: `Zone ${request.params.zoneId} not found`, statusCode: 404 }
      });
    }

    const body = request.body || {};
    const catalogId = body.plant_catalog_id !== undefined ? body.plant_catalog_id : body.catalog_plant_id;
    const {
      custom_nickname = null,
      quantity = 1,
      planted_date,
      expected_harvest_date = null,
      status = 'GROWING',
      health_status = 'HEALTHY',
      notes = null
    } = body;

    if (!catalogId) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'MISSING_CATALOG_PLANT_ID',
          message: 'plant_catalog_id (or catalog_plant_id) is required.',
          statusCode: 400
        }
      });
    }

    const catalogPlant = await PlantCatalog.findByPk(catalogId);
    if (!catalogPlant) {
      return reply.code(404).send({
        success: false,
        error: {
          code: 'CATALOG_PLANT_NOT_FOUND',
          message: `Plant catalog entry ${catalogId} not found.`,
          statusCode: 404
        }
      });
    }

    const parsedQty = Number(quantity);
    if (isNaN(parsedQty) || parsedQty < 1 || !Number.isInteger(parsedQty)) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'INVALID_QUANTITY',
          message: 'Quantity must be a positive integer (>= 1).',
          statusCode: 400
        }
      });
    }

    if (!VALID_PLANT_STATUSES.includes(status)) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'INVALID_PLANT_STATUS',
          message: `status must be one of: ${VALID_PLANT_STATUSES.join(', ')}`,
          statusCode: 400
        }
      });
    }

    if (!VALID_HEALTH_STATUSES.includes(health_status)) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'INVALID_HEALTH_STATUS',
          message: `health_status must be one of: ${VALID_HEALTH_STATUSES.join(', ')}`,
          statusCode: 400
        }
      });
    }

    const effectivePlantedDate = planted_date || new Date().toISOString().slice(0, 10);

    const created = await ZonePlant.create({
      zone_id: zone.id,
      plant_catalog_id: catalogPlant.id,
      custom_nickname: custom_nickname ? String(custom_nickname).trim() : null,
      quantity: parsedQty,
      planted_date: effectivePlantedDate,
      expected_harvest_date: expected_harvest_date || null,
      status,
      health_status,
      notes: notes ? String(notes).trim() : null
    });

    const createdWithCatalog = await ZonePlant.findByPk(created.id, {
      include: [{ model: PlantCatalog, as: 'catalogPlant' }]
    });

    const allZonePlants = await ZonePlant.findAll({
      where: { zone_id: zone.id },
      include: [{ model: PlantCatalog, as: 'catalogPlant' }]
    });

    const utilization = calculateZoneCapacity(zone.area_sq_m, allZonePlants);
    const enriched = enrichZonePlant(createdWithCatalog || created);
    const isOvercrowded = utilization.status === 'OVERCROWDED';

    return reply.code(201).send({
      success: true,
      data: {
        zone_plant: enriched,
        zonePlant: enriched
      },
      meta: {
        warning: isOvercrowded ? 'ZONE_OVERCROWDED' : null,
        message: isOvercrowded
          ? `Zone capacity exceeded (${Math.round(utilization.utilization_ratio * 100)}%). High risk of stunted growth and fungal blight.`
          : null,
        utilization_ratio: utilization.utilization_ratio,
        occupied_area_sq_m: utilization.occupied_area_sq_m,
        available_area_sq_m: utilization.available_area_sq_m
      }
    });
  });

  // PUT /api/zones/:zoneId/plants/:plantId
  fastify.put('/:zoneId/plants/:plantId', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY'])]
  }, async (request, reply) => {
    const { zoneId, plantId } = request.params;
    const zone = await Zone.findByPk(zoneId);
    if (!zone) {
      return reply.code(404).send({
        success: false,
        error: { code: 'ZONE_NOT_FOUND', message: `Zone ${zoneId} not found`, statusCode: 404 }
      });
    }

    const zonePlant = await ZonePlant.findOne({
      where: { id: plantId, zone_id: zone.id }
    });
    if (!zonePlant) {
      return reply.code(404).send({
        success: false,
        error: { code: 'PLANT_NOT_FOUND', message: `Plant ${plantId} not found in zone ${zoneId}`, statusCode: 404 }
      });
    }

    const body = request.body || {};

    if (body.quantity !== undefined) {
      const parsedQty = Number(body.quantity);
      if (isNaN(parsedQty) || parsedQty < 1 || !Number.isInteger(parsedQty)) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'INVALID_QUANTITY',
            message: 'Quantity must be a positive integer (>= 1).',
            statusCode: 400
          }
        });
      }
      zonePlant.quantity = parsedQty;
    }

    if (body.status !== undefined) {
      if (!VALID_PLANT_STATUSES.includes(body.status)) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'INVALID_PLANT_STATUS',
            message: `status must be one of: ${VALID_PLANT_STATUSES.join(', ')}`,
            statusCode: 400
          }
        });
      }
      zonePlant.status = body.status;
    }

    if (body.health_status !== undefined) {
      if (!VALID_HEALTH_STATUSES.includes(body.health_status)) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'INVALID_HEALTH_STATUS',
            message: `health_status must be one of: ${VALID_HEALTH_STATUSES.join(', ')}`,
            statusCode: 400
          }
        });
      }
      zonePlant.health_status = body.health_status;
    }

    if (body.custom_nickname !== undefined) {
      zonePlant.custom_nickname = body.custom_nickname ? String(body.custom_nickname).trim() : null;
    }
    if (body.planted_date !== undefined) {
      zonePlant.planted_date = body.planted_date;
    }
    if (body.expected_harvest_date !== undefined) {
      zonePlant.expected_harvest_date = body.expected_harvest_date || null;
    }
    if (body.notes !== undefined) {
      zonePlant.notes = body.notes ? String(body.notes).trim() : null;
    }

    await zonePlant.save();

    const updatedWithCatalog = await ZonePlant.findByPk(zonePlant.id, {
      include: [{ model: PlantCatalog, as: 'catalogPlant' }]
    });

    const allZonePlants = await ZonePlant.findAll({
      where: { zone_id: zone.id },
      include: [{ model: PlantCatalog, as: 'catalogPlant' }]
    });

    const utilization = calculateZoneCapacity(zone.area_sq_m, allZonePlants);
    const enriched = enrichZonePlant(updatedWithCatalog || zonePlant);
    const isOvercrowded = utilization.status === 'OVERCROWDED';

    return reply.send({
      success: true,
      data: {
        zone_plant: enriched,
        zonePlant: enriched
      },
      meta: {
        warning: isOvercrowded ? 'ZONE_OVERCROWDED' : null,
        message: isOvercrowded
          ? `Zone capacity exceeded (${Math.round(utilization.utilization_ratio * 100)}%). High risk of stunted growth and fungal blight.`
          : null,
        utilization_ratio: utilization.utilization_ratio,
        occupied_area_sq_m: utilization.occupied_area_sq_m,
        available_area_sq_m: utilization.available_area_sq_m
      }
    });
  });

  // DELETE /api/zones/:zoneId/plants/:plantId
  fastify.delete('/:zoneId/plants/:plantId', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY'])]
  }, async (request, reply) => {
    const { zoneId, plantId } = request.params;
    const zonePlant = await ZonePlant.findOne({
      where: { id: plantId, zone_id: zoneId }
    });
    if (!zonePlant) {
      return reply.code(404).send({
        success: false,
        error: { code: 'PLANT_NOT_FOUND', message: `Plant ${plantId} not found in zone ${zoneId}`, statusCode: 404 }
      });
    }

    await zonePlant.destroy();

    return reply.send({
      success: true,
      data: {
        message: 'Plant removed from zone inventory.'
      }
    });
  });
}

plantRoutes.calculateZoneCapacity = calculateZoneCapacity;
plantRoutes.enrichZonePlant = enrichZonePlant;
plantRoutes.evaluateZoneCompanions = evaluateZoneCompanions;

module.exports = plantRoutes;

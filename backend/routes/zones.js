const { Zone, ZonePlant, PlantCatalog } = require('../models');
const { verifyJwt } = require('../middleware/auth');
const { resolveGardenAndRole } = require('../middleware/rbac');
const { calculateZoneCapacity, enrichZonePlant } = require('./plants');

const VALID_ZONE_TYPES = ['OUTDOOR_BED', 'RAISED_BED', 'GREENHOUSE', 'INDOOR_POTS', 'HYDROPONIC'];
const VALID_SOIL_TYPES = ['LOAM', 'CLAY', 'SANDY', 'SILT', 'PEAT', 'CHALKY'];
const VALID_SUNLIGHT_LEVELS = ['FULL_SUN', 'PART_SHADE', 'FULL_SHADE'];

function normalizeZoneJson(zoneInstance, extra = {}) {
  const raw = zoneInstance.toJSON ? zoneInstance.toJSON() : { ...zoneInstance };
  return {
    ...raw,
    is_outdoor: Boolean(raw.is_outdoor),
    area_sq_m: raw.area_sq_m !== null && raw.area_sq_m !== undefined ? Number(raw.area_sq_m) : 0,
    ...extra
  };
}

async function zoneRoutes(fastify, options) {
  // GET /api/zones/:id
  fastify.get('/:id', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const zone = await Zone.findByPk(request.params.id);
    if (!zone) {
      return reply.code(404).send({
        success: false,
        error: { code: 'ZONE_NOT_FOUND', message: `Zone ${request.params.id} not found`, statusCode: 404 }
      });
    }

    const rawPlants = await ZonePlant.findAll({
      where: { zone_id: zone.id },
      include: [{ model: PlantCatalog, as: 'catalogPlant' }],
      order: [['id', 'ASC']]
    });

    const plants = rawPlants.map(zp => enrichZonePlant(zp));
    const zoneUtilization = calculateZoneCapacity(zone.area_sq_m, rawPlants);

    return reply.send({
      success: true,
      data: {
        zone: normalizeZoneJson(zone, { plant_count: plants.length }),
        plants,
        active_devices: [],
        zone_utilization: zoneUtilization
      }
    });
  });

  // PUT /api/zones/:id
  fastify.put('/:id', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY'])]
  }, async (request, reply) => {
    const zone = await Zone.findByPk(request.params.id);
    if (!zone) {
      return reply.code(404).send({
        success: false,
        error: { code: 'ZONE_NOT_FOUND', message: `Zone ${request.params.id} not found`, statusCode: 404 }
      });
    }

    const {
      name,
      is_outdoor,
      zone_type,
      soil_type,
      sunlight_level,
      area_sq_m,
      dimensions_description
    } = request.body || {};

    if (name !== undefined) {
      if (!name || typeof name !== 'string' || !name.trim()) {
        return reply.code(400).send({
          success: false,
          error: { code: 'INVALID_ZONE_NAME', message: 'Zone name cannot be empty.', statusCode: 400 }
        });
      }
      zone.name = name.trim();
    }

    if (is_outdoor !== undefined) {
      zone.is_outdoor = Boolean(is_outdoor);
    }

    if (zone_type !== undefined) {
      if (!VALID_ZONE_TYPES.includes(zone_type)) {
        return reply.code(400).send({
          success: false,
          error: { code: 'INVALID_ZONE_TYPE', message: `zone_type must be one of: ${VALID_ZONE_TYPES.join(', ')}`, statusCode: 400 }
        });
      }
      zone.zone_type = zone_type;
    }

    if (soil_type !== undefined) {
      if (!VALID_SOIL_TYPES.includes(soil_type)) {
        return reply.code(400).send({
          success: false,
          error: { code: 'INVALID_SOIL_TYPE', message: `soil_type must be one of: ${VALID_SOIL_TYPES.join(', ')}`, statusCode: 400 }
        });
      }
      zone.soil_type = soil_type;
    }

    if (sunlight_level !== undefined) {
      if (!VALID_SUNLIGHT_LEVELS.includes(sunlight_level)) {
        return reply.code(400).send({
          success: false,
          error: { code: 'INVALID_SUNLIGHT_LEVEL', message: `sunlight_level must be one of: ${VALID_SUNLIGHT_LEVELS.join(', ')}`, statusCode: 400 }
        });
      }
      zone.sunlight_level = sunlight_level;
    }

    if (area_sq_m !== undefined) {
      if (area_sq_m !== null && (isNaN(Number(area_sq_m)) || Number(area_sq_m) < 0)) {
        return reply.code(400).send({
          success: false,
          error: { code: 'INVALID_AREA', message: 'Zone area_sq_m must be a non-negative number.', statusCode: 400 }
        });
      }
      zone.area_sq_m = area_sq_m !== null ? Number(area_sq_m) : 0;
    }

    if (dimensions_description !== undefined) {
      zone.dimensions_description = dimensions_description ? String(dimensions_description).trim() : null;
    }

    await zone.save();

    return reply.send({
      success: true,
      data: {
        zone: normalizeZoneJson(zone)
      }
    });
  });

  // DELETE /api/zones/:id
  fastify.delete('/:id', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER'])]
  }, async (request, reply) => {
    const zone = await Zone.findByPk(request.params.id);
    if (!zone) {
      return reply.code(404).send({
        success: false,
        error: { code: 'ZONE_NOT_FOUND', message: `Zone ${request.params.id} not found`, statusCode: 404 }
      });
    }

    await ZonePlant.destroy({ where: { zone_id: zone.id } });
    await zone.destroy();

    return reply.send({
      success: true,
      data: { message: 'Zone and child inventory removed.' }
    });
  });
}

module.exports = zoneRoutes;

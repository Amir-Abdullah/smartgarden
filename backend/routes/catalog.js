const { Op } = require('sequelize');
const { PlantCatalog, ZonePlant } = require('../models');
const { verifyJwt, checkAdmin } = require('../middleware/auth');

const VALID_CATEGORIES = ['VEGETABLE', 'HERB', 'FRUIT', 'FLOWER', 'FOLIAGE', 'SUCCULENT', 'TREE'];
const VALID_SUNLIGHT = ['FULL_SUN', 'PART_SHADE', 'FULL_SHADE'];

async function catalogRoutes(fastify, options) {
  // GET /api/catalog
  fastify.get('/', {
    preHandler: [verifyJwt]
  }, async (request, reply) => {
    const {
      q,
      category,
      sunlight,
      watering,
      page = 1,
      limit = 20
    } = request.query || {};

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (parsedPage - 1) * parsedLimit;

    const where = {};

    if (category && typeof category === 'string' && category.trim()) {
      const upperCat = category.trim().toUpperCase();
      if (!VALID_CATEGORIES.includes(upperCat)) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'INVALID_CATEGORY',
            message: `category must be one of: ${VALID_CATEGORIES.join(', ')}`,
            statusCode: 400
          }
        });
      }
      where.category = upperCat;
    }

    if (sunlight && typeof sunlight === 'string' && sunlight.trim()) {
      const upperSun = sunlight.trim().toUpperCase();
      if (!VALID_SUNLIGHT.includes(upperSun)) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'INVALID_SUNLIGHT',
            message: `sunlight must be one of: ${VALID_SUNLIGHT.join(', ')}`,
            statusCode: 400
          }
        });
      }
      where.sunlight_req = upperSun;
    }

    if (watering !== undefined && watering !== null && watering !== '') {
      const parsedWatering = parseInt(watering, 10);
      if (!isNaN(parsedWatering) && parsedWatering > 0) {
        where.watering_freq_days = parsedWatering;
      }
    }

    if (q && typeof q === 'string' && q.trim()) {
      const term = `%${q.trim()}%`;
      where[Op.or] = [
        { common_name: { [Op.like]: term } },
        { scientific_name: { [Op.like]: term } }
      ];
    }

    const total = await PlantCatalog.count({ where });
    const rows = await PlantCatalog.findAll({
      where,
      order: [['common_name', 'ASC']],
      limit: parsedLimit,
      offset
    });

    const totalPages = Math.max(1, Math.ceil(total / parsedLimit));
    const plants = rows.map(r => r.toJSON());

    return reply.send({
      success: true,
      data: {
        plants,
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages
      },
      meta: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages
      }
    });
  });

  // GET /api/catalog/:id
  fastify.get('/:id', {
    preHandler: [verifyJwt]
  }, async (request, reply) => {
    const plant = await PlantCatalog.findByPk(request.params.id);
    if (!plant) {
      return reply.code(404).send({
        success: false,
        error: {
          code: 'CATALOG_PLANT_NOT_FOUND',
          message: 'Plant catalog entry not found.',
          statusCode: 404
        }
      });
    }

    return reply.send({
      success: true,
      data: {
        plant: plant.toJSON()
      }
    });
  });

  // POST /api/catalog (Admin only)
  fastify.post('/', {
    preHandler: [verifyJwt, checkAdmin]
  }, async (request, reply) => {
    const {
      scientific_name,
      common_name,
      category = 'VEGETABLE',
      description = null,
      sunlight_req = 'FULL_SUN',
      ideal_moisture_min = 40,
      ideal_moisture_max = 70,
      ideal_temp_min = 15,
      ideal_temp_max = 28,
      watering_freq_days = 3,
      fertilizing_freq_days = 14,
      soil_pref = 'Well-draining, nutrient-rich loam',
      spacing_cm = 30,
      row_spacing_cm = 45,
      spread_radius_cm = 20,
      min_soil_depth_cm = 25,
      planting_months = [3, 4, 5],
      harvest_months = [7, 8, 9],
      good_companions = [],
      bad_companions = [],
      image_url = null
    } = request.body || {};

    if (!scientific_name || typeof scientific_name !== 'string' || !scientific_name.trim() ||
      !common_name || typeof common_name !== 'string' || !common_name.trim()) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'scientific_name and common_name are required.',
          statusCode: 400
        }
      });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'INVALID_CATEGORY',
          message: `category must be one of: ${VALID_CATEGORIES.join(', ')}`,
          statusCode: 400
        }
      });
    }

    if (!VALID_SUNLIGHT.includes(sunlight_req)) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'INVALID_SUNLIGHT',
          message: `sunlight_req must be one of: ${VALID_SUNLIGHT.join(', ')}`,
          statusCode: 400
        }
      });
    }

    const existing = await PlantCatalog.findOne({ where: { scientific_name: scientific_name.trim() } });
    if (existing) {
      return reply.code(409).send({
        success: false,
        error: {
          code: 'PLANT_ALREADY_EXISTS',
          message: `A catalog entry with scientific name '${scientific_name.trim()}' already exists.`,
          statusCode: 409
        }
      });
    }

    const plant = await PlantCatalog.create({
      scientific_name: scientific_name.trim(),
      common_name: common_name.trim(),
      category,
      description,
      sunlight_req,
      ideal_moisture_min: Number(ideal_moisture_min),
      ideal_moisture_max: Number(ideal_moisture_max),
      ideal_temp_min: Number(ideal_temp_min),
      ideal_temp_max: Number(ideal_temp_max),
      watering_freq_days: Number(watering_freq_days),
      fertilizing_freq_days: Number(fertilizing_freq_days),
      soil_pref,
      spacing_cm: Number(spacing_cm),
      row_spacing_cm: Number(row_spacing_cm),
      spread_radius_cm: Number(spread_radius_cm),
      min_soil_depth_cm: Number(min_soil_depth_cm),
      planting_months: Array.isArray(planting_months) ? planting_months : [3, 4, 5],
      harvest_months: Array.isArray(harvest_months) ? harvest_months : [7, 8, 9],
      good_companions: Array.isArray(good_companions) ? good_companions : [],
      bad_companions: Array.isArray(bad_companions) ? bad_companions : [],
      image_url
    });

    return reply.code(201).send({
      success: true,
      data: {
        plant: plant.toJSON()
      }
    });
  });

  // PUT /api/catalog/:id (Admin only)
  fastify.put('/:id', {
    preHandler: [verifyJwt, checkAdmin]
  }, async (request, reply) => {
    const plant = await PlantCatalog.findByPk(request.params.id);
    if (!plant) {
      return reply.code(404).send({
        success: false,
        error: {
          code: 'CATALOG_PLANT_NOT_FOUND',
          message: 'Plant catalog entry not found.',
          statusCode: 404
        }
      });
    }

    const body = request.body || {};
    const updatableFields = [
      'scientific_name', 'common_name', 'category', 'description', 'sunlight_req',
      'ideal_moisture_min', 'ideal_moisture_max', 'ideal_temp_min', 'ideal_temp_max',
      'watering_freq_days', 'fertilizing_freq_days', 'soil_pref',
      'spacing_cm', 'row_spacing_cm', 'spread_radius_cm', 'min_soil_depth_cm',
      'planting_months', 'harvest_months', 'good_companions', 'bad_companions', 'image_url'
    ];

    for (const key of updatableFields) {
      if (body[key] !== undefined) {
        plant[key] = body[key];
      }
    }

    await plant.save();

    return reply.send({
      success: true,
      data: {
        plant: plant.toJSON()
      }
    });
  });

  // DELETE /api/catalog/:id (Admin only)
  fastify.delete('/:id', {
    preHandler: [verifyJwt, checkAdmin]
  }, async (request, reply) => {
    const plant = await PlantCatalog.findByPk(request.params.id);
    if (!plant) {
      return reply.code(404).send({
        success: false,
        error: {
          code: 'CATALOG_PLANT_NOT_FOUND',
          message: 'Plant catalog entry not found.',
          statusCode: 404
        }
      });
    }

    const activeCount = await ZonePlant.count({ where: { plant_catalog_id: plant.id } });
    if (activeCount > 0) {
      return reply.code(409).send({
        success: false,
        error: {
          code: 'CANNOT_DELETE_ACTIVE_PLANT',
          message: 'Cannot delete plant species referenced in active garden zone inventory.',
          statusCode: 409
        }
      });
    }

    await plant.destroy();

    return reply.send({
      success: true,
      data: {
        message: 'Catalog plant record deleted successfully.'
      }
    });
  });
}

module.exports = catalogRoutes;

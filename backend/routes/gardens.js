const crypto = require('node:crypto');
const { Op } = require('sequelize');
const { sequelize, Garden, GardenMember, GardenInvitation, Zone, ZonePlant, PlantCatalog, User } = require('../models');
const { verifyJwt } = require('../middleware/auth');
const { resolveGardenAndRole } = require('../middleware/rbac');

const VALID_ZONE_TYPES = ['OUTDOOR_BED', 'RAISED_BED', 'GREENHOUSE', 'INDOOR_POTS', 'HYDROPONIC'];
const VALID_SOIL_TYPES = ['LOAM', 'CLAY', 'SANDY', 'SILT', 'PEAT', 'CHALKY'];
const VALID_SUNLIGHT_LEVELS = ['FULL_SUN', 'PART_SHADE', 'FULL_SHADE'];

function isValidTimezone(tz) {
  if (!tz || typeof tz !== 'string' || !tz.trim()) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch (err) {
    return false;
  }
}

function normalizeZoneJson(zoneInstance, extra = {}) {
  const raw = zoneInstance.toJSON ? zoneInstance.toJSON() : { ...zoneInstance };
  return {
    ...raw,
    is_outdoor: Boolean(raw.is_outdoor),
    area_sq_m: raw.area_sq_m !== null && raw.area_sq_m !== undefined ? Number(raw.area_sq_m) : 0,
    ...extra
  };
}

function normalizeGardenJson(gardenInstance, extra = {}) {
  const raw = gardenInstance.toJSON ? gardenInstance.toJSON() : { ...gardenInstance };
  return {
    ...raw,
    area_sq_m: raw.area_sq_m !== null && raw.area_sq_m !== undefined ? Number(raw.area_sq_m) : 0,
    latitude: raw.latitude !== null && raw.latitude !== undefined ? Number(raw.latitude) : null,
    longitude: raw.longitude !== null && raw.longitude !== undefined ? Number(raw.longitude) : null,
    ...extra
  };
}

async function gardenRoutes(fastify, options) {
  // GET /api/gardens
  fastify.get('/', {
    preHandler: [verifyJwt]
  }, async (request, reply) => {
    const memberships = await GardenMember.findAll({
      where: { user_id: request.user.id },
      order: [['created_at', 'DESC']]
    });

    const now = Date.now();
    const activeMemberships = memberships.filter(m => {
      if (m.role === 'GUEST' && m.expires_at) {
        return new Date(m.expires_at).getTime() > now;
      }
      return true;
    });

    const gardens = [];
    const seenGardenIds = new Set();

    for (const m of activeMemberships) {
      const garden = await Garden.findByPk(m.garden_id);
      if (!garden) continue;
      seenGardenIds.add(garden.id);

      const zones = await Zone.findAll({ where: { garden_id: garden.id } });
      let plantCount = 0;
      for (const z of zones) {
        const zCount = await ZonePlant.count({ where: { zone_id: z.id } });
        plantCount += zCount;
      }

      gardens.push(normalizeGardenJson(garden, {
        role: m.role,
        zone_count: zones.length,
        plant_count: plantCount
      }));
    }

    if (request.user.is_admin) {
      const allGardens = await Garden.findAll({ order: [['created_at', 'DESC']] });
      for (const garden of allGardens) {
        if (seenGardenIds.has(garden.id)) continue;
        const zones = await Zone.findAll({ where: { garden_id: garden.id } });
        let plantCount = 0;
        for (const z of zones) {
          plantCount += await ZonePlant.count({ where: { zone_id: z.id } });
        }
        gardens.push(normalizeGardenJson(garden, {
          role: 'ADMIN',
          zone_count: zones.length,
          plant_count: plantCount
        }));
      }
    }

    return reply.send({ success: true, data: { gardens } });
  });

  // POST /api/gardens
  fastify.post('/', {
    preHandler: [verifyJwt]
  }, async (request, reply) => {
    const {
      name,
      latitude,
      longitude,
      location_address,
      location,
      timezone = 'UTC',
      area_sq_m = 0,
      description
    } = request.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_GARDEN_NAME', message: 'Garden name is required.', statusCode: 400 }
      });
    }

    if (!isValidTimezone(timezone)) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_TIMEZONE', message: `Invalid IANA timezone '${timezone}'.`, statusCode: 400 }
      });
    }

    if (area_sq_m !== undefined && area_sq_m !== null && (isNaN(Number(area_sq_m)) || Number(area_sq_m) < 0)) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_AREA', message: 'Garden area_sq_m must be a non-negative number.', statusCode: 400 }
      });
    }

    if (latitude !== undefined && latitude !== null && (isNaN(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90)) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_COORDINATES', message: 'Latitude must be between -90 and 90.', statusCode: 400 }
      });
    }

    if (longitude !== undefined && longitude !== null && (isNaN(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180)) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_COORDINATES', message: 'Longitude must be between -180 and 180.', statusCode: 400 }
      });
    }

    let createdGarden;
    await sequelize.transaction(async (t) => {
      createdGarden = await Garden.create({
        owner_id: request.user.id,
        name: name.trim(),
        latitude: latitude !== undefined && latitude !== null && latitude !== '' ? Number(latitude) : null,
        longitude: longitude !== undefined && longitude !== null && longitude !== '' ? Number(longitude) : null,
        location_address: (location_address || location) ? String(location_address || location).trim() : null,
        timezone: timezone.trim(),
        area_sq_m: area_sq_m !== undefined && area_sq_m !== null && area_sq_m !== '' ? Number(area_sq_m) : 0,
        description: description ? String(description).trim() : null
      }, { transaction: t });

      await GardenMember.create({
        garden_id: createdGarden.id,
        user_id: request.user.id,
        role: 'OWNER'
      }, { transaction: t });
    });

    const gardenData = normalizeGardenJson(createdGarden, {
      role: 'OWNER',
      zone_count: 0,
      plant_count: 0
    });

    return reply.code(201).send({
      success: true,
      data: {
        garden: gardenData,
        role: 'OWNER'
      }
    });
  });

  // GET /api/gardens/:id
  fastify.get('/:id', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const garden = await Garden.findByPk(request.resolvedGardenId);
    if (!garden) {
      return reply.code(404).send({
        success: false,
        error: { code: 'GARDEN_NOT_FOUND', message: 'Garden not found.', statusCode: 404 }
      });
    }

    const rawZones = await Zone.findAll({
      where: { garden_id: garden.id },
      order: [['id', 'ASC']]
    });

    const zones = [];
    for (const z of rawZones) {
      const zonePlants = await ZonePlant.findAll({
        where: { zone_id: z.id },
        include: [{ model: PlantCatalog, as: 'catalogPlant' }]
      });
      zones.push(normalizeZoneJson(z, {
        plant_count: zonePlants.length,
        plants: zonePlants.map(zp => zp.toJSON())
      }));
    }

    const members = await GardenMember.findAll({
      where: { garden_id: garden.id },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'location_region']
      }],
      order: [['created_at', 'ASC']]
    });

    return reply.send({
      success: true,
      data: {
        garden: normalizeGardenJson(garden, { role: request.gardenRole }),
        zones,
        members
      }
    });
  });

  // PUT /api/gardens/:id
  fastify.put('/:id', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER'])]
  }, async (request, reply) => {
    const garden = await Garden.findByPk(request.resolvedGardenId);
    if (!garden) {
      return reply.code(404).send({
        success: false,
        error: { code: 'GARDEN_NOT_FOUND', message: 'Garden not found.', statusCode: 404 }
      });
    }

    const {
      name,
      latitude,
      longitude,
      location_address,
      location,
      timezone,
      area_sq_m,
      description
    } = request.body || {};

    if (name !== undefined) {
      if (!name || typeof name !== 'string' || !name.trim()) {
        return reply.code(400).send({
          success: false,
          error: { code: 'INVALID_GARDEN_NAME', message: 'Garden name cannot be empty.', statusCode: 400 }
        });
      }
      garden.name = name.trim();
    }

    if (timezone !== undefined) {
      if (!isValidTimezone(timezone)) {
        return reply.code(400).send({
          success: false,
          error: { code: 'INVALID_TIMEZONE', message: `Invalid IANA timezone '${timezone}'.`, statusCode: 400 }
        });
      }
      garden.timezone = timezone.trim();
    }

    if (area_sq_m !== undefined) {
      if (area_sq_m !== null && (isNaN(Number(area_sq_m)) || Number(area_sq_m) < 0)) {
        return reply.code(400).send({
          success: false,
          error: { code: 'INVALID_AREA', message: 'Garden area_sq_m must be a non-negative number.', statusCode: 400 }
        });
      }
      garden.area_sq_m = area_sq_m !== null ? Number(area_sq_m) : 0;
    }

    if (latitude !== undefined) {
      garden.latitude = latitude !== null && latitude !== '' ? Number(latitude) : null;
    }
    if (longitude !== undefined) {
      garden.longitude = longitude !== null && longitude !== '' ? Number(longitude) : null;
    }
    if (location_address !== undefined || location !== undefined) {
      const addr = location_address !== undefined ? location_address : location;
      garden.location_address = addr ? String(addr).trim() : null;
    }
    if (description !== undefined) {
      garden.description = description ? String(description).trim() : null;
    }

    await garden.save();

    return reply.send({
      success: true,
      data: {
        garden: normalizeGardenJson(garden, { role: request.gardenRole })
      }
    });
  });

  // DELETE /api/gardens/:id
  fastify.delete('/:id', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER'])]
  }, async (request, reply) => {
    const gardenId = request.resolvedGardenId;

    await sequelize.transaction(async (t) => {
      const zones = await Zone.findAll({ where: { garden_id: gardenId } });
      for (const z of zones) {
        await ZonePlant.destroy({ where: { zone_id: z.id }, transaction: t });
      }
      await Zone.destroy({ where: { garden_id: gardenId }, transaction: t });
      await GardenInvitation.destroy({ where: { garden_id: gardenId }, transaction: t });
      await GardenMember.destroy({ where: { garden_id: gardenId }, transaction: t });
      await Garden.destroy({ where: { id: gardenId }, transaction: t });
    });

    return reply.send({
      success: true,
      data: { message: 'Garden and all associated records deleted.' }
    });
  });

  // GET /api/gardens/:gardenId/zones
  fastify.get('/:gardenId/zones', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const rawZones = await Zone.findAll({
      where: { garden_id: request.resolvedGardenId },
      order: [['id', 'ASC']]
    });

    const zones = [];
    for (const z of rawZones) {
      const zonePlants = await ZonePlant.findAll({
        where: { zone_id: z.id },
        include: [{ model: PlantCatalog, as: 'catalogPlant' }]
      });
      zones.push(normalizeZoneJson(z, {
        plant_count: zonePlants.length,
        plants: zonePlants.map(zp => zp.toJSON())
      }));
    }

    return reply.send({ success: true, data: { zones } });
  });

  // POST /api/gardens/:gardenId/zones
  fastify.post('/:gardenId/zones', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY'])]
  }, async (request, reply) => {
    const {
      name,
      is_outdoor = true,
      zone_type = 'OUTDOOR_BED',
      soil_type = 'LOAM',
      sunlight_level = 'FULL_SUN',
      area_sq_m = 1.00,
      dimensions_description = null
    } = request.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_ZONE_NAME', message: 'Zone name is required.', statusCode: 400 }
      });
    }

    if (!VALID_ZONE_TYPES.includes(zone_type)) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_ZONE_TYPE', message: `zone_type must be one of: ${VALID_ZONE_TYPES.join(', ')}`, statusCode: 400 }
      });
    }

    if (!VALID_SOIL_TYPES.includes(soil_type)) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_SOIL_TYPE', message: `soil_type must be one of: ${VALID_SOIL_TYPES.join(', ')}`, statusCode: 400 }
      });
    }

    if (!VALID_SUNLIGHT_LEVELS.includes(sunlight_level)) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_SUNLIGHT_LEVEL', message: `sunlight_level must be one of: ${VALID_SUNLIGHT_LEVELS.join(', ')}`, statusCode: 400 }
      });
    }

    if (area_sq_m !== undefined && area_sq_m !== null && (isNaN(Number(area_sq_m)) || Number(area_sq_m) < 0)) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_AREA', message: 'Zone area_sq_m must be a non-negative number.', statusCode: 400 }
      });
    }

    const createdZone = await Zone.create({
      garden_id: request.resolvedGardenId,
      name: name.trim(),
      is_outdoor: Boolean(is_outdoor),
      zone_type,
      soil_type,
      sunlight_level,
      area_sq_m: area_sq_m !== undefined && area_sq_m !== null && area_sq_m !== '' ? Number(area_sq_m) : 1.00,
      dimensions_description: dimensions_description ? String(dimensions_description).trim() : null
    });

    return reply.code(201).send({
      success: true,
      data: {
        zone: normalizeZoneJson(createdZone, { plant_count: 0 })
      }
    });
  });

  // GET /api/gardens/:id/members
  fastify.get('/:id/members', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const members = await GardenMember.findAll({
      where: { garden_id: request.resolvedGardenId },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'location_region']
      }],
      order: [['created_at', 'ASC']]
    });
    return reply.send({ success: true, data: { members } });
  });

  // PUT /api/gardens/:id/members/:userId
  fastify.put('/:id/members/:userId', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER'])]
  }, async (request, reply) => {
    const { userId } = request.params;
    const { role, expires_at } = request.body || {};

    if (!role || !['OWNER', 'FAMILY', 'GUEST'].includes(role)) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_ROLE', message: "Role must be 'OWNER', 'FAMILY', or 'GUEST'.", statusCode: 400 }
      });
    }

    const member = await GardenMember.findOne({
      where: { garden_id: request.resolvedGardenId, user_id: userId }
    });
    if (!member) {
      return reply.code(404).send({
        success: false,
        error: { code: 'MEMBER_NOT_FOUND', message: 'User is not a member of this garden.', statusCode: 404 }
      });
    }

    // Sole owner guard
    if (member.role === 'OWNER' && role !== 'OWNER') {
      const ownerCount = await GardenMember.count({
        where: { garden_id: request.resolvedGardenId, role: 'OWNER' }
      });
      if (ownerCount <= 1) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'CANNOT_DEMOTE_SOLE_OWNER',
            message: 'The sole garden owner cannot demote their own role without transferring ownership.',
            statusCode: 400
          }
        });
      }
    }

    member.role = role;
    member.expires_at = role === 'GUEST' && expires_at ? new Date(expires_at) : null;
    await member.save();

    return reply.send({ success: true, data: { member } });
  });

  // DELETE /api/gardens/:id/members/:userId
  fastify.delete('/:id/members/:userId', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const { userId } = request.params;
    const targetUserId = Number(userId);

    // Permission check: OWNER/ADMIN can remove anyone; non-owners can only remove themselves
    if (request.gardenRole !== 'OWNER' && request.gardenRole !== 'ADMIN' && request.user.id !== targetUserId) {
      return reply.code(403).send({
        success: false,
        error: { code: 'CANNOT_REMOVE_MEMBER', message: 'Only garden owners can remove other members.', statusCode: 403 }
      });
    }

    const member = await GardenMember.findOne({
      where: { garden_id: request.resolvedGardenId, user_id: targetUserId }
    });
    if (!member) {
      return reply.code(404).send({
        success: false,
        error: { code: 'MEMBER_NOT_FOUND', message: 'Member not found in this garden.', statusCode: 404 }
      });
    }

    // Sole owner guard
    if (member.role === 'OWNER') {
      const ownerCount = await GardenMember.count({
        where: { garden_id: request.resolvedGardenId, role: 'OWNER' }
      });
      if (ownerCount <= 1) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'CANNOT_REMOVE_SOLE_OWNER',
            message: 'The sole garden owner cannot leave the garden without deleting it or transferring ownership.',
            statusCode: 400
          }
        });
      }
    }

    await member.destroy();
    return reply.send({ success: true, data: { message: 'Member removed from garden successfully.' } });
  });

  // POST /api/gardens/:id/invitations
  fastify.post('/:id/invitations', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER'])]
  }, async (request, reply) => {
    const { email, role = 'GUEST', expiresInDays = 7 } = request.body || {};
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_EMAIL', message: 'A valid email address is required.', statusCode: 400 }
      });
    }
    if (!['FAMILY', 'GUEST'].includes(role)) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_INVITATION_ROLE', message: "Invitation role must be 'FAMILY' or 'GUEST'.", statusCode: 400 }
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user is already a member
    const existingUser = await User.findOne({ where: { email: normalizedEmail } });
    if (existingUser) {
      const isMember = await GardenMember.findOne({
        where: { garden_id: request.resolvedGardenId, user_id: existingUser.id }
      });
      if (isMember) {
        return reply.code(409).send({
          success: false,
          error: { code: 'USER_ALREADY_MEMBER', message: `User '${normalizedEmail}' is already a member of this garden.`, statusCode: 409 }
        });
      }
    }

    // Check if active pending invite already exists
    const activeInvite = await GardenInvitation.findOne({
      where: {
        garden_id: request.resolvedGardenId,
        invitee_email: normalizedEmail,
        status: 'PENDING',
        expires_at: { [Op.gt]: new Date() }
      }
    });
    if (activeInvite) {
      return reply.code(409).send({
        success: false,
        error: { code: 'INVITATION_ALREADY_EXISTS', message: `An active invitation already exists for '${normalizedEmail}'.`, statusCode: 409 }
      });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const ttlDays = Math.max(1, parseInt(expiresInDays, 10) || 7);
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    const invitation = await GardenInvitation.create({
      garden_id: request.resolvedGardenId,
      invited_by: request.user.id,
      invitee_email: normalizedEmail,
      role,
      token: tokenHash,
      status: 'PENDING',
      expires_at: expiresAt
    });

    return reply.code(201).send({
      success: true,
      data: {
        id: invitation.id,
        garden_id: invitation.garden_id,
        email: invitation.invitee_email,
        role: invitation.role,
        token: rawToken,
        status: invitation.status,
        expires_at: invitation.expires_at,
        invite_url: `/invitations/accept?token=${rawToken}`
      }
    });
  });

  // GET /api/gardens/:id/invitations
  fastify.get('/:id/invitations', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER'])]
  }, async (request, reply) => {
    const invitations = await GardenInvitation.findAll({
      where: { garden_id: request.resolvedGardenId },
      order: [['created_at', 'DESC']]
    });
    return reply.send({ success: true, data: { invitations } });
  });

  // DELETE /api/gardens/:id/invitations/:invitationId
  fastify.delete('/:id/invitations/:invitationId', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER'])]
  }, async (request, reply) => {
    const { invitationId } = request.params;
    const invitation = await GardenInvitation.findOne({
      where: { id: invitationId, garden_id: request.resolvedGardenId }
    });
    if (!invitation) {
      return reply.code(404).send({
        success: false,
        error: { code: 'INVITATION_NOT_FOUND', message: 'Invitation not found or does not belong to this garden.', statusCode: 404 }
      });
    }

    invitation.status = 'CANCELED';
    await invitation.save();
    return reply.send({ success: true, data: { message: 'Invitation canceled successfully.' } });
  });
}

module.exports = gardenRoutes;

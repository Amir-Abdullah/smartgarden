const { Garden, Zone, ZonePlant, GardenMember } = require('../models');

const ROLE_RANKS = {
  GUEST: 1,
  FAMILY: 2,
  OWNER: 3,
  ADMIN: 4
};

/**
 * Extracts and resolves the target garden_id from request parameters.
 * Responds with RFC 7807 404 error if an explicit resource ID was passed but does not exist.
 */
async function resolveGardenId(request, reply) {
  const params = request.params || {};
  const url = (request.raw && request.raw.url) ? request.raw.url : '';
  const routerPath = request.routerPath || (request.routeOptions && request.routeOptions.url) || '';

  // Case 1: Direct garden identifier via :gardenId
  if (params.gardenId) {
    const garden = await Garden.findByPk(params.gardenId, { attributes: ['id'] });
    if (!garden) {
      reply.code(404).send({
        success: false,
        error: { code: 'GARDEN_NOT_FOUND', message: `Garden ${params.gardenId} not found`, statusCode: 404 }
      });
      return null;
    }
    request.resolvedGardenId = garden.id;
    return garden.id;
  }

  // Case 2: Garden route with :id (e.g. /api/gardens/:id)
  if (params.id && (routerPath.includes('/gardens/:id') || url.includes('/gardens/'))) {
    const garden = await Garden.findByPk(params.id, { attributes: ['id'] });
    if (!garden) {
      reply.code(404).send({
        success: false,
        error: { code: 'GARDEN_NOT_FOUND', message: `Garden ${params.id} not found`, statusCode: 404 }
      });
      return null;
    }
    request.resolvedGardenId = garden.id;
    return garden.id;
  }

  // Case 3: Zone identifier (:zoneId or :id in /zones/:id)
  const isZoneRoute = routerPath.includes('/zones/:id') || routerPath.includes('/zones/') || url.includes('/zones/');
  const zoneId = params.zoneId || (isZoneRoute ? params.id : null);
  if (zoneId) {
    const zone = await Zone.findByPk(zoneId, { attributes: ['id', 'garden_id'] });
    if (!zone) {
      reply.code(404).send({
        success: false,
        error: { code: 'ZONE_NOT_FOUND', message: `Zone ${zoneId} not found`, statusCode: 404 }
      });
      return null;
    }
    request.resolvedGardenId = zone.garden_id;
    return zone.garden_id;
  }

  // Case 4: Plant identifier (:plantId or :id in /plants/:id)
  const isPlantRoute = routerPath.includes('/plants/:id') || routerPath.includes('/plants/') || url.includes('/plants/');
  const plantId = params.plantId || (isPlantRoute ? params.id : null);
  if (plantId) {
    const whereClause = { id: plantId };
    if (params.zoneId) {
      whereClause.zone_id = params.zoneId; // Compound scoping
    }
    const plant = await ZonePlant.findOne({
      where: whereClause,
      include: [{ model: Zone, as: 'zone', attributes: ['id', 'garden_id'] }]
    });
    if (!plant || !plant.zone) {
      reply.code(404).send({
        success: false,
        error: { code: 'PLANT_NOT_FOUND', message: `Plant ${plantId} not found`, statusCode: 404 }
      });
      return null;
    }
    request.resolvedGardenId = plant.zone.garden_id;
    return plant.zone.garden_id;
  }

  reply.code(400).send({
    success: false,
    error: { code: 'GARDEN_CONTEXT_MISSING', message: 'Unable to resolve target garden context', statusCode: 400 }
  });
  return null;
}

/**
 * PreHandler hook: verifies user membership and enforces minimum allowed roles.
 */
function resolveGardenAndRole(allowedRoles = ['OWNER', 'FAMILY', 'GUEST']) {
  return async function(request, reply) {
    // 1. Authentication check
    if (!request.user) {
      return reply.code(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 }
      });
    }

    // 2. Resource-to-garden resolution
    const gardenId = await resolveGardenId(request, reply);
    if (!gardenId) {
      return; // Error response already sent
    }

    // 3. Platform Admin Superuser Bypass
    if (request.user.is_admin) {
      request.resolvedGardenId = gardenId;
      request.gardenRole = 'ADMIN';
      request.gardenContext = {
        gardenId,
        role: 'ADMIN',
        member: null
      };
      return;
    }

    // 4. Query Garden Membership
    const member = await GardenMember.findOne({
      where: {
        garden_id: gardenId,
        user_id: request.user.id
      }
    });

    if (!member) {
      return reply.code(403).send({
        success: false,
        error: { code: 'NOT_A_GARDEN_MEMBER', message: 'Access denied: You are not a member of this garden.', statusCode: 403 }
      });
    }

    // 5. Check Guest Expiration
    if (member.role === 'GUEST' && member.expires_at) {
      if (new Date(member.expires_at).getTime() <= Date.now()) {
        return reply.code(403).send({
          success: false,
          error: { code: 'GUEST_ACCESS_EXPIRED', message: 'Your temporary guest access to this garden has expired.', statusCode: 403 }
        });
      }
    }

    // 6. Verify Allowed Roles
    if (!allowedRoles.includes(member.role)) {
      return reply.code(403).send({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Role '${member.role}' cannot perform this action.`,
          statusCode: 403
        }
      });
    }

    // 7. Context Binding
    request.resolvedGardenId = gardenId;
    request.gardenRole = member.role;
    request.gardenContext = {
      gardenId,
      role: member.role,
      member
    };
  };
}

module.exports = {
  resolveGardenId,
  resolveGardenAndRole,
  checkGardenRole: resolveGardenAndRole,
  ROLE_RANKS
};

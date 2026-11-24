const {
  Garden,
  Zone,
  ZonePlant,
  GardenMember,
  CareTask,
  Device,
  AutomationRule,
  AlertLog,
  DeviceWatchdogAlert
} = require('../models');

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

  // Case 3: Zone identifier (:zoneId or :id in /zones/:id) with compound child ownership checks
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

    if (params.plantId) {
      const plant = await ZonePlant.findOne({
        where: { id: params.plantId, zone_id: zone.id },
        attributes: ['id', 'zone_id']
      });
      if (!plant) {
        reply.code(404).send({
          success: false,
          error: { code: 'PLANT_NOT_FOUND', message: `Plant ${params.plantId} not found in zone ${zone.id}`, statusCode: 404 }
        });
        return null;
      }
    }

    if (params.taskId) {
      const task = await CareTask.findOne({
        where: { id: params.taskId, zone_id: zone.id },
        attributes: ['id', 'zone_id']
      });
      if (!task) {
        reply.code(404).send({
          success: false,
          error: { code: 'TASK_NOT_FOUND', message: `Care task ${params.taskId} not found in zone ${zone.id}`, statusCode: 404 }
        });
        return null;
      }
    }

    if (params.deviceId) {
      const device = await Device.findOne({
        where: { id: params.deviceId, zone_id: zone.id },
        attributes: ['id', 'zone_id']
      });
      if (!device) {
        reply.code(404).send({
          success: false,
          error: { code: 'DEVICE_NOT_FOUND', message: `Device ${params.deviceId} not found in zone ${zone.id}`, statusCode: 404 }
        });
        return null;
      }
    }

    if (params.ruleId) {
      const rule = await AutomationRule.findOne({
        where: { id: params.ruleId, zone_id: zone.id },
        attributes: ['id', 'zone_id']
      });
      if (!rule) {
        reply.code(404).send({
          success: false,
          error: { code: 'RULE_NOT_FOUND', message: `Automation rule ${params.ruleId} not found in zone ${zone.id}`, statusCode: 404 }
        });
        return null;
      }
    }

    if (params.alertId) {
      const alert = await AlertLog.findOne({
        where: { id: params.alertId, zone_id: zone.id },
        attributes: ['id', 'zone_id']
      });
      if (!alert) {
        reply.code(404).send({
          success: false,
          error: { code: 'ALERT_NOT_FOUND', message: `Alert ${params.alertId} not found in zone ${zone.id}`, statusCode: 404 }
        });
        return null;
      }
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
      whereClause.zone_id = params.zoneId;
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

  // Case 5: Task identifier (:taskId or :id in /tasks/:id)
  const isTaskRoute = routerPath.includes('/tasks/:id') || routerPath.includes('/tasks/') || url.includes('/tasks/');
  const taskId = params.taskId || (isTaskRoute ? params.id : null);
  if (taskId) {
    const task = await CareTask.findByPk(taskId, { attributes: ['id', 'zone_id'] });
    const zone = task ? await Zone.findByPk(task.zone_id, { attributes: ['id', 'garden_id'] }) : null;
    if (!task || !zone) {
      reply.code(404).send({
        success: false,
        error: { code: 'TASK_NOT_FOUND', message: `Care task ${taskId} not found`, statusCode: 404 }
      });
      return null;
    }
    request.resolvedGardenId = zone.garden_id;
    return zone.garden_id;
  }

  // Case 6: Device identifier (:deviceId or :id in /devices/:id) or /devices/claim body.zoneId
  if (routerPath.includes('/devices/claim') || url.includes('/devices/claim')) {
    const bodyZoneId = request.body && request.body.zoneId;
    if (bodyZoneId === undefined || bodyZoneId === null || bodyZoneId === '') {
      reply.code(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'zoneId is required to claim a device.', statusCode: 400 }
      });
      return null;
    }
    const parsedZoneId = Number(bodyZoneId);
    if (
      typeof bodyZoneId === 'boolean' ||
      typeof bodyZoneId === 'object' ||
      (typeof bodyZoneId === 'string' && !bodyZoneId.trim()) ||
      !Number.isInteger(parsedZoneId) ||
      parsedZoneId <= 0
    ) {
      reply.code(400).send({
        success: false,
        error: { code: 'INVALID_ZONE_ID', message: 'zoneId must be a positive integer.', statusCode: 400 }
      });
      return null;
    }
    const zone = await Zone.findByPk(parsedZoneId, { attributes: ['id', 'garden_id'] });
    if (!zone) {
      reply.code(404).send({
        success: false,
        error: { code: 'ZONE_NOT_FOUND', message: `Zone ${parsedZoneId} not found`, statusCode: 404 }
      });
      return null;
    }
    request.resolvedGardenId = zone.garden_id;
    return zone.garden_id;
  }

  const isDeviceRoute = routerPath.includes('/devices/:id') || routerPath.includes('/devices/') || url.includes('/devices/');
  const deviceId = params.deviceId || (isDeviceRoute ? params.id : null);
  if (deviceId) {
    const device = await Device.findByPk(deviceId, { attributes: ['id', 'zone_id'] });
    const zone = device ? await Zone.findByPk(device.zone_id, { attributes: ['id', 'garden_id'] }) : null;
    if (!device || !zone) {
      reply.code(404).send({
        success: false,
        error: { code: 'DEVICE_NOT_FOUND', message: `Device ${deviceId} not found`, statusCode: 404 }
      });
      return null;
    }
    request.resolvedGardenId = zone.garden_id;
    return zone.garden_id;
  }

  // Case 7: Rule identifier (:ruleId or :id in /rules/:id)
  const isRuleRoute = routerPath.includes('/rules/:id') || routerPath.includes('/rules/') || url.includes('/rules/');
  const ruleId = params.ruleId || (isRuleRoute ? params.id : null);
  if (ruleId) {
    const rule = await AutomationRule.findByPk(ruleId, { attributes: ['id', 'zone_id'] });
    const zone = rule ? await Zone.findByPk(rule.zone_id, { attributes: ['id', 'garden_id'] }) : null;
    if (!rule || !zone) {
      reply.code(404).send({
        success: false,
        error: { code: 'RULE_NOT_FOUND', message: `Automation rule ${ruleId} not found`, statusCode: 404 }
      });
      return null;
    }
    request.resolvedGardenId = zone.garden_id;
    return zone.garden_id;
  }

  // Case 8: Alert identifier (:alertId or :id in /alerts/:id)
  const isAlertRoute = routerPath.includes('/alerts/:id') || routerPath.includes('/alerts/') || url.includes('/alerts/');
  const alertId = params.alertId || (isAlertRoute ? params.id : null);
  if (alertId) {
    const rawAlertId = String(alertId);
    if (rawAlertId.startsWith('wd-')) {
      const wdId = Number(rawAlertId.slice(3));
      const wd = Number.isInteger(wdId) && wdId > 0 ? await DeviceWatchdogAlert.findByPk(wdId) : null;
      if (!wd) {
        reply.code(404).send({
          success: false,
          error: { code: 'ALERT_NOT_FOUND', message: `Alert ${alertId} not found`, statusCode: 404 }
        });
        return null;
      }
      request.resolvedGardenId = wd.garden_id;
      return wd.garden_id;
    }
    const alert = await AlertLog.findByPk(alertId, { attributes: ['id', 'zone_id'] });
    const zone = alert ? await Zone.findByPk(alert.zone_id, { attributes: ['id', 'garden_id'] }) : null;
    if (!alert || !zone) {
      reply.code(404).send({
        success: false,
        error: { code: 'ALERT_NOT_FOUND', message: `Alert ${alertId} not found`, statusCode: 404 }
      });
      return null;
    }
    request.resolvedGardenId = zone.garden_id;
    return zone.garden_id;
  }

  reply.code(400).send({
    success: false,
    error: { code: 'GARDEN_CONTEXT_MISSING', message: 'Unable to resolve target garden context', statusCode: 400 }
  });
  return null;
}

/**
 * Reusable membership & RBAC verification helper (used by HTTP middleware, WS, and SSE).
 * Returns { allowed: true, gardenId, role, member } or { allowed: false, statusCode, code, message }.
 */
async function checkMemberAccess(user, gardenId, allowedRoles = ['OWNER', 'FAMILY', 'GUEST']) {
  if (!user) {
    return { allowed: false, statusCode: 401, code: 'UNAUTHORIZED', message: 'Authentication required' };
  }

  const garden = await Garden.findByPk(gardenId, { attributes: ['id'] });
  if (!garden) {
    return { allowed: false, statusCode: 404, code: 'GARDEN_NOT_FOUND', message: `Garden ${gardenId} not found` };
  }

  if (user.is_admin) {
    return { allowed: true, gardenId: garden.id, role: 'ADMIN', member: null };
  }

  const member = await GardenMember.findOne({
    where: {
      garden_id: garden.id,
      user_id: user.id
    }
  });

  if (!member) {
    return {
      allowed: false,
      statusCode: 403,
      code: 'NOT_A_GARDEN_MEMBER',
      message: 'Access denied: You are not a member of this garden.'
    };
  }

  if (member.role === 'GUEST' && member.expires_at) {
    if (new Date(member.expires_at).getTime() <= Date.now()) {
      return {
        allowed: false,
        statusCode: 403,
        code: 'GUEST_ACCESS_EXPIRED',
        message: 'Your temporary guest access to this garden has expired.'
      };
    }
  }

  if (!allowedRoles.includes(member.role)) {
    return {
      allowed: false,
      statusCode: 403,
      code: 'INSUFFICIENT_PERMISSIONS',
      message: `Role '${member.role}' cannot perform this action.`
    };
  }

  return { allowed: true, gardenId: garden.id, role: member.role, member };
}

/**
 * PreHandler hook: verifies user membership and enforces minimum allowed roles.
 */
function resolveGardenAndRole(allowedRoles = ['OWNER', 'FAMILY', 'GUEST']) {
  return async function(request, reply) {
    if (!request.user) {
      return reply.code(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 }
      });
    }

    const gardenId = await resolveGardenId(request, reply);
    if (!gardenId) {
      return;
    }

    const access = await checkMemberAccess(request.user, gardenId, allowedRoles);
    if (!access.allowed) {
      return reply.code(access.statusCode).send({
        success: false,
        error: {
          code: access.code,
          message: access.message,
          statusCode: access.statusCode
        }
      });
    }

    request.resolvedGardenId = access.gardenId;
    request.gardenRole = access.role;
    request.gardenContext = {
      gardenId: access.gardenId,
      role: access.role,
      member: access.member
    };
  };
}

module.exports = {
  resolveGardenId,
  resolveGardenAndRole,
  checkGardenRole: resolveGardenAndRole,
  checkMemberAccess,
  ROLE_RANKS
};

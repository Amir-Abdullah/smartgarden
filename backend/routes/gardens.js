const crypto = require('node:crypto');
const { Op } = require('sequelize');
const { Garden, GardenMember, GardenInvitation, User } = require('../models');
const { verifyJwt } = require('../middleware/auth');
const { resolveGardenAndRole } = require('../middleware/rbac');

async function gardenRoutes(fastify, options) {
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

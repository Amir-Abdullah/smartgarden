const crypto = require('node:crypto');
const { Op } = require('sequelize');
const { sequelize, GardenInvitation, GardenMember } = require('../models');
const { verifyJwt } = require('../middleware/auth');

async function invitationRoutes(fastify, options) {
  // POST /api/invitations/:token/accept
  fastify.post('/:token/accept', { preHandler: [verifyJwt] }, async (request, reply) => {
    const incomingToken = request.params.token;
    if (!incomingToken) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invitation token is required.', statusCode: 400 }
      });
    }

    const tokenHash = crypto.createHash('sha256').update(incomingToken).digest('hex');

    const invitation = await GardenInvitation.findOne({
      where: {
        [Op.or]: [{ token: incomingToken }, { token: tokenHash }]
      }
    });

    if (!invitation) {
      return reply.code(404).send({
        success: false,
        error: { code: 'INVITATION_NOT_FOUND', message: 'Invalid or unknown invitation token.', statusCode: 404 }
      });
    }

    if (invitation.status !== 'PENDING') {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVITATION_ALREADY_USED', message: `This invitation has already been ${invitation.status.toLowerCase()}.`, statusCode: 400 }
      });
    }

    if (new Date(invitation.expires_at) <= new Date()) {
      invitation.status = 'EXPIRED';
      await invitation.save();
      return reply.code(400).send({
        success: false,
        error: { code: 'INVITATION_EXPIRED', message: 'This invitation has expired.', statusCode: 400 }
      });
    }

    // Atomic transaction: upsert member and mark invitation ACCEPTED
    await sequelize.transaction(async (t) => {
      let member = await GardenMember.findOne({
        where: { garden_id: invitation.garden_id, user_id: request.user.id },
        transaction: t
      });

      if (member) {
        member.role = invitation.role;
        member.expires_at = invitation.role === 'GUEST' ? invitation.expires_at : null;
        await member.save({ transaction: t });
      } else {
        await GardenMember.create({
          garden_id: invitation.garden_id,
          user_id: request.user.id,
          role: invitation.role,
          expires_at: invitation.role === 'GUEST' ? invitation.expires_at : null
        }, { transaction: t });
      }

      invitation.status = 'ACCEPTED';
      invitation.accepted_at = new Date();
      await invitation.save({ transaction: t });
    });

    return reply.send({
      success: true,
      data: {
        message: `Successfully joined garden as ${invitation.role}.`,
        gardenId: invitation.garden_id,
        role: invitation.role
      }
    });
  });

  // POST /api/invitations/:token/reject
  fastify.post('/:token/reject', { preHandler: [verifyJwt] }, async (request, reply) => {
    const incomingToken = request.params.token;
    if (!incomingToken) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invitation token is required.', statusCode: 400 }
      });
    }

    const tokenHash = crypto.createHash('sha256').update(incomingToken).digest('hex');

    const invitation = await GardenInvitation.findOne({
      where: {
        [Op.or]: [{ token: incomingToken }, { token: tokenHash }]
      }
    });

    if (!invitation) {
      return reply.code(404).send({
        success: false,
        error: { code: 'INVITATION_NOT_FOUND', message: 'Invalid or unknown invitation token.', statusCode: 404 }
      });
    }

    if (invitation.status !== 'PENDING') {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVITATION_ALREADY_USED', message: `This invitation has already been ${invitation.status.toLowerCase()}.`, statusCode: 400 }
      });
    }

    invitation.status = 'REJECTED';
    await invitation.save();

    return reply.send({
      success: true,
      data: {
        message: 'Invitation declined.'
      }
    });
  });
}

module.exports = invitationRoutes;

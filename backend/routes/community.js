const { verifyJwt } = require('../middleware/auth');
const { parseMultipart } = require('../utils/multipartParser');
const communityService = require('../services/communityService');

async function communityRoutes(fastify) {
  // GET /api/community/posts
  fastify.get('/community/posts', {
    preHandler: [verifyJwt]
  }, async (request, reply) => {
    const {
      category = 'ALL',
      search = '',
      following_only: followingOnly = false,
      author_id: authorId = null,
      page = 1,
      limit = 20
    } = request.query || {};

    const result = await communityService.listPosts({
      currentUserId: request.user.id,
      category,
      search,
      followingOnly,
      authorId,
      page,
      limit
    });

    return reply.send({ success: true, data: result });
  });

  // POST /api/community/posts
  fastify.post('/community/posts', {
    preHandler: [verifyJwt]
  }, async (request, reply) => {
    const ct = String(request.headers['content-type'] || '').toLowerCase();
    let payload;
    if (ct.includes('multipart/form-data')) {
      const { fields, files } = parseMultipart(request);
      payload = {
        ...fields,
        file: files.photo || Object.values(files)[0] || null
      };
    } else {
      payload = request.body && typeof request.body === 'object' ? { ...request.body } : {};
    }

    const post = await communityService.createPost(request.user.id, payload);
    return reply.code(201).send({ success: true, data: post });
  });

  // DELETE /api/community/posts/:postId
  fastify.delete('/community/posts/:postId', {
    preHandler: [verifyJwt]
  }, async (request, reply) => {
    const result = await communityService.deletePost(request.params.postId, request.user);
    return reply.send({ success: true, data: result });
  });

  // POST /api/community/posts/:postId/like
  fastify.post('/community/posts/:postId/like', {
    preHandler: [verifyJwt]
  }, async (request, reply) => {
    const result = await communityService.togglePostLike(request.params.postId, request.user.id);
    return reply.send({ success: true, data: result });
  });

  // GET /api/community/posts/:postId/comments
  fastify.get('/community/posts/:postId/comments', {
    preHandler: [verifyJwt]
  }, async (request, reply) => {
    const result = await communityService.listComments(request.params.postId);
    return reply.send({ success: true, data: result });
  });

  // POST /api/community/posts/:postId/comments
  fastify.post('/community/posts/:postId/comments', {
    preHandler: [verifyJwt]
  }, async (request, reply) => {
    const body = request.body && typeof request.body === 'object' ? request.body : {};
    const comment = await communityService.addComment(request.params.postId, request.user.id, body);
    return reply.code(201).send({ success: true, data: comment });
  });

  // POST /api/community/users/:userId/follow
  fastify.post('/community/users/:userId/follow', {
    preHandler: [verifyJwt]
  }, async (request, reply) => {
    const result = await communityService.followUser(request.user.id, request.params.userId);
    return reply.send({ success: true, data: result });
  });

  // DELETE /api/community/users/:userId/follow
  fastify.delete('/community/users/:userId/follow', {
    preHandler: [verifyJwt]
  }, async (request, reply) => {
    const result = await communityService.unfollowUser(request.user.id, request.params.userId);
    return reply.send({ success: true, data: result });
  });

  // GET /api/community/users/:userId/profile
  fastify.get('/community/users/:userId/profile', {
    preHandler: [verifyJwt]
  }, async (request, reply) => {
    const profile = await communityService.getUserProfile(request.params.userId, request.user.id);
    return reply.send({ success: true, data: profile });
  });

  // PATCH /api/admin/community/posts/:postId
  fastify.patch('/admin/community/posts/:postId', {
    preHandler: [verifyJwt]
  }, async (request, reply) => {
    const body = request.body && typeof request.body === 'object' ? request.body : {};
    const post = await communityService.moderatePost(request.params.postId, request.user.id, body);
    return reply.send({ success: true, data: post });
  });

  // DELETE /api/admin/community/comments/:commentId
  fastify.delete('/admin/community/comments/:commentId', {
    preHandler: [verifyJwt]
  }, async (request, reply) => {
    const result = await communityService.deleteCommentAdmin(request.params.commentId, request.user.id);
    return reply.send({ success: true, data: result });
  });
}

module.exports = communityRoutes;

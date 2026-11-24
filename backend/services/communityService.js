const {
  CommunityPost,
  CommunityComment,
  CommunityPostLike,
  UserFollow,
  User,
  Garden
} = require('../models');
const { Op } = require('sequelize');
const storageService = require('./storageService');
const { validateImageBuffer } = require('../utils/multipartParser');

const VALID_CATEGORIES = ['QUESTION', 'SHOWCASE', 'TIP', 'GENERAL'];

function createError(statusCode, code, message, details = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

async function resolveOptionalPhoto({ file, photo_base64, photo_mime_type, photo_url, userId }) {
  if (file && Buffer.isBuffer(file.buffer)) {
    const uploaded = await storageService.uploadImage({
      buffer: file.buffer,
      mimeType: file.mimeType,
      originalFilename: file.filename,
      folder: 'community',
      userId
    });
    return uploaded.url;
  }
  if (photo_base64 && typeof photo_base64 === 'string') {
    const dataUriMatch = photo_base64.match(/^data:([^;]+);base64,(.+)$/);
    const mime = dataUriMatch ? dataUriMatch[1] : (photo_mime_type || 'image/png');
    const b64 = dataUriMatch ? dataUriMatch[2] : photo_base64;
    const buffer = Buffer.from(b64, 'base64');
    const verifiedMime = validateImageBuffer(buffer, mime);
    const uploaded = await storageService.uploadImage({
      buffer,
      mimeType: verifiedMime,
      originalFilename: `community.${verifiedMime.split('/')[1] || 'png'}`,
      folder: 'community',
      userId
    });
    return uploaded.url;
  }
  if (photo_url && typeof photo_url === 'string') {
    const trimmed = photo_url.trim();
    if (trimmed.startsWith('/api/media/') || /^https?:\/\//i.test(trimmed)) {
      return trimmed.slice(0, 500);
    }
    throw createError(400, 'INVALID_PHOTO_URL', 'Invalid photo URL format.');
  }
  return null;
}

async function hydratePosts(posts, currentUserId) {
  if (posts.length === 0) return [];
  const authorIds = [...new Set(posts.map((p) => Number(p.author_id)))];
  const gardenIds = [...new Set(posts.map((p) => p.garden_id).filter(Boolean).map(Number))];
  const postIds = posts.map((p) => Number(p.id));

  const [authors, gardens, myLikes, myFollows] = await Promise.all([
    User.findAll({
      where: { id: { [Op.in]: authorIds } },
      attributes: ['id', 'name', 'location_region', 'is_admin']
    }),
    gardenIds.length > 0
      ? Garden.findAll({ where: { id: { [Op.in]: gardenIds } }, attributes: ['id', 'name'] })
      : [],
    currentUserId
      ? CommunityPostLike.findAll({ where: { user_id: currentUserId, post_id: { [Op.in]: postIds } } })
      : [],
    currentUserId
      ? UserFollow.findAll({ where: { follower_id: currentUserId } })
      : []
  ]);

  const authorMap = new Map(authors.map((a) => [Number(a.id), a]));
  const gardenMap = new Map(gardens.map((g) => [Number(g.id), g]));
  const likedSet = new Set(myLikes.map((l) => Number(l.post_id)));
  const followingSet = new Set(myFollows.map((f) => Number(f.followed_id)));

  return posts.map((p) => {
    const plain = typeof p.toJSON === 'function' ? p.toJSON() : { ...p };
    const author = authorMap.get(Number(plain.author_id));
    const garden = plain.garden_id ? gardenMap.get(Number(plain.garden_id)) : null;
    return {
      id: Number(plain.id),
      author_id: Number(plain.author_id),
      author_name: author ? author.name : 'Gardener',
      author_region: author ? author.location_region : null,
      garden_id: plain.garden_id ? Number(plain.garden_id) : null,
      garden_name: garden ? garden.name : null,
      title: plain.title,
      content: plain.content,
      category: plain.category,
      photo_url: plain.photo_url || null,
      is_flagged: Boolean(plain.is_flagged),
      is_pinned: Boolean(plain.is_pinned),
      likes_count: Number(plain.likes_count || 0),
      comments_count: Number(plain.comments_count || 0),
      liked_by_me: likedSet.has(Number(plain.id)),
      author_followed_by_me: followingSet.has(Number(plain.author_id)),
      created_at: plain.created_at,
      updated_at: plain.updated_at
    };
  });
}

async function listPosts({
  currentUserId,
  category = 'ALL',
  search = '',
  followingOnly = false,
  authorId = null,
  page = 1,
  limit = 20
} = {}) {
  const allPosts = await CommunityPost.findAll({
    order: [['is_pinned', 'DESC'], ['created_at', 'DESC'], ['id', 'DESC']]
  });

  const hydrated = await hydratePosts(allPosts, currentUserId);
  const cleanCat = String(category || 'ALL').toUpperCase();
  const cleanSearch = String(search || '').trim().toLowerCase();
  const followFilter = followingOnly === true || followingOnly === 'true';

  const filtered = hydrated.filter((p) => {
    if (cleanCat !== 'ALL' && VALID_CATEGORIES.includes(cleanCat) && p.category !== cleanCat) {
      return false;
    }
    if (authorId && Number(p.author_id) !== Number(authorId)) {
      return false;
    }
    if (followFilter && !p.author_followed_by_me && Number(p.author_id) !== Number(currentUserId)) {
      return false;
    }
    if (cleanSearch) {
      const hay = `${p.title} ${p.content} ${p.author_name} ${p.garden_name || ''}`.toLowerCase();
      if (!hay.includes(cleanSearch)) return false;
    }
    return true;
  });

  // Sort pinned first then newest created_at/id descending
  filtered.sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    const tA = new Date(a.created_at).getTime();
    const tB = new Date(b.created_at).getTime();
    if (tA !== tB) return tB - tA;
    return b.id - a.id;
  });

  const pageNum = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(limit) || 20));
  const offset = (pageNum - 1) * pageSize;

  return {
    posts: filtered.slice(offset, offset + pageSize),
    pagination: {
      total: filtered.length,
      page: pageNum,
      limit: pageSize,
      total_pages: Math.max(1, Math.ceil(filtered.length / pageSize))
    }
  };
}

async function createPost(userId, payload = {}) {
  const title = String(payload.title || '').trim();
  const content = String(payload.content || '').trim();
  const category = String(payload.category || 'GENERAL').trim().toUpperCase();

  if (title.length < 3 || title.length > 200) {
    throw createError(400, 'VALIDATION_ERROR', 'Post title must be between 3 and 200 characters.');
  }
  if (content.length < 5 || content.length > 5000) {
    throw createError(400, 'VALIDATION_ERROR', 'Post content must be between 5 and 5000 characters.');
  }
  if (!VALID_CATEGORIES.includes(category)) {
    throw createError(400, 'VALIDATION_ERROR', `Category must be one of: ${VALID_CATEGORIES.join(', ')}.`);
  }

  let gardenId = null;
  if (payload.garden_id && payload.garden_id !== 'NONE') {
    const parsed = Number(payload.garden_id);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw createError(400, 'VALIDATION_ERROR', 'Invalid garden_id.');
    }
    const g = await Garden.findByPk(parsed);
    if (!g) {
      throw createError(404, 'GARDEN_NOT_FOUND', `Garden ${parsed} not found.`);
    }
    gardenId = parsed;
  }

  const photo_url = await resolveOptionalPhoto({
    file: payload.file || null,
    photo_base64: payload.photo_base64,
    photo_mime_type: payload.photo_mime_type,
    photo_url: payload.photo_url,
    userId
  });

  const created = await CommunityPost.create({
    author_id: userId,
    garden_id: gardenId,
    title,
    content,
    category,
    photo_url,
    is_flagged: false,
    is_pinned: false,
    likes_count: 0,
    comments_count: 0
  });

  const [hydrated] = await hydratePosts([created], userId);
  return hydrated;
}

async function deletePost(postId, actorUser) {
  const post = await CommunityPost.findByPk(postId);
  if (!post) {
    throw createError(404, 'POST_NOT_FOUND', `Community post ${postId} not found.`);
  }

  const isOwner = Number(post.author_id) === Number(actorUser.id);
  const dbUser = await User.findByPk(actorUser.id);
  const isAdmin = Boolean(dbUser && dbUser.is_admin);
  if (!isOwner && !isAdmin) {
    throw createError(403, 'FORBIDDEN', 'Only the post author or an administrator can delete this post.');
  }

  const oldPhoto = post.photo_url;
  await post.destroy();
  if (oldPhoto) {
    await storageService.deleteMediaByUrl(oldPhoto);
  }
  return { deleted: true, id: Number(postId) };
}

async function togglePostLike(postId, userId) {
  const post = await CommunityPost.findByPk(postId);
  if (!post) {
    throw createError(404, 'POST_NOT_FOUND', `Community post ${postId} not found.`);
  }

  const existing = await CommunityPostLike.findOne({
    where: { post_id: post.id, user_id: userId }
  });

  let liked;
  if (existing) {
    await existing.destroy();
    liked = false;
  } else {
    await CommunityPostLike.create({
      post_id: post.id,
      user_id: userId
    });
    liked = true;
  }

  const likesCount = await CommunityPostLike.count({ where: { post_id: post.id } });
  await post.update({ likes_count: likesCount });

  return {
    post_id: Number(post.id),
    liked,
    likes_count: Number(likesCount)
  };
}

async function listComments(postId) {
  const post = await CommunityPost.findByPk(postId);
  if (!post) {
    throw createError(404, 'POST_NOT_FOUND', `Community post ${postId} not found.`);
  }

  const rawComments = await CommunityComment.findAll({
    where: { post_id: post.id },
    order: [['created_at', 'ASC'], ['id', 'ASC']]
  });

  const authorIds = [...new Set(rawComments.map((c) => Number(c.author_id)))];
  const authors = authorIds.length > 0
    ? await User.findAll({ where: { id: { [Op.in]: authorIds } }, attributes: ['id', 'name', 'location_region'] })
    : [];
  const authorMap = new Map(authors.map((a) => [Number(a.id), a]));

  const comments = rawComments.map((c) => {
    const plain = typeof c.toJSON === 'function' ? c.toJSON() : { ...c };
    const author = authorMap.get(Number(plain.author_id));
    return {
      id: Number(plain.id),
      post_id: Number(plain.post_id),
      author_id: Number(plain.author_id),
      author_name: author ? author.name : 'Gardener',
      parent_comment_id: plain.parent_comment_id ? Number(plain.parent_comment_id) : null,
      content: plain.content,
      is_flagged: Boolean(plain.is_flagged),
      created_at: plain.created_at
    };
  });

  return { post_id: Number(post.id), comments };
}

async function addComment(postId, userId, { content, parent_comment_id = null } = {}) {
  const post = await CommunityPost.findByPk(postId);
  if (!post) {
    throw createError(404, 'POST_NOT_FOUND', `Community post ${postId} not found.`);
  }

  const cleanContent = String(content || '').trim();
  if (cleanContent.length < 1 || cleanContent.length > 2000) {
    throw createError(400, 'VALIDATION_ERROR', 'Comment must be between 1 and 2000 characters.');
  }

  let parentId = null;
  if (parent_comment_id) {
    const parent = await CommunityComment.findOne({
      where: { id: parent_comment_id, post_id: post.id }
    });
    if (!parent) {
      throw createError(400, 'INVALID_PARENT_COMMENT', 'Parent comment does not belong to this post.');
    }
    parentId = Number(parent.id);
  }

  const created = await CommunityComment.create({
    post_id: post.id,
    author_id: userId,
    parent_comment_id: parentId,
    content: cleanContent,
    is_flagged: false
  });

  const totalCount = await CommunityComment.count({ where: { post_id: post.id } });
  await post.update({ comments_count: totalCount });

  const author = await User.findByPk(userId, { attributes: ['id', 'name'] });
  return {
    id: Number(created.id),
    post_id: Number(post.id),
    author_id: Number(userId),
    author_name: author ? author.name : 'Gardener',
    parent_comment_id: parentId,
    content: created.content,
    is_flagged: false,
    created_at: created.created_at,
    comments_count: Number(totalCount)
  };
}

async function followUser(followerId, followedId) {
  const fId = Number(followerId);
  const targetId = Number(followedId);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    throw createError(400, 'INVALID_USER_ID', 'Invalid target user ID.');
  }
  if (fId === targetId) {
    throw createError(400, 'CANNOT_FOLLOW_SELF', 'You cannot follow your own account.');
  }

  const targetUser = await User.findByPk(targetId, { attributes: ['id', 'name'] });
  if (!targetUser) {
    throw createError(404, 'USER_NOT_FOUND', `User ${targetId} not found.`);
  }

  const existing = await UserFollow.findOne({
    where: { follower_id: fId, followed_id: targetId }
  });
  if (!existing) {
    await UserFollow.create({ follower_id: fId, followed_id: targetId });
  }

  const followerCount = await UserFollow.count({ where: { followed_id: targetId } });
  return {
    follower_id: fId,
    followed_id: targetId,
    following: true,
    followers_count: Number(followerCount)
  };
}

async function unfollowUser(followerId, followedId) {
  const fId = Number(followerId);
  const targetId = Number(followedId);
  const existing = await UserFollow.findOne({
    where: { follower_id: fId, followed_id: targetId }
  });
  if (existing) {
    await existing.destroy();
  }
  const followerCount = await UserFollow.count({ where: { followed_id: targetId } });
  return {
    follower_id: fId,
    followed_id: targetId,
    following: false,
    followers_count: Number(followerCount)
  };
}

async function getUserProfile(targetUserId, viewerUserId) {
  const user = await User.findByPk(targetUserId, {
    attributes: ['id', 'name', 'location_region', 'created_at']
  });
  if (!user) {
    throw createError(404, 'USER_NOT_FOUND', `User ${targetUserId} not found.`);
  }

  const [followersCount, followingCount, posts, followRecord] = await Promise.all([
    UserFollow.count({ where: { followed_id: user.id } }),
    UserFollow.count({ where: { follower_id: user.id } }),
    CommunityPost.findAll({
      where: { author_id: user.id },
      order: [['created_at', 'DESC'], ['id', 'DESC']]
    }),
    viewerUserId
      ? UserFollow.findOne({ where: { follower_id: viewerUserId, followed_id: user.id } })
      : null
  ]);

  const recentPosts = await hydratePosts(posts.slice(0, 10), viewerUserId);

  return {
    user: {
      id: Number(user.id),
      name: user.name,
      location_region: user.location_region || null,
      member_since: user.created_at
    },
    stats: {
      followers_count: Number(followersCount),
      following_count: Number(followingCount),
      posts_count: posts.length
    },
    followed_by_me: Boolean(followRecord),
    recent_posts: recentPosts
  };
}

async function requireAdminActor(userId) {
  const actor = await User.findByPk(userId);
  if (!actor || !actor.is_admin) {
    throw createError(403, 'ADMIN_REQUIRED', 'Administrator privileges are required for community moderation.');
  }
  return actor;
}

async function moderatePost(postId, actorUserId, { is_pinned, is_flagged } = {}) {
  await requireAdminActor(actorUserId);
  const post = await CommunityPost.findByPk(postId);
  if (!post) {
    throw createError(404, 'POST_NOT_FOUND', `Community post ${postId} not found.`);
  }

  const updates = {};
  if (typeof is_pinned === 'boolean') updates.is_pinned = is_pinned;
  if (typeof is_flagged === 'boolean') updates.is_flagged = is_flagged;
  if (Object.keys(updates).length > 0) {
    await post.update(updates);
  }

  const [hydrated] = await hydratePosts([post], actorUserId);
  return hydrated;
}

async function deleteCommentAdmin(commentId, actorUserId) {
  await requireAdminActor(actorUserId);
  const comment = await CommunityComment.findByPk(commentId);
  if (!comment) {
    throw createError(404, 'COMMENT_NOT_FOUND', `Comment ${commentId} not found.`);
  }

  const postId = Number(comment.post_id);
  const childReplies = await CommunityComment.findAll({
    where: { parent_comment_id: comment.id }
  });
  for (const child of childReplies) {
    await child.destroy();
  }
  await comment.destroy();

  const post = await CommunityPost.findByPk(postId);
  if (post) {
    const remaining = await CommunityComment.count({ where: { post_id: postId } });
    await post.update({ comments_count: remaining });
  }

  return { deleted: true, id: Number(commentId), post_id: postId };
}

module.exports = {
  VALID_CATEGORIES,
  listPosts,
  createPost,
  deletePost,
  togglePostLike,
  listComments,
  addComment,
  followUser,
  unfollowUser,
  getUserProfile,
  moderatePost,
  deleteCommentAdmin
};

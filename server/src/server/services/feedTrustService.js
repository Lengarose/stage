const Post = require('../models/postModel');
const Comment = require('../models/commentModel');
const Player = require('../models/playerModel');
const Notification = require('../models/notificationModel');

const VIDEO_FEED_REJECTION = 'Video uploads are not supported yet. Please upload an image.';

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function parseLikes(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function hasVideoMediaType(body = {}) {
  return String(body.media_type || '').trim().toLowerCase() === 'video';
}

function assertFeedPostAllowsMedia(body = {}) {
  if (hasVideoMediaType(body)) throw httpError(400, VIDEO_FEED_REJECTION);
}

function removeServerOwnedPostFields(body = {}) {
  const safeBody = { ...body };
  delete safeBody.likes;
  delete safeBody.likes_count;
  delete safeBody.comments_count;
  return safeBody;
}

async function actorProfileForUser(user = {}) {
  const rows = user.id ? await new Player().selectByUserId(user.id).catch(() => []) : [];
  const player = rows[0] || {};
  const email = player.email || user.email || '';
  return {
    userId: user.id || null,
    email,
    likeKey: email || user.id || '',
    name: player.gamertag || user.name || (email ? String(email).split('@')[0] : 'StageLeagues player'),
    avatar: player.avatar_url || null,
  };
}

async function getPostOrThrow(postId) {
  const rows = await new Post().selectOne(postId);
  if (!rows.length) throw httpError(404, 'Post not found');
  return rows[0];
}

async function updatePostRecord(post) {
  const model = new Post(post);
  await model.update(post.id);
  const rows = await model.selectOne(post.id);
  return rows[0] || post;
}

async function notifyPostOwner({ post, actor, type }) {
  const recipientEmail = post.author_email;
  if (!recipientEmail || normalizeEmail(recipientEmail) === normalizeEmail(actor.email)) return null;

  const verb = type === 'post_comment' ? 'commented on' : 'liked';
  const notification = new Notification({
    recipient_email: recipientEmail,
    type,
    title: `${actor.name} ${verb} your post`,
    body: type === 'post_comment'
      ? `${actor.name} commented on your post.`
      : `${actor.name} liked your post.`,
    read: false,
    link: post.club_id ? `/clubs/${post.club_id}` : '/social',
    related_id: post.id,
  });
  await notification.create();
  return notification.id;
}

async function togglePostLike({ postId, user }) {
  const [post, actor] = await Promise.all([
    getPostOrThrow(postId),
    actorProfileForUser(user),
  ]);
  if (!actor.likeKey) throw httpError(401, 'Authenticated user is required');

  const likes = parseLikes(post.likes);
  const normalizedActor = normalizeEmail(actor.likeKey);
  const existingIndex = likes.findIndex((like) => normalizeEmail(like) === normalizedActor);
  const liked = existingIndex === -1;
  const nextLikes = liked
    ? [...likes, actor.likeKey]
    : likes.filter((_like, index) => index !== existingIndex);

  const updatedPost = await updatePostRecord({
    ...post,
    likes: nextLikes,
    likes_count: nextLikes.length,
  });

  if (liked) {
    await notifyPostOwner({ post, actor, type: 'post_like' });
  }

  return { post: updatedPost, liked };
}

async function createTrustedComment({ body, user }) {
  const postId = body?.post_id;
  const content = String(body?.content || '').trim();
  if (!postId) throw httpError(400, 'post_id is required');
  if (!content) throw httpError(400, 'Comment content is required');

  const [post, actor] = await Promise.all([
    getPostOrThrow(postId),
    actorProfileForUser(user),
  ]);
  if (!actor.email) throw httpError(401, 'Authenticated user email is required');

  const comment = new Comment({
    post_id: postId,
    author_email: actor.email,
    author_name: actor.name,
    author_avatar: actor.avatar,
    content,
  });
  await comment.create();
  const created = await comment.selectOne(comment.id);
  const updatedPost = await updatePostRecord({
    ...post,
    comments_count: Number(post.comments_count || 0) + 1,
  });

  await notifyPostOwner({ post, actor, type: 'post_comment' });

  return { comment: created[0], post: updatedPost };
}

module.exports = {
  VIDEO_FEED_REJECTION,
  assertFeedPostAllowsMedia,
  createTrustedComment,
  removeServerOwnedPostFields,
  togglePostLike,
};

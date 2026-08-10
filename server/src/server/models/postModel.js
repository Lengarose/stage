const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

function normalizePost(row) {
  if (!row) return row;
  let likes = row.likes;
  let tags = row.tags;
  if (typeof likes === 'string') {
    try { likes = JSON.parse(likes); } catch { likes = []; }
  }
  if (typeof tags === 'string') {
    try { tags = JSON.parse(tags); } catch { tags = []; }
  }
  return {
    ...row,
    likes: Array.isArray(likes) ? likes : [],
    tags: Array.isArray(tags) ? tags : [],
  };
}

class Post {
  constructor(body = {}) {
    this.id              = body.id;
    this.author_email    = body.author_email;
    this.author_name     = body.author_name;
    this.author_avatar   = body.author_avatar;
    this.content         = body.content;
    this.media_url       = body.media_url;
    this.media_cover_url = body.media_cover_url;
    this.media_type      = body.media_type;
    this.club_id         = body.club_id;
    this.club_name       = body.club_name;
    this.tournament_id   = body.tournament_id;
    this.likes_count     = body.likes_count;
    this.comments_count  = body.comments_count;
    this.likes           = body.likes
      ? (typeof body.likes === 'string' ? body.likes : JSON.stringify(body.likes))
      : null;
    this.tags            = body.tags
      ? (typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags))
      : null;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM posts ORDER BY id DESC LIMIT ? OFFSET ?', [pageSize, offset])
      .then((rows) => rows.map(normalizePost));
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM posts WHERE id = ?', [id]).then((rows) => rows.map(normalizePost));
  }

  selectByClub(club_id) {
    return EXECUTESQL('SELECT * FROM posts WHERE club_id = ? ORDER BY id DESC', [club_id])
      .then((rows) => rows.map(normalizePost));
  }

  selectByAuthor(email) {
    return EXECUTESQL('SELECT * FROM posts WHERE author_email = ? ORDER BY id DESC', [email])
      .then((rows) => rows.map(normalizePost));
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO posts
      (id, author_email, author_name, author_avatar, content, media_url,
       media_cover_url, media_type, club_id, club_name, tournament_id,
       likes, likes_count, comments_count, tags)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.author_email, this.author_name, this.author_avatar,
      this.content, this.media_url, this.media_cover_url, this.media_type,
      this.club_id, this.club_name, this.tournament_id,
      this.likes, this.likes_count, this.comments_count, this.tags,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE posts SET
      author_email=?, author_name=?, author_avatar=?, content=?, media_url=?,
      media_cover_url=?, media_type=?, club_id=?, club_name=?, tournament_id=?,
      likes=?, likes_count=?, comments_count=?, tags=?
      WHERE id=?`;
    const values = [
      this.author_email, this.author_name, this.author_avatar, this.content,
      this.media_url, this.media_cover_url, this.media_type, this.club_id,
      this.club_name, this.tournament_id,
      this.likes, this.likes_count, this.comments_count, this.tags,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  async toggleLike(id, userEmail) {
    const email = String(userEmail || '').trim().toLowerCase();
    const inserted = await EXECUTESQL(
      'INSERT IGNORE INTO post_likes (id, post_id, user_email) VALUES (?,?,?)',
      [uuidv4(), id, email]
    );
    const liked = Number(inserted.affectedRows || 0) > 0;
    if (!liked) {
      await EXECUTESQL(
        'DELETE FROM post_likes WHERE post_id = ? AND LOWER(user_email) = LOWER(?)',
        [id, email]
      );
    }
    await EXECUTESQL(
      `UPDATE posts SET
         likes = COALESCE((SELECT JSON_ARRAYAGG(user_email) FROM post_likes WHERE post_id = ?), JSON_ARRAY()),
         likes_count = (SELECT COUNT(*) FROM post_likes WHERE post_id = ?)
       WHERE id = ?`,
      [id, id, id]
    );
    return liked;
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM posts WHERE id = ?', [id]);
  }
}

module.exports = Post;

const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class Player {
  constructor(body = {}) {
    this.id                  = body.id;
    this.user_id             = body.user_id;
    this.email               = body.email;
    this.gamertag            = body.gamertag;
    this.position            = body.position;
    this.platform            = body.platform;
    this.country             = body.country;
    this.country_code        = body.country_code;
    this.bio                 = body.bio;
    this.avatar_url          = body.avatar_url;
    this.avatar_zoom         = body.avatar_zoom;
    this.avatar_position     = body.avatar_position;
    this.shirt_number        = body.shirt_number;
    this.overall_rating      = body.overall_rating;
    this.goals               = body.goals;
    this.assists             = body.assists;
    this.credits             = body.credits;
    this.subscription        = body.subscription;
    this.role                = body.role;
    this.dressing_room_seat  = body.dressing_room_seat;
    this.is_ready            = body.is_ready;
    this.club_id             = body.club_id;
    this.notification_settings = body.notification_settings
      ? (typeof body.notification_settings === 'string'
          ? body.notification_settings
          : JSON.stringify(body.notification_settings))
      : null;
    this.club_roles          = body.club_roles
      ? (typeof body.club_roles === 'string'
          ? body.club_roles
          : JSON.stringify(body.club_roles))
      : null;
    this.banner_url          = body.banner_url;
    this.banner_position     = body.banner_position;
    this.banner_zoom         = body.banner_zoom;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM players LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM players WHERE id = ?', [id]);
  }

  selectByEmail(email) {
    return EXECUTESQL('SELECT * FROM players WHERE email = ?', [email]);
  }

  selectByClub(club_id) {
    return EXECUTESQL('SELECT * FROM players WHERE club_id = ?', [club_id]);
  }

  selectByUserId(user_id) {
    return EXECUTESQL('SELECT * FROM players WHERE user_id = ?', [user_id]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO players
      (id, user_id, email, gamertag, position, platform, country, country_code, bio,
       avatar_url, avatar_zoom, avatar_position, shirt_number, overall_rating,
       goals, assists, credits, subscription, role, dressing_room_seat, is_ready,
       club_id, notification_settings, club_roles,
       banner_url, banner_position, banner_zoom)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.user_id, this.email, this.gamertag, this.position, this.platform,
      this.country, this.country_code, this.bio, this.avatar_url,
      this.avatar_zoom, this.avatar_position, this.shirt_number,
      this.overall_rating, this.goals, this.assists, this.credits,
      this.subscription, this.role, this.dressing_room_seat, this.is_ready,
      this.club_id, this.notification_settings, this.club_roles,
      this.banner_url, this.banner_position, this.banner_zoom,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE players SET
      user_id=?, email=?, gamertag=?, position=?, platform=?, country=?, country_code=?,
      bio=?, avatar_url=?, avatar_zoom=?, avatar_position=?, shirt_number=?,
      overall_rating=?, goals=?, assists=?, credits=?, subscription=?, role=?,
      dressing_room_seat=?, is_ready=?, club_id=?, notification_settings=?,
      club_roles=?, banner_url=?, banner_position=?, banner_zoom=?
      WHERE id=?`;
    const values = [
      this.user_id, this.email, this.gamertag, this.position, this.platform,
      this.country, this.country_code, this.bio, this.avatar_url,
      this.avatar_zoom, this.avatar_position, this.shirt_number,
      this.overall_rating, this.goals, this.assists, this.credits,
      this.subscription, this.role, this.dressing_room_seat, this.is_ready,
      this.club_id, this.notification_settings, this.club_roles,
      this.banner_url, this.banner_position, this.banner_zoom,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM players WHERE id = ?', [id]);
  }

  updateCredits(id, amount) {
    return EXECUTESQL('UPDATE players SET credits = credits + ? WHERE id = ?', [amount, id]);
  }
}

module.exports = Player;

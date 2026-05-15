const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class Player {
  constructor(body = {}) {
    this.id                      = body.id;
    this.user_id                 = body.user_id;
    this.email                   = body.email;
    this.gamertag                = body.gamertag;
    this.position                = body.position;
    this.secondary_position      = body.secondary_position;
    this.platform                = body.platform;
    this.country                 = body.country;
    this.country_code            = body.country_code;
    this.bio                     = body.bio;
    this.avatar_url              = body.avatar_url;
    this.avatar_zoom             = body.avatar_zoom;
    this.avatar_position         = body.avatar_position;
    this.shirt_number            = body.shirt_number;
    this.overall_rating          = body.overall_rating;
    this.goals                   = body.goals;
    this.goals_player            = body.goals_player;
    this.assists                 = body.assists;
    this.matches_played          = body.matches_played;
    this.matches_played_club     = body.matches_played_club;
    this.wins_count              = body.wins_count;
    this.wins_club               = body.wins_club;
    this.losses_count            = body.losses_count;
    this.losses_club             = body.losses_club;
    this.draws_count             = body.draws_count;
    this.draws_club              = body.draws_club;
    this.clean_sheets            = body.clean_sheets;
    this.man_of_the_match        = body.man_of_the_match;
    this.avg_match_rating        = body.avg_match_rating;
    this.credits                 = body.credits;
    this.stc                     = body.stc;
    this.subscription            = body.subscription;
    this.subscription_expires_at = body.subscription_expires_at;
    this.subscription_billing    = body.subscription_billing;
    this.stripe_subscription_id  = body.stripe_subscription_id;
    this.stripe_customer_id      = body.stripe_customer_id;
    this.is_verified             = body.is_verified;
    this.verified_platform       = body.verified_platform;
    this.verified_platform_handle = body.verified_platform_handle;
    this.identity_verified_at    = body.identity_verified_at;
    this.role                    = body.role;
    this.status                  = body.status;
    this.dressing_room_seat      = body.dressing_room_seat;
    this.is_ready                = body.is_ready;
    this.club_id                 = body.club_id;
    this.notification_settings   = body.notification_settings
      ? (typeof body.notification_settings === 'string'
          ? body.notification_settings
          : JSON.stringify(body.notification_settings))
      : null;
    this.club_roles              = body.club_roles
      ? (typeof body.club_roles === 'string'
          ? body.club_roles
          : JSON.stringify(body.club_roles))
      : null;
    this.banner_url              = body.banner_url;
    this.banner_position         = body.banner_position;
    this.banner_zoom             = body.banner_zoom;
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
      (id, user_id, email, gamertag, position, secondary_position, platform, country, country_code, bio,
       avatar_url, avatar_zoom, avatar_position, shirt_number, overall_rating,
       goals, goals_player, assists,
       matches_played, matches_played_club,
       wins_count, wins_club, losses_count, losses_club,
       draws_count, draws_club, clean_sheets, man_of_the_match, avg_match_rating,
       credits, stc, subscription, subscription_expires_at, subscription_billing,
       stripe_subscription_id, stripe_customer_id, is_verified,
       verified_platform, verified_platform_handle, identity_verified_at,
       role, status, dressing_room_seat, is_ready,
       club_id, notification_settings, club_roles,
       banner_url, banner_position, banner_zoom)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.user_id, this.email, this.gamertag, this.position, this.secondary_position, this.platform,
      this.country, this.country_code, this.bio,
      this.avatar_url, this.avatar_zoom, this.avatar_position, this.shirt_number,
      this.overall_rating,
      this.goals, this.goals_player, this.assists,
      this.matches_played, this.matches_played_club,
      this.wins_count, this.wins_club, this.losses_count, this.losses_club,
      this.draws_count, this.draws_club, this.clean_sheets, this.man_of_the_match, this.avg_match_rating,
      this.credits, this.stc, this.subscription, this.subscription_expires_at, this.subscription_billing,
      this.stripe_subscription_id, this.stripe_customer_id, this.is_verified,
      this.verified_platform, this.verified_platform_handle, this.identity_verified_at,
      this.role, this.status, this.dressing_room_seat, this.is_ready,
      this.club_id, this.notification_settings, this.club_roles,
      this.banner_url, this.banner_position, this.banner_zoom,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE players SET
      user_id=?, email=?, gamertag=?, position=?, secondary_position=?, platform=?, country=?, country_code=?,
      bio=?, avatar_url=?, avatar_zoom=?, avatar_position=?, shirt_number=?,
      overall_rating=?,
      goals=?, goals_player=?, assists=?,
      matches_played=?, matches_played_club=?,
      wins_count=?, wins_club=?, losses_count=?, losses_club=?,
      draws_count=?, draws_club=?, clean_sheets=?, man_of_the_match=?, avg_match_rating=?,
      credits=?, stc=?, subscription=?, subscription_expires_at=?, subscription_billing=?,
      stripe_subscription_id=?, stripe_customer_id=?, is_verified=?,
      verified_platform=?, verified_platform_handle=?, identity_verified_at=?,
      role=?, status=?, dressing_room_seat=?, is_ready=?,
      club_id=?, notification_settings=?, club_roles=?,
      banner_url=?, banner_position=?, banner_zoom=?
      WHERE id=?`;
    const values = [
      this.user_id, this.email, this.gamertag, this.position, this.secondary_position, this.platform,
      this.country, this.country_code, this.bio,
      this.avatar_url, this.avatar_zoom, this.avatar_position, this.shirt_number,
      this.overall_rating,
      this.goals, this.goals_player, this.assists,
      this.matches_played, this.matches_played_club,
      this.wins_count, this.wins_club, this.losses_count, this.losses_club,
      this.draws_count, this.draws_club, this.clean_sheets, this.man_of_the_match, this.avg_match_rating,
      this.credits, this.stc, this.subscription, this.subscription_expires_at, this.subscription_billing,
      this.stripe_subscription_id, this.stripe_customer_id, this.is_verified,
      this.verified_platform, this.verified_platform_handle, this.identity_verified_at,
      this.role, this.status, this.dressing_room_seat, this.is_ready,
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

  updateStc(id, amount) {
    return EXECUTESQL('UPDATE players SET stc = stc + ? WHERE id = ?', [amount, id]);
  }
}

module.exports = Player;

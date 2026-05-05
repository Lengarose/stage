const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class ShirtSale {
  constructor(body = {}) {
    this.id              = body.id;
    this.player_id       = body.player_id;
    this.player_gamertag = body.player_gamertag;
    this.shirt_number    = body.shirt_number;
    this.club_id         = body.club_id;
    this.buyer_email     = body.buyer_email;
    this.price_stc       = body.price_stc;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM shirt_sales ORDER BY id DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM shirt_sales WHERE id = ?', [id]);
  }

  selectByClub(club_id) {
    return EXECUTESQL('SELECT * FROM shirt_sales WHERE club_id = ?', [club_id]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO shirt_sales
      (id, player_id, player_gamertag, shirt_number, club_id, buyer_email, price_stc)
      VALUES (?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.player_id, this.player_gamertag, this.shirt_number,
      this.club_id, this.buyer_email, this.price_stc,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE shirt_sales SET
      player_id=?, player_gamertag=?, shirt_number=?, club_id=?,
      buyer_email=?, price_stc=?
      WHERE id=?`;
    const values = [
      this.player_id, this.player_gamertag, this.shirt_number,
      this.club_id, this.buyer_email, this.price_stc,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM shirt_sales WHERE id = ?', [id]);
  }
}

module.exports = ShirtSale;

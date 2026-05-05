const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class LifestyleItem {
  constructor(body = {}) {
    this.id         = body.id;
    this.name       = body.name;
    this.is_active  = body.is_active;
    this.sort_order = body.sort_order;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM lifestyle_items ORDER BY sort_order ASC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM lifestyle_items WHERE id = ?', [id]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO lifestyle_items (id, name, is_active, sort_order) VALUES (?,?,?,?)`;
    return EXECUTESQL(sql, [this.id, this.name, this.is_active, this.sort_order]);
  }

  update(id) {
    const sql = `UPDATE lifestyle_items SET name=?, is_active=?, sort_order=? WHERE id=?`;
    return EXECUTESQL(sql, [this.name, this.is_active, this.sort_order, id]);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM lifestyle_items WHERE id = ?', [id]);
  }
}

module.exports = LifestyleItem;

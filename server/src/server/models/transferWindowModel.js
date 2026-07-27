const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

function toMysqlDateTime(val) {
  if (!val) return null;
  return new Date(val).toISOString().slice(0, 19).replace('T', ' ');
}

class TransferWindowModel {
  constructor(body = {}) {
    this.id                  = body.id;
    this.status              = body.status || 'closed';
    this.start_date          = toMysqlDateTime(body.start_date);
    this.end_date            = toMysqlDateTime(body.end_date);
    this.label               = body.label;
    this.notes               = body.notes;
    this.transfers_executed  = body.transfers_executed ?? 0;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM transfer_windows ORDER BY created_date DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM transfer_windows WHERE id = ?', [id]);
  }

  async selectActive() {
    const rows = await EXECUTESQL(
      "SELECT * FROM transfer_windows WHERE status = 'open' ORDER BY created_date DESC LIMIT 1",
      []
    );
    const win = rows[0];
    if (!win) return [];
    if (win.end_date) {
      const end = new Date(win.end_date);
      if (!Number.isNaN(end.getTime())) {
        if (end.getUTCHours() === 0 && end.getUTCMinutes() === 0 && end.getUTCSeconds() === 0) {
          end.setUTCHours(23, 59, 59, 999);
        }
        if (end.getTime() < Date.now()) {
          await EXECUTESQL(
            "UPDATE transfer_windows SET status = 'closed', updated_date = NOW() WHERE id = ? AND status = 'open'",
            [win.id]
          );
          return [];
        }
      }
    }
    return [win];
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO transfer_windows
      (id, status, start_date, end_date, label, notes, transfers_executed)
      VALUES (?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.status, this.start_date, this.end_date,
      this.label, this.notes, this.transfers_executed,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE transfer_windows SET
      status=?, start_date=?, end_date=?, label=?, notes=?, transfers_executed=?
      WHERE id=?`;
    const values = [
      this.status, this.start_date, this.end_date,
      this.label, this.notes, this.transfers_executed,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM transfer_windows WHERE id = ?', [id]);
  }
}

module.exports = TransferWindowModel;

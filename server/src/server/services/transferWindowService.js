const { EXECUTESQL } = require('../db/database');

function isTransferWindowEndPassed(endDate) {
  if (!endDate) return false;
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return false;
  // Date-only / midnight end_date means the window stays open through that day.
  if (end.getUTCHours() === 0 && end.getUTCMinutes() === 0 && end.getUTCSeconds() === 0) {
    end.setUTCHours(23, 59, 59, 999);
  }
  return end.getTime() < Date.now();
}

async function ensureTransferWindowsTable() {
  try {
    await EXECUTESQL(`
      CREATE TABLE IF NOT EXISTS transfer_windows (
        id VARCHAR(36) PRIMARY KEY,
        label VARCHAR(255),
        status VARCHAR(50) DEFAULT 'open',
        start_date DATETIME,
        end_date DATETIME,
        notes TEXT,
        transfers_executed INT DEFAULT 0,
        created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_date DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    // Startup migrations normally own this table; this fallback keeps old hosts safe.
    console.warn('[transfer_windows] ensure table:', err?.message || err);
  }
}

async function getCurrentTransferWindow() {
  await ensureTransferWindowsTable();
  const rows = await EXECUTESQL(
    "SELECT * FROM transfer_windows WHERE status = 'open' ORDER BY created_date DESC LIMIT 1",
    []
  ).catch((err) => {
    console.warn('[transfer_windows] select open:', err?.message || err);
    return [];
  });
  const win = rows[0] || null;
  if (!win) return null;
  if (isTransferWindowEndPassed(win.end_date)) {
    await EXECUTESQL(
      "UPDATE transfer_windows SET status = 'closed', updated_date = NOW() WHERE id = ? AND status = 'open'",
      [win.id]
    ).catch(() => null);
    return null;
  }
  return win;
}

async function getLatestTransferWindow() {
  const open = await getCurrentTransferWindow();
  if (open) return open;
  const rows = await EXECUTESQL(
    "SELECT * FROM transfer_windows ORDER BY COALESCE(updated_date, created_date) DESC LIMIT 1",
    []
  ).catch(() => []);
  return rows[0] || null;
}

function transferWindowClosedError() {
  const err = new Error('Transfer window is closed. Contract offers can only be sent while the transfer window is open.');
  err.status = 409;
  err.code = 'transfer_window_closed';
  return err;
}

async function assertTransferWindowOpenForContractOffer() {
  const current = await getCurrentTransferWindow();
  if (!current) throw transferWindowClosedError();
  return current;
}

module.exports = {
  assertTransferWindowOpenForContractOffer,
  getCurrentTransferWindow,
  getLatestTransferWindow,
  isTransferWindowEndPassed,
  transferWindowClosedError,
};

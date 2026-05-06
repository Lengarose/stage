const fs = require('fs');
const path = require('path');
const { get } = require('./env');

/**
 * Writable uploads directory.
 * Default: `<folder containing server entry>/uploads` — e.g. vhost root next to `server.js`:
 *   /lamp0/web/vhosts/default/uploads
 * When developing with `node src/server.js`, that resolves to `server/src/uploads`.
 * Override with UPLOADS_DIR (absolute or relative to process.cwd()).
 */
function uploadsDir() {
  const override = get('UPLOADS_DIR');
  if (override && String(override).trim()) {
    const s = String(override).trim();
    return path.isAbsolute(s) ? s : path.resolve(process.cwd(), s);
  }
  const main = require.main && require.main.filename;
  if (main) {
    return path.join(path.dirname(main), 'uploads');
  }
  return path.join(__dirname, '..', '..', 'uploads');
}

function ensureUploadsDir() {
  const dir = uploadsDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

module.exports = { uploadsDir, ensureUploadsDir };

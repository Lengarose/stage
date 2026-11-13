const FRAMES = new Set(['rectangle', 'parallelogram', 'circle']);
function normalizePlayerPhotoFrame(value) {
  // Retired frame values from existing profiles or stale clients use the default.
  if (value == null || value === '' || value === 'triangle') return 'rectangle';
  if (FRAMES.has(value)) return value;
  const error = new Error('Choose a supported player picture frame.');
  error.status = 400;
  throw error;
}
module.exports = { normalizePlayerPhotoFrame };

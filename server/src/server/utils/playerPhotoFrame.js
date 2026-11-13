const FRAMES = new Set(['rectangle', 'parallelogram', 'circle', 'triangle']);
function normalizePlayerPhotoFrame(value) {
  if (value == null || value === '') return 'rectangle';
  if (FRAMES.has(value)) return value;
  const error = new Error('Choose a supported player picture frame.');
  error.status = 400;
  throw error;
}
module.exports = { normalizePlayerPhotoFrame };

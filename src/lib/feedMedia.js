const DEFAULT_MEDIA_POSITION = "50% 50%";
const DEFAULT_MEDIA_ZOOM = 100;
const DEFAULT_MEDIA_ASPECT = "square";

function clampZoom(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_MEDIA_ZOOM;
  return Math.max(100, Math.min(500, Math.round(numeric)));
}

function normalizePosition(value) {
  const text = String(value || "").trim();
  if (!text) return DEFAULT_MEDIA_POSITION;
  const [x, y] = text.split(/\s+/);
  if (!x || !y) return DEFAULT_MEDIA_POSITION;
  return `${x} ${y}`;
}

export function getPostMediaFrame(post = {}) {
  return {
    position: normalizePosition(post.media_position),
    zoom: clampZoom(post.media_zoom),
    aspect: post.media_aspect || DEFAULT_MEDIA_ASPECT,
  };
}

export function getPostImageStyle(post = {}) {
  const frame = getPostMediaFrame(post);
  return {
    objectPosition: frame.position,
    transform: `scale(${frame.zoom / 100})`,
  };
}

export const DEFAULT_POST_MEDIA_FRAME = {
  position: DEFAULT_MEDIA_POSITION,
  zoom: DEFAULT_MEDIA_ZOOM,
  aspect: DEFAULT_MEDIA_ASPECT,
};

const viteEnv = typeof import.meta !== "undefined" ? import.meta.env : {};

/** Override with VITE_INTRO_VIDEO_URL for a higher-bitrate upload (e.g. 1080p). */
export const INTRO_VIDEO_URL = (
  viteEnv?.VITE_INTRO_VIDEO_URL || "https://stageleagues.com/uploads/video/intro.mp4"
).trim();

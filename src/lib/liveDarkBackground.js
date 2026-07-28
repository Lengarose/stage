import trophiesBg from "@/assets/live-dark/trophies.jpg";
import wisBg from "@/assets/live-dark/wis.jpg";
import hiwBg from "@/assets/live-dark/hiw.jpg";

export const LIVE_DARK_BG_STORAGE_KEY = "stage-live-dark-bg";
export const LIVE_DARK_UPLOADS_KEY = "stage-live-dark-uploads";
export const LIVE_DARK_FX_KEY = "stage-live-dark-fx";
export const LIVE_DARK_BG_CHANGE_EVENT = "stage-live-dark-bg-change";

export const LIVE_DARK_MAX_UPLOADS = 3;
export const LIVE_DARK_BLUR_MIN = 0;
export const LIVE_DARK_BLUR_MAX = 16;
export const LIVE_DARK_OVERLAY_MIN = 0;
export const LIVE_DARK_OVERLAY_MAX = 0.85;

/** @typedef {'daily' | 'trophies' | 'wis' | 'hiw' | `custom-${number}`} LiveDarkBgId */

export const LIVE_DARK_BG_OPTIONS = [
  {
    id: "daily",
    labelKey: "stgLiveDarkBgDaily",
    descKey: "stgLiveDarkBgDailyDesc",
  },
  {
    id: "trophies",
    labelKey: "stgLiveDarkBgTrophies",
    src: trophiesBg,
  },
  {
    id: "wis",
    labelKey: "stgLiveDarkBgWis",
    src: wisBg,
  },
  {
    id: "hiw",
    labelKey: "stgLiveDarkBgHiw",
    src: hiwBg,
  },
];

const FIXED_IMAGES = [trophiesBg, wisBg, hiwBg];
const FIXED_IDS = ["trophies", "wis", "hiw"];
const DEFAULT_FX = { blur: 0, overlay: 0.45 };

function notifyChange(detail = {}) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LIVE_DARK_BG_CHANGE_EVENT, { detail }));
  }
}

function isCustomId(id) {
  return typeof id === "string" && /^custom-\d+$/.test(id);
}

function customIndex(id) {
  const m = String(id).match(/^custom-(\d+)$/);
  return m ? Number(m[1]) : -1;
}

function normalizeSlots(raw) {
  const slots = Array.from({ length: LIVE_DARK_MAX_UPLOADS }, () => "");
  if (!Array.isArray(raw)) return slots;
  for (let i = 0; i < LIVE_DARK_MAX_UPLOADS; i++) {
    const v = raw[i];
    if (typeof v === "string" && v) slots[i] = v;
  }
  return slots;
}

/** @returns {string[]} length-3, empty string = vacant */
export function getLiveDarkUploadSlots() {
  try {
    return normalizeSlots(JSON.parse(localStorage.getItem(LIVE_DARK_UPLOADS_KEY) || "[]"));
  } catch {
    return normalizeSlots([]);
  }
}

function persistSlots(slots) {
  const next = normalizeSlots(slots);
  try {
    localStorage.setItem(LIVE_DARK_UPLOADS_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
  notifyChange({ uploads: next });
  return next;
}

export function filledUploadCount(slots = getLiveDarkUploadSlots()) {
  return slots.filter(Boolean).length;
}

/**
 * Fill first empty slot, or fail if full (caller must replace).
 * @param {string} url
 */
export function addLiveDarkUpload(url) {
  const slots = getLiveDarkUploadSlots();
  const empty = slots.findIndex((s) => !s);
  if (empty === -1) return { ok: false, reason: "full", slots };
  slots[empty] = url;
  return { ok: true, index: empty, slots: persistSlots(slots) };
}

/** Replace a specific slot (0–2). */
export function replaceLiveDarkUpload(index, url) {
  if (index < 0 || index >= LIVE_DARK_MAX_UPLOADS || !url) {
    return { ok: false, reason: "invalid", slots: getLiveDarkUploadSlots() };
  }
  const slots = getLiveDarkUploadSlots();
  slots[index] = url;
  return { ok: true, index, slots: persistSlots(slots) };
}

export function clearLiveDarkUpload(index) {
  const slots = getLiveDarkUploadSlots();
  if (index < 0 || index >= LIVE_DARK_MAX_UPLOADS) return slots;
  slots[index] = "";
  const next = persistSlots(slots);
  if (getLiveDarkBgPreference() === `custom-${index}`) setLiveDarkBgPreference("daily");
  return next;
}

/** @returns {{ blur: number, overlay: number }} */
export function getLiveDarkFx() {
  try {
    const raw = JSON.parse(localStorage.getItem(LIVE_DARK_FX_KEY) || "{}");
    const blur = Number(raw.blur);
    const overlay = Number(raw.overlay);
    return {
      blur: Number.isFinite(blur)
        ? Math.min(LIVE_DARK_BLUR_MAX, Math.max(LIVE_DARK_BLUR_MIN, blur))
        : DEFAULT_FX.blur,
      overlay: Number.isFinite(overlay)
        ? Math.min(LIVE_DARK_OVERLAY_MAX, Math.max(LIVE_DARK_OVERLAY_MIN, overlay))
        : DEFAULT_FX.overlay,
    };
  } catch {
    return { ...DEFAULT_FX };
  }
}

/** @param {{ blur?: number, overlay?: number }} patch */
export function setLiveDarkFx(patch = {}) {
  const current = getLiveDarkFx();
  const next = {
    blur:
      patch.blur == null
        ? current.blur
        : Math.min(LIVE_DARK_BLUR_MAX, Math.max(LIVE_DARK_BLUR_MIN, Number(patch.blur))),
    overlay:
      patch.overlay == null
        ? current.overlay
        : Math.min(LIVE_DARK_OVERLAY_MAX, Math.max(LIVE_DARK_OVERLAY_MIN, Number(patch.overlay))),
  };
  try {
    localStorage.setItem(LIVE_DARK_FX_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  notifyChange({ fx: next });
  return next;
}

/** @returns {LiveDarkBgId} */
export function getLiveDarkBgPreference() {
  try {
    const raw = localStorage.getItem(LIVE_DARK_BG_STORAGE_KEY);
    if (raw === "daily" || FIXED_IDS.includes(raw)) return /** @type {LiveDarkBgId} */ (raw);
    if (isCustomId(raw)) {
      const idx = customIndex(raw);
      if (idx >= 0 && getLiveDarkUploadSlots()[idx]) return /** @type {LiveDarkBgId} */ (raw);
    }
  } catch {
    /* ignore */
  }
  return "daily";
}

/** @param {LiveDarkBgId} id */
export function setLiveDarkBgPreference(id) {
  let next = "daily";
  if (id === "daily" || FIXED_IDS.includes(id)) next = id;
  else if (isCustomId(id)) {
    const idx = customIndex(id);
    if (idx >= 0 && getLiveDarkUploadSlots()[idx]) next = id;
  }
  try {
    localStorage.setItem(LIVE_DARK_BG_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  notifyChange({ id: next });
  return /** @type {LiveDarkBgId} */ (next);
}

function dayIndex() {
  return Math.floor(Date.now() / 86_400_000);
}

function rotationPool() {
  return [...FIXED_IMAGES, ...getLiveDarkUploadSlots().filter(Boolean)];
}

/** @param {LiveDarkBgId} [preference] */
export function getLiveDarkBackgroundUrl(preference = getLiveDarkBgPreference()) {
  if (isCustomId(preference)) {
    const src = getLiveDarkUploadSlots()[customIndex(preference)];
    if (src) return src;
  }
  if (preference && preference !== "daily") {
    const fixed = LIVE_DARK_BG_OPTIONS.find((o) => o.id === preference && o.src);
    if (fixed?.src) return fixed.src;
  }
  const pool = rotationPool();
  return pool[dayIndex() % pool.length] || trophiesBg;
}

export function getLiveDarkBgPreviewSrc(id) {
  if (isCustomId(id)) return getLiveDarkUploadSlots()[customIndex(id)] || trophiesBg;
  if (id === "daily") return getLiveDarkBackgroundUrl("daily");
  return LIVE_DARK_BG_OPTIONS.find((o) => o.id === id)?.src || trophiesBg;
}

/**
 * Compress a File to a JPEG data URL (max edge 1600) for localStorage.
 * @param {File} file
 * @returns {Promise<string>}
 */
export function compressImageFileToDataUrl(file, maxEdge = 1600, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read_failed"));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas_failed"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error("image_failed"));
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

const FLAG_CDN_SLUG = {
  ENG: "gb-eng",
  SCO: "gb-sct",
  WAL: "gb-wls",
  NIR: "gb-nir",
  UK: "gb",
  KOS: "xk",
};

/** PNG flag URL for a country code, including Home Nations. */
export function flagImageUrl(code, width = 80) {
  const normalized = String(code || "").toUpperCase();
  const slug = FLAG_CDN_SLUG[normalized] || (normalized.length === 2 ? normalized.toLowerCase() : "");
  if (!slug) return "";
  const size = Math.max(40, Number(width) || 80);
  return `https://flagcdn.com/w${size}/${slug}.png`;
}

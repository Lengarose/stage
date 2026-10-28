// Display only: account identity, filtering and matchmaking keep stored values.
export function formatProfilePlatform(value, fallback = "—", { preserveUnspecified = false } = {}) {
  const raw = String(value ?? "").trim();
  const key = raw.toLowerCase().replace(/[\s_-]+/g, "");
  if (preserveUnspecified && ['playstation', 'ps'].includes(key)) return 'PlayStation';
  // Generic PlayStation is the app's common-gen5 option (see eafcClient).
  if (["playstation", "ps", "playstation5", "ps5"].includes(key)) return "PS5";
  if (["playstation4", "ps4"].includes(key)) return "PS4";
  if (["xbox", "xboxone", "xboxseries", "xboxseriesx", "xboxseriess", "xboxseriesx/s"].includes(key)) return "Xbox";
  if (["pc", "windows"].includes(key)) return "PC";
  if (["crossplatform", "crossplay"].includes(key)) return "Cross-Platform";
  return raw || fallback;
}

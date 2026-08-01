export function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

export function asObjectArray(value) {
  return Array.isArray(value) ? value.filter((item) => asObject(item)) : [];
}

export function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

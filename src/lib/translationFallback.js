function interpolate(text, params = {}) {
  return Object.entries(params).reduce(
    (out, [key, value]) => out.replaceAll(`{${key}}`, String(value)),
    text,
  );
}

function isRawTranslationKey(value, key) {
  if (typeof value !== "string") return false;
  const tail = String(key || "").split(".").pop();
  return value === key || value === tail;
}

export function withTranslationFallback(t) {
  return (key, fallback, params = {}) => {
    const translated = t(key, params);
    if (!isRawTranslationKey(translated, key)) return translated;
    return interpolate(fallback, params);
  };
}

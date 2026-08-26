export function parseAddressList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function parseDraftMeta(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value) || {};
  } catch {
    return {};
  }
}

export function messageRecipients(message) {
  const to = parseAddressList(message?.to_addresses);
  const cc = parseAddressList(message?.cc_addresses);
  let bcc = parseAddressList(message?.bcc_addresses);
  const summary = String(message?.to_email || "");

  if (!bcc.length && (summary.startsWith("Bulk") || /\d+ recipients/i.test(summary))) {
    if (to.length) return { to: [], cc, bcc: to };
  }
  if (!to.length && !cc.length && !bcc.length && summary && summary.includes("@")) {
    return { to: [summary], cc: [], bcc: [] };
  }
  return { to, cc, bcc };
}

export function hasDraftContent(draft) {
  return Boolean(
    String(draft?.to || "").trim()
    || String(draft?.cc || "").trim()
    || String(draft?.bcc || "").trim()
    || String(draft?.subject || "").trim()
    || String(draft?.body || "").trim(),
  );
}

export function joinAddressList(values) {
  return values.join(", ");
}

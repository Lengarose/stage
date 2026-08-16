export const MERCATO_STATUS_LABELS = {
  rumour: "RUMOUR",
  reported: "REPORTED",
  negotiation: "IN NEGOTIATION",
  agreement_close: "CLOSE TO AGREEMENT",
  agreement: "AGREEMENT REACHED",
  medical: "MEDICAL",
  signed: "SIGNED",
  official: "OFFICIAL",
  failed: "DEAL OFF",
};

export const MERCATO_FILTERS = [
  { id: "all", label: "All" },
  { id: "official", label: "Official" },
  { id: "rumours", label: "Rumours" },
  { id: "negotiations", label: "Negotiations" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
  { id: "loans", label: "Loans" },
  { id: "free_agents", label: "Free Agents" },
  { id: "contract_extensions", label: "Extensions" },
];

export const MERCATO_PRICE_BANDS = [
  { id: "any", label: "Any fee", min: 0, max: 0 },
  { id: "u1m", label: "Under 1M", min: 0, max: 1_000_000 },
  { id: "1to10", label: "1M–10M", min: 1_000_000, max: 10_000_000 },
  { id: "10to50", label: "10M–50M", min: 10_000_000, max: 50_000_000 },
  { id: "50plus", label: "50M+", min: 50_000_000, max: 0 },
];

export function mercatoStatusLabel(status) {
  return MERCATO_STATUS_LABELS[status] || String(status || "").toUpperCase();
}

export function transferToNewspaperItem(transfer) {
  if (!transfer) return null;
  const title = transfer.headline
    || [transfer.player_name, transfer.to_club_name].filter(Boolean).join(" to ");
  return {
    id: transfer.id,
    title,
    body: transfer.body || "",
    player_name: transfer.player_name,
    player_id: transfer.player_id,
    player_avatar_url: transfer.player_avatar_url,
    photo_url: transfer.player_photo_url || transfer.player_avatar_url,
    photo_position: transfer.photo_position || "50% 18%",
    club_name: transfer.to_club_name,
    club_id: transfer.to_club_id,
    club_logo_url: transfer.to_club_logo_url,
    transfer_fee_stc: transfer.transfer_fee,
    published_at: transfer.last_updated_at || transfer.published_at,
    _category: transfer.status === "rumour" || transfer.status === "reported" ? "market" : "transfers",
    link: transfer.player_id ? `/players/${transfer.player_id}` : "",
  };
}

export function formatMercatoFee(amount, currency = "STC") {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return "Undisclosed";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M ${currency}`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K ${currency}`;
  return `${value.toLocaleString()} ${currency}`;
}

export function formatMercatoClock(date) {
  if (!date) return "";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  return value.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatMercatoDate(date) {
  if (!date) return "";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  return value.toLocaleDateString("en-GB");
}

export function formatDeadlineCountdown(remainingMs) {
  const ms = Math.max(0, Number(remainingMs) || 0);
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1_000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatSignedBalance(amount, currency = "STC") {
  const value = Number(amount) || 0;
  const formatted = formatMercatoFee(Math.abs(value), currency);
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return formatted === "Undisclosed" ? `0 ${currency}` : formatted;
}

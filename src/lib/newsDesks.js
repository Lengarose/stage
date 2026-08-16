export const DESK_FILTERS = {
  club_news: [
    { id: "all", label: "All" },
    { id: "stadium", label: "Stadium" },
    { id: "shirts", label: "Shirts" },
    { id: "contract", label: "Contracts" },
    { id: "tickets", label: "Tickets" },
    { id: "trophy", label: "Trophies" },
  ],
  player_news: [
    { id: "all", label: "All" },
    { id: "lifestyle", label: "Lifestyle" },
    { id: "ranking", label: "Rankings" },
    { id: "signed", label: "Signed" },
    { id: "motm", label: "MOTM" },
  ],
  tournament: [
    { id: "all", label: "All" },
    { id: "field", label: "The field" },
    { id: "phase", label: "Phases" },
    { id: "champion", label: "Champions" },
  ],
  competitions: [
    { id: "all", label: "All" },
    { id: "field", label: "The table" },
    { id: "phase", label: "Matchdays" },
    { id: "champion", label: "Titles" },
  ],
  daily_news: [
    { id: "all", label: "All" },
    { id: "club_news", label: "Club" },
    { id: "player_news", label: "Player" },
    { id: "tournament", label: "Tournament" },
    { id: "competitions", label: "Competition" },
    { id: "mercato", label: "Mercato" },
    { id: "press", label: "Press" },
  ],
};

export function formatDeskClock(date) {
  if (!date) return "";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  return value.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatDeskAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M STC`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K STC`;
  return `${value.toLocaleString()} STC`;
}

export function matchesDeskFilter(row, filterId = "all") {
  if (!filterId || filterId === "all") return true;
  if (row?.beat === filterId) return true;
  return row?.kind === filterId || row?.stamp === String(filterId).toUpperCase();
}

export function filterDeskFeed(rows, { filter = "all", query = "" } = {}) {
  const q = String(query || "").trim().toLowerCase();
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (!matchesDeskFilter(row, filter)) return false;
    if (!q) return true;
    const hay = `${row.title || ""} ${row.body || ""} ${row.club_name || ""} ${row.player_name || ""} ${row.tournament_name || ""} ${row.name || ""}`.toLowerCase();
    return hay.includes(q);
  });
}

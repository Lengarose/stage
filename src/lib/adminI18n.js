/** Map admin route slugs to translation key segments (camelCase). */
const SECTION_SLUG_TO_KEY = {
  disputes: "disputes",
  forfeits: "forfeits",
  players: "players",
  clubs: "clubs",
  rankings: "rankings",
  leagues: "leagues",
  tournaments: "tournaments",
  "international-tournaments": "internationalTournaments",
  news: "news",
  lifestyles: "lifestyles",
  transfers: "transfers",
  "match-archive": "matchArchive",
  trophies: "trophies",
  rewards: "rewards",
  landing: "landing",
  home: "home",
  analytics: "analytics",
  store: "store",
};

export function getAdminSectionKey(slug) {
  if (!slug) return null;
  return SECTION_SLUG_TO_KEY[slug] || slug;
}

export function getAdminSectionLabel(t, slug) {
  const key = getAdminSectionKey(slug);
  if (!key) return t("admin.shell.title");
  return t(`admin.sections.${key}`);
}

export function getSeasonStatusLabel(t, status) {
  const key = String(status || "").toLowerCase();
  return t(`admin.seasonStatus.${key}`) || status;
}

export function getSimTestDescription(t, name) {
  return t(`admin.economy.simTests.${name}`) || name;
}

export function getVerifyTestDescription(t, name) {
  return t(`admin.economy.verifyTests.${name}`) || name;
}

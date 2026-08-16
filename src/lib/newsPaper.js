export function toNewspaperHeadline(title = "") {
  return String(title)
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function newsStoryImage(item) {
  if (!item || typeof item !== "object") return "";
  return String(
    item.photo_url || item.image_url || item.player_avatar_url || item.club_logo_url || "",
  ).trim();
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatNewspaperDate(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  return `${WEEKDAYS[value.getUTCDay()]}, ${value.getUTCDate()} ${MONTHS[value.getUTCMonth()]} ${value.getUTCFullYear()}`;
}

export function newspaperVolume(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  return Number.isNaN(value.getTime()) ? "" : String(value.getUTCFullYear());
}

export function storyByline(item) {
  if (!item) return "";
  return [item.player_name, item.club_name].filter(Boolean).join("  —  ");
}

export function formatTransferFee(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M STC`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K STC`;
  return `${value} STC`;
}

/** Masthead sections. All is first, then Mercato. */
export const NEWS_SECTION_FILTERS = [
  { id: "all", labelKey: "all" },
  { id: "mercato", labelKey: "mercato" },
  { id: "club_news", labelKey: "clubNews" },
  { id: "player_news", labelKey: "playerNews" },
  { id: "tournament", labelKey: "tournaments" },
  { id: "competitions", labelKey: "competitions" },
  { id: "daily_news", labelKey: "dailyNews" },
  { id: "world_news", labelKey: "worldNews" },
];

const KNOWN_SECTIONS = new Set(
  NEWS_SECTION_FILTERS.map((filter) => filter.id).filter((id) => id !== "all"),
);

const TYPE_TO_CATEGORY = {
  transfer: "transfers",
  contract: "contracts",
  tournament: "tournament",
  league: "competitions",
  competition: "competitions",
  achievement: "achievement",
  app_update: "announcement",
  ranking: "ranking",
  press_conference: "press_conference",
  announcement: "announcement",
  club_news: "club_news",
  player_news: "player_news",
  market: "market",
  stadium: "stadium",
  shirts: "shirts",
  lifestyle: "lifestyle",
  tickets: "tickets",
  trophy: "trophy",
  motm: "motm",
};

const SECTIONS_BY_CATEGORY = {
  contracts: ["mercato"],
  transfers: ["mercato"],
  market: ["mercato"],
  club_news: ["club_news"],
  stadium: ["club_news"],
  shirts: ["club_news"],
  tickets: ["club_news"],
  trophy: ["club_news"],
  player_news: ["player_news"],
  lifestyle: ["player_news"],
  achievement: ["player_news"],
  ranking: ["player_news"],
  motm: ["player_news"],
  tournament: ["tournament"],
  competitions: ["competitions"],
  press_conference: ["daily_news"],
  announcement: ["daily_news"],
  general: ["daily_news"],
};

const CLUB_CONTRACT_RE = /\b(offered(?: a)?(?: trial)?(?: contract)?|offered renewal|cancelled a contract offer|terminated|released)\b/i;
const PLAYER_SIGNED_RE = /\b(joined|has accepted|signed)\b/i;

export function contractNewsSections(title = "", body = "") {
  const text = `${title} ${body}`;
  if (/\b(transfer fee|paid .+ fee)\b/i.test(text) && !CLUB_CONTRACT_RE.test(text) && !PLAYER_SIGNED_RE.test(text)) {
    return ["club_news"];
  }
  if (PLAYER_SIGNED_RE.test(text)) return ["player_news"];
  if (CLUB_CONTRACT_RE.test(text)) return ["club_news"];
  return ["daily_news"];
}

function parseTagList(value) {
  if (Array.isArray(value)) return value.map((tag) => String(tag || "").trim()).filter(Boolean);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parseTagList(parsed);
  } catch {
    /* comma-separated fallback */
  }
  return value.split(",").map((tag) => tag.trim()).filter(Boolean);
}

export function resolveNewsCategory(item) {
  if (item?.category && item.category !== "general") return item.category;
  return TYPE_TO_CATEGORY[item?.type] || "general";
}

export function newsStorySections(item) {
  const tagged = parseTagList(item?.tags).filter((tag) => KNOWN_SECTIONS.has(tag));
  if (tagged.length) return tagged;
  const category = item?._category || resolveNewsCategory(item);
  const derived = SECTIONS_BY_CATEGORY[category] || SECTIONS_BY_CATEGORY[item?.type] || [];
  return derived.length ? derived : ["daily_news"];
}

export function isSameNewsDay(item, now = new Date()) {
  const published = new Date(item?.published_at || item?.created_date || 0);
  if (Number.isNaN(published.getTime())) return false;
  const current = now instanceof Date ? now : new Date(now);
  return published.getUTCFullYear() === current.getUTCFullYear()
    && published.getUTCMonth() === current.getUTCMonth()
    && published.getUTCDate() === current.getUTCDate();
}

export function matchesNewsSection(item, filterId = "all", now = new Date()) {
  if (!filterId || filterId === "all") return true;
  if (filterId === "daily_news") return isSameNewsDay(item, now);
  if (filterId === "world_news") return true;
  return newsStorySections(item).includes(filterId);
}

export function mergeNewspaperFeed(newsItems, pressArticles) {
  const news = (Array.isArray(newsItems) ? newsItems : []).map((item) => ({
    ...item,
    _category: resolveNewsCategory(item),
  }));
  const fromPress = (Array.isArray(pressArticles) ? pressArticles : []).map((article) => ({
    id: `press_${article.id}`,
    type: "press_conference",
    category: "press_conference",
    _category: "press_conference",
    title: article.headline || article.title,
    body: article.quotes?.[0]?.answer ? `"${article.quotes[0].answer}"` : (article.summary || article.body || ""),
    club_name: article.club_name,
    club_logo_url: article.club_logo_url,
    player_name: article.player_name,
    player_avatar_url: article.player_avatar_url,
    photo_url: article.photo_url || null,
    photo_position: article.photo_position || "50% 50%",
    published_at: article.published_at,
    quotes: article.quotes,
    is_global: true,
  }));
  return [...news, ...fromPress].sort((a, b) => (
    new Date(b.published_at || b.created_date || 0) - new Date(a.published_at || a.created_date || 0)
  ));
}

export function isNewspaperVisible(item, myPlayer, myClub) {
  if (item?.is_global) return true;
  const hasVisibilityData = (
    (item?.visible_to_club_ids?.length > 0) ||
    (item?.visible_to_player_ids?.length > 0)
  );
  if (!hasVisibilityData) return true;
  if (item._category === "press_conference") return true;
  if (myClub && item.visible_to_club_ids?.includes(myClub.id)) return true;
  if (myPlayer && item.visible_to_player_ids?.includes(myPlayer.id)) return true;
  return false;
}

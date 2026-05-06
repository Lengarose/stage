import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { cn } from "@/lib/utils";
import {
  Newspaper, ArrowRightLeft, FileSignature, Shield,
  User, TrendingUp, Trophy, Mic, Megaphone, Star, Zap
} from "lucide-react";
import NewsArticleCard from "@/components/news/NewsArticleCard";
import NewsFeaturedCard from "@/components/news/NewsFeaturedCard";
import PressArticleCard from "@/components/news/PressArticleCard";

// ── Category config ────────────────────────────────────────────────────────
export const CATEGORY_CONFIG = {
  transfers:        { label: "Transfers",       icon: ArrowRightLeft,  color: "text-warning",     bg: "bg-warning/10 border-warning/30" },
  contracts:        { label: "Contracts",       icon: FileSignature,   color: "text-primary",     bg: "bg-primary/10 border-primary/30" },
  club_news:        { label: "Club News",       icon: Shield,          color: "text-accent",      bg: "bg-accent/10 border-accent/30" },
  player_news:      { label: "Player News",     icon: User,            color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/30" },
  market:           { label: "Market",          icon: TrendingUp,      color: "text-success",     bg: "bg-success/10 border-success/30" },
  tournament:       { label: "Tournament",      icon: Trophy,          color: "text-accent",      bg: "bg-accent/10 border-accent/30" },
  press_conference: { label: "Press Room",      icon: Mic,             color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/30" },
  general:          { label: "General",         icon: Megaphone,       color: "text-primary",     bg: "bg-primary/10 border-primary/30" },
  // legacy fallbacks
  achievement:      { label: "Achievement",     icon: Star,            color: "text-warning",     bg: "bg-warning/10 border-warning/30" },
  app_update:       { label: "App Update",      icon: Zap,             color: "text-primary",     bg: "bg-primary/10 border-primary/30" },
  ranking:          { label: "Rankings",        icon: TrendingUp,      color: "text-success",     bg: "bg-success/10 border-success/30" },
  announcement:     { label: "Announcement",    icon: Megaphone,       color: "text-primary",     bg: "bg-primary/10 border-primary/30" },
};

const FILTERS = [
  { id: "all",              label: "All" },
  { id: "transfers",        label: "Transfers" },
  { id: "contracts",        label: "Contracts" },
  { id: "club_news",        label: "Club News" },
  { id: "player_news",      label: "Player News" },
  { id: "market",           label: "Market" },
  { id: "tournament",       label: "Tournaments" },
  { id: "press_conference", label: "Press Room" },
];

export function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Resolve category: prefer `category` field, fall back by `type` for old records */
function resolveCategory(item) {
  if (item.category && item.category !== "general") return item.category;
  const typeMap = {
    transfer: "transfers",
    contract: "contracts",
    tournament: "tournament",
    achievement: "general",
    app_update: "general",
    ranking: "general",
    press_conference: "press_conference",
    announcement: "general",
    club_news: "club_news",
    player_news: "player_news",
    market: "market",
  };
  return typeMap[item.type] || "general";
}

function mergeAndSort(newsItems, pressArticles) {
  const fromPress = pressArticles.map(a => ({
    id: "press_" + a.id,
    type: "press_conference",
    category: "press_conference",
    title: a.headline,
    body: a.quotes?.[0] ? `"${a.quotes[0].answer}"` : "",
    club_name: a.club_name,
    club_logo_url: a.club_logo_url,
    player_name: a.player_name,
    player_avatar_url: a.player_avatar_url,
    photo_url: a.photo_url || null,
    photo_position: a.photo_position || "50% 50%",
    photo_zoom: a.photo_zoom || 120,
    published_at: a.published_at,
    match_name: a.match_name,
    tournament_name: a.tournament_name,
    quotes: a.quotes,
    is_featured: false,
    is_global: true,
    _raw_press: a,
  }));

  return [...newsItems, ...fromPress]
    .map(i => ({ ...i, _category: resolveCategory(i) }))
    .sort((a, b) => new Date(b.published_at || b.created_date || 0) - new Date(a.published_at || a.created_date || 0));
}

/** Determine if a news item is visible to the current user */
function isVisible(item, myPlayer, myClub, followedIds) {
  // Global items visible to everyone
  if (item.is_global) return true;

  // Legacy items with no visibility data — show them
  const hasVisibilityData =
    (item.visible_to_club_ids?.length > 0) ||
    (item.visible_to_player_ids?.length > 0);
  if (!hasVisibilityData) return true;

  // Press conferences always visible
  if (item._category === "press_conference") return true;

  // Club membership
  if (myClub && item.visible_to_club_ids?.includes(myClub.id)) return true;

  // Player directly involved
  if (myPlayer && item.visible_to_player_ids?.includes(myPlayer.id)) return true;

  // Following the club or player involved
  if (item.club_id && followedIds.has(item.club_id)) return true;
  if (item.player_id && followedIds.has(item.player_id)) return true;

  return false;
}

export default function News() {
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [myPlayer, setMyPlayer] = useState(null);
  const [myClub, setMyClub] = useState(null);
  const [followedIds, setFollowedIds] = useState(new Set());

  useEffect(() => {
    async function load() {
      let player = null;
      let club = null;
      let followed = new Set();

      try {
        const u = await stageClient.auth.me();
        const players = await stageClient.entities.Player.filter({ email: u.email });
        player = players[0] || null;
        setMyPlayer(player);

        if (player?.club_id) {
          const clubs = await stageClient.entities.Club.filter({ id: player.club_id });
          club = clubs[0] || null;
          setMyClub(club);
        }

        // Load followed entities to use for visibility
        const follows = await stageClient.entities.Follow.filter({ follower_player_id: player?.id });
        followed = new Set(follows.map(f => f.target_id));
        setFollowedIds(followed);
      } catch (_) {}

      const [news, press] = await Promise.all([
        stageClient.entities.NewsItem.list("-published_at", 100),
        stageClient.entities.PressArticle.list("-published_at", 30),
      ]);

      const merged = mergeAndSort(news, press);
      setAllItems(merged);
      setLoading(false);
    }
    load();

    const unsub1 = stageClient.entities.NewsItem.subscribe(e => {
      if (e.type === "create") {
        const item = { ...e.data, _category: resolveCategory(e.data) };
        setAllItems(prev => [item, ...prev]);
      }
    });
    const unsub2 = stageClient.entities.PressArticle.subscribe(e => {
      if (e.type === "create") {
        const a = e.data;
        const item = {
          id: "press_" + a.id, type: "press_conference", category: "press_conference",
          _category: "press_conference",
          title: a.headline, body: a.quotes?.[0] ? `"${a.quotes[0].answer}"` : "",
          club_name: a.club_name, club_logo_url: a.club_logo_url,
          player_name: a.player_name, player_avatar_url: a.player_avatar_url,
          published_at: a.published_at, quotes: a.quotes, is_global: true,
        };
        setAllItems(prev => [item, ...prev]);
      }
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  const visible = allItems.filter(i => isVisible(i, myPlayer, myClub, followedIds));
  const filtered = activeFilter === "all" ? visible : visible.filter(i => i._category === activeFilter);

  const featured = filtered.find(i => i.is_featured) || filtered[0];
  const rest = filtered.filter(i => i !== featured);

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Newspaper className="w-6 h-6 text-primary shrink-0" />
          <div>
            <h1
              className="font-heading font-black text-5xl md:text-6xl text-foreground uppercase"
              style={{ transform: "skewX(-8deg)", letterSpacing: "-0.02em", transformOrigin: "left center" }}
            >
              NEWS
            </h1>
            <p className="text-xs text-muted-foreground mt-1">Transfers · Contracts · Club & Player news · Press Room</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider border transition-all",
                activeFilter === f.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="bg-card border border-border rounded-2xl p-12 text-center space-y-3">
            <Newspaper className="w-12 h-12 text-muted-foreground/20 mx-auto" />
            <p className="text-foreground font-semibold">Nothing here yet</p>
            <p className="text-sm text-muted-foreground">
              News will appear as transfers, contracts, matches and tournaments happen.
            </p>
          </div>
        )}

        {/* Feed */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-8">
            {/* Featured / Hero */}
            {featured && (
              featured._category === "press_conference"
                ? <PressArticleCard item={featured} />
                : <NewsFeaturedCard item={featured} />
            )}

            {/* Rest */}
            {rest.length > 0 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rest.map(item =>
                  item._category === "press_conference"
                    ? <PressArticleCard key={item.id} item={item} compact />
                    : <NewsArticleCard key={item.id} item={item} />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
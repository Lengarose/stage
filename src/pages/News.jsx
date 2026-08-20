import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowRightLeft, FileSignature, Shield,
  User, TrendingUp, Trophy, Megaphone, Star, Zap
} from "lucide-react";
import AllNewsPaper from "@/components/news/AllNewsPaper";
import MercatoPaper from "@/components/news/MercatoPaper";
import NewsBeatDesk from "@/components/news/NewsBeatDesk";
import WorldNewsDesk from "@/components/news/WorldNewsDesk";
import { useTranslation } from "@/hooks/useTranslation";
import {
  NEWS_SECTION_FILTERS,
  formatNewspaperDate,
  newspaperVolume,
} from "@/lib/newsPaper";
import "./newsPaper.css";

export const CATEGORY_CONFIG = {
  transfers:        { label: "Transfers",       labelKey: "transfers", icon: ArrowRightLeft,  color: "text-warning",     bg: "bg-warning/10 border-warning/30" },
  contracts:        { label: "Contracts",       labelKey: "contracts", icon: FileSignature,   color: "text-primary",     bg: "bg-primary/10 border-primary/30" },
  club_news:        { label: "Club News",       labelKey: "clubNews", icon: Shield,          color: "text-accent",      bg: "bg-accent/10 border-accent/30" },
  player_news:      { label: "Player News",     labelKey: "playerNews", icon: User,            color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/30" },
  market:           { label: "Market",          labelKey: "market", icon: TrendingUp,      color: "text-success",     bg: "bg-success/10 border-success/30" },
  tournament:       { label: "Tournaments",     labelKey: "tournaments", icon: Trophy,          color: "text-accent",      bg: "bg-accent/10 border-accent/30" },
  stadium:          { label: "Stadium",         labelKey: "clubNews", icon: Shield,          color: "text-accent",      bg: "bg-accent/10 border-accent/30" },
  shirts:           { label: "Shirts",          labelKey: "clubNews", icon: Shield,          color: "text-accent",      bg: "bg-accent/10 border-accent/30" },
  tickets:          { label: "Tickets",         labelKey: "clubNews", icon: Shield,          color: "text-accent",      bg: "bg-accent/10 border-accent/30" },
  trophy:           { label: "Trophies",        labelKey: "clubNews", icon: Trophy,          color: "text-accent",      bg: "bg-accent/10 border-accent/30" },
  lifestyle:        { label: "Lifestyle",       labelKey: "playerNews", icon: User,            color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/30" },
  motm:             { label: "MOTM",            labelKey: "playerNews", icon: Star,            color: "text-warning",     bg: "bg-warning/10 border-warning/30" },
  competitions:     { label: "Competitions",    labelKey: "competitions", icon: Trophy,          color: "text-accent",      bg: "bg-accent/10 border-accent/30" },
  ranking:          { label: "Rankings",        labelKey: "rankings", icon: TrendingUp,      color: "text-success",     bg: "bg-success/10 border-success/30" },
  general:          { label: "General",         labelKey: "general", icon: Megaphone,       color: "text-primary",     bg: "bg-primary/10 border-primary/30" },
  achievement:      { label: "Achievement",     labelKey: "achievement", icon: Star,            color: "text-warning",     bg: "bg-warning/10 border-warning/30" },
  app_update:       { label: "App Update",      labelKey: "appUpdate", icon: Zap,             color: "text-primary",     bg: "bg-primary/10 border-primary/30" },
  announcement:     { label: "Announcement",    labelKey: "announcement", icon: Megaphone,       color: "text-primary",     bg: "bg-primary/10 border-primary/30" },
};

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

export default function News() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeFilter, setActiveFilter] = useState(searchParams.get("section") || "mercato");
  const transferId = searchParams.get("transfer") || "";
  const editionDate = formatNewspaperDate(new Date());
  const volume = newspaperVolume(new Date());

  useEffect(() => {
    const next = searchParams.get("section") || "mercato";
    setActiveFilter(next);
  }, [searchParams]);

  return (
    <div className="news-paper-page news-paper-page--viewport">
      <div className="news-paper-sheet">
        <header className="news-paper-masthead">
          <p className="news-paper-kicker">
            <span className="news-paper-kicker-slug">Stage League</span>
            <span>Late edition</span>
          </p>
          <h1 className="news-paper-title">THE STAGE TIMES</h1>
        </header>
        <div className="news-paper-dateline">
          <span>Vol. {volume} · No. {new Date().getUTCDate()}</span>
          <span>{editionDate}</span>
          <span>Matchday</span>
        </div>

        <nav className="news-paper-sections" aria-label="Newspaper sections">
          {NEWS_SECTION_FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setActiveFilter(f.id);
                setSearchParams(f.id === "mercato" ? (transferId ? { transfer: transferId } : {}) : { section: f.id });
              }}
              aria-pressed={activeFilter === f.id}
            >
              {t(`commonPages.${f.labelKey}`)}
            </button>
          ))}
        </nav>

        {activeFilter === "mercato" ? (
          <MercatoPaper initialTransferId={transferId} />
        ) : activeFilter === "all" ? (
          <AllNewsPaper />
        ) : activeFilter === "world_news" ? (
          <WorldNewsDesk
            initialContinent={searchParams.get("continent") || ""}
            initialCountry={searchParams.get("country") || ""}
          />
        ) : (
          <NewsBeatDesk section={activeFilter} />
        )}
      </div>
    </div>
  );
}

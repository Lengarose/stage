import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import { Newspaper, Trophy, Star, Zap, BarChart3, Mic, Megaphone, ArrowRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_CONFIG = {
  tournament:       { label: "Tournament",      icon: Trophy,     color: "text-accent",    bg: "bg-accent/10 border-accent/20",     dot: "bg-accent" },
  achievement:      { label: "Achievement",     icon: Star,       color: "text-warning",   bg: "bg-warning/10 border-warning/20",   dot: "bg-warning" },
  app_update:       { label: "Update",          icon: Zap,        color: "text-primary",   bg: "bg-primary/10 border-primary/20",   dot: "bg-primary" },
  ranking:          { label: "Rankings",        icon: BarChart3,  color: "text-success",   bg: "bg-success/10 border-success/20",   dot: "bg-success" },
  press_conference: { label: "Press Room",      icon: Mic,        color: "text-purple-400",bg: "bg-purple-500/10 border-purple-500/20", dot: "bg-purple-400" },
  announcement:     { label: "Announcement",   icon: Megaphone,  color: "text-primary",   bg: "bg-primary/10 border-primary/20",   dot: "bg-primary" },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function mergeAndSort(newsItems, pressArticles) {
  const fromPress = pressArticles.map(a => ({
    id: "press_" + a.id,
    type: "press_conference",
    title: a.headline,
    body: a.quotes?.[0] ? `"${a.quotes[0].answer}" — ${a.quotes[0].reporter_name}, ${a.quotes[0].outlet}` : "",
    club_name: a.club_name,
    club_logo_url: a.club_logo_url,
    player_name: a.player_name,
    player_avatar_url: a.player_avatar_url,
    published_at: a.published_at,
    link: "/news",
    is_featured: false,
  }));
  return [...newsItems, ...fromPress]
    .sort((a, b) => new Date(b.published_at || b.created_date) - new Date(a.published_at || a.created_date));
}

export default function NewsWidget() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      Promise.all([
        stageClient.entities.NewsItem.list("-published_at", 20),
        stageClient.entities.PressArticle.list("-published_at", 10),
      ]).then(([news, press]) => {
        setItems(mergeAndSort(news, press));
        setLoading(false);
      });
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const featured = items.find(i => i.is_featured) || items[0];
  const rest = items.filter(i => i !== featured).slice(0, 4);

  if (loading) return (
    <div className="flex items-center justify-center py-10">
      <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (items.length === 0) return (
    <div className="text-center py-8">
      <Newspaper className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
      <p className="text-muted-foreground text-sm">No news yet. Check back soon.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Featured Card */}
      {featured && (() => {
        const cfg = TYPE_CONFIG[featured.type] || TYPE_CONFIG.announcement;
        const Icon = cfg.icon;
        return (
          <Link to={featured.link || "/news"} className="block group">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-secondary hover:border-primary/30 transition-all duration-300">
              {/* Decorative glow */}
              <div className={cn("absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-20", cfg.dot)} />

              {featured.image_url && (
                <div className="h-48 w-full overflow-hidden">
                  <img src={featured.image_url} alt={featured.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
                </div>
              )}

              <div className="p-6 relative">
                {/* Type badge */}
                <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold uppercase tracking-wider mb-3", cfg.bg, cfg.color)}>
                  <Icon className="w-3 h-3" />
                  {cfg.label}
                  <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse ml-0.5", cfg.dot)} />
                </div>

                <h3 className="text-xl font-bold text-foreground leading-tight font-heading group-hover:text-primary transition-colors">
                  {featured.title}
                </h3>

                {featured.body && (
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed line-clamp-2">{featured.body}</p>
                )}

                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2">
                    {featured.club_logo_url && (
                      <img src={featured.club_logo_url} alt={featured.club_name} className="w-5 h-5 rounded-full object-cover border border-border" />
                    )}
                    {featured.player_avatar_url && !featured.club_logo_url && (
                      <img src={featured.player_avatar_url} alt={featured.player_name} className="w-5 h-5 rounded-full object-cover border border-border" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {featured.club_name || featured.player_name || "STAGE"}
                    </span>
                    {featured.published_at && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-xs text-muted-foreground/60">{timeAgo(featured.published_at)}</span>
                      </>
                    )}
                  </div>
                  <span className={cn("text-xs font-semibold flex items-center gap-1 group-hover:gap-2 transition-all", cfg.color)}>
                    Read <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </div>
          </Link>
        );
      })()}

      {/* Side stories */}
      {rest.length > 0 && (
        <div className="space-y-2">
          {rest.map(item => {
            const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.announcement;
            const Icon = cfg.icon;
            return (
              <Link key={item.id} to={item.link || "/news"} className="block group">
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary/60 border border-border hover:border-primary/30 hover:bg-secondary transition-all">
                  <div className={cn("w-8 h-8 rounded-lg border flex items-center justify-center shrink-0", cfg.bg)}>
                    <Icon className={cn("w-4 h-4", cfg.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={cn("text-[10px] uppercase font-bold tracking-wider", cfg.color)}>{cfg.label}</span>
                      {item.published_at && (
                        <>
                          <span className="text-muted-foreground/40 text-[10px]">·</span>
                          <span className="text-[10px] text-muted-foreground/60">{timeAgo(item.published_at)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary shrink-0 transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* View all */}
      <Link to="/news" className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border/60 text-xs font-semibold text-muted-foreground hover:text-primary hover:border-primary/30 transition-all">
        <Newspaper className="w-3.5 h-3.5" /> View All News
      </Link>
    </div>
  );
}
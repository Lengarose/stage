import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { CATEGORY_CONFIG, timeAgo } from "@/pages/News";

export default function NewsArticleCard({ item }) {
  const cat = CATEGORY_CONFIG[item._category] || CATEGORY_CONFIG.general;
  const Icon = cat.icon;

  const content = (
    <div className={cn(
      "rounded-2xl border bg-card overflow-hidden hover:shadow-lg hover:shadow-black/20 transition-all group cursor-pointer h-full flex flex-col",
      "border-border hover:border-primary/30"
    )}>
      {/* Category tag + timestamp row */}
      <div className="px-4 pt-4 flex items-center justify-between gap-2">
        <div className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider",
          cat.bg, cat.color
        )}>
          <Icon className="w-2.5 h-2.5" />
          {cat.label}
        </div>
        <span className="text-[10px] text-muted-foreground/60 shrink-0">{timeAgo(item.published_at)}</span>
      </div>

      {/* Main content */}
      <div className="p-4 flex-1 flex flex-col gap-2">
        <h3 className="font-bold text-foreground leading-snug text-sm group-hover:text-primary transition-colors line-clamp-2">
          {item.title}
        </h3>
        {item.body && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 flex-1">
            {item.body}
          </p>
        )}
      </div>

      {/* Footer — entities */}
      {(item.club_name || item.player_name) && (
        <div className="px-4 pb-4 flex items-center gap-2 pt-2 border-t border-border/40">
          {item.club_logo_url && (
            <img src={item.club_logo_url} alt={item.club_name} className="w-5 h-5 rounded object-cover shrink-0 border border-border" />
          )}
          {item.player_avatar_url && !item.club_logo_url && (
            <img src={item.player_avatar_url} alt={item.player_name} className="w-5 h-5 rounded-full object-cover shrink-0 border border-border" />
          )}
          {item.club_logo_url && item.player_avatar_url && (
            <img src={item.player_avatar_url} alt={item.player_name} className="w-5 h-5 rounded-full object-cover shrink-0 border border-border -ml-2" />
          )}
          <span className="text-[10px] text-muted-foreground truncate flex-1">
            {[item.player_name, item.club_name].filter(Boolean).join(" → ")}
          </span>
          {item.transfer_fee_stc > 0 && (
            <span className="text-[10px] font-bold text-warning shrink-0">
              {item.transfer_fee_stc >= 1_000_000
                ? `${(item.transfer_fee_stc / 1_000_000).toFixed(1)}M`
                : `${(item.transfer_fee_stc / 1_000).toFixed(0)}K`} STC
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (item.link) {
    return <Link to={item.link} className="h-full block">{content}</Link>;
  }
  return content;
}
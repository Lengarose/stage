import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { CATEGORY_CONFIG, timeAgo } from "@/pages/News";

export default function NewsFeaturedCard({ item }) {
  const cat = CATEGORY_CONFIG[item._category] || CATEGORY_CONFIG.general;
  const Icon = cat.icon;

  const inner = (
    <div className={cn("relative rounded-2xl border overflow-hidden bg-card group cursor-pointer", cat.bg)}>
      {/* Hero image if present */}
      {item.image_url && (
        <div className="h-52 sm:h-64 w-full overflow-hidden">
          <img
            src={item.image_url}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 h-52 sm:h-64 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        </div>
      )}

      <div className="p-5 sm:p-7 space-y-3">
        {/* Category + featured badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider",
            cat.bg, cat.color
          )}>
            <Icon className="w-3 h-3" />
            {cat.label}
            {item.is_featured && (
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse ml-0.5" />
            )}
          </div>
          {item.is_featured && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-warning border border-warning/30 bg-warning/10 px-2 py-0.5 rounded-full">
              ⭐ Featured
            </span>
          )}
        </div>

        {/* Title */}
        <h2 className={cn("text-xl sm:text-2xl font-bold leading-tight font-heading group-hover:opacity-90 transition-opacity", cat.color)}>
          {item.title}
        </h2>

        {/* Body */}
        {item.body && (
          <p className="text-muted-foreground leading-relaxed text-sm line-clamp-3">
            {item.body}
          </p>
        )}

        {/* Entities + timestamp */}
        <div className="flex items-center gap-3 pt-2 border-t border-white/10 flex-wrap">
          {item.club_logo_url && (
            <img src={item.club_logo_url} alt={item.club_name} className="w-6 h-6 rounded-full object-cover border border-border shrink-0" />
          )}
          {item.player_avatar_url && (
            <img src={item.player_avatar_url} alt={item.player_name} className="w-6 h-6 rounded-full object-cover border border-border shrink-0" />
          )}
          <span className="text-sm font-medium text-foreground/80 truncate flex-1">
            {[item.player_name, item.club_name].filter(Boolean).join(" → ")}
          </span>
          {item.transfer_fee_stc > 0 && (
            <span className="text-xs font-bold text-warning shrink-0">
              {item.transfer_fee_stc >= 1_000_000
                ? `${(item.transfer_fee_stc / 1_000_000).toFixed(1)}M`
                : `${(item.transfer_fee_stc / 1_000).toFixed(0)}K`} STC
            </span>
          )}
          <span className="text-xs text-muted-foreground/60 shrink-0">{timeAgo(item.published_at)}</span>
        </div>
      </div>
    </div>
  );

  if (item.link) {
    return <Link to={item.link}>{inner}</Link>;
  }
  return inner;
}
import { cn } from "@/lib/utils";
import { Mic } from "lucide-react";
import { timeAgo } from "@/pages/News";

export default function PressArticleCard({ item, compact = false }) {
  const heroImage = item.photo_url || item.player_avatar_url;
  const bgPos = item.photo_url ? (item.photo_position || "50% 50%") : "50% 50%";
  const bgZoom = item.photo_url ? (item.photo_zoom || 120) : 100;

  if (compact) {
    return (
      <article className="rounded-2xl border border-purple-500/20 bg-card overflow-hidden flex flex-col">
        {heroImage && (
          <div className="h-32 w-full overflow-hidden">
            <img src={heroImage} alt={item.player_name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-4 flex-1 flex flex-col gap-2">
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[10px] font-bold uppercase tracking-widest w-fit">
            <Mic className="w-2.5 h-2.5" /> Press Room
          </div>
          <h3 className="font-bold text-sm text-foreground leading-snug line-clamp-2">{item.title}</h3>
          {item.body && <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{item.body}</p>}
          <div className="flex items-center gap-2 pt-2 border-t border-border/40">
            {item.player_avatar_url && (
              <img src={item.player_avatar_url} alt={item.player_name} className="w-4 h-4 rounded-full object-cover shrink-0" />
            )}
            <span className="text-[10px] text-muted-foreground truncate flex-1">{item.player_name}{item.club_name ? ` · ${item.club_name}` : ""}</span>
            <span className="text-[10px] text-muted-foreground/50 shrink-0">{timeAgo(item.published_at)}</span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-purple-500/20 bg-card overflow-hidden">
      {heroImage && (
        <div
          className="relative h-56 sm:h-72 w-full overflow-hidden"
          style={item.photo_url ? {
            backgroundImage: `url(${heroImage})`,
            backgroundSize: `${bgZoom}%`,
            backgroundPosition: bgPos,
            backgroundRepeat: "no-repeat",
          } : {}}
        >
          {!item.photo_url && (
            <img src={heroImage} alt={item.player_name} className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/30 border border-purple-500/40 text-purple-300 text-[10px] font-bold uppercase tracking-widest mb-3">
              <Mic className="w-2.5 h-2.5" /> Press Conference
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white font-heading leading-tight drop-shadow-lg">{item.title}</h2>
          </div>
        </div>
      )}

      <div className="p-4 sm:p-6 space-y-4">
        {!heroImage && (
          <>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[10px] font-bold uppercase tracking-widest">
              <Mic className="w-2.5 h-2.5" /> Press Conference
            </div>
            <h2 className="text-xl font-bold text-foreground font-heading leading-tight">{item.title}</h2>
          </>
        )}

        <div className="flex items-center gap-3 pb-4 border-b border-border/50">
          {item.player_avatar_url && (
            <img src={item.player_avatar_url} alt={item.player_name} className="w-9 h-9 rounded-full object-cover border-2 border-purple-500/30 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-foreground truncate">{item.player_name}</p>
            <p className="text-xs text-muted-foreground truncate">{item.club_name}{item.match_name ? ` · ${item.match_name}` : ""}</p>
          </div>
          {item.club_logo_url && (
            <img src={item.club_logo_url} alt={item.club_name} className="w-7 h-7 rounded-lg object-cover border border-border shrink-0" />
          )}
          <span className="text-xs text-muted-foreground/60 shrink-0">{timeAgo(item.published_at)}</span>
        </div>

        {item.quotes?.length > 0 && (
          <div className="space-y-4">
            {item.quotes.map((q, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-2 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-purple-400">{q.reporter_name}</span>
                    <span className="text-xs text-muted-foreground/60"> · {q.outlet}</span>
                    <p className="text-sm text-muted-foreground mt-0.5 italic">{q.question}</p>
                  </div>
                </div>
                <div className="ml-3.5 pl-4 border-l-2 border-primary/30">
                  <p className="text-sm text-foreground leading-relaxed">"{q.answer}"</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
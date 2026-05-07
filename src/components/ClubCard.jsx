import { Link } from "react-router-dom";
import { Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";

function rankBadge(rank) {
  if (rank === 1) return "bg-yellow-400 text-black shadow-[0_0_16px_rgba(234,179,8,0.7)] font-black";
  if (rank === 2) return "bg-slate-300 text-black shadow-[0_0_10px_rgba(203,213,225,0.5)] font-black";
  if (rank === 3) return "bg-amber-600 text-white shadow-[0_0_10px_rgba(217,119,6,0.5)] font-black";
  return "bg-white/8 text-white/50 font-semibold";
}

function ratingStyle(r) {
  if (!r) return { cls: "text-white/50", shadow: "" };
  if (r >= 90) return { cls: "text-yellow-300", shadow: "0 0 18px rgba(253,224,71,0.7)" };
  if (r >= 85) return { cls: "text-yellow-400", shadow: "0 0 14px rgba(234,179,8,0.5)" };
  if (r >= 80) return { cls: "text-slate-200",  shadow: "0 0 10px rgba(226,232,240,0.4)" };
  if (r >= 75) return { cls: "text-amber-500",  shadow: "0 0 8px rgba(245,158,11,0.3)"  };
  return { cls: "text-[hsl(189,100%,52%)]", shadow: "0 0 8px hsl(189 100% 52% / 0.4)" };
}

export default function ClubCard({ club, rank }) {
  const totalGames = (club.wins || 0) + (club.losses || 0) + (club.draws || 0);
  const winRate    = totalGames > 0 ? Math.round(((club.wins || 0) / totalGames) * 100) : 0;
  const rs         = ratingStyle(club.rating);

  return (
    <Link to={`/clubs/${club.id}`} className="block group">
      <div className="relative rounded-2xl overflow-hidden" style={{ minHeight: "80px" }}>

        {/* Banner background */}
        {club.banner_url ? (
          <div
            className="absolute inset-0 scale-105 group-hover:scale-110 transition-transform duration-700"
            style={{
              backgroundImage:    `url(${club.banner_url})`,
              backgroundSize:     `${club.banner_zoom || 150}%`,
              backgroundPosition: club.banner_position || "50% 50%",
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 to-slate-800" />
        )}

        {/* Dark gradient for readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/88 via-black/65 to-black/25" />
        {/* Left accent line */}
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[hsl(189,100%,52%)]/0 group-hover:bg-[hsl(189,100%,52%)]/80 transition-all duration-300 rounded-l-2xl" />
        {/* Border */}
        <div className="absolute inset-0 rounded-2xl border border-white/8 group-hover:border-[hsl(189,100%,52%)]/35 transition-colors duration-300" />

        {/* Content */}
        <div className="relative z-10 flex items-center gap-4 px-5 py-4">

          {/* Rank badge */}
          {rank && (
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs shrink-0", rankBadge(rank))}>
              {rank}
            </div>
          )}

          {/* Rating */}
          {club.rating != null && (
            <div className="shrink-0 text-center w-10">
              <div
                className={cn("font-heading font-black text-2xl leading-none", rs.cls)}
                style={{ textShadow: rs.shadow }}
              >
                {club.rating}
              </div>
              <div className="text-white/30 text-[8px] uppercase tracking-widest mt-0.5">RTG</div>
            </div>
          )}

          {/* Logo */}
          <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/15 shrink-0 bg-black/40 flex items-center justify-center group-hover:border-white/30 transition-colors">
            {club.logo_url ? (
              <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover rounded-full" />
            ) : (
              <Users className="w-5 h-5 text-white/30" />
            )}
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-heading font-black text-base text-white uppercase tracking-wide group-hover:text-[hsl(189,100%,52%)] transition-colors truncate">
                {club.name}
              </span>
              {club.tag && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-[hsl(189,100%,52%)]/15 text-[hsl(189,100%,52%)] border border-[hsl(189,100%,52%)]/25 uppercase tracking-wider shrink-0 font-mono">
                  [{club.tag}]
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-white/35 mt-0.5 flex-wrap">
              {club.platform && <span>{club.platform}</span>}
              {club.region   && <><span>·</span><span>{club.region}</span></>}
            </div>
          </div>

          {/* Stats */}
          <div className="hidden sm:flex items-center gap-6 shrink-0 pr-1">
            <div className="text-center w-10">
              <div className="flex items-center justify-center gap-1">
                <Trophy className="w-3 h-3 text-yellow-400" />
                <span className="text-white font-black text-sm leading-none">{club.trophies || 0}</span>
              </div>
              <div className="text-white/25 text-[8px] uppercase tracking-widest mt-0.5">Trophies</div>
            </div>
            <div className="text-center w-16">
              <div className="text-white/60 text-xs font-semibold">{club.wins || 0}W {club.draws || 0}D {club.losses || 0}L</div>
              <div className="text-white/25 text-[8px] uppercase tracking-widest mt-0.5">Record</div>
            </div>
            <div className="text-center w-10">
              <div className={cn("font-black text-sm leading-none",
                winRate >= 60 ? "text-emerald-400" : winRate >= 40 ? "text-yellow-400" : "text-white/40"
              )}>{winRate}%</div>
              <div className="text-white/25 text-[8px] uppercase tracking-widest mt-0.5">WR</div>
            </div>
          </div>

        </div>
      </div>
    </Link>
  );
}

import { Link } from "react-router-dom";
import { Users } from "lucide-react";

export default function ClubCard({ club }) {
  return (
    <Link to={`/clubs/${club.id}`} className="block group">
      <div className="relative rounded-2xl overflow-hidden" style={{ minHeight: "80px" }}>

        {/* Banner background */}
        {club.banner_url ? (
          <div
            className="absolute inset-0 scale-105 group-hover:scale-110 transition-transform duration-700"
            style={{
              backgroundImage: `url(${club.banner_url})`,
              backgroundSize: `${club.banner_zoom || 150}%`,
              backgroundPosition: club.banner_position || "50% 50%",
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 to-slate-800" />
        )}

        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/15 to-black/90" />
        {/* Left accent line */}
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[hsl(189,100%,52%)]/0 group-hover:bg-[hsl(189,100%,52%)]/80 transition-all duration-300 rounded-l-2xl" />
        {/* Border */}
        <div className="absolute inset-0 rounded-2xl border border-white/8 group-hover:border-[hsl(189,100%,52%)]/35 transition-colors duration-300" />

        {/* Content */}
        <div className="relative z-10 flex items-center gap-4 px-5 py-4">
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
            <div className="flex items-center gap-5 flex-wrap">
              <span className="font-heading font-black text-base text-white uppercase tracking-wide group-hover:text-[hsl(189,100%,52%)] transition-colors">
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
              {club.region && <><span>·</span><span>{club.region}</span></>}
            </div>
          </div>

          <div className="hidden sm:block shrink-0 text-xs font-bold uppercase tracking-wider text-white/35 group-hover:text-[hsl(189,100%,52%)]/80 transition-colors">
            View Club
          </div>

        </div>
      </div>
    </Link>
  );
}

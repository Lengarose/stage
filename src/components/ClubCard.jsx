import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { asObject } from "@/lib/safeData";

export default function ClubCard({ club: rawClub }) {
  const { t } = useTranslation();
  const club = asObject(rawClub);
  if (!club?.id) return null;

  return (
    <Link to={`/clubs/${club.id}`} className="block group">
      <div
        className="relative overflow-hidden"
        style={{ minHeight: "80px", clipPath: "polygon(2% 0, 100% 0, 98% 100%, 0 100%)" }}
      >

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
        <div className="absolute bottom-0 left-0 top-0 w-[4px] bg-[hsl(189,100%,52%)]/0 transition-all duration-300 group-hover:bg-[hsl(189,100%,52%)]/80" />
        {/* Border */}
        <div className="absolute inset-0 border border-white/8 transition-colors duration-300 group-hover:border-[hsl(189,100%,52%)]/35" />

        {/* Content */}
        <div className="relative z-10 flex items-center gap-4 px-7 py-4 sm:px-8">
          {/* Logo */}
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden border-2 border-white/15 bg-black/40 transition-colors group-hover:border-white/30"
            style={{ clipPath: "polygon(14% 0, 100% 0, 86% 100%, 0 100%)" }}
          >
            {club.logo_url ? (
              <img src={club.logo_url} alt={club.name} className="h-full w-full object-cover" />
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
                <span
                  className="shrink-0 border border-[hsl(189,100%,52%)]/25 bg-[hsl(189,100%,52%)]/15 px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider text-[hsl(189,100%,52%)]"
                  style={{ clipPath: "polygon(12% 0, 100% 0, 88% 100%, 0 100%)" }}
                >
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
            {t("commonPages.viewClub")}
          </div>

        </div>
      </div>
    </Link>
  );
}

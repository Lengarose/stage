import { Crown, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { getBannerStyle } from "@/lib/storeItems";
import { getCountryFlag } from "@/lib/allCountries";
import { GamerMetaPill } from "./GamerProfileUI";
import { cn } from "@/lib/utils";
import { Shield } from "lucide-react";

export function GamerPresidentPhotoFrame({
  president,
  as: Component = "div",
  className,
  ...props
}) {
  const imageUrl = president?.avatar_url;
  const position = president?.avatar_position || "50% 50%";
  const zoom = president?.avatar_zoom;

  return (
    <Component
      className={cn(
        "relative w-[132px] sm:w-[156px] aspect-[3/4] rounded-2xl overflow-hidden shrink-0 text-left",
        "border border-amber-400/30 shadow-[0_0_40px_-8px_rgba(255,184,0,0.45)]",
        "bg-gradient-to-br from-amber-500/10 via-[#0d1528] to-cyan-500/10",
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent z-[1]" />
      {imageUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${imageUrl})`,
            backgroundPosition: position,
            backgroundSize: zoom ? `${zoom}%` : "cover",
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Shield className="w-14 h-14 text-amber-400/30" />
        </div>
      )}
      <div className="absolute top-2 right-2 z-[2] min-w-[42px] rounded-lg bg-gradient-to-br from-amber-300 to-yellow-500 px-2 py-1 text-center shadow-lg">
        <Crown className="w-3.5 h-3.5 text-black mx-auto" />
        <p className="font-heading text-[10px] font-black text-black leading-none mt-0.5">PREZ</p>
      </div>
      <div className="absolute bottom-0 inset-x-0 z-[2] p-3">
        <p className="font-heading text-lg font-black uppercase leading-none tracking-tight text-amber-300 truncate">
          {president?.display_name || "—"}
        </p>
        <p className="text-[10px] font-bold text-white/50 mt-0.5 truncate">
          {president?.role_title || "President"}
        </p>
      </div>
    </Component>
  );
}

function ClubChip({ club, label }) {
  if (!club?.id) return null;
  return (
    <Link
      to={`/clubs/${club.id}`}
      className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-black/45 backdrop-blur-md px-2.5 py-1.5 hover:bg-black/60 hover:border-amber-300/30 transition-colors max-w-[220px]"
    >
      <span
        className="w-8 h-8 rounded-full border border-white/20 bg-[#101827] overflow-hidden shrink-0 flex items-center justify-center"
        style={club.logo_url ? {
          backgroundImage: `url(${club.logo_url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        } : undefined}
        aria-hidden
      >
        {!club.logo_url ? <Shield className="w-3.5 h-3.5 text-white/40" /> : null}
      </span>
      <span className="font-heading text-sm font-black uppercase tracking-wide text-white truncate">
        {club.name || label || "Club"}
      </span>
    </Link>
  );
}

export default function GamerPresidentProfileHero({
  president,
  club,
  successLabel,
  topLeftActions,
  topActions,
  sideActions,
  onBannerClick,
  sinceLabel,
  sinceDate,
  children,
}) {
  const bannerStyle = (() => {
    const base = getBannerStyle(president?.banner_url, president?.banner_position);
    if (president?.banner_url?.startsWith?.("http")) {
      return {
        ...base,
        backgroundSize: `${president.banner_zoom || 150}%`,
        backgroundPosition: president.banner_position || "50% 50%",
      };
    }
    return base;
  })();
  const countryFlag = president?.country_code ? getCountryFlag(president.country_code) : "";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onBannerClick}
        className="relative block w-full h-44 sm:h-56 md:h-64 overflow-hidden text-left"
      >
        <div className="absolute inset-0" style={bannerStyle} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#060912]/30 via-[#060912]/20 to-[#060912]" />
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-cyan-500/10" />
      </button>
      {topLeftActions ? <div className="absolute top-4 left-4 z-20 flex items-center gap-2">{topLeftActions}</div> : null}
      {topActions ? <div className="absolute top-4 right-4 z-20 flex items-center gap-2">{topActions}</div> : null}

      <div className="max-w-6xl mx-auto px-4 -mt-24 sm:-mt-28 relative z-10">
        <div className="flex flex-col lg:flex-row gap-5 lg:gap-8 items-start">
          <GamerPresidentPhotoFrame president={president} />

          <div className="flex-1 min-w-0 space-y-3 pt-2 lg:pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight leading-none">
                    {president?.display_name || "President"}
                  </h1>
                  {president?.role_title ? (
                    <span className="font-heading text-xl font-black text-amber-400/80 border border-amber-400/25 rounded-lg px-2 py-0.5">
                      {president.role_title}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <GamerMetaPill><Crown className="w-3 h-3 text-amber-400" />President</GamerMetaPill>
                  {successLabel ? (
                    <GamerMetaPill className="border-amber-300/30 text-amber-200">{successLabel}</GamerMetaPill>
                  ) : null}
                  {president?.management_style ? (
                    <GamerMetaPill>{president.management_style}</GamerMetaPill>
                  ) : null}
                  {countryFlag ? (
                    <GamerMetaPill>{countryFlag} {president.country_code}</GamerMetaPill>
                  ) : null}
                </div>
              </div>
              {(club?.id || sideActions) ? (
                <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
                  <ClubChip club={club} />
                  {sideActions ? <div className="flex flex-wrap gap-2 justify-end">{sideActions}</div> : null}
                </div>
              ) : null}
            </div>

            {president?.quote ? (
              <p className="text-sm font-semibold text-white/85">"{president.quote}"</p>
            ) : null}
            {president?.bio ? (
              <p className="text-sm text-white/65 leading-relaxed max-w-2xl">{president.bio}</p>
            ) : null}
            {sinceDate ? (
              <div className="flex flex-wrap gap-2 text-xs text-white/50">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-amber-100">
                  <Trophy className="w-3 h-3 text-amber-300" /> {sinceLabel} {sinceDate}
                </span>
              </div>
            ) : null}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

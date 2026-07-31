import { Gamepad2, Globe, Users } from "lucide-react";
import { getBannerStyle } from "@/lib/storeItems";
import { getCountryFlag } from "@/lib/allCountries";
import GamerClubCard, { GamerClubPhotoFrame } from "./GamerClubCard";
import { GamerMetaPill, GamerRecordStrip } from "./GamerProfileUI";
import { cn } from "@/lib/utils";

export default function GamerClubProfileHero({
  club,
  wins = 0,
  draws = 0,
  losses = 0,
  winRate = 0,
  topActions,
  sideActions,
  followers,
  memberCount,
  onBannerClick,
  onLogoClick,
  logoUploadHtmlFor,
  logoUploading = false,
  children,
}) {
  const bannerStyle = getBannerStyle(club?.banner_url, club?.banner_position);
  const countryFlag = club?.country_code ? getCountryFlag(club.country_code) : "";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onBannerClick}
        className="relative block w-full h-44 sm:h-56 md:h-64 overflow-hidden text-left"
        style={{ marginLeft: "calc(-50vw + 50%)", width: "100vw" }}
      >
        <div className="absolute inset-0" style={bannerStyle} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#060912]/30 via-[#060912]/20 to-[#060912]" />
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-cyan-500/10" />
      </button>
      {topActions ? <div className="absolute top-4 right-4 z-20 flex items-center gap-2">{topActions}</div> : null}

      <div className="max-w-6xl mx-auto px-4 -mt-24 sm:-mt-28 relative z-10">
        <div className="flex flex-col lg:flex-row gap-5 lg:gap-8 items-start">
          {logoUploadHtmlFor ? (
            <label
              htmlFor={logoUploading ? undefined : logoUploadHtmlFor}
              className={cn(
                "relative block cursor-pointer touch-manipulation shrink-0",
                logoUploading && "pointer-events-none opacity-60"
              )}
            >
              <GamerClubPhotoFrame
                club={club}
                winRate={winRate}
                className="pointer-events-none"
              />
              <span className="absolute inset-0 z-10 rounded-2xl bg-black/45 flex items-center justify-center opacity-100 md:opacity-0 md:hover:opacity-100 transition-opacity">
                <span className="text-[10px] font-black uppercase tracking-wider text-white bg-black/50 px-2 py-1 rounded-lg">
                  {logoUploading ? "…" : "Change logo"}
                </span>
              </span>
            </label>
          ) : (
            <GamerClubCard club={club} winRate={winRate} onLogoClick={onLogoClick} />
          )}

          <div className="flex-1 min-w-0 space-y-3 pt-2 lg:pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight leading-none">
                    {club?.name || "Club"}
                  </h1>
                  {club?.tag ? (
                    <span className="font-heading text-xl font-black text-amber-400/80 border border-amber-400/25 rounded-lg px-2 py-0.5">
                      [{club.tag}]
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {club?.platform ? (
                    <GamerMetaPill><Gamepad2 className="w-3 h-3 text-amber-400" />{club.platform}</GamerMetaPill>
                  ) : null}
                  {club?.region ? (
                    <GamerMetaPill><Globe className="w-3 h-3 text-cyan-400" />{club.region}</GamerMetaPill>
                  ) : null}
                  {countryFlag ? (
                    <GamerMetaPill>{countryFlag} {club.country || club.country_code}</GamerMetaPill>
                  ) : null}
                  <GamerMetaPill><Users className="w-3 h-3 text-teal-400" />{memberCount ?? "—"}</GamerMetaPill>
                </div>
              </div>
              {sideActions ? <div className="flex flex-wrap gap-2 shrink-0">{sideActions}</div> : null}
            </div>

            <GamerRecordStrip wins={wins} draws={draws} losses={losses} />

            {club?.description ? (
              <p className="text-sm text-white/65 leading-relaxed max-w-2xl">{club.description}</p>
            ) : null}
            {followers}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

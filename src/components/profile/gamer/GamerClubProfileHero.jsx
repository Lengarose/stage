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
  topLeftActions,
  topActions,
  sideActions,
  infoAside,
  memberCount,
  onBannerClick,
  onLogoClick,
  logoUploadHtmlFor,
  logoUploading = false,
  children,
}) {
  const bannerStyle = getBannerStyle(club?.banner_url, club?.banner_position);
  const heroBannerStyle = bannerStyle.backgroundImage
    ? { ...bannerStyle, backgroundPosition: club?.banner_position || "50% 64%" }
    : bannerStyle;
  const countryFlag = club?.country_code ? getCountryFlag(club.country_code) : "";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onBannerClick}
        className="relative block w-full h-52 sm:h-64 md:h-72 overflow-hidden text-left"
      >
        <div className="absolute inset-0 scale-[1.03]" style={heroBannerStyle} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#060912]/18 via-[#060912]/18 via-55% to-[#060912]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#060912] via-[#060912]/72 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-cyan-500/10" />
      </button>
      {topLeftActions ? <div className="absolute top-4 left-4 z-20 flex items-center gap-2">{topLeftActions}</div> : null}
      {topActions ? <div className="absolute top-4 right-4 z-20 flex items-center gap-2">{topActions}</div> : null}

      <div className="max-w-6xl mx-auto px-4 -mt-28 sm:-mt-32 relative z-10">
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
              <span className="absolute inset-0 z-10 bg-black/45 flex items-center justify-center opacity-100 md:opacity-0 md:hover:opacity-100 transition-opacity [clip-path:polygon(12%_0,100%_0,88%_100%,0_100%)]">
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
              {(infoAside || sideActions) ? (
                <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
                  {infoAside}
                  {sideActions ? <div className="flex flex-wrap gap-2 justify-end">{sideActions}</div> : null}
                </div>
              ) : null}
            </div>

            <GamerRecordStrip wins={wins} draws={draws} losses={losses} />

            {club?.description ? (
              <p className="text-sm text-white/65 leading-relaxed max-w-2xl">{club.description}</p>
            ) : null}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

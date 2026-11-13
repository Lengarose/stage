import { Gamepad2, Globe } from "lucide-react";
import PageBannerShell from "@/components/PageBannerShell";
import AdaptiveBannerBackground from "@/components/profile/AdaptiveBannerBackground";
import { getCountryFlag } from "@/lib/allCountries";
import GamerClubCard, { GamerClubPhotoFrame } from "./GamerClubCard";
import { GamerRecordStrip } from "./GamerProfileUI";
import ProfileBannerDivider from "./ProfileBannerDivider";
import ProfileBannerIdentity, { PROFILE_BANNER_SIZE } from "./ProfileBannerIdentity";
import { formatProfilePlatform } from "@/lib/profilePlatform";
import { getCountryShortName } from "@/lib/countryDisplay";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

function GamerClubProfileHero({
  club,
  wins = 0,
  draws = 0,
  losses = 0,
  winRate = 0,
  topLeftActions,
  topActions,
  sideActions,
  infoAside,
  onBannerClick,
  onLogoClick,
  logoUploadHtmlFor,
  logoUploading = false,
  children,
  stickyLayout = false,
  stickyDockChildren = null,
}) {
  const { t } = useTranslation();
  const countryFlag = club?.country_code ? getCountryFlag(club.country_code) : "";
  const card = logoUploadHtmlFor ? (
    <label
      htmlFor={logoUploading ? undefined : logoUploadHtmlFor}
      className={cn("relative block pointer-events-auto cursor-pointer touch-manipulation shrink-0", logoUploading && "pointer-events-none opacity-60")}
    >
      <GamerClubPhotoFrame club={club} winRate={winRate} className="pointer-events-none" />
      <span className="absolute inset-0 z-10 rounded-full bg-black/45 flex items-center justify-center opacity-100 md:opacity-0 md:hover:opacity-100 transition-opacity">
        <span className="text-[10px] font-black uppercase tracking-wider text-white bg-black/50 px-2 py-1 rounded-none">{logoUploading ? "…" : "Change logo"}</span>
      </span>
    </label>
  ) : <GamerClubCard club={club} winRate={winRate} onLogoClick={onLogoClick} className="pointer-events-auto" />;

  const banner = (
    <div className={cn("relative w-full overflow-hidden", PROFILE_BANNER_SIZE)}>
      <button
        type="button"
        onClick={onBannerClick}
        className="absolute inset-0 block w-full overflow-hidden text-left"
      >
        <AdaptiveBannerBackground
          bannerUrl={club?.banner_url}
          bannerPosition={club?.banner_position || "50% 64%"}
          bannerZoom={club?.banner_zoom}
          className="scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#04070d]/20 via-[#04070d]/28 via-55% to-[#060912]" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#060912] via-[#060912]/78 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/12 via-transparent to-cyan-500/14" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#060912] via-[#060912]/55 to-transparent" />
      </button>
      <ProfileBannerDivider portrait="club" />
      {topLeftActions ? <div className="absolute top-4 left-4 z-20 flex items-center gap-2">{topLeftActions}</div> : null}
      {topActions ? <div className="absolute top-4 right-4 z-20 flex items-center gap-2">{topActions}</div> : null}
      <ProfileBannerIdentity className="pl-[212px] pb-4 pt-20 sm:pl-72 lg:pt-32 xl:pt-40">
        <p className="font-heading text-[10px] font-black uppercase tracking-[0.34em] text-amber-200/55">Club Headquarters</p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="min-w-0 [overflow-wrap:anywhere] font-heading text-2xl sm:text-4xl lg:text-6xl font-black uppercase tracking-normal leading-none drop-shadow-[0_8px_28px_rgba(0,0,0,0.85)]">{club?.name || "Club"}</h1>
          {club?.tag ? <span className="font-heading text-xl font-black text-amber-400/80 border border-amber-400/25 rounded-lg px-2 py-0.5">[{club.tag}]</span> : null}
        </div>
        <div className="club-profile-metadata flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/70">
          {club?.platform ? <span className="inline-flex items-center gap-1.5"><Gamepad2 className="w-3 h-3 shrink-0 text-amber-400" />{formatProfilePlatform(club.platform)}</span> : null}
          {club?.region ? <span className="inline-flex items-center gap-1.5"><Globe className="w-3 h-3 shrink-0 text-cyan-400" />{club.region}</span> : null}
          {club?.country || club?.country_code ? <span>{countryFlag} {getCountryShortName(club.country_code, club.country)}</span> : null}
          {infoAside}
        </div>
        <div className="pointer-events-auto flex flex-wrap items-center gap-4">
          <GamerRecordStrip wins={wins} draws={draws} losses={losses} />
          <span className="text-xs font-medium text-white">{t("commonPages.clubWinRate", "Win rate")}: {Math.min(100, Math.max(0, Math.round(Number(winRate) || 0)))}%</span>
        </div>
      </ProfileBannerIdentity>
    </div>
  );

  const body = (
    <div className="max-w-6xl mx-auto px-4 -mt-40 sm:-mt-44 relative z-20 pointer-events-none">
      <div className="flex flex-col lg:flex-row gap-5 lg:gap-8 items-start">
        {card}

        <div className="flex-1 min-w-0 space-y-3 pt-2 lg:pt-40">
          <div className="flex flex-wrap items-start justify-between gap-3">
            {sideActions ? (
              <div className="pointer-events-auto flex flex-col items-stretch sm:items-end gap-2 shrink-0">
                {sideActions ? <div className="flex flex-wrap gap-2 justify-end">{sideActions}</div> : null}
              </div>
            ) : null}
          </div>



          {club?.description ? (
            <p className="pointer-events-auto text-sm text-white/65 leading-relaxed max-w-2xl">{club.description}</p>
          ) : null}
          <div className="pointer-events-auto">{children}</div>
        </div>
      </div>
    </div>
  );

  if (stickyLayout) {
    return (
      <PageBannerShell
        banner={banner}
        bannerClassName="h-auto sm:h-auto xl:h-auto"
        className="bg-transparent"
        dockClassName="bg-transparent"
        dockScroll={false}
      >
        <div className="relative z-20">
          {body}
        </div>
        <div className="relative z-[1]">
          {stickyDockChildren}
        </div>
      </PageBannerShell>
    );
  }

  return (
    <div className="relative">
      {banner}
      {body}
    </div>
  );
}

GamerClubProfileHero.isStickyBannerHero = true;

export default GamerClubProfileHero;

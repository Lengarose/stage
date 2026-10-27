import { Link } from "react-router-dom";
import { BadgeCheck, Gamepad2, Shield, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import PageBannerShell from "@/components/PageBannerShell";
import AdaptiveBannerBackground from "@/components/profile/AdaptiveBannerBackground";
import { formatProfilePlatform } from "@/lib/profilePlatform";
import { getCountryShortName, getPlayerNationality } from "@/lib/countryDisplay";
import { getCountryFlag } from "@/lib/allCountries";
import ProfileBannerDivider from "./ProfileBannerDivider";
import ProfileBannerIdentity, { PROFILE_BANNER_SIZE } from "./ProfileBannerIdentity";
import {
  GamerMetaPill,
  GamerPlayerCard,
} from "./GamerProfileUI";

function GamerProfileHero({
  player,
  user,
  club,
  roleBadges = [],
  managementBadges = [],
  formatPositions,
  topLeftActions,
  topActions,
  sideActions,
  verifiedHandle,
  onAvatarClick,
  children,
  stickyLayout = false,
  stickyDockChildren = null,
}) {
  const nationality = getPlayerNationality(player);
  const countryFlag = getCountryFlag(nationality.code) || String(player?.country || "").match(/^\p{Regional_Indicator}{2}/u)?.[0] || "";
  const identity = (
      <>
        <p className="font-heading text-[10px] font-black uppercase tracking-[0.34em] text-cyan-200/55">Player Profile</p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="min-w-0 [overflow-wrap:anywhere] font-heading text-2xl sm:text-4xl lg:text-6xl font-black uppercase tracking-normal leading-none drop-shadow-[0_8px_28px_rgba(0,0,0,0.85)]">
            {player?.gamertag || user?.full_name || "Player"}
          </h1>
          {Number(player?.is_verified) === 1 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-300">
              <BadgeCheck className="w-3.5 h-3.5" /> EA
            </span>
          ) : null}
        </div>
        <div className="player-profile-metadata flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/70">
          {player?.position ? <span className="inline-flex items-center gap-1.5"><Target className="w-3 h-3 shrink-0 text-cyan-400" />{formatPositions ? formatPositions(player) : player.position}</span> : null}
          {player?.platform ? <span className="inline-flex items-center gap-1.5"><Gamepad2 className="w-3 h-3 shrink-0 text-amber-400" />{formatProfilePlatform(player.platform)}</span> : null}
          {player?.country || player?.country_code ? <span>{countryFlag} {getCountryShortName(player.country_code, player.country)}</span> : null}
          {club ? <Link to={`/clubs/${club.id}`}><GamerMetaPill className="hover:border-cyan-400/30 hover:text-cyan-300 transition-colors"><Shield className="w-3 h-3" />{club.name}</GamerMetaPill></Link> : null}
        </div>
        {verifiedHandle ? <p className="[overflow-wrap:anywhere] text-xs font-medium text-cyan-300/80">{verifiedHandle}</p> : null}
      </>
  );
  const banner = (
    <div className={cn("relative w-full overflow-hidden", PROFILE_BANNER_SIZE)}>
      <AdaptiveBannerBackground
        bannerUrl={player?.banner_url}
        bannerPosition={player?.banner_position || "50% 64%"}
        bannerZoom={player?.banner_zoom}
        className="scale-[1.03]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#04070d]/20 via-[#04070d]/28 via-55% to-[#060912]" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#060912] via-[#060912]/78 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/14 via-transparent to-amber-500/12" />
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#060912] via-[#060912]/55 to-transparent" />
      <ProfileBannerDivider />
      {topLeftActions ? <div className="absolute top-4 left-4 z-20 flex items-center gap-2">{topLeftActions}</div> : null}
      {topActions ? <div className="absolute top-4 right-4 z-20 flex items-center gap-2">{topActions}</div> : null}
      <ProfileBannerIdentity>{identity}</ProfileBannerIdentity>
    </div>
  );

  const body = (
    <div className="max-w-6xl mx-auto px-4 -mt-32 sm:-mt-36 relative z-20">
      <div className="flex flex-col lg:flex-row gap-5 lg:gap-8 items-start">
        <GamerPlayerCard player={player} onAvatarClick={onAvatarClick} />

        <div className="w-full flex-1 min-w-0 space-y-3 pt-2 lg:pt-40">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              {roleBadges.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {roleBadges.map((role) => (
                    <span
                      key={role}
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border capitalize",
                        role === "president" ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" :
                        role === "captain" ? "bg-amber-500/15 text-amber-300 border-amber-500/30" :
                        "bg-white/5 text-white/50 border-white/10"
                      )}
                    >
                      {role}
                    </span>
                  ))}
                </div>
              ) : null}

              {managementBadges.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {managementBadges.map((badge) => (
                    <span
                      key={badge.id}
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border",
                        badge.tone === "amber" ? "bg-amber-500/15 text-amber-300 border-amber-500/30" :
                        badge.tone === "cyan" ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" :
                        "bg-white/5 text-white/55 border-white/10"
                      )}
                      title={badge.clubName || undefined}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            {sideActions ? <div className="flex flex-wrap gap-2 shrink-0">{sideActions}</div> : null}
          </div>

          {player?.bio ? <p className="text-sm text-white/65 leading-relaxed max-w-2xl">{player.bio}</p> : null}
          {children}
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

GamerProfileHero.isStickyBannerHero = true;

export default GamerProfileHero;

import { Link } from "react-router-dom";
import { BadgeCheck, Gamepad2, Shield, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBannerStyle } from "@/lib/storeItems";
import {
  GamerMetaPill,
  GamerPlayerCard,
  GamerRecordStrip,
} from "./GamerProfileUI";

export default function GamerProfileHero({
  player,
  user,
  club,
  roleBadges = [],
  formatPositions,
  topLeftActions,
  topActions,
  sideActions,
  verifiedHandle,
  onAvatarClick,
  children,
}) {
  const bannerStyle = getBannerStyle(player?.banner_url, player?.banner_position);
  const wins = player?.wins_count ?? player?.wins ?? 0;
  const draws = player?.draws_count ?? player?.draws ?? 0;
  const losses = player?.losses_count ?? player?.losses ?? 0;

  return (
    <div className="relative">
      <div className="relative h-44 sm:h-56 md:h-64 w-full overflow-hidden">
        <div className="absolute inset-0" style={bannerStyle} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#060912]/30 via-[#060912]/20 to-[#060912]" />
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-transparent to-amber-500/10" />
        {topLeftActions ? <div className="absolute top-4 left-4 z-20 flex items-center gap-2">{topLeftActions}</div> : null}
        {topActions ? <div className="absolute top-4 right-4 z-20 flex items-center gap-2">{topActions}</div> : null}
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-24 sm:-mt-28 relative z-10">
        <div className="flex flex-col lg:flex-row gap-5 lg:gap-8 items-start">
          <GamerPlayerCard player={player} onAvatarClick={onAvatarClick} />

          <div className="flex-1 min-w-0 space-y-3 pt-2 lg:pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight leading-none">
                    {player?.gamertag || user?.full_name || "Player"}
                  </h1>
                  {Number(player?.is_verified) === 1 ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-300">
                      <BadgeCheck className="w-3.5 h-3.5" /> EA
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {player?.position ? (
                    <GamerMetaPill><Target className="w-3 h-3 text-cyan-400" />{formatPositions ? formatPositions(player) : player.position}</GamerMetaPill>
                  ) : null}
                  {player?.platform ? (
                    <GamerMetaPill><Gamepad2 className="w-3 h-3 text-amber-400" />{player.platform}</GamerMetaPill>
                  ) : null}
                  {player?.country ? <GamerMetaPill>{player.country}</GamerMetaPill> : null}
                  {club ? (
                    <Link to={`/clubs/${club.id}`}>
                      <GamerMetaPill className="hover:border-cyan-400/30 hover:text-cyan-300 transition-colors">
                        <Shield className="w-3 h-3" />{club.name}
                      </GamerMetaPill>
                    </Link>
                  ) : null}
                </div>

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
              </div>

              {sideActions ? <div className="flex flex-wrap gap-2 shrink-0">{sideActions}</div> : null}
            </div>

            <GamerRecordStrip wins={wins} draws={draws} losses={losses} />

            {player?.bio ? <p className="text-sm text-white/65 leading-relaxed max-w-2xl">{player.bio}</p> : null}
            {verifiedHandle ? (
              <p className="text-xs text-cyan-300/80">
                {verifiedHandle}
              </p>
            ) : null}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

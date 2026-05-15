import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink, Clock, Users, Shield, Star, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import TransferBadge from "./TransferBadge";
import { calculatePlayerValue, formatSTC, getValueTier } from "@/lib/playerValue";

const CONTRACT_TYPE_LABELS = {
  trial:     { label: "Trial", desc: "Short-term evaluation" },
  academy:   { label: "Academy", desc: "Development squad" },
  squad:     { label: "Squad",  desc: "Regular squad member" },
  important: { label: "Important", desc: "Key squad player" },
  star:      { label: "Star",   desc: "Top team player" },
};

export default function TransferDetailPanel({ entry, canManage, hasConflict, onOffer, windowOpen }) {
  if (!entry) {
    return (
      <div className="bg-card border border-border rounded-2xl p-10 text-center flex flex-col items-center justify-center h-full min-h-[320px]">
        <Users className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">Select a player</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Click any player to view their details</p>
      </div>
    );
  }

  const { player, badgeType, contract, days_left } = entry;
  const conflict = hasConflict(player.id);
  const marketValue = calculatePlayerValue(player);
  const valueTier = getValueTier(marketValue);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Top banner — shorter so it doesn't eat into the name */}
      <div className="h-14 bg-gradient-to-br from-primary/20 via-secondary to-background relative">
        <div className="absolute inset-0 fc-stripe opacity-40" />
      </div>

      {/* Avatar + name row — avatar overlaps banner, name sits fully below */}
      <div className="px-5 pb-5">
        <div className="flex items-end gap-4 -mt-8 mb-1">
          <div className="w-16 h-16 rounded-full border-4 border-card bg-secondary overflow-hidden shrink-0 shadow-xl relative z-10">
            {player.avatar_url
              ? <img src={player.avatar_url} alt={player.gamertag} className="w-full h-full object-cover" style={{ objectPosition: player.avatar_position || "50% 50%" }} />
              : <div className="w-full h-full flex items-center justify-center bg-primary/10">
                  <span className="text-xl font-black text-primary">{(player.gamertag || "?")[0].toUpperCase()}</span>
                </div>}
          </div>
        </div>

        {/* Name and badge — fully below the banner overlap zone */}
        <div className="mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-heading font-black text-xl text-foreground uppercase leading-tight">
              {player.gamertag}
            </h2>
            {player.is_verified && <Star className="w-4 h-4 text-warning fill-warning shrink-0" />}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <TransferBadge type={badgeType} daysLeft={days_left} />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: "Position", value: [player.position, player.secondary_position].filter(Boolean).join(" / ") || "—" },
            { label: "OVR", value: player.overall_rating || "—" },
            { label: "Platform", value: player.platform || "—" },
          ].map(s => (
            <div key={s.label} className="bg-secondary rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
              <p className="font-bold text-foreground text-sm mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Market Value */}
        <div className="flex items-center justify-between bg-secondary/60 rounded-xl px-4 py-2.5 mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Market Value</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("text-xs font-semibold", valueTier.color)}>{valueTier.label}</span>
            <span className="font-light text-foreground text-sm tracking-tight">{formatSTC(marketValue)}</span>
          </div>
        </div>

        {/* Club / contract info */}
        {player.club_id ? (
          <div className="bg-secondary rounded-xl p-3 mb-4 flex items-center gap-3">
            <Shield className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Current Club</p>
              <p className="text-sm font-semibold text-foreground truncate">Under Contract</p>
            </div>
            {contract && (
              <div className="ml-auto text-right">
                <p className="text-[10px] text-muted-foreground">Games left</p>
                <p className="text-sm font-bold text-warning">
                  {Math.max(0, (contract.max_games || 0) - (contract.games_played || 0))}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-success/10 border border-success/20 rounded-xl p-3 mb-4 flex items-center gap-3">
            <Users className="w-4 h-4 text-success shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="text-sm font-semibold text-success">Free Agent — Available Now</p>
            </div>
          </div>
        )}

        {/* Bio */}
        {player.bio && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Bio</p>
            <p className="text-sm text-foreground/80 leading-relaxed">{player.bio}</p>
          </div>
        )}

        {/* Country + win stats */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          {[
            { label: "Country", value: player.country || "—" },
            { label: "Goals", value: player.goals ?? 0 },
            { label: "Assists", value: player.assists ?? 0 },
            { label: "Matches", value: player.matches_played ?? 0 },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between px-3 py-2 bg-secondary/60 rounded-lg">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <span className="text-xs font-bold text-foreground">{s.value}</span>
            </div>
          ))}
        </div>

        {/* Transfer window note */}
        {windowOpen === false && (
          <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2.5 mb-4 text-xs text-blue-400">
            <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Transfer window is closed. Offers sent now will execute when the window opens.</span>
          </div>
        )}

        {/* CTA buttons */}
        <div className="flex flex-col gap-2">
          {!conflict && canManage && (
            <Button
              onClick={() => onOffer({ player, badgeType })}
              className="w-full bg-primary text-primary-foreground gap-2"
            >
              <FileText className="w-4 h-4" />
              Send Contract Offer
            </Button>
          )}
          {conflict && (
            <div className="w-full text-center py-2.5 rounded-xl bg-muted border border-border text-sm text-muted-foreground font-medium">
              Offer Already Sent
            </div>
          )}
          <Link to={`/players/${player.id}`} className="w-full">
            <Button variant="outline" className="w-full gap-2 border-border">
              <ExternalLink className="w-4 h-4" />
              View Full Profile
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Shield, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import TransferBadge from "./TransferBadge";

export default function TransferPlayerList({ players, selectedId, onSelect, canManage, hasConflict, onOffer }) {
  if (players.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-12 text-center">
        <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
        <p className="text-sm font-medium text-muted-foreground">No players found</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {players.map(({ player, badge, badgeType, contract, days_left }) => {
        const isSelected = selectedId === player.id;
        const conflict = hasConflict(player.id);

        return (
          <button
            key={player.id}
            onClick={() => onSelect({ player, badge, badgeType, contract, days_left })}
            className={cn(
              "w-full text-left bg-card border rounded-xl p-3.5 flex items-center gap-3.5 transition-all hover:border-primary/30 hover:bg-card/80 group",
              isSelected ? "border-primary/50 bg-primary/5 shadow-md" : "border-border"
            )}
          >
            {/* Avatar */}
            <div className="w-11 h-11 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 overflow-hidden">
              {player.avatar_url
                ? <img src={player.avatar_url} alt={player.gamertag} className="w-full h-full object-cover" style={{ objectPosition: player.avatar_position || "50% 50%" }} />
                : <span className="text-sm font-bold text-primary">{(player.gamertag || "?")[0].toUpperCase()}</span>}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("font-bold text-sm truncate", isSelected ? "text-primary" : "text-foreground group-hover:text-primary transition-colors")}>
                  {player.gamertag}
                </span>
                <TransferBadge type={badgeType} daysLeft={days_left} />
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {player.position && (
                  <span className="text-[11px] font-semibold text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded">
                    {player.position}
                  </span>
                )}
                {player.overall_rating && (
                  <span className="text-[11px] text-muted-foreground font-medium">
                    OVR {player.overall_rating}
                  </span>
                )}
                {player.platform && (
                  <span className="text-[11px] text-muted-foreground hidden sm:inline">
                    {player.platform}
                  </span>
                )}
              </div>
            </div>

            {/* Action */}
            <div className="shrink-0" onClick={e => e.stopPropagation()}>
              {conflict ? (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 bg-muted px-2 py-1 rounded-lg">
                  <FileText className="w-3 h-3" /> Sent
                </span>
              ) : canManage ? (
                <Button
                  size="sm"
                  onClick={() => onOffer({ player, badgeType })}
                  className="h-7 px-2.5 text-xs bg-primary/10 text-primary hover:bg-primary/20 border-0 gap-1"
                >
                  <FileText className="w-3 h-3" />
                  <span className="hidden sm:inline">Offer</span>
                </Button>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
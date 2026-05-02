import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { STADIUM_LEVELS, getStadiumLevel, getNextStadiumLevel, calcTicketRevenue } from "@/lib/stadiumLevels";
import { formatSTC } from "@/lib/playerValue";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowUp, Lock, TrendingUp } from "lucide-react";

// Revenue description helper
function revenueDesc(lvl) {
  const revenue = lvl.capacity * lvl.ticket_price_stc;
  return `${formatSTC(revenue)} per home match (${lvl.capacity.toLocaleString()} × ${lvl.ticket_price_stc} STC/ticket)`;
}

export default function StadiumUpgrade({ club, canEdit, onUpdate }) {
  const [upgrading, setUpgrading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Clamp old-format levels (0-5) to new 3-level system (0-2)
  const rawLevel = club?.stadium_level || 0;
  const currentLevel = rawLevel > 2 ? 2 : rawLevel; // cap at 2
  const current = getStadiumLevel(currentLevel);
  const next = getNextStadiumLevel(currentLevel);
  const clubStc = club?.stc || 0;
  const canAfford = next && clubStc >= next.upgrade_cost_stc;

  function showNotif(msg, type) {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  }

  async function handleUpgrade() {
    if (!next || !canAfford) return;
    setUpgrading(true);
    try {
      const newStc = clubStc - next.upgrade_cost_stc;
      const updates = {
        stc: newStc,
        stadium_level: currentLevel + 1,
        stadium_name: club.stadium_name || `${club.name} Stadium`,
        stadium_capacity: next.capacity,
      };
      await base44.entities.Club.update(club.id, updates);
      await base44.entities.STCTransaction.create({
        club_id: club.id,
        amount: -next.upgrade_cost_stc,
        type: "stadium_upgrade",
        description: `Stadium upgraded to ${next.name}`,
        reference_id: club.id,
      });
      onUpdate?.(updates);
      showNotif(`Stadium upgraded to ${next.name}!`, "success");
    } catch (err) {
      showNotif(err.message || "Upgrade failed", "error");
    }
    setUpgrading(false);
  }

  return (
    <div className="space-y-5">
      {notification && (
        <div className={cn("px-4 py-3 rounded-xl text-sm font-medium border",
          notification.type === "success"
            ? "bg-success/15 border-success/30 text-success"
            : "bg-destructive/15 border-destructive/30 text-destructive"
        )}>
          {notification.msg}
        </div>
      )}

      {/* Current Stadium */}
      <div className={cn("border rounded-2xl p-5", current.bg)}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">{current.emoji}</span>
          <div className="flex-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Current Stadium</p>
            <h3 className={cn("font-heading font-black text-xl uppercase tracking-tight", current.color)}>
              {club?.stadium_name || current.name}
            </h3>
            <p className="text-xs text-muted-foreground">{current.description}</p>
          </div>
          <div className="ml-auto text-right shrink-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Level (of 3)</p>
            <p className={cn("font-black text-3xl", current.color)}>{currentLevel + 1}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/40">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Capacity</p>
            <p className="font-light text-foreground text-lg">{current.capacity.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ticket Price per Fan</p>
            <p className="font-light text-success text-lg">{current.ticket_price_stc} STC</p>
          </div>
        </div>
        {/* Ticket Revenue */}
        <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Ticket Revenue per Home Match</p>
          <div className="bg-success/10 border border-success/20 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Revenue Formula:</p>
              <p className="text-sm font-semibold text-success">{current.capacity.toLocaleString()} capacity × {current.ticket_price_stc} STC/ticket</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground mb-1">Per Home Match</p>
              <p className={cn("text-xl font-bold", current.color)}>{formatSTC(current.capacity * current.ticket_price_stc)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade section */}
      {next ? (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <ArrowUp className="w-3.5 h-3.5 text-primary" /> Next Upgrade
          </p>
          <div className="flex items-center gap-4">
            <span className="text-3xl">{next.emoji}</span>
            <div className="flex-1">
              <p className={cn("font-bold text-base", next.color)}>{next.name}</p>
              <p className="text-xs text-muted-foreground">{next.description}</p>
              <div className="flex gap-4 mt-1.5">
                <span className="text-xs text-muted-foreground">Capacity: <span className="text-foreground font-medium">{next.capacity.toLocaleString()}</span></span>
                <span className="text-xs text-muted-foreground">Revenue/Match: <span className="text-success font-medium">{formatSTC(next.capacity * next.ticket_price_stc)}</span></span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-secondary/60 rounded-xl px-4 py-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Upgrade Cost</p>
              <p className={cn("font-light text-xl tracking-tight", canAfford ? "text-warning" : "text-destructive")}>
                {formatSTC(next.upgrade_cost_stc)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Club Balance</p>
              <p className="font-light text-foreground text-lg tracking-tight">{formatSTC(clubStc)}</p>
            </div>
          </div>

          {canEdit && (
            <Button
              onClick={handleUpgrade}
              disabled={upgrading || !canAfford}
              className={cn("w-full gap-2 font-semibold",
                canAfford
                  ? "bg-warning text-black hover:bg-warning/90"
                  : "bg-secondary text-muted-foreground cursor-not-allowed"
              )}
            >
              {upgrading
                ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                : canAfford
                ? <><ArrowUp className="w-4 h-4" /> Upgrade to {next.name} — {formatSTC(next.upgrade_cost_stc)}</>
                : <><Lock className="w-4 h-4" /> Need {formatSTC(next.upgrade_cost_stc - clubStc)} more STC</>
              }
            </Button>
          )}
        </div>
      ) : (
        <div className="text-center py-6 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl">
          <span className="text-3xl">👑</span>
          <p className="font-bold text-yellow-400 mt-2">Max Level — Iconic Arena</p>
          <p className="text-xs text-muted-foreground mt-1">Your stadium is the pinnacle of football infrastructure.</p>
        </div>
      )}

      {/* Full upgrade ladder */}
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Upgrade Path</p>
        <div className="space-y-2">
          {STADIUM_LEVELS.map((lvl, i) => (
            <div key={i} className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all",
              i === currentLevel
                ? cn(lvl.bg, "opacity-100")
                : i < currentLevel
                ? "bg-success/5 border-success/15 opacity-70"
                : "bg-secondary/40 border-border/40 opacity-50"
            )}>
              <span className="text-base shrink-0">{lvl.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className={cn("text-xs font-bold", i <= currentLevel ? lvl.color : "text-muted-foreground")}>{lvl.name} <span className="font-normal opacity-60">Lv {i + 1}</span></p>
                <p className="text-[10px] text-muted-foreground">{lvl.capacity.toLocaleString()} capacity · {formatSTC(lvl.capacity * lvl.ticket_price_stc)}/match ({lvl.ticket_price_stc} STC/ticket)</p>
              </div>
              <div className="text-right shrink-0">
                {i === 0 ? (
                  <span className="text-[10px] text-muted-foreground">Lv 1 — Default</span>
                ) : (
                  <span className={cn("text-[10px] font-medium", i <= currentLevel ? "text-success" : "text-muted-foreground")}>
                    {i <= currentLevel ? "✓ Unlocked" : formatSTC(lvl.upgrade_cost_stc)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
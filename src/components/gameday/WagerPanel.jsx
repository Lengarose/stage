/**
 * WagerPanel — shows wager info and accept/decline/cancel controls on a match.
 */
import { useState } from "react";
import { stageClient } from "@/api/stageClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Coins, Lock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

const MIN_BET = 10_000;
const MAX_BET = 2_000_000;

function formatSTC(v) {
  if (!v) return "0";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString();
}

const WAGER_STATUS_CONFIG = {
  pending_acceptance: { label: "Awaiting Acceptance", color: "text-warning", bg: "bg-warning/10 border-warning/30" },
  active:             { label: "Funds Locked 🔒",      color: "text-success", bg: "bg-success/10 border-success/30" },
  settled:            { label: "Settled ✅",            color: "text-primary", bg: "bg-primary/10 border-primary/30" },
  refunded:           { label: "Refunded (Draw)",       color: "text-muted-foreground", bg: "bg-secondary border-border" },
  declined:           { label: "Declined",              color: "text-destructive", bg: "bg-destructive/10 border-destructive/30" },
  cancelled:          { label: "Cancelled",             color: "text-destructive", bg: "bg-destructive/10 border-destructive/30" },
};

export default function WagerPanel({ game, myPlayer, isMyMatch, amIHomeTeam, onGameUpdate }) {
  const [loading, setLoading] = useState(null);
  const [notif, setNotif] = useState(null);

  const wagerStc = game.wager_stc || 0;
  const wagerStatus = game.wager_status;
  const pot = wagerStc * 2;
  const isAwaySide = isMyMatch && !amIHomeTeam;
  const isHomeSide = isMyMatch && amIHomeTeam;

  function showNotif(msg, type) {
    setNotif({ msg, type });
    setTimeout(() => setNotif(null), 3500);
  }

  async function invoke(action, extra = {}) {
    setLoading(action);
    try {
      const res = await stageClient.functions.invoke("wagerMatchActions", {
        action, match_id: game.id, ...extra,
      });
      const updated = { ...game, ...res.data._match_patch };
      if (action === 'accept_wager') {
        onGameUpdate?.({ ...game, wager_away_locked: true, wager_status: 'active' });
        showNotif("Wager accepted! Funds locked. 🔒", "success");
      } else if (action === 'decline_wager') {
        onGameUpdate?.({ ...game, wager_status: 'declined', wager_stc: 0 });
        showNotif("Wager declined. No funds deducted.", "info");
      } else if (action === 'cancel_wager') {
        onGameUpdate?.({ ...game, wager_status: 'cancelled', wager_stc: 0 });
        showNotif("Wager cancelled. Funds refunded.", "info");
      }
    } catch (err) {
      showNotif(err.response?.data?.error || err.message || "Action failed", "error");
    }
    setLoading(null);
  }

  // Don't render if no wager and match is already in_progress or beyond
  if (!wagerStc && (game.status !== 'scheduled' || !isMyMatch)) return null;
  if (!wagerStc) return null;

  const statusCfg = WAGER_STATUS_CONFIG[wagerStatus] || WAGER_STATUS_CONFIG.pending_acceptance;

  return (
    <div className={cn("mx-5 mb-3 rounded-xl border px-4 py-3 space-y-2", statusCfg.bg)}>
      {notif && (
        <div className={cn("text-xs font-medium px-2 py-1 rounded-lg",
          notif.type === "success" ? "bg-success/20 text-success" :
          notif.type === "error" ? "bg-destructive/20 text-destructive" :
          "bg-secondary text-muted-foreground"
        )}>{notif.msg}</div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4 text-warning shrink-0" />
          <span className="text-sm font-bold text-foreground">STC Wager</span>
        </div>
        <span className={cn("text-[10px] font-bold uppercase tracking-wider", statusCfg.color)}>
          {statusCfg.label}
        </span>
      </div>

      {/* Pot details */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-black/15 rounded-lg px-3 py-2 text-center">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Each Side</p>
          <p className="text-sm font-black text-warning">{formatSTC(wagerStc)} STC</p>
        </div>
        <div className="bg-black/15 rounded-lg px-3 py-2 text-center">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Total Pot</p>
          <p className="text-sm font-black text-success">{formatSTC(pot)} STC</p>
        </div>
      </div>

      {/* Lock status */}
      <div className="flex items-center gap-3 text-xs">
        <div className={cn("flex items-center gap-1", game.wager_home_locked ? "text-success" : "text-muted-foreground")}>
          {game.wager_home_locked ? <Lock className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
          Home {game.wager_home_locked ? "locked" : "not locked"}
        </div>
        <div className={cn("flex items-center gap-1", game.wager_away_locked ? "text-success" : "text-muted-foreground")}>
          {game.wager_away_locked ? <Lock className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
          Away {game.wager_away_locked ? "locked" : "not locked"}
        </div>
      </div>

      {/* Away side: accept / decline */}
      {isAwaySide && wagerStatus === 'pending_acceptance' && game.status === 'scheduled' && (
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            onClick={() => invoke('accept_wager')}
            disabled={!!loading}
            className="flex-1 bg-success text-white text-xs gap-1 h-8"
          >
            {loading === 'accept_wager'
              ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
              : <><CheckCircle2 className="w-3 h-3" /> Accept ({formatSTC(wagerStc)} STC)</>}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => invoke('decline_wager')}
            disabled={!!loading}
            className="flex-1 text-destructive border-destructive/40 text-xs gap-1 h-8"
          >
            {loading === 'decline_wager'
              ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              : <><XCircle className="w-3 h-3" /> Decline</>}
          </Button>
        </div>
      )}

      {/* Home side: cancel (only while scheduled) */}
      {isHomeSide && ['pending_acceptance', 'active'].includes(wagerStatus) && game.status === 'scheduled' && (
        <button
          onClick={() => invoke('cancel_wager')}
          disabled={!!loading}
          className="text-[10px] text-destructive/60 hover:text-destructive transition-colors w-full text-center pt-1"
        >
          {loading === 'cancel_wager' ? "Cancelling..." : "Cancel wager (refund both sides)"}
        </button>
      )}

      {/* Settled banner */}
      {wagerStatus === 'settled' && (
        <p className="text-xs text-success font-semibold text-center">Winner received {formatSTC(pot)} STC</p>
      )}
      {wagerStatus === 'refunded' && (
        <p className="text-xs text-muted-foreground font-semibold text-center">Draw — both sides refunded {formatSTC(wagerStc)} STC</p>
      )}
    </div>
  );
}
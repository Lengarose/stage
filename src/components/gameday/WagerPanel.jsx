import { useState } from "react";
import { stageClient } from "@/api/stageClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Coins, Lock, CheckCircle2, XCircle, AlertTriangle, Trophy, RefreshCw } from "lucide-react";

const MIN_BET = 10_000;
const MAX_BET = 2_000_000;

function formatSTC(v) {
  if (!v) return "0";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString();
}

const WAGER_STATUS_CONFIG = {
  pending_acceptance: { label: "Awaiting Acceptance", color: "text-warning",          bg: "bg-warning/10 border-warning/30" },
  active:             { label: "Funds Locked 🔒",      color: "text-success",          bg: "bg-success/10 border-success/30" },
  settling:           { label: "Settling…",             color: "text-primary",          bg: "bg-primary/10 border-primary/30" },
  settled:            { label: "Settled ✅",             color: "text-primary",          bg: "bg-primary/10 border-primary/30" },
  refunded:           { label: "Draw — Refunded",       color: "text-muted-foreground", bg: "bg-secondary border-border" },
  declined:           { label: "Declined",              color: "text-destructive",      bg: "bg-destructive/10 border-destructive/30" },
  cancelled:          { label: "Cancelled",             color: "text-destructive",      bg: "bg-destructive/10 border-destructive/30" },
};

export default function WagerPanel({ game, myPlayer, myClub, isMyMatch, amIHomeTeam, onGameUpdate }) {
  const [loading, setLoading] = useState(null);
  const [notif, setNotif] = useState(null);

  const wagerStc   = Number(game.wager_stc || 0);
  const wagerStatus = game.wager_status;
  const pot = wagerStc * 2;
  const isAwaySide = isMyMatch && !amIHomeTeam;
  const isHomeSide = isMyMatch && amIHomeTeam;

  // Determine winner for settled display
  const homeScore = Number(game.home_score ?? -1);
  const awayScore = Number(game.away_score ?? -1);
  const homeWon = homeScore > awayScore;
  const awayWon = awayScore > homeScore;
  const isDraw  = homeScore >= 0 && homeScore === awayScore;

  const homeName = game.mode === 'club' ? (game.home_club_name || 'Home') : (game.home_player_name || 'Home');
  const awayName = game.mode === 'club' ? (game.away_club_name || 'Away') : (game.away_player_name || 'Away');

  // Who am I rooting for?
  const myIsHome = isMyMatch && amIHomeTeam;
  const myIsAway = isMyMatch && !amIHomeTeam;
  const myTeamWon = (myIsHome && homeWon) || (myIsAway && awayWon);
  const myTeamLost = (myIsHome && awayWon) || (myIsAway && homeWon);

  if (!wagerStc) return null;

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
      if (action === 'accept_wager') {
        onGameUpdate?.({ ...game, wager_away_locked: true, wager_status: 'active' });
        showNotif("Wager accepted — funds locked. 🔒", "success");
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

      {/* Lock status — only show while pending/active */}
      {['pending_acceptance', 'active'].includes(wagerStatus) && (
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
      )}

      {/* Settled outcome banner */}
      {wagerStatus === 'settled' && (
        <div className={cn(
          "rounded-lg px-3 py-2 flex items-center gap-2 text-xs font-semibold",
          myTeamWon   ? "bg-success/20 text-success" :
          myTeamLost  ? "bg-destructive/20 text-destructive" :
          "bg-primary/15 text-primary"
        )}>
          {myTeamWon ? (
            <><Trophy className="w-3.5 h-3.5 shrink-0" /> You won! +{formatSTC(pot)} STC added to your balance</>
          ) : myTeamLost ? (
            <><XCircle className="w-3.5 h-3.5 shrink-0" /> You lost — {formatSTC(wagerStc)} STC forfeited</>
          ) : (
            <><Trophy className="w-3.5 h-3.5 shrink-0" /> {homeWon ? homeName : awayName} won — {formatSTC(pot)} STC pot</>
          )}
        </div>
      )}
      {wagerStatus === 'refunded' && (
        <div className="rounded-lg px-3 py-2 flex items-center gap-2 text-xs font-medium bg-secondary text-muted-foreground">
          <RefreshCw className="w-3.5 h-3.5 shrink-0" />
          Draw — both sides refunded {formatSTC(wagerStc)} STC
        </div>
      )}
      {wagerStatus === 'cancelled' && (
        <p className="text-xs text-destructive font-medium text-center">Wager cancelled — funds refunded</p>
      )}
      {wagerStatus === 'declined' && (
        <p className="text-xs text-muted-foreground text-center">Wager declined — no funds deducted</p>
      )}

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

      {/* Home side: cancel (only while scheduled / pending) */}
      {isHomeSide && ['pending_acceptance', 'active'].includes(wagerStatus) && game.status === 'scheduled' && (
        <button
          onClick={() => invoke('cancel_wager')}
          disabled={!!loading}
          className="text-[10px] text-destructive/60 hover:text-destructive transition-colors w-full text-center pt-1"
        >
          {loading === 'cancel_wager' ? "Cancelling…" : "Cancel wager (refund both sides)"}
        </button>
      )}
    </div>
  );
}

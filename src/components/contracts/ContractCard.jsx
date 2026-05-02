import { cn } from "@/lib/utils";
import { CONTRACT_TYPES, getContractProgress } from "@/lib/contractTypes";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { X, CheckCircle, Clock, Gamepad2, RefreshCw, AlertTriangle, MessageSquare, Coins, Target } from "lucide-react";

const STATUS_STYLES = {
  pending:        "bg-warning/20 text-warning border-warning/30",
  pending_window: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  active:         "bg-success/20 text-success border-success/30",
  rejected:       "bg-destructive/20 text-destructive border-destructive/30",
  expired:        "bg-muted/50 text-muted-foreground border-border",
  terminated:     "bg-destructive/10 text-destructive/70 border-destructive/20",
  completed:      "bg-primary/10 text-primary border-primary/20",
};

export default function ContractCard({ contract, player, canManage, isMyContract, onAccept, onReject, onTerminate, onRenew, onNegotiate }) {
  const meta = CONTRACT_TYPES[contract.contract_type];
  const progress = getContractProgress(contract);
  if (!meta) return null;

  const isPendingWindow = contract.status === "pending_window";
  const isNegotiating = contract.status === "negotiating";
  const isNearEnd = contract.status === "active" && progress && (
    progress.gamesLeft <= 10 || progress.daysLeft <= 7
  );

  const isRenewable = canManage && ["active", "completed", "expired"].includes(contract.status);
  const canNegotiate = isMyContract && (contract.status === "pending" || (isNegotiating && contract.last_negotiated_by !== player?.id));

  return (
    <div className={cn("rounded-xl border p-4 transition-all", meta.bg, meta.border)}>
      {/* Pending window banner */}
      {isPendingWindow && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>Accepted — awaiting transfer window to execute</span>
        </div>
      )}
      {isNegotiating && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold">
          <MessageSquare className="w-3.5 h-3.5 shrink-0" />
          <span>Negotiating — Round {contract.negotiation_round || 1} · Waiting for response</span>
        </div>
      )}

      {/* Warning banner */}
      {isNearEnd && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-warning/10 border border-warning/30 text-warning text-xs font-semibold">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>
            Contract expiring soon —{" "}
            {progress.gamesLeft <= 10 && `${progress.gamesLeft} game${progress.gamesLeft !== 1 ? "s" : ""} left`}
            {progress.gamesLeft <= 10 && progress.daysLeft <= 7 && " · "}
            {progress.daysLeft <= 7 && `${progress.daysLeft} day${progress.daysLeft !== 1 ? "s" : ""} left`}
          </span>
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Player avatar */}
        <div className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 overflow-hidden">
          {player?.avatar_url
            ? <img src={player.avatar_url} alt={player.gamertag} className="w-full h-full object-cover" />
            : <span className="text-xs font-bold text-primary">{(player?.gamertag || "?")[0].toUpperCase()}</span>}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={`/players/${player?.id}`} className="font-bold text-foreground hover:text-primary transition-colors truncate">
              {player?.gamertag || "Unknown Player"}
            </Link>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider", meta.badge)}>
              {meta.label}
            </span>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider", STATUS_STYLES[contract.status] || STATUS_STYLES.pending)}>
              {contract.status}
            </span>
          </div>

          <p className="text-xs text-muted-foreground mt-0.5">
            {meta.description}
            {contract.start_date && contract.status === "active" && (
              <> · Started {new Date(contract.start_date).toLocaleDateString()}</>
            )}
            {contract.end_date && contract.status === "active" && (
              <> · Ends {new Date(contract.end_date).toLocaleDateString()}</>
            )}
          </p>

          {contract.offer_note && (
            <p className="text-xs text-muted-foreground italic mt-1">"{contract.offer_note}"</p>
          )}

          {/* Financial terms */}
          {(contract.weekly_salary_stc > 0 || contract.signing_bonus_stc > 0) && (
            <div className="flex flex-wrap gap-2 mt-2">
              {contract.weekly_salary_stc > 0 && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-success/10 border border-success/20 text-success font-medium">
                  <Coins className="w-2.5 h-2.5" /> {contract.weekly_salary_stc.toLocaleString()} STC/wk
                </span>
              )}
              {contract.signing_bonus_stc > 0 && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-warning/10 border border-warning/20 text-warning font-medium">
                  <Coins className="w-2.5 h-2.5" /> +{contract.signing_bonus_stc.toLocaleString()} bonus
                </span>
              )}
              {contract.captaincy_offered && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 border border-warning/20 text-warning font-medium">
                  ⭐ Captaincy
                </span>
              )}
            </div>
          )}

          {/* Performance targets */}
          {contract.performance_targets?.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
              <Target className="w-2.5 h-2.5 shrink-0" />
              {contract.performance_targets.length} performance target{contract.performance_targets.length > 1 ? "s" : ""}
            </div>
          )}

          {/* Progress bars — only for active contracts */}
          {contract.status === "active" && progress && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Gamepad2 className="w-3 h-3 shrink-0" />
                <div className="flex-1 bg-secondary rounded-full h-1.5 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", progress.gamesPercent >= 80 ? "bg-warning" : progress.gamesPercent >= 95 ? "bg-destructive" : meta.color.replace("text-", "bg-"))}
                    style={{ width: `${progress.gamesPercent}%` }}
                  />
                </div>
                <span className={cn("shrink-0", progress.gamesLeft <= 10 ? "text-warning font-semibold" : "")}>
                  {progress.gamesPlayed}/{progress.maxGames} games
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3 shrink-0" />
                <div className="flex-1 bg-secondary rounded-full h-1.5 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", progress.daysPercent >= 80 ? "bg-warning" : progress.daysPercent >= 95 ? "bg-destructive" : meta.color.replace("text-", "bg-"))}
                    style={{ width: `${progress.daysPercent}%` }}
                  />
                </div>
                <span className={cn("shrink-0", progress.daysLeft <= 7 ? "text-warning font-semibold" : "")}>
                  {progress.daysLeft}d left
                </span>
              </div>
            </div>
          )}

          {/* Completed/expired summary */}
          {["completed", "expired", "terminated"].includes(contract.status) && progress && (
            <p className="text-xs text-muted-foreground mt-2">
              {contract.games_played || 0} games played
              {contract.start_date && contract.end_date && (
                <> · {new Date(contract.start_date).toLocaleDateString()} – {new Date(contract.end_date).toLocaleDateString()}</>
              )}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5 shrink-0">
          {/* Player actions on their own pending contract */}
          {(contract.status === "pending" || (isNegotiating && canNegotiate)) && isMyContract && (
            <>
              <Button size="sm" className="h-7 px-2 text-xs bg-success/20 text-success hover:bg-success/30 border-0" onClick={() => onAccept(contract)}>
                <CheckCircle className="w-3 h-3 mr-1" /> Accept
              </Button>
              {onNegotiate && (
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10" onClick={() => onNegotiate(contract)}>
                  <MessageSquare className="w-3 h-3 mr-1" /> Counter
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => onReject(contract)}>
                <X className="w-3 h-3 mr-1" /> Reject
              </Button>
            </>
          )}
          {/* Management actions */}
          {contract.status === "active" && canManage && (
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => onTerminate(contract)}>
              <X className="w-3 h-3 mr-1" /> Terminate
            </Button>
          )}
          {isRenewable && onRenew && (
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-primary/30 text-primary hover:bg-primary/10" onClick={() => onRenew(contract)}>
              <RefreshCw className="w-3 h-3 mr-1" /> Renew
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
import EmptyState from "@/components/admin/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Flag, Check, X, AlertTriangle } from "lucide-react";

export default function ForfeitsTab({ forfeits, resolveForfeit }) {
  return (
    <>
      {forfeits.length === 0 ? (
        <EmptyState icon={Flag} text="No pending forfeit requests." />
      ) : (
        <div className="space-y-3">
          {forfeits.map(m => {
            const claimerName  = m.forfeit_claimed_by === m.home_club_id ? m.home_club_name : m.away_club_name;
            // A "stale" claim is one filed against a match that has since been
            // played to completion (or already forfeited). Approving would
            // overwrite the recorded result, so we only allow Reject.
            const isStale      = m.status === "completed" || m.status === "forfeit";
            const hasScore     = m.home_score != null && m.away_score != null;
            return (
              <div
                key={m.id}
                className={`bg-card border rounded p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${isStale ? "border-destructive/40" : "border-warning/20"}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-foreground">{m.home_club_name} vs {m.away_club_name}</p>
                    {hasScore && (
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-secondary text-foreground">
                        {m.home_score} – {m.away_score}
                      </span>
                    )}
                    {isStale && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30">
                        <AlertTriangle className="w-3 h-3" />
                        Match already {m.status === "forfeit" ? "forfeited" : "played"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Claimed by: <strong className="text-foreground">{claimerName}</strong></p>
                  {isStale && (
                    <p className="text-[11px] text-destructive/85 mt-1">
                      This claim cannot be approved — the match result is already recorded. Reject to dismiss.
                    </p>
                  )}
                  {m.forfeit_proof_url && <a href={m.forfeit_proof_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline mt-1 block">View Proof</a>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    disabled={isStale}
                    onClick={() => resolveForfeit(m.id, true)}
                    className="bg-success/20 text-success hover:bg-success/30 border-0 gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isStale ? "Cannot approve — match already resolved" : "Approve forfeit claim"}
                  >
                    <Check className="w-4 h-4" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resolveForfeit(m.id, false)}
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 gap-1"
                  >
                    <X className="w-4 h-4" /> Reject
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

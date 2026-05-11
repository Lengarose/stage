import EmptyState from "@/components/admin/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Flag, Check, X } from "lucide-react";

export default function ForfeitsTab({ forfeits, resolveForfeit }) {
  return (
    <>
      {forfeits.length === 0 ? (
        <EmptyState icon={Flag} text="No pending forfeit requests." />
      ) : (
        <div className="space-y-3">
          {forfeits.map(m => {
            const claimerName = m.forfeit_claimed_by === m.home_club_id ? m.home_club_name : m.away_club_name;
            return (
              <div key={m.id} className="bg-card border border-warning/20 rounded p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <p className="font-bold text-foreground">{m.home_club_name} vs {m.away_club_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Claimed by: <strong className="text-foreground">{claimerName}</strong></p>
                  {m.forfeit_proof_url && <a href={m.forfeit_proof_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline mt-1 block">View Proof</a>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" onClick={() => resolveForfeit(m.id, true)} className="bg-success/20 text-success hover:bg-success/30 border-0 gap-1"><Check className="w-4 h-4" /> Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => resolveForfeit(m.id, false)} className="border-destructive/30 text-destructive hover:bg-destructive/10 gap-1"><X className="w-4 h-4" /> Reject</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

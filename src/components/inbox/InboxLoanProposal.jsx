import { useEffect, useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { withTranslationFallback } from "@/lib/translationFallback";
import { formatSTC } from "@/lib/playerValue";
import { getEffectiveInboxActionType, parseInboxMetadata } from "@/lib/inboxActionTypes";

export default function InboxLoanProposal({ message, onActioned }) {
  const { t } = useTranslation();
  const tx = withTranslationFallback(t);
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState(null);
  const metadata = parseInboxMetadata(message);
  const loanId = metadata.loan_id || message?.related_entity_id;
  const actionType = getEffectiveInboxActionType(message);
  const isPlayer = actionType === "loan_player_response";

  useEffect(() => {
    if (!loanId) { setLoading(false); return; }
    let cancelled = false;
    stageClient.entities.PlayerLoan.get(loanId)
      .then((row) => { if (!cancelled) setLoan(row); })
      .catch(() => { if (!cancelled) setLoan(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [loanId]);

  async function act(path, action) {
    if (!loanId) return;
    setActing(true);
    setError(null);
    try {
      await stageClient.http.post(`/player-loans/${encodeURIComponent(loanId)}/${path}`, {});
      onActioned?.(action);
    } catch (err) {
      setError(err?.data?.code || err?.message || tx("commonPages.loanActionFailed", "Could not update this loan."));
    } finally {
      setActing(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">{tx("commonPages.loading", "Loading...")}</p>;
  if (!loan) return <p className="text-sm text-muted-foreground">{tx("commonPages.loanNotFound", "Loan proposal not found.")}</p>;

  const status = String(loan.status || "").toUpperCase();
  const parentCanDecide = !isPlayer && status === "PROPOSED";
  const playerCanDecide = isPlayer && status === "AWAITING_PLAYER";
  const canDecide = parentCanDecide || playerCanDecide;

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
      <p className="text-xs uppercase tracking-wider text-white/45">
        {isPlayer ? tx("commonPages.loanOffer", "Loan offer") : tx("commonPages.loanProposal", "Loan proposal")}
      </p>
      <p className="text-sm text-foreground">
        {tx("commonPages.fromClub", "From")}: {metadata.parent_club_name || loan.parent_club_name || "—"}
      </p>
      <p className="text-sm text-foreground">
        {tx("commonPages.toClub", "To")}: {metadata.loan_club_name || loan.loan_club_name || "—"}
      </p>
      <p className="text-sm text-foreground">
        {tx("commonPages.loanFee", "Loan fee (STC)")}: {formatSTC(loan.loan_fee_stc || 0)}
      </p>
      <p className="text-sm text-foreground">
        {tx("commonPages.wageSplit", "Wage split")}: {loan.parent_wage_percentage}% / {loan.loan_wage_percentage}%
      </p>
      <p className="text-sm text-foreground">
        {loan.start_date || "—"} → {loan.end_date || "—"}
      </p>
      {error ? <p className="text-sm text-red-400">{String(error)}</p> : null}
      {canDecide ? (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            disabled={acting}
            onClick={() => act(isPlayer ? "player-accept" : "parent-accept", "accept")}
            className="w-full"
          >
            {acting ? tx("commonPages.sending", "Sending...") : tx("commonPages.acceptLoan", "Accept loan")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={acting}
            onClick={() => act(isPlayer ? "player-reject" : "parent-reject", "reject")}
            className="w-full"
          >
            {acting ? tx("commonPages.sending", "Sending...") : tx("commonPages.rejectLoan", "Reject loan")}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{loan.status}</p>
      )}
    </div>
  );
}

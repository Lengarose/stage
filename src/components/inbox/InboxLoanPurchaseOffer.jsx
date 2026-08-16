import { useEffect, useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { withTranslationFallback } from "@/lib/translationFallback";
import { formatSTC } from "@/lib/playerValue";
import { parseInboxMetadata } from "@/lib/inboxActionTypes";

// Club B exercised its option to buy. Accepting converts the loan into a
// permanent deal at Club B; rejecting leaves the loan running as agreed.
export default function InboxLoanPurchaseOffer({ message, onActioned }) {
  const { t } = useTranslation();
  const tx = withTranslationFallback(t);
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState(null);
  const metadata = parseInboxMetadata(message);
  const loanId = metadata.loan_id || message?.related_entity_id;

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

  const canDecide = String(loan.status || "").toUpperCase() === "ACTIVE"
    && String(loan.purchase_offer_status || "") === "AWAITING_PLAYER";
  const days = Number(loan.purchase_contract_days || 0);

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
      <p className="text-xs uppercase tracking-wider text-white/45">
        {tx("commonPages.purchaseOffer", "Permanent transfer offer")}
      </p>
      <p className="text-sm text-foreground">
        {tx("commonPages.toClub", "To")}: {metadata.loan_club_name || loan.loan_club_name || "—"}
      </p>
      <p className="text-sm text-foreground">
        {tx("commonPages.purchaseFee", "Purchase fee (STC)")}: {formatSTC(loan.purchase_option_stc || 0)}
      </p>
      <p className="text-sm text-foreground">
        {tx("commonPages.weeklySalary", "Weekly salary (STC)")}: {formatSTC(loan.purchase_salary_stc || 0)}
      </p>
      <p className="text-sm text-foreground">
        {days > 0
          ? `${tx("commonPages.contractLength", "Contract length")}: ${days} ${tx("commonPages.days", "days")}`
          : tx("commonPages.purchaseKeepsCurrentTerm", "Contract runs to the end of your current deal")}
      </p>
      {error ? <p className="text-sm text-red-400">{String(error)}</p> : null}
      {canDecide ? (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            disabled={acting}
            onClick={() => act("purchase-accept", "accept")}
            className="w-full"
          >
            {acting ? tx("commonPages.sending", "Sending...") : tx("commonPages.acceptTransfer", "Accept transfer")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={acting}
            onClick={() => act("purchase-reject", "reject")}
            className="w-full"
          >
            {acting ? tx("commonPages.sending", "Sending...") : tx("commonPages.rejectTransfer", "Reject and stay on loan")}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{loan.status}</p>
      )}
    </div>
  );
}

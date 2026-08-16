import { useEffect, useState } from "react";
import { stageClient } from "@/api/stageClient";
import { useTranslation } from "@/hooks/useTranslation";
import { withTranslationFallback } from "@/lib/translationFallback";
import { parseInboxMetadata } from "@/lib/inboxActionTypes";

export default function InboxLoanTerminatedEarly({ message }) {
  const { t } = useTranslation();
  const tx = withTranslationFallback(t);
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
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

  if (loading) return <p className="text-sm text-muted-foreground">{tx("commonPages.loading", "Loading...")}</p>;

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
      <p className="text-xs uppercase tracking-wider text-white/45">
        {tx("commonPages.loanTerminatedEarly", "Loan ended early")}
      </p>
      <p className="text-sm text-foreground">
        {tx("commonPages.fromClub", "From")}: {metadata.parent_club_name || loan?.parent_club_name || "—"}
      </p>
      <p className="text-sm text-foreground">
        {tx("commonPages.toClub", "To")}: {metadata.loan_club_name || loan?.loan_club_name || "—"}
      </p>
      <p className="text-sm text-muted-foreground">
        {tx("commonPages.loanTerminatedEarlyNotice", "Playing rights have returned to the parent club. No response is required.")}
      </p>
      {loan?.status ? <p className="text-sm text-muted-foreground">{loan.status}</p> : null}
    </div>
  );
}

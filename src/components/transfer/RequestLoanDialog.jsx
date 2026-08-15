import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { stageClient } from "@/api/stageClient";
import { useTranslation } from "@/hooks/useTranslation";
import { withTranslationFallback } from "@/lib/translationFallback";

function defaultEndDate() {
  const end = new Date();
  end.setMonth(end.getMonth() + 6);
  return end.toISOString().slice(0, 10);
}

function defaultStartDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function RequestLoanDialog({ open, onClose, player, club, onSubmitted }) {
  const { t } = useTranslation();
  const tx = withTranslationFallback(t);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [loanFee, setLoanFee] = useState("0");
  const [loanWage, setLoanWage] = useState("70");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    setSubmitError(null);
    setStartDate(defaultStartDate());
    setEndDate(defaultEndDate());
    setLoanFee("0");
    setLoanWage("70");
  }, [open, player?.id]);

  const parentWage = 100 - (parseInt(loanWage, 10) || 0);
  const splitValid = parentWage >= 0 && parentWage <= 100 && parentWage + (parseInt(loanWage, 10) || 0) === 100;

  async function handleSubmit() {
    if (!player?.id || !club?.id || !splitValid) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await stageClient.entities.PlayerLoan.create({
        player_id: player.id,
        loan_club_id: club.id,
        start_date: startDate,
        end_date: endDate,
        loan_fee_stc: parseInt(loanFee, 10) || 0,
        parent_wage_percentage: parentWage,
        loan_wage_percentage: parseInt(loanWage, 10) || 0,
      });
      onSubmitted?.();
      onClose?.();
    } catch (err) {
      setSubmitError(err?.data?.code || err?.message || tx("commonPages.loanRequestFailed", "Could not send the loan request."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose?.(); }}>
      <DialogContent className="max-w-md border-white/10 bg-[#071018] text-white">
        <DialogHeader>
          <DialogTitle className="font-heading uppercase tracking-wide">
            {tx("commonPages.requestLoan", "Request Loan")}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-white/60">
          {tx("commonPages.loanRequestFor", "Propose a loan for {name}.", { name: player?.gamertag || "this player" })}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs uppercase tracking-wider text-white/45">
            {tx("commonPages.loanStart", "Start")}
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-1 w-full rounded-none border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs uppercase tracking-wider text-white/45">
            {tx("commonPages.loanEnd", "End")}
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="mt-1 w-full rounded-none border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </label>
        </div>
        <label className="text-xs uppercase tracking-wider text-white/45">
          {tx("commonPages.loanFee", "Loan fee (STC)")}
          <input
            type="number"
            min="0"
            value={loanFee}
            onChange={(event) => setLoanFee(event.target.value)}
            className="mt-1 w-full rounded-none border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="text-xs uppercase tracking-wider text-white/45">
          {tx("commonPages.loanClubWageShare", "Your wage share %")}
          <input
            type="number"
            min="0"
            max="100"
            value={loanWage}
            onChange={(event) => setLoanWage(event.target.value)}
            className="mt-1 w-full rounded-none border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
          />
        </label>
        <p className="text-xs text-white/50">
          {tx("commonPages.parentWageShare", "Parent club pays {percent}%", { percent: parentWage })}
        </p>
        {submitError ? <p className="text-sm text-red-400">{String(submitError)}</p> : null}
        <Button
          type="button"
          disabled={submitting || !splitValid}
          onClick={handleSubmit}
          className="w-full rounded-none bg-gradient-to-b from-[#ffe27a] to-[#c9a227] font-heading text-sm font-black uppercase tracking-[0.18em] text-black"
        >
          {submitting ? tx("commonPages.sending", "Sending...") : tx("commonPages.requestLoan", "Request Loan")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

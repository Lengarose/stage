import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { stageClient } from "@/api/stageClient";
import { Coins, Loader2, ArrowRight } from "lucide-react";
import { formatSTC } from "@/lib/playerValue";
import { notify, postContractNews } from "@/lib/notify";
import { cn } from "@/lib/utils";

export default function TransferPaymentDialog({ open, onClose, player, targetClub, myClub, onPaid }) {
  const [fee, setFee] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const feeNum = parseInt(fee) || 0;
  const myBalance = myClub?.stc || 0;
  const myTransferBudget = myClub?.transfer_budget_stc || 0;
  const insufficient = feeNum > myBalance;
  const overTransferBudget = !insufficient && feeNum > myTransferBudget;

  async function handlePay() {
    if (feeNum <= 0) { setError("Enter a valid transfer fee amount."); return; }
    if (insufficient) { setError(`Insufficient funds. Club balance: ${formatSTC(myBalance)}`); return; }
    setLoading(true);
    setError(null);
    try {
      await stageClient.entities.Club.update(myClub.id, {
        stc: myBalance - feeNum,
        transfer_budget_stc: Math.max(0, myTransferBudget - feeNum),
      });
      if (targetClub) {
        await stageClient.entities.Club.update(targetClub.id, {
          stc: (targetClub.stc || 0) + feeNum,
          transfer_budget_stc: (targetClub.transfer_budget_stc || 0) + feeNum,
        });
        notify(targetClub.owner_email, "club_update",
          `💰 Transfer Fee Received — ${formatSTC(feeNum)}`,
          `${myClub.name} paid a transfer fee of ${formatSTC(feeNum)} for ${player?.gamertag || "a player"}.`,
          `/clubs/${targetClub.id}`
        );
      }
      postContractNews({
        title: `💰 ${myClub.name} paid ${formatSTC(feeNum)} transfer fee for ${player?.gamertag || "a player"}`,
        body: `${myClub.name} paid a transfer fee of ${formatSTC(feeNum)} to ${targetClub?.name || "the previous club"} for ${player?.gamertag || "a player"}.`,
        club_name: myClub.name, club_logo_url: myClub.logo_url || "",
        player_name: player?.gamertag || "", player_avatar_url: player?.avatar_url || "",
        link: `/players/${player?.id}`,
        transfer_fee_stc: feeNum,
      });
      setSuccess(true);
      onPaid?.(feeNum);
    } catch (err) {
      setError(err?.message || "Payment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setFee(""); setError(null); setSuccess(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Coins className="w-5 h-5 text-primary" />
            Pay Transfer Fee
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-success/20 border border-success/30 flex items-center justify-center mx-auto text-2xl">💰</div>
            <p className="font-bold text-foreground">Transfer fee paid!</p>
            <p className="text-sm text-muted-foreground">
              {formatSTC(feeNum)} sent to {targetClub?.name || "the club"} for {player?.gamertag}.
            </p>
            <Button onClick={handleClose} className="mt-2">Done</Button>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {/* Flow visualization */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary border border-border">
              <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
                {myClub?.logo_url
                  ? <img src={myClub.logo_url} alt={myClub.name} className="w-full h-full object-cover" />
                  : <span className="text-xs font-bold text-primary">{(myClub?.name || "?")[0]}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">From</p>
                <p className="text-sm font-bold text-foreground truncate">{myClub?.name}</p>
                <p className="text-[10px] text-muted-foreground">Balance: {formatSTC(myBalance)}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0 text-right">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">To</p>
                <p className="text-sm font-bold text-foreground truncate">{targetClub?.name || "No club"}</p>
                <p className="text-[10px] text-muted-foreground">For {player?.gamertag}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center overflow-hidden shrink-0">
                {player?.avatar_url
                  ? <img src={player.avatar_url} alt={player.gamertag} className="w-full h-full object-cover" />
                  : <span className="text-xs font-bold text-foreground">{(player?.gamertag || "?")[0]}</span>}
              </div>
            </div>

            {/* Amount input */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1 block">
                <Coins className="w-3 h-3 text-primary" /> Transfer Fee Amount (STC)
              </label>
              <input
                type="number" value={fee} onChange={e => setFee(e.target.value)} min="0"
                placeholder="e.g. 1,000,000"
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Budget feedback */}
            {feeNum > 0 && (
              <div className={cn("px-3 py-2 rounded-lg border text-xs font-medium",
                insufficient ? "bg-destructive/10 border-destructive/30 text-destructive"
                : overTransferBudget ? "bg-warning/10 border-warning/30 text-warning"
                : "bg-success/10 border-success/20 text-success"
              )}>
                {insufficient
                  ? `⛔ Exceeds club balance — need ${formatSTC(feeNum - myBalance)} more STC`
                  : overTransferBudget
                  ? `⚠ Exceeds transfer budget (${formatSTC(myTransferBudget)}) — deducted from main balance`
                  : `✓ Within transfer budget (${formatSTC(myTransferBudget)})`}
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={handleClose} className="flex-1">Cancel</Button>
              <Button
                onClick={handlePay}
                disabled={loading || !feeNum || insufficient}
                className="flex-1 bg-primary text-primary-foreground gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
                {loading ? "Paying…" : "Pay Transfer Fee"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

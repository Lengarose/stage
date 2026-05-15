import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { stageClient } from "@/api/stageClient";
import { Building2, CheckCircle, FileText, Loader2 } from "lucide-react";

export default function OwnerContractDialog({ open, club, player, contractId, onSigned, onClose }) {
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState(null);

  async function signContract() {
    if (!contractId) {
      onSigned?.();
      return;
    }
    setSigning(true);
    setError(null);
    try {
      await stageClient.functions.invoke("contractManagement", {
        action: "accept",
        contract_id: contractId,
      });
      onSigned?.();
    } catch (err) {
      setError(err?.message || "Could not sign ownership contract.");
    } finally {
      setSigning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose?.()}>
      <DialogContent className="bg-[#0d1225] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Building2 className="w-5 h-5 text-primary" />
            Club Ownership Contract
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/25 bg-primary/10 p-4">
            <p className="text-xs uppercase tracking-widest text-primary font-bold mb-1">Owner</p>
            <p className="text-lg font-black">{player?.gamertag || player?.full_name || "Club Creator"}</p>
            <p className="text-sm text-white/55 mt-1">{club?.name || "Your club"}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2 text-sm text-white/70">
            <p className="flex items-center gap-2 font-semibold text-white">
              <FileText className="w-4 h-4 text-primary" /> Contract terms
            </p>
            <p>Role: Club Owner</p>
            <p>Duration: 10 years</p>
            <p>Salary: 0 STC/week</p>
            <p>This confirms you as the club creator and owner. Captaincy remains a separate staff title that must be assigned later.</p>
          </div>
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <Button onClick={signContract} disabled={signing} className="w-full gap-2">
            {signing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {signing ? "Signing..." : "Sign Ownership Contract"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

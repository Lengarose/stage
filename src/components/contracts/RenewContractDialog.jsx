import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CONTRACT_TYPE_OPTIONS } from "@/lib/contractTypes";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

export default function RenewContractDialog({ open, onClose, contract, player, onRenew }) {
  const [selectedType, setSelectedType] = useState("squad");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRenew() {
    setLoading(true);
    await onRenew({ contract_type: selectedType, offer_note: note });
    setNote("");
    setSelectedType("squad");
    setLoading(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <RefreshCw className="w-5 h-5 text-primary" />
            Renew Contract
            {player && <span className="text-muted-foreground font-normal text-base">for {player.gamertag}</span>}
          </DialogTitle>
        </DialogHeader>

        {contract && (
          <p className="text-xs text-muted-foreground -mt-2">
            Current contract: <span className="font-semibold text-foreground capitalize">{contract.contract_type}</span> · status: <span className="font-semibold">{contract.status}</span>
          </p>
        )}

        <div className="space-y-5 mt-2">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">New Contract Type</label>
            <div className="space-y-2">
              {CONTRACT_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedType(opt.value)}
                  className={cn(
                    "w-full rounded-xl border px-4 py-3 text-left transition-all flex items-center gap-3",
                    selectedType === opt.value
                      ? `${opt.bg} ${opt.border}`
                      : "bg-secondary border-border hover:border-primary/30"
                  )}
                >
                  <span className="text-lg">{opt.icon}</span>
                  <div className="flex-1">
                    <p className={cn("font-bold text-sm", selectedType === opt.value ? opt.color : "text-foreground")}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{opt.description}</p>
                  </div>
                  {selectedType === opt.value && (
                    <div className={cn("w-2 h-2 rounded-full", opt.color.replace("text-", "bg-"))} />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Note to player <span className="normal-case font-normal">(optional)</span>
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-secondary border-border"
              placeholder="Message about the renewal..."
            />
          </div>

          <Button
            onClick={handleRenew}
            disabled={loading}
            className="w-full bg-primary text-primary-foreground gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            {loading ? "Sending renewal offer..." : "Send Renewal Offer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
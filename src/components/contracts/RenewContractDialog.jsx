import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CONTRACT_TYPE_OPTIONS, CONTRACT_TYPES } from "@/lib/contractTypes";
import { getContractType } from "@/lib/playerContractFields";
import { formatSTC, suggestSigningBonus, suggestWeeklySalary } from "@/lib/playerValue";
import {
  formatPerformanceTarget,
  suggestDefaultPerformanceTargets,
} from "@/lib/contractPerformanceTargets";
import { normalizePerformanceTargets } from "@/lib/founderPlayerTerms";
import { cn } from "@/lib/utils";
import { Coins, RefreshCw, Target } from "lucide-react";

function previewTerms(type, contract, player) {
  const currentType = contract ? getContractType(contract) : null;
  const weekly = currentType === type && Number(contract?.weekly_salary_stc) > 0
    ? Number(contract.weekly_salary_stc)
    : suggestWeeklySalary(type, player);
  const bonus = currentType === type && Number(contract?.signing_bonus_stc) > 0
    ? Number(contract.signing_bonus_stc)
    : suggestSigningBonus(type, weekly);
  return { weekly, bonus };
}

export default function RenewContractDialog({ open, onClose, contract, player, onRenew }) {
  const [selectedType, setSelectedType] = useState("squad");
  const [note, setNote] = useState("");
  const [weeklySalary, setWeeklySalary] = useState("");
  const [signingBonus, setSigningBonus] = useState("");
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(false);

  function applyType(type) {
    const { weekly, bonus } = previewTerms(type, contract, player);
    setSelectedType(type);
    setWeeklySalary(weekly ? String(weekly) : "");
    setSigningBonus(bonus ? String(bonus) : "");
  }

  useEffect(() => {
    if (!open) return;
    const currentType = contract ? getContractType(contract) : "squad";
    const type = CONTRACT_TYPE_OPTIONS.some((opt) => opt.value === currentType) ? currentType : "squad";
    const existing = normalizePerformanceTargets(contract?.performance_targets);
    const typeMeta = CONTRACT_TYPES[type] || CONTRACT_TYPES.squad;
    setTargets(existing.length ? existing : suggestDefaultPerformanceTargets(player, type, typeMeta.max_games));
    setNote("");
    applyType(type);
  }, [open, contract?.id, player?.id]);

  async function handleRenew() {
    setLoading(true);
    try {
      await onRenew({
        contract_type: selectedType,
        offer_note: note,
        weekly_salary_stc: weeklySalary ? parseInt(weeklySalary, 10) : 0,
        signing_bonus_stc: signingBonus ? parseInt(signingBonus, 10) : 0,
        performance_targets: targets,
      });
      setNote("");
      setSelectedType("squad");
      onClose();
    } finally {
      setLoading(false);
    }
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
            Current contract: <span className="font-semibold text-foreground capitalize">{getContractType(contract)}</span> · status: <span className="font-semibold">{contract.status || "pending"}</span>
          </p>
        )}

        <div className="space-y-5 mt-2">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">New Contract Type</label>
            <div className="space-y-2">
              {CONTRACT_TYPE_OPTIONS.map((opt) => {
                const preview = selectedType === opt.value
                  ? {
                      weekly: parseInt(weeklySalary, 10) || 0,
                      bonus: parseInt(signingBonus, 10) || 0,
                    }
                  : previewTerms(opt.value, contract, player);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => applyType(opt.value)}
                    className={cn(
                      "w-full rounded-xl border px-4 py-3 text-left transition-all flex items-center gap-3",
                      selectedType === opt.value
                        ? `${opt.bg} ${opt.border}`
                        : "bg-secondary border-border hover:border-primary/30"
                    )}
                  >
                    <span className="text-lg">{opt.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={cn("font-bold text-sm", selectedType === opt.value ? opt.color : "text-foreground")}>
                        {opt.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{opt.description}</p>
                      <p className="text-[11px] text-foreground/80 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-success font-medium">{formatSTC(preview.weekly)}/wk</span>
                        <span className="text-warning font-medium">+{formatSTC(preview.bonus)} bonus</span>
                      </p>
                      {targets.length > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Target className="w-2.5 h-2.5 shrink-0" />
                          {targets.length} performance target{targets.length === 1 ? "" : "s"}
                        </p>
                      )}
                    </div>
                    {selectedType === opt.value && (
                      <div className={cn("w-2 h-2 rounded-full", opt.color.replace("text-", "bg-"))} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Coins className="w-3 h-3 text-success" /> Weekly salary
              </label>
              <input
                type="number"
                min="0"
                value={weeklySalary}
                onChange={(e) => setWeeklySalary(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-success"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Coins className="w-3 h-3 text-warning" /> Signing bonus
              </label>
              <input
                type="number"
                min="0"
                value={signingBonus}
                onChange={(e) => setSigningBonus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-warning"
              />
            </div>
          </div>

          {targets.length > 0 && (
            <div className="rounded-xl border border-border bg-secondary/50 px-3 py-2.5 space-y-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Target className="w-3 h-3" /> Performance targets
              </p>
              {targets.map((target, index) => (
                <p key={`${target.stat}-${index}`} className="text-xs text-foreground">
                  {formatPerformanceTarget(target)}
                </p>
              ))}
            </div>
          )}

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

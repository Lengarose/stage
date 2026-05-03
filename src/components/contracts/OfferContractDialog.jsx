import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CONTRACT_TYPE_OPTIONS } from "@/lib/contractTypes";
import { cn } from "@/lib/utils";
import { FileText, Coins, Plus, Trash2, Target, ChevronDown, ChevronUp, Lightbulb } from "lucide-react";
import { suggestSalaryRange, formatSTC } from "@/lib/playerValue";
import { getStatOptionsForPosition, groupStatOptions } from "@/lib/contractPerformanceTargets";

const TARGET_TYPES = [
  { value: "min",   label: "Minimum (≥)" },
  { value: "exact", label: "Exact (=)" },
  { value: "range", label: "Range (between)" },
];

export default function OfferContractDialog({ open, onClose, player, existingActiveContract, playerContracts = [], onOffer, windowOpen, isNegotiation, existingContract, club }) {
  const [selectedType, setSelectedType] = useState(existingContract?.contract_type || "squad");
  const [note, setNote] = useState(existingContract?.offer_note || "");
  const [weeklySalary, setWeeklySalary] = useState(existingContract?.weekly_salary_stc?.toString() || "");
  const [signingBonus, setSigningBonus] = useState(existingContract?.signing_bonus_stc?.toString() || "");
  const [captaincy, setCaptaincy] = useState(existingContract?.captaincy_offered || false);
  const [targets, setTargets] = useState(existingContract?.performance_targets || []);
  const [showTargets, setShowTargets] = useState(false);
  const [offering, setOffering] = useState(false);

  const statOptions = getStatOptionsForPosition(player?.position);
  const groupedStats = groupStatOptions(statOptions);

  function addTarget() {
    setTargets(prev => [...prev, { stat: statOptions[0]?.value || "goals", type: "min", value: 0, value_max: 0 }]);
  }

  function updateTarget(idx, field, val) {
    setTargets(prev => prev.map((t, i) => i === idx ? { ...t, [field]: val } : t));
  }

  function removeTarget(idx) {
    setTargets(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleOffer() {
    setOffering(true);
    try {
      await onOffer({
        contract_type: selectedType,
        offer_note: note,
        weekly_salary_stc: weeklySalary ? parseInt(weeklySalary) : 0,
        signing_bonus_stc: signingBonus ? parseInt(signingBonus) : 0,
        transfer_fee_stc: 0,
        captaincy_offered: captaincy,
        performance_targets: targets,
      });
      setNote("");
      setSelectedType("squad");
      setWeeklySalary("");
      setSigningBonus("");
      onClose();
    } finally {
      setOffering(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="w-5 h-5 text-primary" />
            {isNegotiation ? "Counter Offer" : "Offer Contract"}
            {player && <span className="text-muted-foreground font-normal text-base">to {player.gamertag}</span>}
          </DialogTitle>
        </DialogHeader>

        {/* Type-aware conflict warning: only warn when the selected type group is already occupied */}
        {!isNegotiation && (() => {
          const isOwnershipOffer = selectedType === "ownership";
          const conflict = playerContracts.find(c =>
            isOwnershipOffer ? c.contract_type === "ownership" : c.contract_type !== "ownership"
          ) || (existingActiveContract || null);
          return conflict ? (
            <div className="px-4 py-3 rounded-xl bg-warning/10 border border-warning/30 text-sm text-warning">
              This player already has an active <strong>{conflict.contract_type}</strong> contract (<strong>{conflict.status}</strong>).
              {conflict.contract_type === "ownership" && selectedType === "ownership"
                ? " You can still offer a player contract alongside it."
                : conflict.contract_type !== "ownership" && selectedType !== "ownership"
                ? " You can still offer an ownership contract alongside it."
                : " This will create a second contract of the same type."}
            </div>
          ) : null;
        })()}

        {(!existingActiveContract || isNegotiation) && (
          <div className="space-y-5 mt-2">
            {/* Transfer window awareness */}
            <div className={`text-xs px-3 py-2 rounded-lg border flex items-center gap-2 ${windowOpen === false ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : "bg-success/10 border-success/20 text-success"}`}>
              <FileText className="w-3.5 h-3.5 shrink-0" />
              {windowOpen === false
                ? "Transfer window is closed. Offer queued — transfer executes when window opens."
                : windowOpen === true
                ? "Transfer window OPEN. Accepted offers take effect immediately."
                : "Checking transfer window status..."}
            </div>

            {/* Contract type */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">Contract Type</label>
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
                    <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", opt.color.replace("text-", "bg-"))} />
                    <div className="flex-1">
                      <p className={cn("font-bold text-sm", selectedType === opt.value ? opt.color : "text-foreground")}>{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Financials */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block flex items-center gap-1">
                <Coins className="w-3 h-3" /> Financial Terms (STC)
              </label>

              {/* Wage budget warning */}
              {club && club.wage_budget_stc > 0 && (() => {
                const budget = club.wage_budget_stc;
                const salary = parseInt(weeklySalary) || 0;
                const pct = salary > 0 ? Math.round((salary / budget) * 100) : 0;
                const overBudget = salary > budget;
                return salary > 0 ? (
                  <div className={`mb-3 flex items-start gap-2 px-3 py-2.5 rounded-xl border ${overBudget ? "bg-destructive/10 border-destructive/30" : pct > 70 ? "bg-warning/10 border-warning/30" : "bg-success/10 border-success/20"}`}>
                    <Coins className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${overBudget ? "text-destructive" : pct > 70 ? "text-warning" : "text-success"}`} />
                    <div>
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${overBudget ? "text-destructive" : pct > 70 ? "text-warning" : "text-success"}`}>
                        {overBudget ? "⛔ Exceeds Wage Budget" : `Wage Budget Usage: ${pct}%`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Club wage budget: {(budget / 1_000_000).toFixed(1)}M STC/wk
                        {overBudget && " — reduce the salary to proceed"}
                      </p>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Salary suggestion banner */}
              {player && (() => {
                const suggestion = suggestSalaryRange(selectedType, player.overall_rating);
                return (
                  <div className="mb-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-primary/10 border border-primary/20">
                    <Lightbulb className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-primary font-bold uppercase tracking-wider">Suggested Salary Range</p>
                      <p className="text-xs text-foreground font-light mt-0.5">
                        {formatSTC(suggestion.min)} – {formatSTC(suggestion.max)} / week
                        <span className="text-muted-foreground ml-1">({suggestion.label} · OVR {player.overall_rating})</span>
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1 block">
                    <Coins className="w-3 h-3 text-success" /> Weekly Salary
                  </label>
                  <input
                    type="number"
                    value={weeklySalary}
                    onChange={e => setWeeklySalary(e.target.value)}
                    placeholder="e.g. 50000"
                    min="0"
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-success"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Paid monthly</p>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1 block">
                    <Coins className="w-3 h-3 text-warning" /> Signing Bonus
                  </label>
                  <input
                    type="number"
                    value={signingBonus}
                    onChange={e => setSigningBonus(e.target.value)}
                    placeholder="e.g. 5000"
                    min="0"
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-warning"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Paid on signing</p>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Captaincy</label>
                  <button
                    onClick={() => setCaptaincy(!captaincy)}
                    className={cn("w-full px-3 py-2 rounded-lg border text-sm transition-all text-left",
                      captaincy ? "bg-warning/10 border-warning/30 text-warning font-semibold" : "bg-secondary border-border text-muted-foreground"
                    )}
                  >
                    {captaincy ? "✓ Captain role offered" : "No captaincy"}
                  </button>
                </div>
              </div>
            </div>

            {/* Performance targets */}
            <div>
              <button
                onClick={() => setShowTargets(!showTargets)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-secondary border border-border hover:border-primary/30 transition-all text-sm"
              >
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-foreground">Performance Targets</span>
                  {targets.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold">{targets.length}</span>
                  )}
                </div>
                {showTargets ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              {showTargets && (
                <div className="mt-3 space-y-3">
                  {targets.map((target, idx) => (
                    <div key={idx} className="bg-secondary/50 border border-border rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={target.stat}
                          onChange={e => updateTarget(idx, "stat", e.target.value)}
                          className="flex-1 px-2 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none"
                        >
                          {Object.entries(groupedStats).map(([category, options]) => (
                            <optgroup key={category} label={category}>
                              {options.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </optgroup>
                          ))}
                        </select>
                        <select
                          value={target.type}
                          onChange={e => updateTarget(idx, "type", e.target.value)}
                          className="flex-1 px-2 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none"
                        >
                          {TARGET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <button onClick={() => removeTarget(idx)} className="text-destructive hover:text-destructive/80 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={target.value}
                          onChange={e => updateTarget(idx, "value", parseFloat(e.target.value) || 0)}
                          placeholder={target.type === "range" ? "Min" : "Value"}
                          className="flex-1 px-2 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none"
                        />
                        {target.type === "range" && (
                          <>
                            <span className="text-muted-foreground text-xs">–</span>
                            <input
                              type="number"
                              value={target.value_max || ""}
                              onChange={e => updateTarget(idx, "value_max", parseFloat(e.target.value) || 0)}
                              placeholder="Max"
                              className="flex-1 px-2 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none"
                            />
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={addTarget}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-dashed border-primary/30 text-primary text-xs hover:bg-primary/5 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Target
                  </button>
                </div>
              )}
            </div>

            {/* Note */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Message <span className="normal-case font-normal">(optional)</span>
              </label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="bg-secondary border-border"
                placeholder={isNegotiation ? "Explain your counter-offer..." : "Welcome message or contract terms..."}
                rows={3}
              />
            </div>

            <Button
              onClick={handleOffer}
              disabled={offering}
              className="w-full bg-primary text-primary-foreground gap-2"
            >
              <FileText className="w-4 h-4" />
              {offering ? "Sending..." : isNegotiation ? "Send Counter-Offer" : "Send Contract Offer"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CONTRACT_TYPE_OPTIONS } from "@/lib/contractTypes";
import { cn } from "@/lib/utils";
import { FileText, Coins, Plus, Trash2, Target, ChevronDown, ChevronUp, Lightbulb } from "lucide-react";
import { suggestSalaryRange, formatSTC } from "@/lib/playerValue";
import { getStatOptionsForPosition, groupStatOptions } from "@/lib/contractPerformanceTargets";
import { useTranslation } from "@/hooks/useTranslation";
import { findBlockingContractConflict } from "@/lib/contractOfferVisibility";
import { isFounderPlayerContract } from "@/lib/lifecycleOwnedContracts";
import {
  FOUNDER_PLAYER_WEEKLY_SALARY_MAX,
  FOUNDER_PLAYER_WEEKLY_SALARY_MIN,
  founderPlayerWageError,
  normalizePerformanceTargets,
} from "@/lib/founderPlayerTerms";

const TARGET_TYPE_VALUES = ["min", "exact", "range"];

export default function OfferContractDialog({ open, onClose, player, existingActiveContract, playerContracts = [], clubContracts = null, onOffer, windowOpen, isNegotiation, existingContract, club }) {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState(existingContract?.contract_type || "squad");
  const [note, setNote] = useState(existingContract?.offer_note || "");
  const [weeklySalary, setWeeklySalary] = useState(existingContract?.weekly_salary_stc?.toString() || "");
  const [signingBonus, setSigningBonus] = useState(existingContract?.signing_bonus_stc?.toString() || "");
  const [captaincy, setCaptaincy] = useState(existingContract?.captaincy_offered || false);
  const [targets, setTargets] = useState(normalizePerformanceTargets(existingContract?.performance_targets));
  const lockContractType = isNegotiation && isFounderPlayerContract(existingContract);
  const [showTargets, setShowTargets] = useState(false);
  const [offering, setOffering] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // A stale refusal from the previous target would be misleading on the next one.
  useEffect(() => { setSubmitError(null); }, [open, player?.id]);

  const statOptions = getStatOptionsForPosition(player?.position);
  const groupedStats = groupStatOptions(statOptions);
  const offerLockedByWindow = !isNegotiation && windowOpen !== true;
  const blockingConflict = !isNegotiation
    ? findBlockingContractConflict({ selectedType, playerContracts, existingActiveContract })
    : null;
  const weeklySalaryNumber = parseInt(weeklySalary, 10) || 0;
  const wageCap = Number(club?.wage_budget_stc || 0);
  // The wage cap is a CLUB total, so it has to be summed over the club's whole
  // contract book. `playerContracts` is scoped to the one player being offered to
  // (it drives the conflict check), so using it here under-counts and the preview
  // says there's room when the server knows there isn't. Callers that have the
  // club's contracts pass them; the rest fall back to the old, narrower behaviour.
  const wageSourceContracts = clubContracts || playerContracts || [];
  const committedWeeklyWages = wageSourceContracts.reduce((sum, contract) => {
    if (existingContract?.id && contract.id === existingContract.id) return sum;
    const status = String(contract.status || "").toLowerCase();
    const type = String(contract.contract_type || "").toLowerCase();
    const belongsToClub = !club?.id || contract.club_id === club.id || contract.team_id === club.id;
    if (!belongsToClub || type === "ownership") return sum;
    if (!["active", "pending", "pending_window", "negotiating"].includes(status)) return sum;
    return sum + Number(contract.weekly_salary_stc || 0);
  }, 0);
  const projectedWeeklyWages = committedWeeklyWages + (selectedType === "ownership" ? 0 : weeklySalaryNumber);
  const wageCapExceeded = wageCap > 0 && projectedWeeklyWages > wageCap;

  const TARGET_TYPES = [
    { value: "min",   label: t("commonPages.cccTargetMin") },
    { value: "exact", label: t("commonPages.cccTargetExact") },
    { value: "range", label: t("commonPages.cccTargetRange") },
  ];

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
    if (offerLockedByWindow) return;
    if (blockingConflict && !isNegotiation) return;
    if (lockContractType || isFounderPlayerContract({ contract_type: selectedType })) {
      const wageError = founderPlayerWageError(weeklySalaryNumber);
      if (wageError) {
        setSubmitError(wageError);
        return;
      }
    }
    setOffering(true);
    setSubmitError(null);
    try {
      await onOffer({
        contract_type: lockContractType ? (existingContract?.contract_type || selectedType) : selectedType,
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
    } catch (err) {
      // The server enforces rules this dialog can only guess at — wage cap,
      // transfer window, an existing live contract. Without this catch the
      // rejection was swallowed: the dialog stayed open, nothing was shown, and
      // the button simply re-enabled, which reads as "the button is broken".
      setSubmitError(err?.message || t("commonPages.ocdOfferFailed"));
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
            {lockContractType ? t("commonPages.ocdRenegotiateFounder") : isNegotiation ? t("commonPages.ocdCounterOffer") : t("commonPages.offerContract")}
            {player && <span className="text-muted-foreground font-normal text-base">{t("commonPages.ocdTo", { name: player?.gamertag })}</span>}
          </DialogTitle>
        </DialogHeader>

        {/* Type-aware conflict warning: only warn when the selected type group is already occupied */}
        {!isNegotiation && (() => {
          const conflict = blockingConflict;
          const conflictType = typeof conflict === "object" ? conflict?.contract_type : selectedType;
          const conflictStatus = typeof conflict === "object" ? conflict?.status : "live";
          return conflict ? (
            <div className="px-4 py-3 rounded-xl bg-warning/10 border border-warning/30 text-sm text-warning">
              {t("commonPages.ocdActiveContract", { type: conflictType, status: conflictStatus })}
              {conflictType === "ownership" && selectedType === "ownership"
                ? ` ${t("commonPages.ocdStillOfferPlayer")}`
                : conflictType !== "ownership" && selectedType !== "ownership"
                ? ` ${t("commonPages.ocdStillOfferOwnership")}`
                : ` ${t("commonPages.ocdSecondContract")}`}
            </div>
          ) : null;
        })()}

        {(!blockingConflict || isNegotiation) && (
          <div className="space-y-5 mt-2">
            {/* Transfer window awareness */}
            {!lockContractType && <div className={`text-xs px-3 py-2 rounded-lg border flex items-center gap-2 ${windowOpen === false ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : "bg-success/10 border-success/20 text-success"}`}>
              <FileText className="w-3.5 h-3.5 shrink-0" />
              {windowOpen === false
                ? t("commonPages.ocdWindowClosed")
                : windowOpen === true
                ? t("commonPages.ocdWindowOpen")
                : t("commonPages.ocdWindowChecking")}
            </div>}

            {/* Contract type */}
            {!lockContractType && <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">{t("commonPages.ocdContractType")}</label>
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
            </div>}

            {/* Financials */}
            {selectedType !== "ownership" && <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block flex items-center gap-1">
                <Coins className="w-3 h-3" /> {t("commonPages.ocdFinancialTerms")}
              </label>

              {/* Wage budget warning */}
              {club && wageCap > 0 && (() => {
                const pct = wageCap > 0 ? Math.round((projectedWeeklyWages / wageCap) * 100) : 0;
                return weeklySalaryNumber > 0 ? (
                  <div className={`mb-3 flex items-start gap-2 px-3 py-2.5 rounded-xl border ${wageCapExceeded ? "bg-destructive/10 border-destructive/30" : pct > 70 ? "bg-warning/10 border-warning/30" : "bg-success/10 border-success/20"}`}>
                    <Coins className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${wageCapExceeded ? "text-destructive" : pct > 70 ? "text-warning" : "text-success"}`} />
                    <div>
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${wageCapExceeded ? "text-destructive" : pct > 70 ? "text-warning" : "text-success"}`}>
                        {wageCapExceeded ? "Wage cap exceeded" : t("commonPages.cccWageUsage", { pct })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Current wages: {formatSTC(committedWeeklyWages)} / {formatSTC(wageCap)} per week.
                        {" "}This offer raises it to {formatSTC(projectedWeeklyWages)}.
                        {wageCapExceeded && " Upgrade stadium or reduce wages."}
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
                      <p className="text-[10px] text-primary font-bold uppercase tracking-wider">{t("commonPages.cccSuggestedSalary")}</p>
                      <p className="text-xs text-foreground font-light mt-0.5">
                        {formatSTC(suggestion.min)} – {formatSTC(suggestion.max)} {t("commonPages.cccPerWeek")}
                        <span className="text-muted-foreground ml-1">({suggestion.label} · {t("commonPages.cccBasedOnOvr", { ovr: player.overall_rating })})</span>
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1 block">
                    <Coins className="w-3 h-3 text-success" /> {t("commonPages.cccWeeklySalary")}
                  </label>
                  <input
                    type="number"
                    value={weeklySalary}
                    onChange={e => setWeeklySalary(e.target.value)}
                    placeholder={lockContractType ? "e.g. 40000" : "e.g. 50000"}
                    min={lockContractType ? FOUNDER_PLAYER_WEEKLY_SALARY_MIN : 0}
                    max={lockContractType ? FOUNDER_PLAYER_WEEKLY_SALARY_MAX : undefined}
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-success"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">{t("commonPages.cccPaidMonthly")}</p>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1 block">
                    <Coins className="w-3 h-3 text-warning" /> {t("commonPages.cccSigningBonus")}
                  </label>
                  <input
                    type="number"
                    value={signingBonus}
                    onChange={e => setSigningBonus(e.target.value)}
                    placeholder="e.g. 5000"
                    min="0"
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-warning"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">{t("commonPages.cccPaidOnSigning")}</p>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">{t("commonPages.cccCaptaincy")}</label>
                  <button
                    type="button"
                    onClick={() => setCaptaincy(!captaincy)}
                    className={cn("w-full px-3 py-2 rounded-lg border text-sm transition-all text-left",
                      captaincy ? "bg-warning/10 border-warning/30 text-warning font-semibold" : "bg-secondary border-border text-muted-foreground"
                    )}
                  >
                    {captaincy ? t("commonPages.cccCaptainOffered") : t("commonPages.cccNoCaptaincy")}
                  </button>
                </div>
              </div>
            </div>}

            {/* Performance targets */}
            {selectedType !== "ownership" && <div>
              <button
                type="button"
                onClick={() => setShowTargets(!showTargets)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-secondary border border-border hover:border-primary/30 transition-all text-sm"
              >
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-foreground">{t("commonPages.ocdPerformanceTargets")}</span>
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
                          {TARGET_TYPES.map(tt => <option key={tt.value} value={tt.value}>{tt.label}</option>)}
                        </select>
                        <button type="button" onClick={() => removeTarget(idx)} className="text-destructive hover:text-destructive/80 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={target.value}
                          onChange={e => updateTarget(idx, "value", parseFloat(e.target.value) || 0)}
                          placeholder={target.type === "range" ? t("commonPages.cccMin") : t("commonPages.cccValue")}
                          className="flex-1 px-2 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none"
                        />
                        {target.type === "range" && (
                          <>
                            <span className="text-muted-foreground text-xs">–</span>
                            <input
                              type="number"
                              value={target.value_max || ""}
                              onChange={e => updateTarget(idx, "value_max", parseFloat(e.target.value) || 0)}
                              placeholder={t("commonPages.cccMax")}
                              className="flex-1 px-2 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none"
                            />
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addTarget}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-dashed border-primary/30 text-primary text-xs hover:bg-primary/5 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> {t("commonPages.cccAddTarget")}
                  </button>
                </div>
              )}
            </div>}

            {/* Note */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
                {t("commonPages.ocdMessage")} <span className="normal-case font-normal">({t("commonPages.agdOptional")})</span>
              </label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="bg-secondary border-border"
                placeholder={isNegotiation ? t("commonPages.ocdCounterPlaceholder") : t("commonPages.cccNotePlaceholder")}
                rows={3}
              />
            </div>

            {submitError && (
              <div className="px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                {submitError}
              </div>
            )}

            <Button
              onClick={handleOffer}
              disabled={offering || offerLockedByWindow || wageCapExceeded}
              className="w-full bg-primary text-primary-foreground gap-2"
            >
              <FileText className="w-4 h-4" />
              {offering ? t("commonPages.ocdSending") : isNegotiation ? t("commonPages.ocdSendCounter") : t("commonPages.ocdSendOffer")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

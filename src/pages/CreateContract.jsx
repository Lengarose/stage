import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { resolveMyPlayerAndClub, stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, FileText, Loader2, Send, ShieldAlert,
  Coins, Target, ChevronDown, ChevronUp, Plus, Trash2, Lightbulb
} from "lucide-react";
import PlayerSelectList from "@/components/contracts/PlayerSelectList";
import ContractTypeCards from "@/components/contracts/ContractTypeCards";
import ContractSummary from "@/components/contracts/ContractSummary";
import { CONTRACT_TYPES } from "@/lib/contractTypes";
import { postContractNews } from "@/lib/notify";
import { suggestSalaryRange, formatSTC } from "@/lib/playerValue";
import { getStatOptionsForPosition, groupStatOptions } from "@/lib/contractPerformanceTargets";
import { cn } from "@/lib/utils";
import { ensureContractOfferInbox } from "@/lib/contractOfferDelivery";
import { getContractTargetPlayerId, getContractType, normalizePlayerContracts } from "@/lib/playerContractFields";
import { canManageClubIdentity } from "@/lib/clubPresidentAccess";
import { canCreateContractOffer } from "@/lib/transferWindowAccess";
import { useTransferWindowStatus } from "@/lib/useTransferWindowStatus";
import { useTranslation } from "@/hooks/useTranslation";

export default function CreateContract() {
  const { t } = useTranslation();
  const { windowOpen, loading: windowStatusLoading } = useTransferWindowStatus();
  const navigate = useNavigate();
  const TARGET_TYPES = [
    { value: "min",   label: t("commonPages.cccTargetMin") },
    { value: "exact", label: t("commonPages.cccTargetExact") },
    { value: "range", label: t("commonPages.cccTargetRange") },
  ];
  const urlParams = new URLSearchParams(window.location.search);
  const clubId = urlParams.get("club");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [club, setClub] = useState(null);
  const [players, setPlayers] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [myPlayer, setMyPlayer] = useState(null);
  const [isPresident, setIsPresident] = useState(false);

  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedType, setSelectedType] = useState("squad");
  const [note, setNote] = useState("");
  const [sendError, setSendError] = useState(null);

  // Financial fields
  const [weeklySalary, setWeeklySalary] = useState("");
  const [signingBonus, setSigningBonus] = useState("");
  const [captaincy, setCaptaincy] = useState(false);
  const [targets, setTargets] = useState([]);
  const [showTargets, setShowTargets] = useState(false);

  useEffect(() => {
    if (!clubId) return;
    loadData();
  }, [clubId]);

  async function loadData() {
    setLoading(true);
    const [user, clubArr, identity] = await Promise.all([
      stageClient.auth.me(),
      stageClient.entities.Club.filter({ id: clubId }),
      resolveMyPlayerAndClub(),
    ]);
    const clubData = clubArr[0];
    if (!clubData) { setLoading(false); return; }
    setClub(clubData);

    const [playerArr, contractArr] = await Promise.all([
      stageClient.entities.Player.filter({ club_id: clubId }),
      stageClient.entities.PlayerContract.filter({ team_id: clubId }),
    ]);
    setPlayers(playerArr);
    setContracts(normalizePlayerContracts(contractArr));

    const me = identity.player || playerArr.find(p => p.email === user.email);
    setMyPlayer(me);
    const pres = canManageClubIdentity({
      user,
      club: clubData,
      presidentClub: identity.presidentClub,
      activeRoles: identity.activeRoles || [],
    }) || (me && me.club_roles?.includes("president"));
    setIsPresident(pres);
    setLoading(false);
  }

  function addTarget() {
    const statOptions = getStatOptionsForPosition(selectedPlayer?.position);
    setTargets(prev => [...prev, { stat: statOptions[0]?.value || "goals", type: "min", value: 0, value_max: 0 }]);
  }

  function updateTarget(idx, field, val) {
    setTargets(prev => prev.map((t, i) => i === idx ? { ...t, [field]: val } : t));
  }

  function removeTarget(idx) {
    setTargets(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSend() {
    if (!selectedPlayer || !selectedType) return;
    if (!canCreateContractOffer(windowOpen)) return;
    setSending(true);
    setSendError(null);
    try {
      let recipientEmail = selectedPlayer.email;
      if (!recipientEmail) {
        try {
          const fresh = await stageClient.entities.Player.get(selectedPlayer.id);
          recipientEmail = fresh?.email || null;
        } catch (_) { /* non-fatal */ }
      }

      const typeMeta = CONTRACT_TYPES[selectedType];
      const salary  = weeklySalary  ? parseInt(weeklySalary)  : 0;
      const bonus   = signingBonus  ? parseInt(signingBonus)  : 0;

      const result = await stageClient.functions.invoke("contractManagement", {
        action: "offer",
        team_id: clubId,
        target_player_id: selectedPlayer.id,
        contract_type: selectedType,
        offer_note: note || "",
        max_games: typeMeta.max_games,
        max_days: typeMeta.max_days,
        weekly_salary_stc:   salary,
        signing_bonus_stc:   bonus,
        transfer_fee_stc:    0,
        performance_targets: targets,
        captaincy_offered:   captaincy,
      });
      const newContract = result?.data?.contract;

      if (newContract?.id) {
        await ensureContractOfferInbox({
          contractId: newContract.id,
          player: { ...selectedPlayer, email: recipientEmail || selectedPlayer.email },
          club,
          contractType: selectedType,
          maxGames: typeMeta.max_games,
          maxDays: typeMeta.max_days,
          weeklySalary: salary,
          signingBonus: bonus,
          offerNote: note,
          senderEmail: club?.owner_email,
        }).catch((err) => console.warn("[CreateContract] inbox fallback failed:", err?.message || err));
      }

      postContractNews({
        title: `📄 ${club.name} offered a contract to ${selectedPlayer.gamertag}`,
        body: `${club.name} has sent a ${selectedType} contract offer to ${selectedPlayer.gamertag}.`,
        club_name: club.name, club_logo_url: club.logo_url || "",
        player_name: selectedPlayer.gamertag, player_avatar_url: selectedPlayer.avatar_url || "",
        link: `/clubs/${clubId}`,
      });

      navigate(`/clubs/${clubId}`);
    } catch (err) {
      setSendError(t("commonPages.cccSendFailed", { error: err?.message || "unknown error" }));
    } finally {
      setSending(false);
    }
  }

  const LIVE_STATUSES = ["active", "pending", "pending_window", "negotiating"];
  const isOwnershipOffer = selectedType === "ownership";
  const conflictContract = selectedPlayer
    ? contracts.find(c =>
        getContractTargetPlayerId(c) === selectedPlayer.id &&
        LIVE_STATUSES.includes(c.status) &&
        (isOwnershipOffer ? getContractType(c) === "ownership" : getContractType(c) !== "ownership")
      )
    : null;
  const playerHasConflict = !!conflictContract;

  // Derived for the financial section
  const statOptions = selectedPlayer ? getStatOptionsForPosition(selectedPlayer.position) : [];
  const groupedStats = groupStatOptions(statOptions);
  const salarySuggestion = selectedPlayer ? suggestSalaryRange(selectedType, selectedPlayer.overall_rating, selectedPlayer.market_value_stc || 0) : null;
  const salaryNum = parseInt(weeklySalary) || 0;
  const wagePct = club?.wage_budget_stc > 0 && salaryNum > 0 ? Math.round((salaryNum / club.wage_budget_stc) * 100) : 0;
  const overBudget = club?.wage_budget_stc > 0 && salaryNum > club.wage_budget_stc;

  const canProceed = canCreateContractOffer(windowOpen) && selectedPlayer && !playerHasConflict && selectedType;

  if (loading || windowStatusLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!club) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <p className="text-muted-foreground">{t("commonPages.cdClubNotFound")}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>{t("commonPages.cccGoBack")}</Button>
      </div>
    );
  }

  if (!isPresident) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <ShieldAlert className="w-10 h-10 text-destructive mx-auto mb-3" />
          <h2 className="font-heading text-xl uppercase text-foreground">{t("commonPages.cccAccessRestricted")}</h2>
          <p className="text-sm text-muted-foreground mt-2">{t("commonPages.cccPresidentOnly")}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>{t("commonPages.cccGoBack")}</Button>
        </div>
      </div>
    );
  }

  if (!canCreateContractOffer(windowOpen)) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <ShieldAlert className="w-10 h-10 text-warning mx-auto mb-3" />
          <h2 className="font-heading text-xl uppercase text-foreground">Transfer window closed</h2>
          <p className="text-sm text-muted-foreground mt-2">New contract offers can only be sent while the transfer window is open.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>{t("commonPages.cccGoBack")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-2xl sm:text-3xl uppercase tracking-wide text-foreground">
            {t("commonPages.cccTitle")}
          </h1>
          <p className="text-sm text-muted-foreground truncate">{club.name}</p>
        </div>
        <FileText className="w-6 h-6 text-primary shrink-0" />
      </div>

      {/* Step 1: Player Selection */}
      <section className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3">
          {t("commonPages.cccStep1")}
        </h3>
        <PlayerSelectList
          players={players}
          contracts={contracts}
          selectedId={selectedPlayer?.id}
          onSelect={(p) => {
            setSelectedPlayer(p);
            setTargets([]);
          }}
        />
      </section>

      {/* Conflict Warning */}
      {playerHasConflict && conflictContract && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-warning">
                {t("commonPages.cccAlreadyHasContract", {
                  name: selectedPlayer.gamertag,
                  type: conflictContract.contract_type,
                  status: conflictContract.status,
                })}
              </p>
              <p className="text-xs text-warning/80 mt-1">
                {conflictContract.start_date && `${t("commonPages.cccStarted", { date: new Date(conflictContract.start_date).toLocaleDateString() })} · `}
                {t("commonPages.cccOneActivePerType")}
              </p>
              <p className="text-xs text-warning/80 mt-0.5">
                {isOwnershipOffer
                  ? t("commonPages.cccStillOfferPlayer")
                  : t("commonPages.cccStillOfferOwnership")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Contract Type */}
      {canProceed && (
        <section className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3">
            {t("commonPages.cccStep2")}
          </h3>
          <ContractTypeCards selectedType={selectedType} onSelect={setSelectedType} />
        </section>
      )}

      {/* Step 3: Financial Terms */}
      {canProceed && (
        <section className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
            <Coins className="w-3.5 h-3.5" /> {t("commonPages.cccStep3")}
          </h3>

          {/* Wage budget warning */}
          {club.wage_budget_stc > 0 && salaryNum > 0 && (
            <div className={cn("flex items-start gap-2 px-3 py-2.5 rounded-xl border", overBudget ? "bg-destructive/10 border-destructive/30" : wagePct > 70 ? "bg-warning/10 border-warning/30" : "bg-success/10 border-success/20")}>
              <Coins className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", overBudget ? "text-destructive" : wagePct > 70 ? "text-warning" : "text-success")} />
              <div>
                <p className={cn("text-[10px] font-bold uppercase tracking-wider", overBudget ? "text-destructive" : wagePct > 70 ? "text-warning" : "text-success")}>
                  {overBudget ? t("commonPages.cccExceedsWage") : t("commonPages.cccWageUsage", { pct: wagePct })}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("commonPages.cccClubWageBudget", { amount: (club.wage_budget_stc / 1_000_000).toFixed(1) })}
                  {overBudget && t("commonPages.cccReduceSalary")}
                </p>
              </div>
            </div>
          )}

          {/* Salary suggestion */}
          {salarySuggestion && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-primary/10 border border-primary/20">
              <Lightbulb className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] text-primary font-bold uppercase tracking-wider">{t("commonPages.cccSuggestedSalary")}</p>
                <p className="text-xs text-foreground font-light mt-0.5">
                  {formatSTC(salarySuggestion.min)} – {formatSTC(salarySuggestion.max)} {t("commonPages.cccPerWeek")}
                  <span className="text-muted-foreground ml-1">
                    ({salarySuggestion.label}
                    {salarySuggestion.based_on_value
                      ? ` ${t("commonPages.cccBasedOnValue", { value: formatSTC(selectedPlayer.market_value_stc) })}`
                      : ` ${t("commonPages.cccBasedOnOvr", { ovr: selectedPlayer.overall_rating })}`})
                  </span>
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1 block">
                <Coins className="w-3 h-3 text-success" /> {t("commonPages.cccWeeklySalary")}
              </label>
              <input
                type="number" value={weeklySalary} onChange={e => setWeeklySalary(e.target.value)}
                placeholder="e.g. 50000" min="0"
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-success"
              />
              <p className="text-[10px] text-muted-foreground mt-1">{t("commonPages.cccPaidMonthly")}</p>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1 block">
                <Coins className="w-3 h-3 text-warning" /> {t("commonPages.cccSigningBonus")}
              </label>
              <input
                type="number" value={signingBonus} onChange={e => setSigningBonus(e.target.value)}
                placeholder="e.g. 5000" min="0"
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-warning"
              />
              <p className="text-[10px] text-muted-foreground mt-1">{t("commonPages.cccPaidOnSigning")}</p>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">{t("commonPages.cccCaptaincy")}</label>
              <button
                onClick={() => setCaptaincy(!captaincy)}
                className={cn("w-full px-3 py-2 rounded-lg border text-sm transition-all text-left",
                  captaincy ? "bg-warning/10 border-warning/30 text-warning font-semibold" : "bg-secondary border-border text-muted-foreground"
                )}
              >
                {captaincy ? t("commonPages.cccCaptainOffered") : t("commonPages.cccNoCaptaincy")}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Step 4: Performance Targets */}
      {canProceed && (
        <section className="bg-card border border-border rounded-xl p-5">
          <button
            onClick={() => setShowTargets(!showTargets)}
            className="w-full flex items-center justify-between text-left"
          >
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
              <Target className="w-3.5 h-3.5" /> {t("commonPages.cccStep4")}
              {targets.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold">{targets.length}</span>
              )}
            </h3>
            {showTargets ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {showTargets && (
            <div className="mt-4 space-y-3">
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
                      {TARGET_TYPES.map((tt) => <option key={tt.value} value={tt.value}>{tt.label}</option>)}
                    </select>
                    <button onClick={() => removeTarget(idx)} className="text-destructive hover:text-destructive/80 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" value={target.value}
                      onChange={e => updateTarget(idx, "value", parseFloat(e.target.value) || 0)}
                      placeholder={target.type === "range" ? t("commonPages.cccMin") : t("commonPages.cccValue")}
                      className="flex-1 px-2 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none"
                    />
                    {target.type === "range" && (
                      <>
                        <span className="text-muted-foreground text-xs">–</span>
                        <input
                          type="number" value={target.value_max || ""}
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
                onClick={addTarget}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-dashed border-primary/30 text-primary text-xs hover:bg-primary/5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> {t("commonPages.cccAddTarget")}
              </button>
            </div>
          )}
        </section>
      )}

      {/* Step 5: Review */}
      {canProceed && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3">
            {t("commonPages.cccStep5")}
          </h3>
          <ContractSummary player={selectedPlayer} contractType={selectedType} />
        </section>
      )}

      {/* Step 6: Note */}
      {canProceed && (
        <section className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3">
            {t("commonPages.cccStep6")}
          </h3>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="bg-secondary border-border"
            placeholder={t("commonPages.cccNotePlaceholder")}
            rows={3}
          />
        </section>
      )}

      {sendError && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-sm text-destructive flex items-center justify-between gap-3">
          <span>{sendError}</span>
          <button onClick={() => setSendError(null)} className="text-destructive/60 hover:text-destructive text-xs font-bold">✕</button>
        </div>
      )}

      {/* Actions */}
      {canProceed && (
        <div className="flex items-center gap-3 pt-2">
          <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => navigate(-1)}>
            {t("commonPages.cancel")}
          </Button>
          <Button
            className="flex-1 sm:flex-none bg-primary text-primary-foreground gap-2"
            onClick={handleSend}
            disabled={sending}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? t("commonPages.cdSending") : t("commonPages.sendContractOffer")}
          </Button>
        </div>
      )}
    </div>
  );
}

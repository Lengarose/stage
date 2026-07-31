/**
 * InboxContractOffer — renders inside InboxMessageDetail when message_type === "contract_offer".
 * Allows the player (or club owner) to Accept, Decline, or Counter the contract directly from Inbox.
 */
import { useState, useEffect } from "react";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CheckCircle, X, MessageSquare, Target, Clock, ChevronDown, ChevronUp,
  Loader2, Gamepad2, Plus, Trash2
} from "lucide-react";
import { notify, postContractNews } from "@/lib/notify";
import { formatSTC } from "@/lib/playerValue";
import { PERFORMANCE_STAT_OPTIONS } from "@/lib/contractPerformanceTargets";
import { isTransferWindowOpen } from "@/lib/transferWindow";
import { useTranslation } from "@/hooks/useTranslation";
import { withTranslationFallback } from "@/lib/translationFallback";
import { getContractTargetPlayerId } from "@/lib/playerContractFields";

const TARGET_TYPE_VALUES = ["min", "exact", "range"];

export default function InboxContractOffer({ message, onActioned }) {
  const { t } = useTranslation();
  const tx = withTranslationFallback(t);
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);
  const [myClub, setMyClub] = useState(null);
  const [showCounter, setShowCounter] = useState(false);
  const [counterNote, setCounterNote] = useState("");
  const [counterSalary, setCounterSalary] = useState("");
  const [counterBonus, setCounterBonus] = useState("");
  const [counterFee, setCounterFee] = useState("");
  const [counterTargets, setCounterTargets] = useState([]);
  const [showTargets, setShowTargets] = useState(false);
  const [error, setError] = useState(null);
  const [windowOpen, setWindowOpen] = useState(null); // null=loading, true/false
  const [clubOwnerEmail, setClubOwnerEmail] = useState(null);
  const [clubName, setClubName] = useState(null);
  const [clubLogoUrl, setClubLogoUrl] = useState(null);
  const [myEmail, setMyEmail] = useState(null);

  const contractId = message?.metadata?.contract_id || message?.related_entity_id;

  useEffect(() => {
    if (!contractId) { setLoading(false); return; }
    async function load() {
      const [{ user, player }, c] = await Promise.all([
        resolveMyPlayerAndClub(),
        stageClient.entities.PlayerContract.get(contractId).catch(() => null),
      ]);
      setMyEmail(user?.email);
      setContract(c);
      setMyPlayer(player);

      if (c?.team_id) {
        const clubArr = await stageClient.entities.Club.filter({ id: c.team_id });
        const club = clubArr[0] || null;
        if (player?.club_id && player.club_id === c.team_id) setMyClub(club);
        setClubName(club?.name || message?.metadata?.club_name || null);
        setClubLogoUrl(club?.logo_url || null);
        let ownerEmail = club?.owner_email || null;
        if (!ownerEmail) {
          const contact = await stageClient.functions.invoke("resolveClubContact", { club_id: c.team_id }).catch(() => null);
          ownerEmail = contact?.data?.recipient_email || null;
        }
        setClubOwnerEmail(ownerEmail);
      }

      if (c) {
        setCounterSalary(c.weekly_salary_stc?.toString() || "");
        setCounterBonus(c.signing_bonus_stc?.toString() || "");
        setCounterFee(c.transfer_fee_stc?.toString() || "");
        setCounterTargets(c.performance_targets || []);
      }

      // Check transfer window status
      try {
        const winRes = await stageClient.functions.invoke("transferWindowActions", { action: "get_current" });
        setWindowOpen(isTransferWindowOpen(winRes?.data?.window));
      } catch {
        setWindowOpen(false); // default to closed if can't check
      }

      setLoading(false);
    }
    load();
  }, [contractId]);

  const TARGET_TYPES = [
    { value: "min",   label: t("commonPages.cccTargetMin") },
    { value: "exact", label: t("commonPages.cccTargetExact") },
    { value: "range", label: t("commonPages.cccTargetRange") },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!contract || !contractId) {
    return (
      <div className="mt-4 px-4 py-3 rounded-xl bg-muted/30 border border-border text-sm text-muted-foreground">
        {tx("commonPages.icoContractUnavailable", "Contract data unavailable or already resolved.")}
      </div>
    );
  }

  // Determine my role.
  // isPlayer: direct ID match OR this inbox message was delivered to me (I am the recipient).
  const isPlayer = myPlayer != null && (
    myPlayer.id === getContractTargetPlayerId(contract) ||
    (myEmail && myEmail === message?.recipient_email)
  );
  const isClubOwner = myClub?.id === contract.team_id;
  const isActionable = ["pending", "negotiating"].includes(contract.status);
  // Player can act when: pending (always), or negotiating where last move was by club
  const playerCanAct = isPlayer && isActionable && (
    contract.status === "pending" || contract.last_negotiated_by !== myPlayer?.id
  );
  // Club owner/manager can act when contract is actionable and last move was NOT by club
  // (allows owner to counter their own initial offer, or respond to player counter)
  const clubCanAct = isClubOwner && isActionable &&
    contract.last_negotiated_by !== myClub?.id;

  const canAct = playerCanAct || clubCanAct;

  async function doAction(action) {
    setActionLoading(action);
    setError(null);
    try {
      if (action === "accept") {
        // Renewal = player already belongs to this club; transfers need an open window
        const isRenewal = myPlayer?.club_id && myPlayer.club_id === contract.team_id;
        if (!isRenewal && !windowOpen) {
          const result = await stageClient.functions.invoke("contractManagement", {
            action: "mark_pending_window",
            contract_id: contractId,
          });
          setContract(prev => ({ ...prev, ...(result?.data?.contract || {}), status: "pending_window" }));
          await stageClient.entities.InboxMessage.update(message.id, { status: "accepted", is_read: true });
          onActioned?.("accept");
          return;
        }
        const result = await stageClient.functions.invoke("contractManagement", {
          action: "accept",
          contract_id: contractId,
        });
        const { start_date, end_date } = result?.data || {};
        setContract(prev => ({ ...prev, status: "active", start_date, end_date }));

        notify(clubOwnerEmail, "contract_accepted",
          `✅ Contract Accepted`,
          `${myPlayer?.gamertag || "A player"} has accepted the ${contract.contract_type} contract offer.`,
          `/clubs/${contract.team_id}`
        );
        postContractNews({
          title: `✅ ${myPlayer?.gamertag || "A player"} joined ${clubName || "a club"}`,
          body: `${myPlayer?.gamertag || "A player"} has accepted a ${contract.contract_type} contract.`,
          club_name: clubName || "", club_logo_url: clubLogoUrl || "",
          player_name: myPlayer?.gamertag || "", player_avatar_url: myPlayer?.avatar_url || "",
          link: `/clubs/${contract.team_id}`,
        });
      } else {
        const result = await stageClient.functions.invoke("contractManagement", {
          action: "reject",
          contract_id: contractId,
        });
        setContract(prev => ({ ...prev, ...(result?.data?.contract || {}), status: "rejected" }));
        notify(clubOwnerEmail, "contract_rejected",
          `❌ Contract Declined`,
          `${myPlayer?.gamertag || "A player"} has declined your ${contract.contract_type} contract offer.`,
          `/clubs/${contract.team_id}`
        );
        postContractNews({
          title: `❌ ${myPlayer?.gamertag || "A player"} rejected contract from ${clubName || "a club"}`,
          body: `${myPlayer?.gamertag || "A player"} has rejected the ${contract.contract_type} contract offer.`,
          club_name: clubName || "", club_logo_url: clubLogoUrl || "",
          player_name: myPlayer?.gamertag || "", player_avatar_url: myPlayer?.avatar_url || "",
          link: `/clubs/${contract.team_id}`,
        });
      }
      await stageClient.entities.InboxMessage.update(message.id, {
        status: action === "accept" ? "accepted" : "declined",
        is_read: true,
      });
      onActioned?.(action);
    } catch (e) {
      setError(e.message || "Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function doCounter() {
    setActionLoading("counter");
    setError(null);
    try {
      const updatedFields = {
        status: "negotiating",
        negotiation_round: (contract.negotiation_round || 0) + 1,
        last_negotiated_by: myPlayer?.id || "",
        offer_note: counterNote || contract.offer_note,
      };
      if (counterSalary) updatedFields.weekly_salary_stc = parseInt(counterSalary);
      if (counterBonus)  updatedFields.signing_bonus_stc  = parseInt(counterBonus);
      if (counterFee)    updatedFields.transfer_fee_stc   = parseInt(counterFee);
      if (counterTargets.length > 0) updatedFields.performance_targets = counterTargets;

      const result = await stageClient.functions.invoke("contractManagement", {
        action: "counter",
        contract_id: contractId,
        ...updatedFields,
        last_negotiated_by: myPlayer?.id || "",
      });
      setContract(prev => ({ ...prev, ...(result?.data?.contract || updatedFields) }));
      setShowCounter(false);
      setCounterNote("");
      notify(clubOwnerEmail, "contract_offer",
        `🔄 Counter-Offer from ${myPlayer?.gamertag || "Player"}`,
        `${myPlayer?.gamertag || "A player"} has sent a counter-offer on your contract. Round ${updatedFields.negotiation_round}.`,
        `/clubs/${contract.team_id}`
      );
      postContractNews({
        title: `🔄 ${myPlayer?.gamertag || "A player"} sent counter-offer to ${clubName || "a club"}`,
        body: `${myPlayer?.gamertag || "A player"} has sent a counter-offer (Round ${updatedFields.negotiation_round}).`,
        club_name: clubName || "", club_logo_url: clubLogoUrl || "",
        player_name: myPlayer?.gamertag || "", player_avatar_url: myPlayer?.avatar_url || "",
        link: `/clubs/${contract.team_id}`,
      });
      onActioned?.("negotiating");
    } catch (e) {
      setError(e.message || "Counter-offer failed");
    } finally {
      setActionLoading(null);
    }
  }

  function addTarget() {
    setCounterTargets(prev => [...prev, { stat: "goals", type: "min", value: 0 }]);
  }
  function updateTarget(idx, field, val) {
    setCounterTargets(prev => prev.map((t, i) => i === idx ? { ...t, [field]: val } : t));
  }
  function removeTarget(idx) {
    setCounterTargets(prev => prev.filter((_, i) => i !== idx));
  }

  const statusLabel = {
    pending: tx("commonPages.icoAwaitingResponse", "Awaiting your response"),
    negotiating: tx("commonPages.icoNegotiatingRound", "Negotiating - Round {round}", { round: contract.negotiation_round || 1 }),
    active: tx("commonPages.icoContractActive", "Contract Active"),
    rejected: tx("commonPages.icoDeclined", "Declined"),
    pending_window: tx("commonPages.icoAcceptedPendingWindow", "Accepted - awaiting transfer window"),
  }[contract.status] || contract.status;

  return (
    <div className="mt-5 space-y-4">
      {/* Contract summary card */}
      <div className="rounded-2xl border border-border bg-secondary/40 overflow-hidden">
        <div className="px-4 py-3 bg-primary/10 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-primary" />
            <span className="font-bold text-foreground text-sm capitalize">
              {contract.contract_type === "ownership" 
                ? tx("commonPages.icoClubOwnership", "Club Ownership") 
                : contract.contract_type?.replace("_", " ") || tx("commonPages.icoContract", "Contract")} {contract.contract_type !== "ownership" && tx("commonPages.icoContract", "Contract")}
            </span>
            {contract.negotiation_round > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                {tx("commonPages.icoRound", "Round {round}", { round: contract.negotiation_round })}
              </span>
            )}
          </div>
          <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider",
            contract.status === "active" ? "bg-success/20 text-success border-success/30" :
            contract.status === "rejected" ? "bg-destructive/20 text-destructive border-destructive/30" :
            contract.status === "pending_window" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" :
            "bg-warning/20 text-warning border-warning/30"
          )}>
            {statusLabel}
          </span>
        </div>

        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{tx("commonPages.icoDuration", "Duration")}</p>
            <p className="text-sm font-medium text-foreground">{tx("commonPages.icoDurationValue", "{games} games / {days} days", { games: contract.max_games, days: contract.max_days })}</p>
          </div>
          {contract.weekly_salary_stc > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{t("commonPages.cccWeeklySalary")}</p>
              <p className="text-sm font-medium text-success">{formatSTC(contract.weekly_salary_stc)}</p>
            </div>
          )}
          {contract.signing_bonus_stc > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{t("commonPages.cccSigningBonus")}</p>
              <p className="text-sm font-medium text-warning">{formatSTC(contract.signing_bonus_stc)}</p>
            </div>
          )}
          {contract.transfer_fee_stc > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{tx("commonPages.icoTransferFee", "Transfer Fee")}</p>
              <p className="text-sm font-medium text-primary">{formatSTC(contract.transfer_fee_stc)}</p>
            </div>
          )}
          {contract.captaincy_offered && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{t("commonPages.cccCaptaincy")}</p>
              <p className="text-sm font-medium text-warning">{tx("commonPages.icoOffered", "Offered")}</p>
            </div>
          )}
          {contract.performance_targets?.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{tx("commonPages.icoTargets", "Targets")}</p>
              <p className="text-sm font-medium text-foreground flex items-center gap-1">
                <Target className="w-3 h-3" /> {tx("commonPages.icoTargetCount", "{count} target(s)", { count: contract.performance_targets.length })}
              </p>
            </div>
          )}
        </div>

        {/* Performance targets detail */}
        {contract.performance_targets?.length > 0 && (
          <div className="px-4 pb-4">
            <div className="space-y-1">
              {contract.performance_targets.map((t, i) => {
                const statMeta = PERFORMANCE_STAT_OPTIONS.find(s => s.value === t.stat);
                return (
                  <div key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0" />
                    <span className="text-foreground font-medium">{statMeta?.label || t.stat}</span>
                    <span>— {t.type === "min" ? "≥" : t.type === "exact" ? "=" : "between"} {t.value}{t.type === "range" ? `–${t.value_max}` : ""}{t.unit || ""}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Transfer window notice — shown to the player when it's a transfer (not renewal) */}
      {isPlayer && canAct && myPlayer?.club_id !== contract.team_id && (
        <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold ${
          windowOpen === true
            ? "bg-success/10 border-success/20 text-success"
            : windowOpen === false
            ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
            : "bg-muted/30 border-border text-muted-foreground"
        }`}>
          <Clock className="w-3.5 h-3.5 shrink-0" />
          {windowOpen === true
            ? tx("commonPages.icoWindowOpenImmediate", "Transfer window open. Accepting will activate this contract immediately.")
            : windowOpen === false
            ? tx("commonPages.icoWindowClosedQueue", "Transfer window is closed. Accepting will queue the transfer.")
            : tx("commonPages.icoWindowChecking", "Checking transfer window status...")}
        </div>
      )}

      {/* Action buttons — only when contract is actionable for this user */}
      {canAct && !showCounter && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => doAction("accept")}
            disabled={!!actionLoading}
            className="bg-success text-white hover:bg-success/90 gap-1.5"
          >
            {actionLoading === "accept"
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <CheckCircle className="w-3.5 h-3.5" />}
            {isPlayer && myPlayer?.club_id !== contract.team_id && !windowOpen
              ? tx("commonPages.icoAcceptQueue", "Accept & Queue Transfer")
              : tx("commonPages.icoAcceptContract", "Accept Contract")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCounter(true)}
            disabled={!!actionLoading}
            className="border-purple-500/40 text-purple-400 hover:bg-purple-500/10 gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {tx("commonPages.icoCounterOffer", "Counter-Offer")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => doAction("reject")}
            disabled={!!actionLoading}
            className="border-destructive/40 text-destructive hover:bg-destructive/10 gap-1.5"
          >
            {actionLoading === "reject"
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <X className="w-3.5 h-3.5" />}
            {t("matchFlow.decline")}
          </Button>
        </div>
      )}

      {/* Status info when not actionable */}
      {!canAct && isActionable && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          {tx("commonPages.icoWaitingOther", "Waiting for the other party to respond.")}
        </div>
      )}

      {/* Counter-offer form */}
      {showCounter && (
        <div className="bg-card border border-purple-500/20 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm text-purple-400 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> {tx("commonPages.icoCounterOffer", "Counter-Offer")}
            </p>
            <button type="button" onClick={() => setShowCounter(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">{tx("commonPages.icoWeeklySalaryStc", "Weekly Salary (STC)")}</label>
              <input
                type="number" min="0" value={counterSalary}
                onChange={e => setCounterSalary(e.target.value)}
                placeholder="e.g. 100000"
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-success"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">{tx("commonPages.icoSigningBonusStc", "Signing Bonus (STC)")}</label>
              <input
                type="number" min="0" value={counterBonus}
                onChange={e => setCounterBonus(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-warning"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">{tx("commonPages.icoTransferFeeStc", "Transfer Fee (STC)")}</label>
              <input
                type="number" min="0" value={counterFee}
                onChange={e => setCounterFee(e.target.value)}
                placeholder="e.g. 0"
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Performance targets toggle */}
          <button
            type="button"
            onClick={() => setShowTargets(!showTargets)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-secondary border border-border hover:border-primary/30 transition-all text-sm"
          >
            <div className="flex items-center gap-2">
              <Target className="w-3.5 h-3.5 text-primary" />
              <span className="text-sm text-foreground">{t("commonPages.ocdPerformanceTargets")}</span>
              {counterTargets.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold">{counterTargets.length}</span>
              )}
            </div>
            {showTargets ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {showTargets && (
            <div className="space-y-2">
              {counterTargets.map((target, idx) => (
                <div key={idx} className="bg-secondary/50 border border-border rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={target.stat}
                      onChange={e => updateTarget(idx, "stat", e.target.value)}
                      className="flex-1 px-2 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none"
                    >
                      {PERFORMANCE_STAT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <select
                      value={target.type}
                      onChange={e => updateTarget(idx, "type", e.target.value)}
                      className="w-28 px-2 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none"
                    >
                      {TARGET_TYPES.map(tt => <option key={tt.value} value={tt.value}>{tt.label}</option>)}
                    </select>
                    <button type="button" onClick={() => removeTarget(idx)} className="text-destructive hover:text-destructive/80 p-1">
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
                type="button"
                onClick={addTarget}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-dashed border-primary/30 text-primary text-xs hover:bg-primary/5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> {t("commonPages.cccAddTarget")}
              </button>
            </div>
          )}

          <Textarea
            value={counterNote}
            onChange={e => setCounterNote(e.target.value)}
            placeholder={tx("commonPages.icoCounterPlaceholder", "Explain your counter-offer... (optional)")}
            rows={2}
            className="bg-secondary border-border text-sm"
          />

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={doCounter}
              disabled={!!actionLoading}
              className="bg-purple-600 text-white hover:bg-purple-700 gap-1.5"
            >
              {actionLoading === "counter"
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <MessageSquare className="w-3.5 h-3.5" />}
              {tx("commonPages.icoSendCounter", "Send Counter-Offer")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCounter(false)} className="text-muted-foreground">
              {t("commonPages.cancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

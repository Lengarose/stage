import { useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { postContractNews } from "@/lib/notify";
import { CONTRACT_TYPES } from "@/lib/contractTypes";
import { canCreateContractOffer } from "@/lib/transferWindowAccess";
import { useTransferWindowStatus } from "@/lib/useTransferWindowStatus";
import { Loader2, Check, X, ClipboardList } from "lucide-react";

export default function InboxTrialRequest({ message, onActioned }) {
  const { windowOpen } = useTransferWindowStatus();
  const [loading, setLoading] = useState(null);
  const [done, setDone] = useState(null);
  const safeMessage = message && typeof message === "object" ? message : {};

  const meta = typeof safeMessage.metadata === "string"
    ? (() => { try { return JSON.parse(safeMessage.metadata); } catch { return {}; } })()
    : (safeMessage.metadata || {});
  const currentStatus = String(safeMessage.status || "pending").toLowerCase();
  const isAlreadyResolved = ["accepted", "declined", "confirmed", "rejected"].includes(currentStatus);
  const playerEmail    = meta.player_email    || safeMessage.sender_email;
  const playerId       = meta.player_id       || "";
  const playerGamertag = meta.player_gamertag || safeMessage.sender_gamertag || "Player";
  const playerAvatar   = meta.player_avatar_url || "";
  const playerPosition = meta.player_position || "";
  const playerOvr      = meta.player_overall  || "";
  const clubId         = meta.club_id         || "";
  const clubName       = meta.club_name       || "";
  const clubLogo       = meta.club_logo_url   || "";
  const trialMeta      = CONTRACT_TYPES.trial;

  async function offerTrial() {
    if (!canCreateContractOffer(windowOpen)) return;
    setLoading("offer");
    try {
      // Create trial PlayerContract (pending — player still needs to accept)
      const contract = await stageClient.entities.PlayerContract.create({
        team_id:         clubId,
        user_id:         playerId,
        contract_type:   "trial",
        status:          "pending",
        max_games:       trialMeta.max_games,
        max_days:        trialMeta.max_days,
        weekly_salary_stc: 0,
        signing_bonus_stc: 0,
        transfer_fee_stc:  0,
        performance_targets: [],
        captaincy_offered: false,
        offer_note: `Trial offer from ${clubName} in response to your request.`,
      });

      // PlayerContract.create already routes delivery through the central
      // backend helper, which creates one actionable inbox row and one reminder.

      // Post to news
      postContractNews({
        title: `⚽ ${clubName} offered a trial contract to ${playerGamertag}`,
        body:  `${clubName} responded to a trial request from ${playerGamertag} with a trial contract offer.`,
        club_name: clubName, club_logo_url: clubLogo,
        player_name: playerGamertag, player_avatar_url: playerAvatar,
        link: `/players/${playerId}`,
      });

      // Mark the trial request message as accepted
      if (safeMessage.id) await stageClient.entities.InboxMessage.update(safeMessage.id, { status: "accepted", is_read: true });

      setDone("offered");
      onActioned?.("offer");
    } catch (err) {
      console.error("[InboxTrialRequest] offer failed:", err);
    } finally {
      setLoading(null);
    }
  }

  async function declineTrial() {
    setLoading("decline");
    try {
      // Send decline inbox message to player through the central helper so
      // repeated clicks/retries cannot create duplicate decline messages.
      await stageClient.functions.invoke("sendInboxMessage", {
        recipient_email:  playerEmail,
        sender_email:     safeMessage.recipient_email,
        sender_gamertag:  clubName,
        sender_avatar_url: clubLogo,
        sender_club_name: clubName,
        subject:          `❌ Trial Request Declined — ${clubName}`,
        body:             `Dear ${playerGamertag},\n\nUnfortunately, ${clubName} has decided not to offer you a trial at this time.\n\nBest of luck in your search.\n\n${clubName} Management`,
        message_type:     "general",
        action_type:      "none",
        related_entity_id: safeMessage.id,
        related_entity_type: "trial_request",
        status:           "pending",
        is_read:          false,
        send_notification: true,
      });

      if (safeMessage.id) await stageClient.entities.InboxMessage.update(safeMessage.id, { status: "declined", is_read: true });

      setDone("declined");
      onActioned?.("decline");
    } catch (err) {
      console.error("[InboxTrialRequest] decline failed:", err);
    } finally {
      setLoading(null);
    }
  }

  if (done === "offered") {
    return (
      <div className="mt-4 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-success/10 border border-success/20 text-sm text-success font-medium">
        <Check className="w-4 h-4 shrink-0" />
        Trial contract offer sent to {playerGamertag}.
      </div>
    );
  }

  if (done === "declined") {
    return (
      <div className="mt-4 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive font-medium">
        <X className="w-4 h-4 shrink-0" />
        Trial request declined.
      </div>
    );
  }

  if (isAlreadyResolved) {
    const accepted = currentStatus === "accepted" || currentStatus === "confirmed";
    return (
      <div
        className={`mt-4 flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium ${
          accepted
            ? "bg-success/10 border-success/20 text-success"
            : "bg-destructive/10 border-destructive/20 text-destructive"
        }`}
      >
        {accepted ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
        {accepted ? "Trial request already accepted." : "Trial request already declined."}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {/* Player card */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10">
        <div className="w-9 h-9 rounded-full bg-white/10 overflow-hidden shrink-0 flex items-center justify-center">
          {playerAvatar
            ? <img src={playerAvatar} alt={playerGamertag} className="w-full h-full object-cover" />
            : <ClipboardList className="w-4 h-4 text-white/40" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{playerGamertag}</p>
          <p className="text-xs text-white/40">
            {[playerPosition, playerOvr ? `OVR ${playerOvr}` : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-white/30 uppercase tracking-wider">Trial</p>
          <p className="text-xs text-white/60 font-medium">{trialMeta.max_games}g / {trialMeta.max_days}d</p>
        </div>
      </div>

      <div className="flex gap-2">
        {canCreateContractOffer(windowOpen) ? (
          <Button
            size="sm"
            onClick={offerTrial}
            disabled={!!loading}
            className="flex-1 bg-success/20 text-success hover:bg-success/30 border border-success/30 gap-1.5"
          >
            {loading === "offer" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Offer Trial Contract
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          onClick={declineTrial}
          disabled={!!loading}
          className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10 gap-1.5"
        >
          {loading === "decline" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
          Decline
        </Button>
      </div>
    </div>
  );
}

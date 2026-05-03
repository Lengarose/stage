import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { notify, postContractNews } from "@/lib/notify";
import { CONTRACT_TYPES } from "@/lib/contractTypes";
import { Loader2, Check, X, ClipboardList } from "lucide-react";

export default function InboxTrialRequest({ message, onActioned }) {
  const [loading, setLoading] = useState(null);
  const [done, setDone] = useState(null);

  const meta = message.metadata || {};
  const playerEmail    = meta.player_email    || message.sender_email;
  const playerId       = meta.player_id       || "";
  const playerGamertag = meta.player_gamertag || message.sender_gamertag || "Player";
  const playerAvatar   = meta.player_avatar_url || "";
  const playerPosition = meta.player_position || "";
  const playerOvr      = meta.player_overall  || "";
  const clubId         = meta.club_id         || "";
  const clubName       = meta.club_name       || "";
  const clubLogo       = meta.club_logo_url   || "";
  const trialMeta      = CONTRACT_TYPES.trial;

  async function offerTrial() {
    setLoading("offer");
    try {
      // Create trial PlayerContract (pending — player still needs to accept)
      const contract = await base44.entities.PlayerContract.create({
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

      // Send contract offer to player's inbox
      await base44.entities.InboxMessage.create({
        recipient_email:  playerEmail,
        sender_email:     message.recipient_email,
        sender_gamertag:  clubName,
        sender_avatar_url: clubLogo,
        sender_club_name: clubName,
        subject:          `📄 Trial Contract Offer from ${clubName}`,
        body:             `Dear ${playerGamertag},\n\n${clubName} would like to offer you a trial contract.\n\nType: Trial · ${trialMeta.max_games} games or ${trialMeta.max_days} days\n\nThis trial is your chance to prove yourself. Please respond using the buttons below.\n\nBest regards,\n${clubName} Management`,
        message_type:     "contract_offer",
        action_type:      "contract_negotiation",
        related_entity_id: contract.id,
        status:           "pending",
        is_read:          false,
        metadata: {
          contract_id: contract.id,
          club_id:     clubId,
          club_name:   clubName,
          contract_type: "trial",
        },
      });

      // Notify player
      await notify(playerEmail, "contract_offer",
        `📋 Trial Contract Offer from ${clubName}`,
        `${clubName} has sent you a trial contract offer. Open your inbox to review.`,
        "/inbox"
      );

      // Post to news
      postContractNews({
        title: `⚽ ${clubName} offered a trial contract to ${playerGamertag}`,
        body:  `${clubName} responded to a trial request from ${playerGamertag} with a trial contract offer.`,
        club_name: clubName, club_logo_url: clubLogo,
        player_name: playerGamertag, player_avatar_url: playerAvatar,
        link: `/players/${playerId}`,
      });

      // Mark the trial request message as accepted
      await base44.entities.InboxMessage.update(message.id, { status: "accepted", is_read: true });

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
      // Notify the player of the decline
      await notify(playerEmail, "contract_offer",
        `❌ Trial Request Declined — ${clubName}`,
        `${clubName} has declined your trial request.`,
        `/clubs/${clubId}`
      );

      // Send decline inbox message to player
      await base44.entities.InboxMessage.create({
        recipient_email:  playerEmail,
        sender_email:     message.recipient_email,
        sender_gamertag:  clubName,
        sender_avatar_url: clubLogo,
        sender_club_name: clubName,
        subject:          `❌ Trial Request Declined — ${clubName}`,
        body:             `Dear ${playerGamertag},\n\nUnfortunately, ${clubName} has decided not to offer you a trial at this time.\n\nBest of luck in your search.\n\n${clubName} Management`,
        message_type:     "general",
        action_type:      "none",
        status:           "pending",
        is_read:          false,
      });

      await base44.entities.InboxMessage.update(message.id, { status: "declined", is_read: true });

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
        <Button
          size="sm"
          onClick={offerTrial}
          disabled={!!loading}
          className="flex-1 bg-success/20 text-success hover:bg-success/30 border border-success/30 gap-1.5"
        >
          {loading === "offer" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Offer Trial Contract
        </Button>
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

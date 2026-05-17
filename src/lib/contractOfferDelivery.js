import { stageClient } from "@/api/stageClient";

function formatContractType(type) {
  return String(type || "squad").replace(/_/g, " ");
}

export function buildContractOfferInboxBody({ clubName, contractType, maxGames, maxDays, weeklySalary, signingBonus, offerNote }) {
  return [
    `${clubName || "A club"} has sent you a ${formatContractType(contractType)} contract offer.`,
    "",
    `Duration: ${maxGames || 0} games / ${maxDays || 0} days`,
    `Weekly Salary: ${Number(weeklySalary || 0).toLocaleString()} STC / week`,
    Number(signingBonus || 0) > 0 ? `Signing Bonus: ${Number(signingBonus || 0).toLocaleString()} STC` : null,
    offerNote ? `\nClub note:\n${offerNote}` : null,
    "",
    "Please respond using the buttons below. You can accept the offer, send a counter-offer, or decline it.",
  ].filter(Boolean).join("\n");
}

export async function ensureContractOfferInbox({
  contractId,
  player,
  club,
  contractType,
  maxGames,
  maxDays,
  weeklySalary,
  signingBonus,
  offerNote,
  senderEmail,
}) {
  if (!contractId || !player?.id) return null;

  const body = buildContractOfferInboxBody({
    clubName: club?.name,
    contractType,
    maxGames,
    maxDays,
    weeklySalary,
    signingBonus,
    offerNote,
  });
  const metadata = {
    contract_id: contractId,
    club_id: club?.id,
    club_name: club?.name,
    contract_type: contractType,
  };

  try {
    return await stageClient.functions.invoke("sendInboxMessage", {
      recipient_email: player.email || undefined,
      recipient_player_id: player.id,
      sender_email: senderEmail || club?.owner_email || undefined,
      subject: `Contract Offer from ${club?.name || "Club"}`,
      body,
      message_type: "contract_offer",
      action_type: "contract_negotiation",
      related_entity_id: contractId,
      related_entity_type: "player_contract",
      metadata,
      send_notification: true,
    });
  } catch (err) {
    if (!player.email) throw err;
    return stageClient.entities.InboxMessage.create({
      recipient_email: player.email,
      sender_email: senderEmail || club?.owner_email || "system@stage.com",
      sender_gamertag: club?.name || "Club Management",
      sender_avatar_url: club?.logo_url || "",
      sender_club_name: club?.name || "",
      subject: `Contract Offer from ${club?.name || "Club"}`,
      body,
      message_type: "contract_offer",
      action_type: "contract_negotiation",
      related_entity_id: contractId,
      related_entity_type: "player_contract",
      status: "pending",
      is_read: false,
      metadata,
    });
  }
}

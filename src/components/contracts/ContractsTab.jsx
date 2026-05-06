import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { CONTRACT_TYPES } from "@/lib/contractTypes";
import { notify, postContractNews } from "@/lib/notify";

function buildContractOfferBody({ clubName, playerGamertag, contractType, typeMeta, weeklySalary, signingBonus, transferFee, captaincy, targets, offerNote }) {
  const fmt = (n) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(0)}K` : `${n}`;
  const typeLabel = contractType === "ownership" ? "Club Ownership" : (contractType || "Squad").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  let body = `Dear ${playerGamertag},\n\n`;
  body += `${clubName} is pleased to extend an official contract offer to you. Please review the full terms below carefully before responding.\n\n`;
  body += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  body += `📋  CONTRACT DETAILS\n`;
  body += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  body += `Type:      ${typeLabel} Contract\n`;
  body += `Duration:  ${typeMeta.max_games} games  or  ${typeMeta.max_days} days\n`;
  body += `           (whichever is reached first)\n\n`;

  const hasFinancials = weeklySalary > 0 || signingBonus > 0 || transferFee > 0;
  if (hasFinancials) {
    body += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    body += `💰  FINANCIAL TERMS\n`;
    body += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    if (weeklySalary > 0) body += `Weekly Salary:    ${fmt(weeklySalary)} STC / week\n`;
    if (signingBonus > 0) body += `Signing Bonus:    ${fmt(signingBonus)} STC (paid on signing)\n`;
    if (transferFee > 0)  body += `Transfer Fee:     ${fmt(transferFee)} STC\n`;
    body += `\n`;
  }

  if (captaincy) {
    body += `⭐  CAPTAINCY OFFERED\n`;
    body += `You are being offered the captain role of ${clubName}.\n\n`;
  }

  if (targets?.length > 0) {
    body += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    body += `🎯  PERFORMANCE TARGETS\n`;
    body += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    targets.forEach(t => {
      const typeStr = t.type === "min" ? "at least" : t.type === "exact" ? "exactly" : "between";
      const valStr = t.type === "range" ? `${t.value}–${t.value_max}` : `${t.value}`;
      body += `• ${t.stat?.replace(/_/g, " ")}: ${typeStr} ${valStr}\n`;
    });
    body += `\n`;
  }

  if (offerNote) {
    body += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    body += `📝  MESSAGE FROM ${clubName.toUpperCase()}\n`;
    body += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    body += `"${offerNote}"\n\n`;
  }

  body += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  body += `Please respond using the buttons below. You can accept the offer, send a counter-offer with your preferred terms, or decline if you wish.\n\n`;
  body += `Best regards,\n${clubName} Management`;
  return body;
}
import ContractCard from "./ContractCard";
import OfferContractDialog from "./OfferContractDialog";
import RenewContractDialog from "./RenewContractDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Plus, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function ContractsTab({ club, players, myPlayer, canManage }) {
  const [contracts, setContracts] = useState([]);
  const [playerMap, setPlayerMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [offerDialog, setOfferDialog] = useState(null);   // player object
  const [renewDialog, setRenewDialog] = useState(null);   // contract object
  const [activeTab, setActiveTab] = useState("active");
  const [contractError, setContractError] = useState(null);

  useEffect(() => {
    if (!club?.id) return;
    loadContracts();
  }, [club?.id]);

  async function loadContracts() {
    setLoading(true);
    const all = await stageClient.entities.PlayerContract.filter({ team_id: club.id });
    setContracts(all);

    const pMap = {};
    for (const p of players) pMap[p.id] = p;

    // Fetch any referenced players not in current squad (e.g. terminated contracts)
    const uniqueIds = [...new Set(all.map(c => c.user_id).filter(Boolean))];
    const missing = uniqueIds.filter(uid => !pMap[uid]);
    if (missing.length > 0) {
      const extras = await Promise.all(
        missing.map(uid => stageClient.entities.Player.filter({ id: uid }).then(r => r[0]).catch(() => null))
      );
      extras.filter(Boolean).forEach(p => { pMap[p.id] = p; });
    }
    setPlayerMap(pMap);
    setLoading(false);
  }

  async function offerContract({ contract_type, offer_note, weekly_salary_stc, signing_bonus_stc, transfer_fee_stc, performance_targets, captaincy_offered }) {
    setContractError(null);
    const player = offerDialog;

    // RLS hides email from non-record-owners — fetch fresh to get it
    let recipientEmail = player.email;
    if (!recipientEmail) {
      try {
        const fresh = await stageClient.entities.Player.filter({ id: player.id });
        recipientEmail = fresh[0]?.email || null;
      } catch (_) { /* non-fatal */ }
    }

    let newContract;
    try {
      const typeMeta = CONTRACT_TYPES[contract_type] || CONTRACT_TYPES.squad;
      newContract = await stageClient.entities.PlayerContract.create({
        team_id: club.id,
        user_id: player.id,
        contract_type,
        offer_note: offer_note || "",
        offered_by: myPlayer?.id || "",
        max_games: typeMeta.max_games,
        max_days: typeMeta.max_days,
        weekly_salary_stc:  weekly_salary_stc  || 0,
        signing_bonus_stc:  signing_bonus_stc  || 0,
        transfer_fee_stc:   transfer_fee_stc   || 0,
        performance_targets: performance_targets || [],
        captaincy_offered:  captaincy_offered  || false,
        status: "pending",
      });
    } catch (err) {
      setContractError(`Failed to create contract: ${err?.message || "unknown error"}`);
      throw err;
    }

    if (recipientEmail) {
      try {
        const typeMeta = CONTRACT_TYPES[contract_type] || CONTRACT_TYPES.squad;
        const body = buildContractOfferBody({
          clubName: club.name,
          playerGamertag: player.gamertag || "Player",
          contractType: contract_type,
          typeMeta,
          weeklySalary: weekly_salary_stc || 0,
          signingBonus: signing_bonus_stc || 0,
          transferFee: transfer_fee_stc || 0,
          captaincy: captaincy_offered || false,
          targets: performance_targets || [],
          offerNote: offer_note,
        });
        await stageClient.entities.InboxMessage.create({
          recipient_email:  recipientEmail,
          sender_email:     myPlayer?.email || "system@stage.com",
          sender_gamertag:  club.name,
          sender_avatar_url: club.logo_url || "",
          sender_club_name: club.name,
          subject:          `📄 Contract Offer from ${club.name}`,
          body,
          message_type:     "contract_offer",
          action_type:      "contract_negotiation",
          related_entity_id: newContract.id,
          status:   "pending",
          is_read:  false,
          metadata: { contract_id: newContract.id, club_id: club.id, club_name: club.name, contract_type },
        });
      } catch (_) { /* inbox delivery non-fatal */ }
    }

    notify(recipientEmail, "contract_offer",
      `📋 Contract Offer from ${club.name}`,
      `${club.name} has sent you a ${contract_type} contract offer. Open your inbox to review the terms.`,
      "/inbox"
    );
    postContractNews({
      title: `📄 ${club.name} offered a contract to ${player.gamertag}`,
      body: `${club.name} has sent a ${contract_type} contract offer to ${player.gamertag}.`,
      club_name: club.name, club_logo_url: club.logo_url || "",
      player_name: player.gamertag, player_avatar_url: player.avatar_url || "",
      link: `/clubs/${club.id}`,
    });

    setContracts(prev => [...prev, newContract]);
    setPlayerMap(prev => ({ ...prev, [player.id]: player }));
  }

  async function negotiateContract(contract, terms) {
    await stageClient.entities.PlayerContract.update(contract.id, {
      ...terms,
      status: "negotiating",
      negotiation_round:    (contract.negotiation_round || 0) + 1,
      last_negotiated_by:   myPlayer?.id,
    });
    const recipient = playerMap[contract.user_id];
    const recipientEmail = recipient?.email || null;
    if (recipientEmail) {
      await stageClient.entities.InboxMessage.create({
        recipient_email:  recipientEmail,
        sender_email:     myPlayer?.email || "system@stage.com",
        sender_gamertag:  club.name,
        sender_avatar_url: club.logo_url || "",
        sender_club_name: club.name,
        subject:          `📄 Counter-Offer from ${club.name}`,
        body:             `${club.name} has sent a counter-offer on your contract. Open your inbox to review the updated terms.`,
        message_type:     "contract_offer",
        action_type:      "contract_negotiation",
        related_entity_id: contract.id,
        status:  "pending",
        is_read: false,
        metadata: { contract_id: contract.id, club_id: club.id, club_name: club.name },
      });
      notify(recipientEmail, "contract_offer",
        `🔄 Counter-Offer from ${club.name}`,
        `${club.name} has responded to your contract negotiation. Round ${(contract.negotiation_round || 0) + 1}.`,
        "/inbox"
      );
    }
    const nplayer = playerMap[contract.user_id];
    postContractNews({
      title: `🔄 ${club.name} sent a counter-offer to ${nplayer?.gamertag || "a player"}`,
      body: `${club.name} is negotiating a contract — Round ${(contract.negotiation_round || 0) + 1}.`,
      club_name: club.name, club_logo_url: club.logo_url || "",
      player_name: nplayer?.gamertag || "", player_avatar_url: nplayer?.avatar_url || "",
      link: `/clubs/${club.id}`,
    });
    setContracts(prev => prev.map(c =>
      c.id === contract.id
        ? { ...c, ...terms, status: "negotiating", negotiation_round: (c.negotiation_round || 0) + 1 }
        : c
    ));
  }

  async function acceptContract(contract) {
    const today   = new Date().toISOString().split("T")[0];
    const endDate = new Date(Date.now() + (contract.max_days || 180) * 86400000).toISOString().split("T")[0];
    await stageClient.entities.PlayerContract.update(contract.id, {
      status: "active",
      start_date: today,
      end_date:   endDate,
    });

    const player = playerMap[contract.user_id];

    // Deduct signing bonus from club balance and record in finance
    if ((contract.signing_bonus_stc || 0) > 0) {
      try {
        const freshClub = await stageClient.entities.Club.filter({ id: club.id });
        const clubData = freshClub[0];
        if (clubData) {
          await stageClient.entities.Club.update(club.id, {
            transfer_budget_stc: Math.max(0, (clubData.transfer_budget_stc || 0) - contract.signing_bonus_stc),
          });
          await stageClient.entities.STCTransaction.create({
            club_id: club.id,
            amount: -contract.signing_bonus_stc,
            type: "signing_bonus",
            description: `Signing bonus — ${player?.gamertag || "Player"} (${contract.contract_type} contract)`,
            reference_id: contract.id,
          });
        }
      } catch (_) { /* non-fatal */ }
    }
    notify(club.owner_email, "contract_accepted",
      `✅ Contract Accepted`,
      `${player?.gamertag || "A player"} has accepted your ${contract.contract_type} contract offer.`,
      `/clubs/${club.id}`
    );
    postContractNews({
      title: `✅ ${player?.gamertag || "A player"} joined ${club.name}`,
      body: `${player?.gamertag || "A player"} has accepted a ${contract.contract_type} contract with ${club.name}.`,
      club_name: club.name, club_logo_url: club.logo_url || "",
      player_name: player?.gamertag || "", player_avatar_url: player?.avatar_url || "",
      link: `/clubs/${club.id}`,
    });
    setContracts(prev => prev.map(c =>
      c.id === contract.id ? { ...c, status: "active", start_date: today, end_date: endDate } : c
    ));
  }

  async function rejectContract(contract) {
    await stageClient.entities.PlayerContract.update(contract.id, { status: "rejected" });
    const player = playerMap[contract.user_id];
    notify(club.owner_email, "contract_rejected",
      `❌ Contract Rejected`,
      `${player?.gamertag || "A player"} has declined your ${contract.contract_type} contract offer.`,
      `/clubs/${club.id}`
    );
    postContractNews({
      title: `❌ ${player?.gamertag || "A player"} rejected contract from ${club.name}`,
      body: `${player?.gamertag || "A player"} has rejected the ${contract.contract_type} contract offer from ${club.name}.`,
      club_name: club.name, club_logo_url: club.logo_url || "",
      player_name: player?.gamertag || "", player_avatar_url: player?.avatar_url || "",
      link: `/clubs/${club.id}`,
    });
    setContracts(prev => prev.map(c => c.id === contract.id ? { ...c, status: "rejected" } : c));
  }

  async function terminateContract(contract) {
    if (!confirm("Are you sure you want to terminate this contract?")) return;
    await stageClient.entities.PlayerContract.update(contract.id, { status: "terminated" });
    const player = playerMap[contract.user_id];
    notify(player?.email, "contract_terminated",
      `🚫 Contract Terminated`,
      `Your ${contract.contract_type} contract with ${club.name} has been terminated.`,
      "/inbox"
    );
    postContractNews({
      title: `🚫 ${club.name} terminated contract with ${player?.gamertag || "a player"}`,
      body: `${club.name} has terminated the ${contract.contract_type} contract with ${player?.gamertag || "a player"}.`,
      club_name: club.name, club_logo_url: club.logo_url || "",
      player_name: player?.gamertag || "", player_avatar_url: player?.avatar_url || "",
      link: `/clubs/${club.id}`,
    });
    setContracts(prev => prev.map(c => c.id === contract.id ? { ...c, status: "terminated" } : c));
  }

  async function renewContract({ contract_type, offer_note }) {
    const contract = renewDialog;
    const player   = playerMap[contract.user_id];
    const typeMeta = CONTRACT_TYPES[contract_type] || CONTRACT_TYPES.squad;
    const newContract = await stageClient.entities.PlayerContract.create({
      team_id:             contract.team_id,
      user_id:             contract.user_id,
      contract_type,
      offer_note:          offer_note || "",
      offered_by:          myPlayer?.id || "",
      max_games:           typeMeta.max_games,
      max_days:            typeMeta.max_days,
      weekly_salary_stc:   contract.weekly_salary_stc  || 0,
      signing_bonus_stc:   contract.signing_bonus_stc  || 0,
      performance_targets: contract.performance_targets || [],
      status: "pending",
    });
    // RLS email fallback for renewal
    let renewEmail = player?.email;
    if (!renewEmail && contract.user_id) {
      try {
        const fresh = await stageClient.entities.Player.filter({ id: contract.user_id });
        renewEmail = fresh[0]?.email || null;
      } catch (_) { /* non-fatal */ }
    }
    if (renewEmail) {
      try {
        const body = buildContractOfferBody({
          clubName: club.name,
          playerGamertag: player?.gamertag || "Player",
          contractType: contract_type,
          typeMeta,
          weeklySalary: contract.weekly_salary_stc || 0,
          signingBonus: contract.signing_bonus_stc || 0,
          transferFee: 0,
          captaincy: false,
          targets: contract.performance_targets || [],
          offerNote: offer_note,
        });
        await stageClient.entities.InboxMessage.create({
          recipient_email:  renewEmail,
          sender_email:     myPlayer?.email || "system@stage.com",
          sender_gamertag:  club.name,
          sender_avatar_url: club.logo_url || "",
          sender_club_name: club.name,
          subject:          `📄 Contract Renewal from ${club.name}`,
          body,
          message_type:     "contract_offer",
          action_type:      "contract_negotiation",
          related_entity_id: newContract.id,
          status:  "pending",
          is_read: false,
          metadata: { contract_id: newContract.id, club_id: club.id, club_name: club.name, contract_type },
        });
      } catch (_) { /* inbox delivery non-fatal */ }
    }
    notify(renewEmail, "contract_offer",
      `📋 Contract Renewal from ${club.name}`,
      `${club.name} has offered you a contract renewal (${contract_type}). Open your inbox to review.`,
      "/inbox"
    );
    postContractNews({
      title: `🔄 ${club.name} offered renewal to ${player?.gamertag || "a player"}`,
      body: `${club.name} has offered a ${contract_type} contract renewal to ${player?.gamertag || "a player"}.`,
      club_name: club.name, club_logo_url: club.logo_url || "",
      player_name: player?.gamertag || "", player_avatar_url: player?.avatar_url || "",
      link: `/clubs/${club.id}`,
    });
    setContracts(prev => [...prev, newContract]);
    setRenewDialog(null);
  }

  const HISTORY_STATUSES = ["rejected", "expired", "terminated", "completed"];
  const [negotiateDialog, setNegotiateDialog] = useState(null); // contract object

  const byStatus = {
    active:  contracts.filter(c => c.status === "active"),
    pending: contracts.filter(c => c.status === "pending" || c.status === "pending_window" || c.status === "negotiating"),
    history: contracts.filter(c => HISTORY_STATUSES.includes(c.status)),
  };

  // Owners can hold BOTH an ownership contract AND a player contract simultaneously.
  // A player is eligible for an offer if they're missing at least one contract group.
  const LIVE = ["active", "pending", "pending_window", "negotiating"];
  const eligiblePlayers = players.filter(p => {
    const live = contracts.filter(c => c.user_id === p.id && LIVE.includes(c.status));
    const hasOwnership = live.some(c => c.contract_type === "ownership");
    const hasPlayer    = live.some(c => c.contract_type !== "ownership");
    return !hasOwnership || !hasPlayer; // eligible if at least one slot is open
  });

  // Pending contracts for the current player (to accept/reject/negotiate)
  const myPendingContracts = contracts.filter(c =>
    c.user_id === myPlayer?.id && (c.status === "pending" || c.status === "negotiating")
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {contractError && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-sm text-destructive flex items-center justify-between gap-3">
          <span>{contractError}</span>
          <button onClick={() => setContractError(null)} className="text-destructive/60 hover:text-destructive text-xs font-bold">✕</button>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-bold text-foreground text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> Contracts
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {byStatus.active.length} active · {byStatus.pending.length} pending
          </p>
        </div>
        {canManage && eligiblePlayers.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">
              {eligiblePlayers.length} player{eligiblePlayers.length !== 1 ? "s" : ""} eligible
            </span>
            <Link to={`/contracts/create?club=${club.id}`}>
              <Button size="sm" className="bg-primary text-primary-foreground gap-2">
                <Plus className="w-3.5 h-3.5" /> Create Contract
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* My pending contracts banner */}
      {myPendingContracts.length > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 space-y-3">
          <p className="text-sm font-bold text-warning">You have pending contract offers</p>
          {myPendingContracts.map(c => (
            <ContractCard
              key={c.id}
              contract={c}
              player={playerMap[c.user_id]}
              canManage={false}
              isMyContract={true}
              onAccept={acceptContract}
              onReject={rejectContract}
              onTerminate={() => {}}
              onRenew={null}
              onNegotiate={() => setNegotiateDialog(c)}
            />
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary border border-border">
          <TabsTrigger value="active" className="flex items-center gap-1.5 text-xs">
            Active
            {byStatus.active.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-success/20 text-success text-[10px] font-bold">{byStatus.active.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center gap-1.5 text-xs">
            Pending
            {byStatus.pending.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-warning/20 text-warning text-[10px] font-bold">{byStatus.pending.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1.5 text-xs">
            History
            {byStatus.history.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground text-[10px] font-bold">{byStatus.history.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-2 mt-3">
          {byStatus.active.length === 0 ? (
            <EmptyContracts label="No active contracts." />
          ) : (() => {
            // Find players with both an ownership AND a player contract active
            const dualPlayerIds = new Set(
              byStatus.active
                .filter(c => c.contract_type === "ownership")
                .map(c => c.user_id)
                .filter(uid => byStatus.active.some(c => c.user_id === uid && c.contract_type !== "ownership"))
            );
            // Group: dual-contract players first with a banner, then the rest
            const dualContracts   = byStatus.active.filter(c => dualPlayerIds.has(c.user_id));
            const singleContracts = byStatus.active.filter(c => !dualPlayerIds.has(c.user_id));
            return (
              <>
                {dualContracts.length > 0 && (
                  <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-3 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 flex items-center gap-1.5">
                      <FileText className="w-3 h-3" /> Dual Contracts — Owner + Player role
                    </p>
                    {dualContracts.map(c => (
                      <ContractCard
                        key={c.id}
                        contract={c}
                        player={playerMap[c.user_id]}
                        canManage={canManage}
                        isMyContract={c.user_id === myPlayer?.id}
                        onAccept={acceptContract}
                        onReject={rejectContract}
                        onTerminate={terminateContract}
                        onRenew={canManage ? () => setRenewDialog(c) : null}
                        dualContract={true}
                      />
                    ))}
                  </div>
                )}
                {singleContracts.map(c => (
                  <ContractCard
                    key={c.id}
                    contract={c}
                    player={playerMap[c.user_id]}
                    canManage={canManage}
                    isMyContract={c.user_id === myPlayer?.id}
                    onAccept={acceptContract}
                    onReject={rejectContract}
                    onTerminate={terminateContract}
                    onRenew={canManage ? () => setRenewDialog(c) : null}
                  />
                ))}
              </>
            );
          })()}
        </TabsContent>

        <TabsContent value="pending" className="space-y-2 mt-3">
          {byStatus.pending.length === 0 ? (
            <EmptyContracts label="No pending offers." />
          ) : (
            byStatus.pending.map(c => (
              <ContractCard
                key={c.id}
                contract={c}
                player={playerMap[c.user_id]}
                canManage={canManage}
                isMyContract={c.user_id === myPlayer?.id}
                onAccept={acceptContract}
                onReject={rejectContract}
                onTerminate={terminateContract}
                onRenew={null}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-2 mt-3">
          {byStatus.history.length === 0 ? (
            <EmptyContracts label="No contract history yet." />
          ) : (
            byStatus.history.map(c => (
              <ContractCard
                key={c.id}
                contract={c}
                player={playerMap[c.user_id]}
                canManage={canManage}
                isMyContract={false}
                onAccept={() => {}}
                onReject={() => {}}
                onTerminate={() => {}}
                onRenew={canManage ? () => setRenewDialog(c) : null}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Player picker for multiple eligible */}
      {canManage && eligiblePlayers.length > 1 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-3">Offer to specific player</p>
          <div className="flex flex-wrap gap-2">
            {eligiblePlayers.map(p => (
              <button
                key={p.id}
                onClick={() => setOfferDialog(p)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary border border-border hover:border-primary/30 transition-all text-sm"
              >
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                  {p.avatar_url
                    ? <img src={p.avatar_url} alt={p.gamertag} className="w-full h-full object-cover" />
                    : <span className="text-[10px] font-bold text-primary">{(p.gamertag || "?")[0]}</span>}
                </div>
                <span className="text-foreground font-medium">{p.gamertag}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Offer contract dialog */}
      <OfferContractDialog
        open={!!offerDialog}
        onClose={() => setOfferDialog(null)}
        player={offerDialog}
        playerContracts={offerDialog ? contracts.filter(c => c.user_id === offerDialog.id && LIVE.includes(c.status)) : []}
        existingActiveContract={null}
        onOffer={offerContract}
        windowOpen={null}
      />

      {/* Negotiate / counter-offer dialog */}
      <OfferContractDialog
        open={!!negotiateDialog}
        onClose={() => setNegotiateDialog(null)}
        player={negotiateDialog ? playerMap[negotiateDialog.user_id] : null}
        existingActiveContract={null}
        existingContract={negotiateDialog}
        isNegotiation={true}
        onOffer={(terms) => negotiateContract(negotiateDialog, terms)}
        windowOpen={null}
      />

      {/* Renew contract dialog */}
      <RenewContractDialog
        open={!!renewDialog}
        onClose={() => setRenewDialog(null)}
        contract={renewDialog}
        player={renewDialog ? playerMap[renewDialog.user_id] : null}
        onRenew={renewContract}
      />
    </div>
  );
}

function EmptyContracts({ label }) {
  return (
    <div className="bg-card border border-border rounded-xl p-8 text-center">
      <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
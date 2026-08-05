import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { CONTRACT_TYPES } from "@/lib/contractTypes";
import { getContractTargetPlayerId, getContractType, normalizePlayerContracts } from "@/lib/playerContractFields";
import { notify, postContractNews } from "@/lib/notify";
import { swalConfirm } from "@/lib/swal";

import ContractCard from "./ContractCard";
import OfferContractDialog from "./OfferContractDialog";
import RenewContractDialog from "./RenewContractDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Plus, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { canCreateContractOffer } from "@/lib/transferWindowAccess";
import { useTransferWindowStatus } from "@/lib/useTransferWindowStatus";
import { useTranslation } from "@/hooks/useTranslation";

export default function ContractsTab({ club, players, myPlayer, canManage, onPlayerReleased }) {
  const { t } = useTranslation();
  const { windowOpen } = useTransferWindowStatus();
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
    const safeContracts = normalizePlayerContracts(all);
    setContracts(safeContracts);

    const pMap = {};
    for (const p of players) pMap[p.id] = p;

    // Fetch any referenced players not in current squad (e.g. terminated contracts)
    const uniqueIds = [...new Set(safeContracts.map(getContractTargetPlayerId).filter(Boolean))];
    const missing = uniqueIds.filter(uid => !pMap[uid]);
    if (missing.length > 0) {
      const extras = await Promise.all(
        missing.map(uid => stageClient.entities.Player.get(uid).catch(() => null))
      );
      extras.filter(Boolean).forEach(p => { pMap[p.id] = p; });
    }
    setPlayerMap(pMap);
    setLoading(false);
  }

  async function offerContract({ contract_type, offer_note, weekly_salary_stc, signing_bonus_stc, transfer_fee_stc, performance_targets, captaincy_offered }) {
    setContractError(null);
    const player = offerDialog;
    if (!canCreateContractOffer(windowOpen)) return;

    let newContract;
    try {
      const typeMeta = CONTRACT_TYPES[contract_type] || CONTRACT_TYPES.squad;
      const result = await stageClient.functions.invoke("contractManagement", {
        action: "offer",
        team_id: club.id,
        target_player_id: player.id,
        contract_type,
        offer_note: offer_note || "",
        max_games: typeMeta.max_games,
        max_days: typeMeta.max_days,
        weekly_salary_stc:  weekly_salary_stc  || 0,
        signing_bonus_stc:  signing_bonus_stc  || 0,
        transfer_fee_stc:   transfer_fee_stc   || 0,
        performance_targets: performance_targets || [],
        captaincy_offered:  captaincy_offered  || false,
      });
      newContract = result?.data?.contract;
    } catch (err) {
      setContractError(`Failed to create contract: ${err?.message || "unknown error"}`);
      throw err;
    }

    postContractNews({
      title: `📄 ${club.name} offered a contract to ${player.gamertag}`,
      body: `${club.name} has sent a ${contract_type} contract offer to ${player.gamertag}.`,
      club_name: club.name, club_logo_url: club.logo_url || "",
      player_name: player.gamertag, player_avatar_url: player.avatar_url || "",
      link: `/clubs/${club.id}`,
    });

    if (newContract) setContracts(prev => normalizePlayerContracts([...prev, newContract]));
    setPlayerMap(prev => ({ ...prev, [player.id]: player }));
  }

  async function negotiateContract(contract, terms) {
    const result = await stageClient.functions.invoke("contractManagement", {
      action: "counter",
      contract_id: contract.id,
      ...terms,
      last_negotiated_by: myPlayer?.id,
    });
    const updatedContract = result?.data?.contract || {
      ...contract,
      ...terms,
      status: "negotiating",
      negotiation_round: (contract.negotiation_round || 0) + 1,
    };
    const recipient = playerMap[getContractTargetPlayerId(contract)];
    const recipientEmail = recipient?.email || null;
    if (recipientEmail) {
      notify(recipientEmail, "contract_offer",
        `🔄 Counter-Offer from ${club.name}`,
        `${club.name} has responded to your contract negotiation. Round ${(contract.negotiation_round || 0) + 1}.`,
        "/inbox"
      );
    }
    const nplayer = playerMap[getContractTargetPlayerId(contract)];
    postContractNews({
      title: `🔄 ${club.name} sent a counter-offer to ${nplayer?.gamertag || "a player"}`,
      body: `${club.name} is negotiating a contract — Round ${(contract.negotiation_round || 0) + 1}.`,
      club_name: club.name, club_logo_url: club.logo_url || "",
      player_name: nplayer?.gamertag || "", player_avatar_url: nplayer?.avatar_url || "",
      link: `/clubs/${club.id}`,
    });
    setContracts(prev => normalizePlayerContracts(prev.map(c =>
      c.id === contract.id
        ? { ...c, ...updatedContract }
        : c
    )));
  }

  async function acceptContract(contract) {
    const player = playerMap[getContractTargetPlayerId(contract)];
    const contractType = getContractType(contract);
    const result = await stageClient.functions.invoke("contractManagement", {
      action: "accept",
      contract_id: contract.id,
    });
    const { start_date, end_date } = result?.data || {};
    notify(club.owner_email, "contract_accepted",
      `✅ Contract Accepted`,
      `${player?.gamertag || "A player"} has accepted your ${contractType} contract offer.`,
      `/clubs/${club.id}`
    );
    postContractNews({
      title: `✅ ${player?.gamertag || "A player"} joined ${club.name}`,
      body: `${player?.gamertag || "A player"} has accepted a ${contractType} contract with ${club.name}.`,
      club_name: club.name, club_logo_url: club.logo_url || "",
      player_name: player?.gamertag || "", player_avatar_url: player?.avatar_url || "",
      link: `/clubs/${club.id}`,
    });
    setContracts(prev => normalizePlayerContracts(prev.map(c =>
      c.id === contract.id ? { ...c, status: "active", start_date, end_date } : c
    )));
  }

  async function rejectContract(contract) {
    const contractType = getContractType(contract);
    const result = await stageClient.functions.invoke("contractManagement", {
      action: "reject",
      contract_id: contract.id,
    });
    const updatedContract = result?.data?.contract || { ...contract, status: "rejected" };
    const player = playerMap[getContractTargetPlayerId(contract)];
    notify(club.owner_email, "contract_rejected",
      `❌ Contract Rejected`,
      `${player?.gamertag || "A player"} has declined your ${contractType} contract offer.`,
      `/clubs/${club.id}`
    );
    postContractNews({
      title: `❌ ${player?.gamertag || "A player"} rejected contract from ${club.name}`,
      body: `${player?.gamertag || "A player"} has rejected the ${contractType} contract offer from ${club.name}.`,
      club_name: club.name, club_logo_url: club.logo_url || "",
      player_name: player?.gamertag || "", player_avatar_url: player?.avatar_url || "",
      link: `/clubs/${club.id}`,
    });
    setContracts(prev => normalizePlayerContracts(prev.map(c => c.id === contract.id ? { ...c, ...updatedContract } : c)));
  }

  async function cancelContractOffer(contract) {
    if (!(await swalConfirm("Cancel this pending contract offer? The player will no longer be able to accept it."))) return;
    try {
      const result = await stageClient.functions.invoke("contractManagement", {
        action: "cancel_offer",
        contract_id: contract.id,
      });
      const updated = result?.data?.contract;
      const player = playerMap[getContractTargetPlayerId(contract)];
      const contractType = getContractType(contract);
      postContractNews({
        title: `↩ ${club.name} cancelled a contract offer`,
        body: `${club.name} cancelled the ${contractType} contract offer to ${player?.gamertag || "a player"}.`,
        club_name: club.name, club_logo_url: club.logo_url || "",
        player_name: player?.gamertag || "", player_avatar_url: player?.avatar_url || "",
        link: `/clubs/${club.id}`,
      });
      setContracts(prev => normalizePlayerContracts(prev.map(c => c.id === contract.id ? { ...c, ...(updated || {}), status: "cancelled" } : c)));
    } catch (err) {
      setContractError(`Failed to cancel contract: ${err?.message || "unknown error"}`);
    }
  }

  async function terminateContract(contract) {
    if (!(await swalConfirm("Are you sure you want to terminate this contract?"))) return;
    await stageClient.functions.invoke("contractManagement", { action: "terminate", contract_id: contract.id });
    const playerId = getContractTargetPlayerId(contract);
    const player = playerMap[playerId];
    const contractType = getContractType(contract);
    notify(player?.email, "contract_terminated",
      `🚫 Contract Terminated`,
      `Your ${contractType} contract with ${club.name} has been terminated.`,
      "/inbox"
    );
    postContractNews({
      title: `🚫 ${club.name} terminated contract with ${player?.gamertag || "a player"}`,
      body: `${club.name} has terminated the ${contractType} contract with ${player?.gamertag || "a player"}.`,
      club_name: club.name, club_logo_url: club.logo_url || "",
      player_name: player?.gamertag || "", player_avatar_url: player?.avatar_url || "",
      link: `/clubs/${club.id}`,
    });
    setContracts(prev => normalizePlayerContracts(prev.map(c => c.id === contract.id ? { ...c, status: "terminated" } : c)));
    if (playerId) {
      const releasedPlayer = await stageClient.entities.Player.get(playerId).catch(() => null);
      if (String(releasedPlayer?.club_id || "") !== String(club.id || "")) {
        onPlayerReleased?.(playerId, releasedPlayer);
      } else if (releasedPlayer?.id) {
        setPlayerMap(prev => ({ ...prev, [releasedPlayer.id]: releasedPlayer }));
      }
    }
  }

  async function renewContract({ contract_type, offer_note }) {
    if (!canCreateContractOffer(windowOpen)) return;
    const contract = renewDialog;
    const player   = playerMap[getContractTargetPlayerId(contract)];
    const typeMeta = CONTRACT_TYPES[contract_type] || CONTRACT_TYPES.squad;
    const result = await stageClient.functions.invoke("contractManagement", {
      action: "renewal_offer",
      contract_id: contract.id,
      contract_type,
      offer_note:          offer_note || "",
      max_games:           typeMeta.max_games,
      max_days:            typeMeta.max_days,
      weekly_salary_stc:   contract.weekly_salary_stc  || 0,
      signing_bonus_stc:   contract.signing_bonus_stc  || 0,
      performance_targets: contract.performance_targets || [],
    });
    const newContract = result?.data?.contract;
    postContractNews({
      title: `🔄 ${club.name} offered renewal to ${player?.gamertag || "a player"}`,
      body: `${club.name} has offered a ${contract_type} contract renewal to ${player?.gamertag || "a player"}.`,
      club_name: club.name, club_logo_url: club.logo_url || "",
      player_name: player?.gamertag || "", player_avatar_url: player?.avatar_url || "",
      link: `/clubs/${club.id}`,
    });
    if (newContract) setContracts(prev => normalizePlayerContracts([...prev, newContract]));
    setRenewDialog(null);
  }

  const HISTORY_STATUSES = ["rejected", "expired", "terminated", "completed", "cancelled"];
  const [negotiateDialog, setNegotiateDialog] = useState(null); // contract object

  const safeContracts = normalizePlayerContracts(contracts);
  const byStatus = {
    active:  safeContracts.filter(c => c.status === "active"),
    pending: safeContracts.filter(c => c.status === "pending" || c.status === "pending_window" || c.status === "negotiating"),
    history: safeContracts.filter(c => HISTORY_STATUSES.includes(c.status)),
  };

  // Presidents can hold BOTH a president contract AND a player contract simultaneously.
  // A player is eligible for an offer if they're missing at least one contract group.
  const LIVE = ["active", "pending", "pending_window", "negotiating"];
  const eligiblePlayers = players.filter(p => {
    const live = safeContracts.filter(c => getContractTargetPlayerId(c) === p.id && LIVE.includes(c.status));
    const hasOwnership = live.some(c => getContractType(c) === "ownership");
    const hasPlayer    = live.some(c => getContractType(c) !== "ownership");
    return !hasOwnership || !hasPlayer; // eligible if at least one slot is open
  });

  // Pending contracts for the current player (to accept/reject/negotiate)
  const myPendingContracts = safeContracts.filter(c =>
    getContractTargetPlayerId(c) === myPlayer?.id && (c.status === "pending" || c.status === "negotiating")
  );
  const canManageContractOffers = canManage && canCreateContractOffer(windowOpen);

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
        {canManageContractOffers && eligiblePlayers.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">
              {eligiblePlayers.length} player{eligiblePlayers.length !== 1 ? "s" : ""} eligible
            </span>
            <Link to={`/contracts/create?club=${club.id}`}>
              <Button size="sm" className="bg-primary text-primary-foreground gap-2">
                <Plus className="w-3.5 h-3.5" /> {t("commonPages.cccTitle")}
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
              player={playerMap[getContractTargetPlayerId(c)]}
              canManage={false}
              isMyContract={true}
              onAccept={acceptContract}
                onReject={rejectContract}
                onTerminate={() => {}}
                onCancel={cancelContractOffer}
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
                .filter(c => getContractType(c) === "ownership")
                .map(getContractTargetPlayerId)
                .filter(uid => byStatus.active.some(c => getContractTargetPlayerId(c) === uid && getContractType(c) !== "ownership"))
            );
            // Group: dual-contract players first with a banner, then the rest
            const dualContracts   = byStatus.active.filter(c => dualPlayerIds.has(getContractTargetPlayerId(c)));
            const singleContracts = byStatus.active.filter(c => !dualPlayerIds.has(getContractTargetPlayerId(c)));
            return (
              <>
                {dualContracts.length > 0 && (
                  <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-3 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 flex items-center gap-1.5">
                      <FileText className="w-3 h-3" /> Dual Contracts — President + Player role
                    </p>
                    {dualContracts.map(c => (
                      <ContractCard
                        key={c.id}
                        contract={c}
                        player={playerMap[getContractTargetPlayerId(c)]}
                        canManage={canManage}
                        isMyContract={getContractTargetPlayerId(c) === myPlayer?.id}
                        onAccept={acceptContract}
                        onReject={rejectContract}
                        onTerminate={terminateContract}
                        onCancel={cancelContractOffer}
                        onRenew={canManageContractOffers ? () => setRenewDialog(c) : null}
                        dualContract={true}
                      />
                    ))}
                  </div>
                )}
                {singleContracts.map(c => (
                  <ContractCard
                    key={c.id}
                    contract={c}
                    player={playerMap[getContractTargetPlayerId(c)]}
                    canManage={canManage}
                    isMyContract={getContractTargetPlayerId(c) === myPlayer?.id}
                    onAccept={acceptContract}
                    onReject={rejectContract}
                    onTerminate={terminateContract}
                    onCancel={cancelContractOffer}
                    onRenew={canManageContractOffers ? () => setRenewDialog(c) : null}
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
                player={playerMap[getContractTargetPlayerId(c)]}
                canManage={canManage}
                isMyContract={getContractTargetPlayerId(c) === myPlayer?.id}
                onAccept={acceptContract}
                onReject={rejectContract}
                onTerminate={terminateContract}
                onCancel={cancelContractOffer}
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
                player={playerMap[getContractTargetPlayerId(c)]}
                canManage={canManage}
                isMyContract={false}
                onAccept={() => {}}
                onReject={() => {}}
                onTerminate={() => {}}
                onRenew={canManageContractOffers ? () => setRenewDialog(c) : null}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Player picker for multiple eligible */}
      {canManageContractOffers && eligiblePlayers.length > 1 && (
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
        playerContracts={offerDialog ? safeContracts.filter(c => getContractTargetPlayerId(c) === offerDialog.id && LIVE.includes(c.status)) : []}
        existingActiveContract={null}
        onOffer={offerContract}
        windowOpen={windowOpen}
      />

      {/* Negotiate / counter-offer dialog */}
      <OfferContractDialog
        open={!!negotiateDialog}
        onClose={() => setNegotiateDialog(null)}
        player={negotiateDialog ? playerMap[getContractTargetPlayerId(negotiateDialog)] : null}
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
        player={renewDialog ? playerMap[getContractTargetPlayerId(renewDialog)] : null}
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

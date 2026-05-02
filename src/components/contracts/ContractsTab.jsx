import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { CONTRACT_TYPES } from "@/lib/contractTypes";
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

  useEffect(() => {
    if (!club?.id) return;
    loadContracts();
  }, [club?.id]);

  async function loadContracts() {
    setLoading(true);
    const all = await base44.entities.PlayerContract.filter({ team_id: club.id });
    setContracts(all);

    const pMap = {};
    for (const p of players) pMap[p.id] = p;

    // Fetch any referenced players not in current squad (e.g. terminated contracts)
    const uniqueIds = [...new Set(all.map(c => c.user_id).filter(Boolean))];
    const missing = uniqueIds.filter(uid => !pMap[uid]);
    if (missing.length > 0) {
      const extras = await Promise.all(
        missing.map(uid => base44.entities.Player.filter({ id: uid }).then(r => r[0]).catch(() => null))
      );
      extras.filter(Boolean).forEach(p => { pMap[p.id] = p; });
    }
    setPlayerMap(pMap);
    setLoading(false);
  }

  async function offerContract({ contract_type, offer_note, weekly_salary_stc, signing_bonus_stc, transfer_fee_stc, performance_targets, captaincy_offered }) {
    const player = offerDialog;
    const res = await base44.functions.invoke("contractActions", {
      action: "offer",
      team_id: club.id,
      user_id: player.id,
      contract_type,
      offer_note,
      weekly_salary_stc,
      signing_bonus_stc,
      transfer_fee_stc,
      performance_targets,
      captaincy_offered,
    });
    const newContract = res.data.contract;
    setContracts(prev => [...prev, newContract]);
    setPlayerMap(prev => ({ ...prev, [player.id]: player }));
  }

  async function negotiateContract(contract, terms) {
    await base44.functions.invoke("contractActions", {
      action: "negotiate",
      contract_id: contract.id,
      ...terms,
    });
    setContracts(prev => prev.map(c =>
      c.id === contract.id ? { ...c, status: "negotiating", ...terms } : c
    ));
  }

  async function acceptContract(contract) {
    await base44.functions.invoke("contractActions", { action: "accept", contract_id: contract.id });
    const today = new Date().toISOString().split("T")[0];
    const endDate = new Date(Date.now() + contract.max_days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    setContracts(prev => prev.map(c =>
      c.id === contract.id ? { ...c, status: "active", start_date: today, end_date: endDate } : c
    ));
  }

  async function rejectContract(contract) {
    await base44.functions.invoke("contractActions", { action: "reject", contract_id: contract.id });
    setContracts(prev => prev.map(c => c.id === contract.id ? { ...c, status: "rejected" } : c));
  }

  async function terminateContract(contract) {
    if (!confirm("Are you sure you want to terminate this contract?")) return;
    await base44.functions.invoke("contractActions", { action: "terminate", contract_id: contract.id });
    setContracts(prev => prev.map(c => c.id === contract.id ? { ...c, status: "terminated" } : c));
  }

  async function renewContract({ contract_type, offer_note }) {
    const contract = renewDialog;
    const res = await base44.functions.invoke("contractActions", {
      action: "renew",
      contract_id: contract.id,
      contract_type,
      offer_note,
    });
    const newContract = res.data.contract;
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

  // Players without an active/pending/pending_window contract (eligible for offer)
  const eligiblePlayers = players.filter(p => {
    const existing = contracts.find(c => c.user_id === p.id && (c.status === "active" || c.status === "pending" || c.status === "pending_window"));
    return !existing;
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
          ) : (
            byStatus.active.map(c => (
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
            ))
          )}
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
        existingActiveContract={
          offerDialog
            ? contracts.find(c => c.user_id === offerDialog.id && (c.status === "active" || c.status === "pending"))
            : null
        }
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
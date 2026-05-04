import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import OfferContractDialog from "@/components/contracts/OfferContractDialog";
import TransferWindowBanner from "@/components/transfer/TransferWindowBanner";
import TransferFilters from "@/components/transfer/TransferFilters";
import TransferPlayerList from "@/components/transfer/TransferPlayerList";
import TransferDetailPanel from "@/components/transfer/TransferDetailPanel";

export default function TransferMarket() {
  const [loading, setLoading] = useState(true);
  const [freeAgents, setFreeAgents] = useState([]);
  const [expiringPlayers, setExpiringPlayers] = useState([]);
  const [currentWindow, setCurrentWindow] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);
  const [myClub, setMyClub] = useState(null);
  const [myContracts, setMyContracts] = useState([]);
  const [canManage, setCanManage] = useState(false);

  // UI state
  const [selected, setSelected] = useState(null); // { player, badgeType, contract, days_left }
  const [offerTarget, setOfferTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "free_agent" | "expiring"
  const [platformFilter, setPlatformFilter] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const user = await base44.auth.me();

      const [marketRes, playerArr] = await Promise.all([
        base44.functions.invoke("getTransferMarket", {}).catch(() => ({ data: {} })),
        base44.entities.Player.filter({ email: user.email }),
      ]);

      const player = playerArr[0] || null;
      setMyPlayer(player);
      setFreeAgents(marketRes?.data?.free_agents || []);
      setExpiringPlayers(marketRes?.data?.expiring_players || []);
      setCurrentWindow(marketRes?.data?.current_window || null);

      if (player?.club_id) {
        const [clubArr, contractArr] = await Promise.all([
          base44.entities.Club.filter({ id: player.club_id }),
          base44.entities.PlayerContract.filter({ team_id: player.club_id }),
        ]);
        const club = clubArr[0] || null;
        setMyClub(club);
        setMyContracts(contractArr);
        const isOwner = club?.owner_email === user.email;
        const isManagement = player.club_roles?.includes("president") || player.club_roles?.includes("captain");
        setCanManage(isOwner || isManagement || user.role === "admin");
      }
    } catch (err) {
      console.error("[TransferMarket] load failed:", err);
    } finally {
      setLoading(false);
    }
  }

  function hasConflict(playerId) {
    return myContracts.some(c => c.user_id === playerId && (c.status === "active" || c.status === "pending" || c.status === "pending_window"));
  }

  async function handleOffer({ contract_type, offer_note, weekly_salary_stc, signing_bonus_stc, transfer_fee_stc, performance_targets, captaincy_offered }) {
    if (!offerTarget || !myClub) return;
    const targetPlayer = offerTarget.player || offerTarget;
    await base44.functions.invoke("contractActions", {
      action: "offer",
      team_id: myClub.id,
      user_id: targetPlayer.id,
      contract_type,
      offer_note,
      weekly_salary_stc,
      signing_bonus_stc,
      transfer_fee_stc,
      performance_targets,
      captaincy_offered,
    });
    const updated = await base44.entities.PlayerContract.filter({ team_id: myClub.id });
    setMyContracts(updated);
    setOfferTarget(null);
  }

  // Build unified flat list
  const allEntries = useMemo(() => {
    const free = freeAgents.map(p => ({ player: p, badgeType: "free_agent", contract: null, days_left: null }));
    const expiring = expiringPlayers.map(({ player, contract, days_left }) => ({
      player,
      badgeType: days_left <= 3 ? "expiring_soon" : "expiring",
      contract,
      days_left,
    }));
    return [...free, ...expiring];
  }, [freeAgents, expiringPlayers]);

  // Filtered list
  const filteredEntries = useMemo(() => {
    return allEntries.filter(({ player, badgeType }) => {
      if (search && !player.gamertag?.toLowerCase().includes(search.toLowerCase())) return false;
      if (positionFilter && player.position !== positionFilter) return false;
      if (platformFilter && player.platform !== platformFilter) return false;
      if (statusFilter === "free_agent" && badgeType !== "free_agent") return false;
      if (statusFilter === "expiring" && badgeType !== "expiring" && badgeType !== "expiring_soon") return false;
      return true;
    });
  }, [allEntries, search, positionFilter, statusFilter, platformFilter]);

  const windowOpen = currentWindow?.status === "open";

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header — matches Schedule/GameDay style */}
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="w-6 h-6 text-primary" />
          <div>
            <h1
              className="font-heading font-black text-5xl md:text-6xl text-foreground uppercase"
              style={{ transform: "skewX(-8deg)", letterSpacing: "-0.02em", transformOrigin: "left center" }}
            >
              TRANSFERS
            </h1>
            <p className="text-xs text-muted-foreground mt-2">Browse available players and send contract offers</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-32">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Transfer Window Banner */}
            <TransferWindowBanner window={currentWindow} />

            {/* Desktop: two-column layout */}
            <div className="hidden lg:grid lg:grid-cols-[1fr_360px] gap-4 items-start">
              {/* Left: filters + list */}
              <div className="space-y-4">
                <TransferFilters
                  search={search} onSearch={setSearch}
                  position={positionFilter} onPosition={setPositionFilter}
                  statusFilter={statusFilter} onStatus={setStatusFilter}
                  platform={platformFilter} onPlatform={setPlatformFilter}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>{filteredEntries.length} player{filteredEntries.length !== 1 ? "s" : ""} found</span>
                  <span className="flex gap-3">
                    <span className="text-success font-medium">{freeAgents.length} free agents</span>
                    <span className="text-warning font-medium">{expiringPlayers.length} expiring</span>
                  </span>
                </div>
                <TransferPlayerList
                  players={filteredEntries}
                  selectedId={selected?.player?.id}
                  onSelect={setSelected}
                  canManage={canManage}
                  hasConflict={hasConflict}
                  onOffer={setOfferTarget}
                />
              </div>

              {/* Right: sticky detail panel */}
              <div className="sticky top-6 self-start">
                <TransferDetailPanel
                  entry={selected}
                  canManage={canManage}
                  hasConflict={hasConflict}
                  onOffer={setOfferTarget}
                  windowOpen={windowOpen}
                />
              </div>
            </div>

            {/* Mobile/Tablet: single column */}
            <div className="lg:hidden space-y-4">
              <TransferFilters
                search={search} onSearch={setSearch}
                position={positionFilter} onPosition={setPositionFilter}
                statusFilter={statusFilter} onStatus={setStatusFilter}
                platform={platformFilter} onPlatform={setPlatformFilter}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <span>{filteredEntries.length} player{filteredEntries.length !== 1 ? "s" : ""} found</span>
                <span className="flex gap-3">
                  <span className="text-success font-medium">{freeAgents.length} free</span>
                  <span className="text-warning font-medium">{expiringPlayers.length} expiring</span>
                </span>
              </div>
              <TransferPlayerList
                players={filteredEntries}
                selectedId={selected?.player?.id}
                onSelect={setSelected}
                canManage={canManage}
                hasConflict={hasConflict}
                onOffer={setOfferTarget}
              />
            </div>

            {/* Mobile slide-up detail panel */}
            {selected && (
              <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
                <div
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                  onClick={() => setSelected(null)}
                />
                <div className="relative bg-background rounded-t-2xl shadow-2xl max-h-[88vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
                  {/* Handle bar + close */}
                  <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border shrink-0">
                    <div className="w-10 h-1 rounded-full bg-border absolute left-1/2 -translate-x-1/2 top-2" />
                    <span className="text-sm font-semibold text-foreground">Player Details</span>
                    <button
                      onClick={() => setSelected(null)}
                      className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="overflow-y-auto flex-1">
                    <TransferDetailPanel
                      entry={selected}
                      canManage={canManage}
                      hasConflict={hasConflict}
                      onOffer={e => { setOfferTarget(e); setSelected(null); }}
                      windowOpen={windowOpen}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Offer dialog */}
      <OfferContractDialog
        open={!!offerTarget}
        onClose={() => setOfferTarget(null)}
        player={offerTarget?.player || offerTarget}
        existingActiveContract={offerTarget ? (hasConflict((offerTarget.player || offerTarget)?.id) ? true : null) : null}
        onOffer={handleOffer}
        windowOpen={windowOpen}
      />
    </div>
  );
}
import { useState, useEffect, useMemo } from "react";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import { TrendingUp, X } from "lucide-react";
import OfferContractDialog from "@/components/contracts/OfferContractDialog";
import TransferWindowBanner from "@/components/transfer/TransferWindowBanner";
import TransferFilters from "@/components/transfer/TransferFilters";
import TransferPlayerList from "@/components/transfer/TransferPlayerList";
import TransferDetailPanel from "@/components/transfer/TransferDetailPanel";
import { ensureContractOfferInbox } from "@/lib/contractOfferDelivery";
import { CONTRACT_TYPES } from "@/lib/contractTypes";
import { isTransferWindowOpen } from "@/lib/transferWindow";
import { canShowContractOfferButton, getContractOfferBlockReason } from "@/lib/contractOfferVisibility";
import { buildTransferMarketEntries, normalizeTransferMarketPlayers } from "@/lib/transferMarketEntries";
import { useTranslation } from "@/hooks/useTranslation";

export default function TransferMarket() {
  const { t } = useTranslation();
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
      const { user, player, club } = await resolveMyPlayerAndClub();

      const marketRes = await stageClient.functions.invoke("getTransferMarket", {}).catch(() => ({ data: {} }));
      const normalizedMarket = normalizeTransferMarketPlayers(marketRes?.data || {});

      setMyPlayer(player);
      setFreeAgents(normalizedMarket.freeAgents);
      setExpiringPlayers(normalizedMarket.expiringPlayers);
      setCurrentWindow(marketRes?.data?.current_window || null);

      if (club) {
        const contractArr = await stageClient.entities.PlayerContract.filter({ team_id: club.id }).catch(() => []);
        setMyClub(club);
        setMyContracts(contractArr);
        const isOwner = club?.owner_email === user.email;
        const isManagement = player?.club_roles?.includes("president") || player?.club_roles?.includes("captain");
        setCanManage(isOwner || isManagement || user.role === "admin");
      }
    } catch (err) {
      console.error("[TransferMarket] load failed:", err);
    } finally {
      setLoading(false);
    }
  }

  function getOfferBlockReason(player, entryContract = null) {
    const contracts = entryContract ? [entryContract, ...myContracts] : myContracts;
    return getContractOfferBlockReason({ player, playerContracts: contracts });
  }

  function canOfferPlayer(player, entryContract = null) {
    const contracts = entryContract ? [entryContract, ...myContracts] : myContracts;
    return canManage && canShowContractOfferButton({ player, viewerClub: myClub, playerContracts: contracts });
  }

  async function handleOffer({ contract_type, offer_note, weekly_salary_stc, signing_bonus_stc, transfer_fee_stc, performance_targets, captaincy_offered }) {
    if (!offerTarget || !myClub) return;
    const targetPlayer = offerTarget.player || offerTarget;
    const result = await stageClient.functions.invoke("contractActions", {
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
    const contractId = result?.data?.contract_id || result?.contract_id;
    const typeMeta = CONTRACT_TYPES[contract_type] || CONTRACT_TYPES.squad;
    // Contract offer delivery is also handled server-side. Keep this fallback
    // idempotent until every contract entry point uses one canonical endpoint.
    if (contractId) {
      await ensureContractOfferInbox({
        contractId,
        player: targetPlayer,
        club: myClub,
        contractType: contract_type,
        maxGames: typeMeta.max_games,
        maxDays: typeMeta.max_days,
        weeklySalary: weekly_salary_stc,
        signingBonus: signing_bonus_stc,
        offerNote: offer_note,
        senderEmail: myPlayer?.email,
      }).catch((err) => console.warn("[TransferMarket] inbox fallback failed:", err?.message || err));
    }
    const updated = await stageClient.entities.PlayerContract.filter({ team_id: myClub.id });
    setMyContracts(updated);
    setOfferTarget(null);
  }

  // Build unified flat list
  const allEntries = useMemo(() => {
    return buildTransferMarketEntries(freeAgents, expiringPlayers);
  }, [freeAgents, expiringPlayers]);

  // Filtered list
  const filteredEntries = useMemo(() => {
    return allEntries.filter(({ player, badgeType }) => {
      if (search && !player.gamertag?.toLowerCase().includes(search.toLowerCase())) return false;
      if (positionFilter && player.position !== positionFilter && player.secondary_position !== positionFilter) return false;
      if (platformFilter && player.platform !== platformFilter) return false;
      if (statusFilter === "free_agent" && badgeType !== "free_agent") return false;
      if (statusFilter === "expiring" && badgeType !== "expiring" && badgeType !== "expiring_soon") return false;
      return true;
    });
  }, [allEntries, search, positionFilter, statusFilter, platformFilter]);

  const windowOpen = isTransferWindowOpen(currentWindow);

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
              {t("commonPages.transferTitle")}
            </h1>
            <p className="font-subtitle text-xs text-muted-foreground mt-2">{t("commonPages.transferSubtitle")}</p>
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
                  <span>{t("commonPages.playersFound", { count: filteredEntries.length, plural: filteredEntries.length !== 1 ? "s" : "" })}</span>
                  <span className="flex gap-3">
                    <span className="text-success font-medium">{t("commonPages.freeAgentsShort", { count: freeAgents.length })}</span>
                    <span className="text-warning font-medium">{t("commonPages.expiringShort", { count: expiringPlayers.length })}</span>
                  </span>
                </div>
                <TransferPlayerList
                  players={filteredEntries}
                  selectedId={selected?.player?.id}
                  onSelect={setSelected}
                  canManage={canManage}
                  canOffer={canOfferPlayer}
                  getOfferBlockReason={getOfferBlockReason}
                  onOffer={setOfferTarget}
                />
              </div>

              {/* Right: sticky detail panel */}
              <div className="sticky top-6 self-start">
                <TransferDetailPanel
                  entry={selected}
                  canManage={canManage}
                  canOffer={canOfferPlayer}
                  getOfferBlockReason={getOfferBlockReason}
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
                <span>{t("commonPages.playersFound", { count: filteredEntries.length, plural: filteredEntries.length !== 1 ? "s" : "" })}</span>
                <span className="flex gap-3">
                  <span className="text-success font-medium">{t("commonPages.freeShort", { count: freeAgents.length })}</span>
                  <span className="text-warning font-medium">{t("commonPages.expiringShort", { count: expiringPlayers.length })}</span>
                </span>
              </div>
              <TransferPlayerList
                players={filteredEntries}
                selectedId={selected?.player?.id}
                onSelect={setSelected}
                canManage={canManage}
                canOffer={canOfferPlayer}
                getOfferBlockReason={getOfferBlockReason}
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
                    <span className="text-sm font-semibold text-foreground">{t("commonPages.playerDetails")}</span>
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
                      canOffer={canOfferPlayer}
                      getOfferBlockReason={getOfferBlockReason}
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
        existingActiveContract={null}
        playerContracts={offerTarget ? myContracts.filter(c => getContractTargetPlayerId(c) === (offerTarget.player || offerTarget)?.id) : []}
        onOffer={handleOffer}
        windowOpen={windowOpen}
        club={myClub}
      />
    </div>
  );
}

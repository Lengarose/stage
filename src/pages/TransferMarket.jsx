import { useState, useEffect, useMemo, useCallback } from "react";
import { LayoutList, SlidersHorizontal, Images } from "lucide-react";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import OfferContractDialog from "@/components/contracts/OfferContractDialog";
import RequestLoanDialog from "@/components/transfer/RequestLoanDialog";
import TransferWindowBanner from "@/components/transfer/TransferWindowBanner";
import TransferFilters from "@/components/transfer/TransferFilters";
import TransferPlayerCarousel from "@/components/transfer/TransferPlayerCarousel";
import TransferPlayerList from "@/components/transfer/TransferPlayerList";
import TransferDetailPanel from "@/components/transfer/TransferDetailPanel";
import { ensureContractOfferInbox } from "@/lib/contractOfferDelivery";
import { CONTRACT_TYPES } from "@/lib/contractTypes";
import { getContractTargetPlayerId, normalizePlayerContracts } from "@/lib/playerContractFields";
import { canShowContractOfferButton, canShowLoanRequestButton, getContractOfferBlockReason } from "@/lib/contractOfferVisibility";
import { buildTransferMarketEntries, normalizeTransferMarketPlayers } from "@/lib/transferMarketEntries";
import { canManageClubIdentity } from "@/lib/clubPresidentAccess";
import { canCreateContractOffer } from "@/lib/transferWindowAccess";
import { useTransferWindowStatus } from "@/lib/useTransferWindowStatus";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function TransferMarket() {
  const { t } = useTranslation();
  const { currentWindow, windowOpen } = useTransferWindowStatus();
  const [loading, setLoading] = useState(true);
  const [freeAgents, setFreeAgents] = useState([]);
  const [expiringPlayers, setExpiringPlayers] = useState([]);
  const [liveLoans, setLiveLoans] = useState([]);
  const [myPlayer, setMyPlayer] = useState(null);
  const [myClub, setMyClub] = useState(null);
  const [myContracts, setMyContracts] = useState([]);
  const [canManage, setCanManage] = useState(false);

  // UI state
  const [selected, setSelected] = useState(null); // { player, badgeType, contract, days_left }
  const [offerTarget, setOfferTarget] = useState(null);
  const [loanTarget, setLoanTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "free_agent" | "expiring"
  const [platformFilter, setPlatformFilter] = useState("");
  const [viewMode, setViewMode] = useState("carousel"); // "carousel" | "list"
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { user, player, club: resolvedClub, presidentClub, activeRoles = [] } = await resolveMyPlayerAndClub();

      // Offering a contract is a president action, so it has to be made on behalf
      // of the club this account presides over. `resolvedClub` is NOT that club:
      // it is the club the account *plays* for whenever it has one, and the
      // president club only fills in when there is no player club. For anyone who
      // both plays for one club and presides over another, using it sends the
      // offer from the wrong club — the header shows one name while the request
      // carries another id, and the server rightly refuses.
      const club = presidentClub || resolvedClub;

      const marketRes = await stageClient.functions.invoke("getTransferMarket", {}).catch(() => ({ data: {} }));
      const normalizedMarket = normalizeTransferMarketPlayers(marketRes?.data || {});

      setMyPlayer(player);
      setFreeAgents(normalizedMarket.freeAgents);
      setExpiringPlayers(normalizedMarket.expiringPlayers);
      setLiveLoans(normalizedMarket.liveLoans);

      if (club) {
        const contractArr = await stageClient.entities.PlayerContract.filter({ team_id: club.id }).catch(() => []);
        setMyClub(club);
        setMyContracts(normalizePlayerContracts(contractArr));
        const isManagement = player?.club_roles?.includes("president") || player?.club_roles?.includes("captain");
        setCanManage(canManageClubIdentity({ user, club, presidentClub, activeRoles }) || isManagement);
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
    return canManage && canCreateContractOffer(windowOpen) && canShowContractOfferButton({ player, viewerClub: myClub, playerContracts: contracts });
  }

  function canRequestLoanForPlayer(player, entryContract = null) {
    const contracts = entryContract ? [entryContract, ...myContracts] : myContracts;
    return canManage && canShowLoanRequestButton({
      player,
      viewerClub: myClub,
      playerContracts: contracts,
      loans: liveLoans,
    });
  }

  async function handleOffer({ contract_type, offer_note, weekly_salary_stc, signing_bonus_stc, transfer_fee_stc, performance_targets, captaincy_offered }) {
    if (!offerTarget || !myClub) return;
    if (!canCreateContractOffer(windowOpen)) return;
    const targetPlayer = offerTarget.player || offerTarget;
    const result = await stageClient.functions.invoke("contractActions", {
      action: "offer",
      team_id: myClub.id,
      target_player_id: targetPlayer.id,
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
        senderEmail: myClub?.owner_email,
      }).catch((err) => console.warn("[TransferMarket] inbox fallback failed:", err?.message || err));
    }
    const updated = await stageClient.entities.PlayerContract.filter({ team_id: myClub.id });
    setMyContracts(normalizePlayerContracts(updated));
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

  useEffect(() => {
    if (filteredEntries.length === 0) {
      setSelected(null);
      return;
    }
    setSelected((prev) => {
      const match = prev && filteredEntries.find((entry) => entry.player.id === prev.player.id);
      return match || filteredEntries[0];
    });
  }, [filteredEntries]);

  const selectEntry = useCallback((entry, { openDetails = false } = {}) => {
    setSelected(entry);
    if (openDetails) setDetailsOpen(true);
  }, []);

  const filterCount = [search, positionFilter, platformFilter].filter(Boolean).length
    + (statusFilter !== "all" ? 1 : 0);

  const headerBtn = "h-9 gap-2 rounded-sm font-heading text-xs font-black uppercase tracking-[0.16em]";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-transparent text-white">
      <div className="shrink-0 border-b border-[#f5c542]/20 bg-[#071018]/80 px-4 py-3 sm:px-6 backdrop-blur-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#00e5ff]">Transfer Hub</p>
            <h1
              className="font-heading text-4xl font-black uppercase leading-none text-white md:text-5xl"
              style={{ letterSpacing: "0.04em" }}
            >
              {t("commonPages.transferTitle")}
            </h1>
            <p className="mt-1 text-xs text-white/45">
              {t("commonPages.playersFound", { count: filteredEntries.length, plural: filteredEntries.length !== 1 ? "s" : "" })}
              <span className="mx-2 text-white/20">·</span>
              <span className="text-[#7cff6b]">{t("commonPages.freeShort", { count: freeAgents.length })}</span>
              <span className="mx-2 text-white/20">·</span>
              <span className="text-[#f5c542]">{t("commonPages.expiringShort", { count: expiringPlayers.length })}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              onClick={() => setViewMode("carousel")}
              className={cn(
                headerBtn,
                viewMode === "carousel"
                  ? "bg-gradient-to-b from-[#ffe27a] to-[#c9a227] text-black hover:from-[#fff0a8] hover:to-[#d4ad30]"
                  : "border border-[#f5c542]/40 bg-black/40 text-[#f5c542] hover:bg-[#f5c542]/10"
              )}
            >
              <Images className="h-4 w-4" />
              {t("commonPages.transferCarousel")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setViewMode("list")}
              className={cn(
                headerBtn,
                viewMode === "list"
                  ? "border-transparent bg-gradient-to-b from-[#ffe27a] to-[#c9a227] text-black hover:from-[#fff0a8] hover:to-[#d4ad30]"
                  : "border-[#00e5ff]/40 bg-black/40 text-[#00e5ff] hover:bg-[#00e5ff]/10"
              )}
            >
              <LayoutList className="h-4 w-4" />
              {t("commonPages.transferList")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFiltersOpen(true)}
              className={cn(headerBtn, "relative border-[#00e5ff]/40 bg-black/40 text-[#00e5ff] hover:bg-[#00e5ff]/10")}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {t("commonPages.transferFilters")}
              {filterCount > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#00e5ff] px-1 text-[10px] font-semibold leading-none text-black">
                  {filterCount}
                </span>
              ) : null}
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#f5c542]/20 border-t-[#f5c542]" />
        </div>
      ) : viewMode === "list" ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6">
          <TransferPlayerList
            players={filteredEntries}
            selectedId={selected?.player?.id}
            onSelect={(entry) => selectEntry(entry, { openDetails: true })}
            canManage={canManage}
            canOffer={canOfferPlayer}
            getOfferBlockReason={getOfferBlockReason}
            onOffer={setOfferTarget}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden">
          <TransferPlayerCarousel
            entries={filteredEntries}
            selectedId={selected?.player?.id}
            onSelect={selectEntry}
          />
        </div>
      )}

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-[#f5c542]/20 bg-[#071018] p-0 text-white">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle className="font-heading text-sm font-black uppercase tracking-[0.18em] text-[#00e5ff]">
              {t("commonPages.transferFilters")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-5 pb-5">
            <TransferWindowBanner window={currentWindow} />
            <TransferFilters
              search={search} onSearch={setSearch}
              position={positionFilter} onPosition={setPositionFilter}
              statusFilter={statusFilter} onStatus={setStatusFilter}
              platform={platformFilter} onPlatform={setPlatformFilter}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-[#f5c542]/20 bg-[#071018] p-0 text-white">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle className="font-heading text-sm font-black uppercase tracking-[0.18em] text-[#f5c542]">
              {t("commonPages.playerDetails")}
            </DialogTitle>
          </DialogHeader>
          <TransferDetailPanel
            entry={selected}
            canManage={canManage}
            canOffer={canOfferPlayer}
            canRequestLoan={selected ? canRequestLoanForPlayer(selected.player, selected.contract) : false}
            getOfferBlockReason={getOfferBlockReason}
            onOffer={(target) => { setDetailsOpen(false); setOfferTarget(target); }}
            onRequestLoan={(target) => { setDetailsOpen(false); setLoanTarget(target); }}
            windowOpen={windowOpen}
          />
        </DialogContent>
      </Dialog>

      <OfferContractDialog
        open={!!offerTarget}
        onClose={() => setOfferTarget(null)}
        player={offerTarget?.player || offerTarget}
        existingActiveContract={null}
        playerContracts={offerTarget ? myContracts.filter(c => getContractTargetPlayerId(c) === (offerTarget.player || offerTarget)?.id) : []}
        clubContracts={myContracts}
        onOffer={handleOffer}
        windowOpen={windowOpen}
        club={myClub}
      />
      <RequestLoanDialog
        open={!!loanTarget}
        onClose={() => setLoanTarget(null)}
        player={loanTarget?.player || loanTarget}
        club={myClub}
      />
    </div>
  );
}

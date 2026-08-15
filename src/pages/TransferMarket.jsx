import { useState, useEffect, useMemo, useCallback } from "react";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import OfferContractDialog from "@/components/contracts/OfferContractDialog";
import RequestLoanDialog from "@/components/transfer/RequestLoanDialog";
import TransferWindowBanner from "@/components/transfer/TransferWindowBanner";
import TransferFilters from "@/components/transfer/TransferFilters";
import TransferPlayerCarousel from "@/components/transfer/TransferPlayerCarousel";
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

export default function TransferMarket() {
  const { t } = useTranslation();
  const { currentWindow, windowOpen } = useTransferWindowStatus();
  const [loading, setLoading] = useState(true);
  const [freeAgents, setFreeAgents] = useState([]);
  const [expiringPlayers, setExpiringPlayers] = useState([]);
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
    return canManage && canShowLoanRequestButton({ player, viewerClub: myClub, playerContracts: contracts });
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

  const selectEntry = useCallback((entry) => {
    setSelected(entry);
  }, []);

  return (
    <div className="min-h-full bg-[#05080f] text-white">
      <div className="border-b border-[#f5c542]/20 bg-gradient-to-r from-[#071018] via-[#0a1628] to-[#071018] px-4 py-5 sm:px-6">
        <p className="font-heading text-[10px] font-black uppercase tracking-[0.32em] text-[#00e5ff]">Transfer Hub</p>
        <h1 className="font-heading text-4xl font-black uppercase leading-none text-white md:text-6xl">
          {t("commonPages.transferTitle")}
        </h1>
        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/45">
          {t("commonPages.transferSubtitle")}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#f5c542]/20 border-t-[#f5c542]" />
        </div>
      ) : (
        <div>
          <div className="px-4 py-4 sm:px-6">
            <TransferWindowBanner window={currentWindow} />
          </div>
          <div className="border-y border-white/10 bg-black/30 px-4 py-4 sm:px-6">
            <TransferFilters
              search={search} onSearch={setSearch}
              position={positionFilter} onPosition={setPositionFilter}
              statusFilter={statusFilter} onStatus={setStatusFilter}
              platform={platformFilter} onPlatform={setPlatformFilter}
            />
            <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-white/45">
              <span>{t("commonPages.playersFound", { count: filteredEntries.length, plural: filteredEntries.length !== 1 ? "s" : "" })}</span>
              <span className="flex gap-4">
                <span className="text-[#7cff6b]">{t("commonPages.freeAgentsShort", { count: freeAgents.length })}</span>
                <span className="text-[#f5c542]">{t("commonPages.expiringShort", { count: expiringPlayers.length })}</span>
              </span>
            </div>
          </div>

          <TransferPlayerCarousel
            entries={filteredEntries}
            selectedId={selected?.player?.id}
            onSelect={selectEntry}
          />

          <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
            <TransferDetailPanel
              entry={selected}
              canManage={canManage}
              canOffer={canOfferPlayer}
              canRequestLoan={selected ? canRequestLoanForPlayer(selected.player, selected.contract) : false}
              getOfferBlockReason={getOfferBlockReason}
              onOffer={setOfferTarget}
              onRequestLoan={setLoanTarget}
              windowOpen={windowOpen}
            />
          </div>
        </div>
      )}

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

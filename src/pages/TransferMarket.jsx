import { useState, useEffect, useMemo, useCallback } from "react";
import { LayoutGrid, LayoutList, Search } from "lucide-react";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import OfferContractDialog from "@/components/contracts/OfferContractDialog";
import TransferWindowBanner from "@/components/transfer/TransferWindowBanner";
import TransferWindowDeadline from "@/components/transfer/TransferWindowDeadline";
import TransferRoomHero from "@/components/transfer/TransferRoomHero";
import TransferTalentBoard from "@/components/transfer/TransferTalentBoard";
import TransferRecruitmentPanel from "@/components/transfer/TransferRecruitmentPanel";
import { transferRoomPresentation, TRANSFER_ROOM_ACCENTS } from "@/lib/transferRoomPresentation";
import "@/components/transfer/transfer-room.css";
import { getContractTargetPlayerId, normalizePlayerContracts } from "@/lib/playerContractFields";
import { canShowContractOfferButton, getContractOfferBlockReason } from "@/lib/contractOfferVisibility";
import { buildTransferMarketEntries, normalizeTransferMarketPlayers } from "@/lib/transferMarketEntries";
import { canManageClubIdentity } from "@/lib/clubPresidentAccess";
import { canCreateContractOffer } from "@/lib/transferWindowAccess";
import { useTransferWindowStatus } from "@/lib/useTransferWindowStatus";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function TransferMarket() {
  const { currentWindow, windowOpen, offersAvailable, officialRecruitment } = useTransferWindowStatus();
  const [loading, setLoading] = useState(true);
  const [freeAgents, setFreeAgents] = useState([]);
  const [expiringPlayers, setExpiringPlayers] = useState([]);
  const [myClub, setMyClub] = useState(null);
  const [myContracts, setMyContracts] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [roomConfig, setRoomConfig] = useState(null);

  // UI state
  const [selected, setSelected] = useState(null); // { player, badgeType, contract, days_left }
  const [offerTarget, setOfferTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "free_agent" | "expiring"
  const [platformFilter, setPlatformFilter] = useState("");
  const [viewMode, setViewMode] = useState(null); // "cards" | "list"
  const [sort, setSort] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setLoadError("");
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

      const [marketRes, configRows] = await Promise.all([
        stageClient.functions.invoke("getTransferMarket", {}),
        stageClient.entities.TransferRoomConfig.filter({ key: "main" }, "-updated_date", 1).catch(() => []),
      ]);
      const normalizedMarket = normalizeTransferMarketPlayers(marketRes?.data || {});

      setFreeAgents(normalizedMarket.freeAgents);
      setExpiringPlayers(normalizedMarket.expiringPlayers);
      setRoomConfig(configRows?.[0] || null);

      if (club) {
        const contractArr = await stageClient.entities.PlayerContract.filter({ team_id: club.id }).catch(() => []);
        setMyClub(club);
        setMyContracts(normalizePlayerContracts(contractArr));
        const isManagement = player?.club_roles?.includes("president") || player?.club_roles?.includes("captain");
        setCanManage(canManageClubIdentity({ user, club, presidentClub, activeRoles }) || isManagement);
      }
    } catch (err) {
      console.error("[TransferMarket] load failed:", err);
      setLoadError("The player market could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function getOfferBlockReason(player, entryContract = null) {
    const contracts = entryContract ? [entryContract, ...myContracts] : myContracts;
    return getContractOfferBlockReason({ player, playerContracts: contracts, viewerClub: myClub });
  }

  function canOfferPlayer(player, entryContract = null) {
    const contracts = entryContract ? [entryContract, ...myContracts] : myContracts;
    const futureOffer = entryContract && expiringPlayers.some(entry=>entry.player.id===player.id);
    return canManage && (futureOffer || canCreateContractOffer(offersAvailable)) && canShowContractOfferButton({ player, viewerClub: myClub, playerContracts: contracts });
  }



  // Build unified flat list
  const allEntries = useMemo(() => {
    return buildTransferMarketEntries(freeAgents, expiringPlayers);
  }, [freeAgents, expiringPlayers]);

  const presentation = transferRoomPresentation(roomConfig || {});
  const activeSort = sort || presentation.default_sort;
  const activeView = viewMode || presentation.default_view;

  // Filtered list
  const filteredEntries = useMemo(() => {
    return allEntries.filter(({ player, badgeType }) => {
      if (search && !player.gamertag?.toLowerCase().includes(search.toLowerCase())) return false;
      if (positionFilter && player.position !== positionFilter && player.secondary_position !== positionFilter) return false;
      if (platformFilter) {
        const value=String(player.platform || '').toLowerCase();
        const matches=platformFilter==='PlayStation' ? /playstation|ps[45]/.test(value) : platformFilter==='Xbox' ? /xbox/.test(value) : value==='pc';
        if(!matches)return false;
      }
      if (statusFilter === "free_agent" && badgeType !== "free_agent") return false;
      if (statusFilter === "expiring" && badgeType !== "expiring" && badgeType !== "expiring_soon") return false;
      return true;
    }).sort((a,b) => activeSort === "name" ? String(a.player.gamertag || "").localeCompare(String(b.player.gamertag || "")) : activeSort === "form" ? Number(b.player.avg_match_rating || 0)-Number(a.player.avg_match_rating || 0) : (Date.parse(b.player.created_date) || 0)-(Date.parse(a.player.created_date) || 0));
  }, [allEntries, search, positionFilter, statusFilter, platformFilter, activeSort]);

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

  return (
    <div className="transfer-room" style={{'--tr-accent':TRANSFER_ROOM_ACCENTS[presentation.accent],'--tr-button-ink':presentation.accent==='gold'?'#071020':'#fff'}}>
      <TransferRoomHero presentation={presentation} freeCount={freeAgents.length} expiringCount={expiringPlayers.length} canManage={canManage} clubName={myClub?.name} windowOpen={windowOpen} currentWindow={currentWindow}/>
      <section id="transfer-talent" className="tr-market-wrap" aria-label="Transfer player market">
        <TransferWindowDeadline window={currentWindow} windowOpen={windowOpen}/>
        <div className="tr-market-heading"><div><p className="tr-kicker">SCOUT. CONNECT. SIGN.</p><h2>Find your next game changer.</h2></div><span className="tr-rule-note">{loading?'Loading players…':`${filteredEntries.length} player${filteredEntries.length===1?'':'s'} in your search`}</span></div>
        <div className="tr-toolbar"><div className="tr-categories" aria-label="Player availability">{[{key:'all',label:'All players',count:allEntries.length},{key:'free_agent',label:'Free agents',count:freeAgents.length},{key:'expiring',label:'Expiring · final 14 days',count:expiringPlayers.length}].map(item=><button type="button" key={item.key} className={statusFilter===item.key?'is-active':''} aria-pressed={statusFilter===item.key} onClick={()=>setStatusFilter(item.key)}>{item.label}<small>{item.count}</small></button>)}</div><div className="tr-view-modes" aria-label="Player presentation"><button type="button" className={activeView==='cards'?'is-active':''} aria-pressed={activeView==='cards'} onClick={()=>setViewMode('cards')}><LayoutGrid size={16}/> Showcase</button><button type="button" className={activeView==='list'?'is-active':''} aria-pressed={activeView==='list'} onClick={()=>setViewMode('list')}><LayoutList size={16}/> Directory</button></div></div>
        <div className="tr-filters"><label className="tr-search"><Search size={17}/><input aria-label="Search players by name" placeholder="Find a player by name…" value={search} onChange={e=>setSearch(e.target.value)}/></label><select aria-label="Player position" value={positionFilter} onChange={e=>setPositionFilter(e.target.value)}><option value="">All positions</option>{['GK','CB','LB','RB','CDM','CM','CAM','LM','RM','LW','RW','ST','CF'].map(p=><option key={p}>{p}</option>)}</select><select aria-label="Player platform" value={platformFilter} onChange={e=>setPlatformFilter(e.target.value)}><option value="">All platforms</option>{['PlayStation','Xbox','PC'].map(p=><option key={p}>{p}</option>)}</select><select aria-label="Sort players" value={activeSort} onChange={e=>setSort(e.target.value)}><option value="recent">Newest profiles</option><option value="name">Name: A–Z</option><option value="form">Match rating</option></select></div>
        {loadError?<div className="tr-error" role="alert">{loadError}<button type="button" className="ml-4 underline" onClick={load}>Retry</button></div>:null}
        {loading?<div className="tr-market-loading" role="status">Opening the recruitment desk…</div>:!loadError&&<div className="tr-market-layout"><div><TransferTalentBoard entries={filteredEntries} viewMode={activeView} selected={selected} onSelect={entry=>selectEntry(entry,{openDetails:window.matchMedia('(max-width: 900px)').matches})}/></div><aside aria-label="Selected player"><TransferRecruitmentPanel entry={selected} canManage={canManage} canOffer={canOfferPlayer} getOfferBlockReason={getOfferBlockReason} onOffer={setOfferTarget} officialRecruitment={officialRecruitment} windowOpen={windowOpen}/></aside></div>}
        <details className="mt-7 border-t border-white/10 pt-4"><summary className="cursor-pointer py-2 text-sm text-slate-300">How recruitment works</summary><div className="mt-4 max-w-3xl space-y-4"><p className="tr-rule-note">Explore the market, open a player dossier and review their profile. Managers send offers on behalf of their club. The player reviews and negotiates the proposed terms in their inbox. Recruitment is contract-only: there is no purchase price or transfer fee. Expiring players appear only in their final 14 days. Accepted future agreements start after the current agreement ends.</p><TransferWindowBanner officialRecruitment={officialRecruitment} window={currentWindow}/></div></details>
      </section>
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}><DialogContent className="max-h-[85svh] max-w-lg overflow-y-auto rounded-none border-white/20 bg-[#080e20] p-0 text-white"><DialogHeader className="px-6 pt-6"><DialogTitle>Player dossier</DialogTitle></DialogHeader><div className="transfer-room" style={{'--tr-accent':TRANSFER_ROOM_ACCENTS[presentation.accent],'--tr-button-ink':presentation.accent==='gold'?'#071020':'#fff'}}><TransferRecruitmentPanel entry={selected} canManage={canManage} canOffer={canOfferPlayer} getOfferBlockReason={getOfferBlockReason} onOffer={target=>{setDetailsOpen(false);setOfferTarget(target);}} officialRecruitment={officialRecruitment} windowOpen={windowOpen}/></div></DialogContent></Dialog>

      <OfferContractDialog
        open={!!offerTarget}
        onClose={() => setOfferTarget(null)}
        player={offerTarget?.player || offerTarget}
        existingActiveContract={null}
        playerContracts={offerTarget ? myContracts.filter(c => getContractTargetPlayerId(c) === (offerTarget.player || offerTarget)?.id) : []}
        clubContracts={myContracts}
        onProposalCreated={() => load()}
        officialRecruitment={officialRecruitment}
        windowOpen={windowOpen}
        club={myClub}
      />
    </div>
  );
}

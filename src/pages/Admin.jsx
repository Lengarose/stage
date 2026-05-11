import { useState, useEffect, useRef, useMemo } from "react";
// Admin sub-components (separation of concerns — moved out of this file)
import AdminStat from "@/components/admin/shared/AdminStat";
import EmptyState from "@/components/admin/shared/EmptyState";
import DisputesTab from "@/components/admin/sections/DisputesTab";
import ForfeitsTab from "@/components/admin/sections/ForfeitsTab";
import PlayersTab from "@/components/admin/sections/PlayersTab";
import ClubsTab from "@/components/admin/sections/ClubsTab";
import RankingsTab from "@/components/admin/sections/RankingsTab";
import LeaguesTab from "@/components/admin/sections/LeaguesTab";
import TournamentsTab from "@/components/admin/sections/TournamentsTab";
import NewsTab from "@/components/admin/sections/NewsTab";
import PressConferencesTab from "@/components/admin/sections/PressConferencesTab";
import LifestylesTab from "@/components/admin/sections/LifestylesTab";
import TransfersTab from "@/components/admin/sections/TransfersTab";
import TrophiesTab from "@/components/admin/sections/TrophiesTab";
import RewardsTab from "@/components/admin/sections/RewardsTab";
import LandingTab from "@/components/admin/sections/LandingTab";
import HomeTab from "@/components/admin/sections/HomeTab";
import { ADMIN_SECTION_ALIASES } from "@/components/admin/shared/adminConstants";
import { base44 } from "@/api/base44Client";
import { stageClient } from "@/api/stageClient";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import TrophyCarousel from "@/components/tournament/TrophyCarousel";
import { cn } from "@/lib/utils";
import {
  Shield, AlertTriangle, Users, Trophy, Check, X,
  ArrowLeft, Gavel, Flag, Ban, RefreshCw, Coins, Plus, Trash2,
  Newspaper, Upload, Building2, LogIn, Search, TrendingUp,
  Pencil, ChevronDown, ShoppingBag, Ticket, Wallet, Activity,
  ClipboardList, Filter, Zap, DollarSign, History
} from "lucide-react";
import { COUNTRIES } from "../lib/countries";
import { LEAGUE_DEFINITIONS } from "../lib/qualificationConfig";

/** @param {{ forcedSection?: string }} [props] */
export default function Admin(props) {
  const forcedSection = props?.forcedSection;
  const params = useParams();
  const location = useLocation();
  /** Resolve section from dynamic route, wrapper prop, or `/admin/<segment>` path (static admin URLs have no `:section` param). */
  const section = useMemo(() => {
    if (params.section) return params.section;
    if (forcedSection) return forcedSection;
    const m = location.pathname.match(/^\/admin\/([^/]+)\/?$/);
    return m ? m[1] : undefined;
  }, [params.section, forcedSection, location.pathname]);
  const [allowed, setAllowed] = useState(null);
  const [disputes, setDisputes] = useState([]);
  const [forfeits, setForfeits] = useState([]);
  const [players, setPlayers] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [clubSearch, setClubSearch] = useState("");
  const [tournamentSearch, setTournamentSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [resolveDialog, setResolveDialog] = useState(null);
  const [selectedWinner, setSelectedWinner] = useState("");
  const [creditsDialog, setCreditsDialog] = useState(null);
  const [creditsAmount, setCreditsAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  function takeControl(club) {
    localStorage.setItem('admin_takeover_club_id', club.id);
    localStorage.setItem('stage_admin_effective_role_id', '1');
    localStorage.setItem('stage-account-mode', 'club');
    navigate(`/clubs/${club.id}`);
  }

  // Tournament creation
  const [createTournamentOpen, setCreateTournamentOpen] = useState(false);
  const [tournamentForm, setTournamentForm] = useState({
    name: "", type: "knockout", participant_type: "club", platform: "PlayStation",
    region: "Global", country_code: "", max_teams: 8, start_date: "", description: "", prize_description: "",
    entry_credits: 50, win_credits: 200, custom_rules: "",
    prize_winner_stc: "", prize_runner_up_stc: "", prize_semi_final_stc: "", prize_participation_stc: "",
  });
  const [rulesFile, setRulesFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerColor, setBannerColor] = useState("#1e2a3a");
  const [adminTrophyFile, setAdminTrophyFile] = useState(null);
  const BANNER_COLORS = ["#1e2a3a","#1a3a1a","#3a1a0a","#3a1a1a","#2a1a3a","#1a253a","#2a2a2a","#2a2a0a","#0a2a2a","#3a0a2a"];

  // Trophy manager
  const [trophyItems, setTrophyItems] = useState([]);
  const [newTrophyName, setNewTrophyName] = useState("");
  const [newTrophyFile, setNewTrophyFile] = useState(null);
  const [newTrophyAdminOnly, setNewTrophyAdminOnly] = useState(false);
  const [uploadingTrophy, setUploadingTrophy] = useState(false);
  const [trophyUploadError, setTrophyUploadError] = useState(null);
  const trophyFileRef = useRef(null);

  // Admin create tournament extras
  const [adminEntryType, setAdminEntryType] = useState("free"); // "free" | "stc"
  const [adminTrophyItemId, setAdminTrophyItemId] = useState("");

  // News creation
  const [newsForm, setNewsForm] = useState({ title: "", body: "", type: "app_update", image_url: "" });
  const [newsImageFile, setNewsImageFile] = useState(null);
  const [uploadingNews, setUploadingNews] = useState(false);

  // Competitions / Leagues tab
  const [competitions, setCompetitions] = useState([]);
  const [compSeasons, setCompSeasons] = useState([]);
  const [qualEntries, setQualEntries] = useState([]);
  const [seedingComps, setSeedingComps] = useState(false);
  const [newSeasonForm, setNewSeasonForm] = useState({ competition_id: "", platform: "Cross-Platform", region: "Global", prize_pool_stc: "", num_clubs: 36, num_league_matchdays: 8 });
  const [expiredFixtures, setExpiredFixtures] = useState([]);
  const [schedulingAdminBusy, setSchedulingAdminBusy] = useState(null);
  const [creatingLeagueSeason, setCreatingLeagueSeason] = useState(false);
  const [regionalLeagues, setRegionalLeagues] = useState([]);
  const [seedingRegionalLeagues, setSeedingRegionalLeagues] = useState(false);
  const [processingLeagueEnd, setProcessingLeagueEnd] = useState(null);

  // Competition & league inline editing
  const [editingComp, setEditingComp]       = useState(null);
  const [compEditForm, setCompEditForm]     = useState({});
  const [savingComp, setSavingComp]         = useState(false);
  const [editingLeague, setEditingLeague]   = useState(null);
  const [leagueEditForm, setLeagueEditForm] = useState({});
  const [savingLeague, setSavingLeague]     = useState(false);

  // Fixtures panel
  const [fixturesOpen, setFixturesOpen]               = useState(false);
  const [fixturesPanel, setFixturesPanel]             = useState(null);
  const [fixturesList, setFixturesList]               = useState([]);
  const [loadingFixtures, setLoadingFixtures]         = useState(false);
  const [selectedFixtureSeason, setSelectedFixtureSeason] = useState("");
  const [selectedFixtureLeague, setSelectedFixtureLeague] = useState("");

  // Standings panel
  const [standingsOpen, setStandingsOpen]                 = useState(false);
  const [standingsPanel, setStandingsPanel]               = useState(null);
  const [standingsList, setStandingsList]                 = useState([]);
  const [loadingStandings, setLoadingStandings]           = useState(false);
  const [selectedStandingsSeason, setSelectedStandingsSeason] = useState("");
  const [selectedStandingsLeague, setSelectedStandingsLeague] = useState("");

  // Result entry dialog
  const [resultDialog, setResultDialog]   = useState(null);
  const [resultForm, setResultForm]       = useState({ home_score: "", away_score: "" });
  const [savingResult, setSavingResult]   = useState(false);

  // Season registration applications
  const [regApplications, setRegApplications]     = useState([]);
  const [regAppFilter,    setRegAppFilter]         = useState("actionable"); // "actionable" | "all"
  const [approveRegDialog, setApproveRegDialog]   = useState(null); // { reg }
  const [approveTargetId,  setApproveTargetId]    = useState("");
  const [rejectNotesDialog, setRejectNotesDialog] = useState(null); // { reg, action: "reject"|"waitlist" }
  const [rejectNotes,       setRejectNotes]       = useState("");
  const [processingReg,     setProcessingReg]     = useState(false);

  const [adminProfile, setAdminProfile] = useState(null);
  const [pressConferences, setPressConferences] = useState([]);
  const [lifestyleItems, setLifestyleItems] = useState([]);

  // Rewards tab
  const [rewardSource, setRewardSource] = useState(null); // { id, type, name, trophy_image_url }

  useEffect(() => {
    (async () => {
      try {
        const u = await stageClient.auth.me();
        const isAdmin = u?.role === "admin" || Number(u?.role_id) === 0;
        if (!isAdmin) { setAllowed(false); return; }
        setAllowed(true);
        setAdminProfile(u);
        await loadAll();
      } catch {
        setAllowed(false);
      }
    })();
  }, []);

  const adminTab = useMemo(
    () => (section && ADMIN_SECTION_ALIASES[section] ? ADMIN_SECTION_ALIASES[section] : null),
    [section]
  );

  async function loadAll() {
    setLoading(true);
    try {
      const [disputedMatches, allPlayers, allTournaments, allClubs, allTrophies, allComps, allCompSeasons, allQual, allRegLeagues, expiredLeagueFixtures, expiredCompFixtures, allRegApps, allPressConferences, allLifestyleItems] = await Promise.all([
        base44.entities.Match.filter({ status: "disputed" }, "-updated_date", 50).catch(() => []),
        base44.entities.Player.list("-created_date", 100).catch(() => []),
        base44.entities.Tournament.list("-created_date", 200).catch(() => []),
        base44.entities.Club.list("-created_date", 100).catch(() => []),
        base44.entities.TrophyItem.list("sort_order", 100).catch(() => []),
        base44.entities.Competition.list("tier", 10).catch(() => []),
        base44.entities.CompetitionSeason.list("-season_number", 30).catch(() => []),
        base44.entities.QualificationEntry.filter({ status: "pending" }, null, 50).catch(() => []),
        base44.entities.RegionalLeague.list("-season_number", 50).catch(() => []),
        (base44.entities.RegionalLeagueFixture?.filter({ scheduling_status: "expired" }, null, 50) ?? Promise.resolve([])).catch(() => []),
        (base44.entities.CompetitionFixture?.filter({ scheduling_status: "expired" }, null, 50) ?? Promise.resolve([])).catch(() => []),
        (base44.entities.SeasonRegistration?.list("-applied_at", 200) ?? Promise.resolve([])).catch(() => []),
        stageClient.entities.PressConference.list("-created_date", 200).catch(() => []),
        stageClient.entities.LifestyleItem.list("sort_order", 300).catch(() => []),
      ]);
      const forfeitMatches = await stageClient.entities.Match.filter({ forfeit_status: "pending" }, "-updated_date", 50).catch(() => []);
      setDisputes(disputedMatches.map(m => ({ ...m, _source: "tournament" })));
      setForfeits(forfeitMatches);
      setPlayers(allPlayers);
      setClubs(allClubs);
      setTournaments(allTournaments);
      setTrophyItems(allTrophies);
      setCompetitions(allComps);
      setCompSeasons(allCompSeasons);
      setQualEntries(allQual);
      setRegionalLeagues(allRegLeagues);
      setRegApplications(allRegApps);
      setPressConferences(allPressConferences);
      setLifestyleItems(allLifestyleItems);
      setExpiredFixtures([
        ...expiredLeagueFixtures.map(f => ({ ...f, _fixtureType: "regional_league" })),
        ...expiredCompFixtures.map(f => ({ ...f, _fixtureType: "competition" })),
      ]);

      // Load ranking config (non-fatal)
      const cfgRows = await (base44.entities.RankingConfig?.list(null, 10) ?? Promise.resolve([])).catch(() => []);
      const activeCfg = cfgRows.find(r => r.is_active) || cfgRows[0];
      if (activeCfg) {
        setRankingConfigId(activeCfg.id);
        setRankingConfig(activeCfg);
      } else {
        const { DEFAULT_CONFIG } = await import("@/lib/rankingEngine");
        setRankingConfig({ ...DEFAULT_CONFIG, label: "Default", is_active: true });
        setRankingConfigId(null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function createTrophyItem() {
    if (!newTrophyName.trim() || !newTrophyFile) return;
    setUploadingTrophy(true);
    setTrophyUploadError(null);
    try {
      const uploadResult = await base44.integrations.Core.UploadFile({ file: newTrophyFile });
      if (!uploadResult?.file_url) throw new Error("Upload succeeded but no URL was returned.");
      await base44.entities.TrophyItem.create({
        name: newTrophyName.trim(),
        image_url: uploadResult.file_url,
        is_official: true,
        admin_only: newTrophyAdminOnly,
        sort_order: trophyItems.length,
      });
      setNewTrophyName("");
      setNewTrophyFile(null);
      setNewTrophyAdminOnly(false);
      if (trophyFileRef.current) trophyFileRef.current.value = "";
      const updated = await base44.entities.TrophyItem.list("sort_order", 100).catch(() => []);
      setTrophyItems(updated);
    } catch (err) {
      setTrophyUploadError(err?.message || JSON.stringify(err) || "Failed to add trophy. Check console.");
      console.error("createTrophyItem error:", err);
    } finally {
      setUploadingTrophy(false);
    }
  }

  async function deleteTrophyItem(id) {
    if (!confirm("Delete this trophy from the library? It will no longer appear in carousels.")) return;
    await base44.entities.TrophyItem.delete(id);
    setTrophyItems(prev => prev.filter(t => t.id !== id));
  }

  async function resolveDispute() {
    if (!resolveDialog || !selectedWinner) return;
    setSaving(true);
    const m = resolveDialog.match;
    try {
      const isHome = selectedWinner === m.home_club_id;
      await stageClient.functions.invoke("matchKickoff", {
        match_id: m.id,
        action: "admin_resolve",
        admin_resolve_winner: isHome ? "home" : "away",
      });
    } catch {
      // Fallback: direct update
      const isHome = selectedWinner === m.home_club_id;
      const winnerName = isHome ? m.home_club_name : m.away_club_name;
      await stageClient.entities.Match.update(m.id, { status: "completed", winner_club_id: selectedWinner, winner_club_name: winnerName });
    }
    setResolveDialog(null); setSelectedWinner(""); setSaving(false);
    await loadAll();
  }

  async function resolveForfeit(matchId, approve) {
    const m = forfeits.find(f => f.id === matchId);
    if (!m) return;
    if (approve) {
      const winnerId = m.forfeit_claimed_by;
      const winnerName = winnerId === m.home_club_id ? m.home_club_name : m.away_club_name;
      await stageClient.entities.Match.update(matchId, { status: "forfeit", forfeit_status: "approved", winner_club_id: winnerId, winner_club_name: winnerName });
    } else {
      await stageClient.entities.Match.update(matchId, { forfeit_status: "rejected" });
    }
    setForfeits(prev => prev.filter(f => f.id !== matchId));
  }

  async function kickFromClub(playerId) {
    await stageClient.entities.Player.update(playerId, { club_id: null, role: "member", club_roles: ["member"], status: "free_agent" });
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, club_id: null, role: "member", club_roles: ["member"], status: "free_agent" } : p));
  }

  async function deleteClub(clubId) {
    if (!confirm("Are you sure you want to delete this club? This cannot be undone.")) return;
    await stageClient.entities.Club.delete(clubId);
    setClubs(prev => prev.filter(c => c.id !== clubId));
  }

  async function cancelTournament(tournamentId) {
    await stageClient.entities.Tournament.update(tournamentId, { status: "cancelled" });
    setTournaments(prev => prev.filter(t => t.id !== tournamentId));
  }

  async function createTournament() {
    setSaving(true);
    const user = adminProfile;
    let rules_file_url = "";
    let banner_url = "";
    if (rulesFile) {
      const res = await stageClient.integrations.Core.UploadFile({ file: rulesFile });
      rules_file_url = res.file_url;
    }
    if (bannerFile) {
      const res = await stageClient.integrations.Core.UploadFile({ file: bannerFile });
      banner_url = res.file_url;
    }
    let trophy_url = "";
    if (adminTrophyFile) {
      const res = await stageClient.integrations.Core.UploadFile({ file: adminTrophyFile });
      trophy_url = res.file_url;
      // Auto-create TrophyItem in library from uploaded file
      if (!adminTrophyItemId && tournamentForm.name) {
        const created = await base44.entities.TrophyItem.create({
          name: `By STAGE · ${tournamentForm.name}`,
          image_url: trophy_url,
          is_official: true,
          sort_order: trophyItems.length,
        }).catch(() => null);
        if (created?.id) setAdminTrophyItemId(created.id);
      }
    }
    const resolvedTrophyItemId = adminTrophyItemId || null;
    const resolvedTrophyUrl = trophy_url || trophyItems.find(t => t.id === resolvedTrophyItemId)?.image_url || "";
    
    await base44.entities.Tournament.create({
      ...tournamentForm,
      max_teams: Number(tournamentForm.max_teams),
      entry_credits: 0,
      entry_fee_stc: adminEntryType === "stc" ? (Number(tournamentForm.entry_fee_stc) || 0) : 0,
      prize_winner_stc: Number(tournamentForm.prize_winner_stc) || 0,
      prize_runner_up_stc: Number(tournamentForm.prize_runner_up_stc) || 0,
      prize_semi_final_stc: Number(tournamentForm.prize_semi_final_stc) || 0,
      prize_participation_stc: Number(tournamentForm.prize_participation_stc) || 0,
      start_date: new Date(tournamentForm.start_date).toISOString(),
      organizer_email: user.email,
      creator_email: user.email,
      status: "registration",
      current_round: 1,
      registered_clubs: [],
      registered_players: [],
      rules_file_url,
      banner_url: banner_url || "",
      banner_color: !banner_url ? bannerColor : "",
      trophy_url: resolvedTrophyUrl,
      trophy_item_id: resolvedTrophyItemId,
    });
    setCreateTournamentOpen(false);
    setTournamentForm({ name: "", type: "knockout", participant_type: "club", platform: "PlayStation", region: "Global", country_code: "", max_teams: 8, start_date: "", description: "", prize_description: "", entry_fee_stc: 0, custom_rules: "", prize_winner_stc: "", prize_runner_up_stc: "", prize_semi_final_stc: "", prize_participation_stc: "" });
    setRulesFile(null); setBannerFile(null); setBannerColor("#1e2a3a"); setAdminTrophyFile(null);
    setAdminTrophyItemId(""); setAdminEntryType("free");
    setSaving(false);
    await loadAll();
  }

  async function seedCompetitions() {
    if (competitions.length >= 3) { alert("Competitions already seeded."); return; }
    setSeedingComps(true);
    try {
      const defs = [
        { name: "STAGE Supreme League",    slug: "supreme",    tier: 1, primary_color: "#FFD700", description: "The pinnacle of STAGE competition. Only the elite qualify.",          max_clubs_per_season: 36, promotion_spots: 0, relegation_spots: 0, playoff_spots: 16, qualification_spots_per_region: 2, current_season: 1, is_active: true, platform: "Cross-Platform", region: "Global" },
        { name: "STAGE Elite League",      slug: "elite",      tier: 2, primary_color: "#00E5BD", description: "The proving ground. Earn your place in the Supreme League.",           max_clubs_per_season: 36, promotion_spots: 0, relegation_spots: 0, playoff_spots: 16, qualification_spots_per_region: 2, current_season: 1, is_active: true, platform: "Cross-Platform", region: "Global" },
        { name: "STAGE Challenger League", slug: "challenger", tier: 3, primary_color: "#A78BFA", description: "Where every STAGE career begins. Rise through the ranks.",             max_clubs_per_season: 36, promotion_spots: 0, relegation_spots: 0, playoff_spots: 16, qualification_spots_per_region: 3, current_season: 1, is_active: true, platform: "Cross-Platform", region: "Global" },
      ];
      const existing = new Set(competitions.map(c => c.slug));
      const toCreate = defs.filter(d => !existing.has(d.slug));
      await Promise.all(toCreate.map(d => base44.entities.Competition.create(d)));
      await loadAll();
      alert(`Competitions seeded! (${toCreate.length} created)`);
    } catch (err) {
      const msg = err?.message || "";
      if (msg.includes("not found in app") || msg.includes("schema")) {
        alert(
          "⚠️ Competition entity not published yet.\n\n" +
          "To fix this:\n" +
          "1. Go to app.base44.com\n" +
          "2. Open your app → Entities\n" +
          "3. Find Competition and click Publish\n\n" +
          "Once published, come back and click Seed Competitions again."
        );
      } else {
        alert(`Seed failed: ${msg || "Unknown error."}`);
      }
    } finally {
      setSeedingComps(false);
    }
  }

  async function createCompetitionSeason() {
    if (!newSeasonForm.competition_id) { alert("Select a competition."); return; }
    setCreatingLeagueSeason(true);
    const comp = competitions.find(c => c.id === newSeasonForm.competition_id);
    if (!comp) { setCreatingLeagueSeason(false); return; }
    const existingSeasons = compSeasons.filter(s => s.competition_id === comp.id);
    const nextSeason = existingSeasons.length > 0 ? Math.max(...existingSeasons.map(s => s.season_number)) + 1 : 1;
    const numMatchdays = parseInt(newSeasonForm.num_league_matchdays) || 8;
    await base44.entities.CompetitionSeason.create({
      competition_id: comp.id,
      competition_name: comp.name,
      competition_tier: comp.tier,
      competition_slug: comp.slug,
      season_number: nextSeason,
      season_label: `Season ${nextSeason}`,
      platform: newSeasonForm.platform,
      region: newSeasonForm.region,
      status: "draft",
      format: "league_36_8md",
      playoff_format: "9_24_bracket",
      num_league_matchdays: numMatchdays,
      league_matchday_total: numMatchdays,
      fixtures_generated: false,
      registered_club_ids: [],
      num_clubs: parseInt(newSeasonForm.num_clubs) || 36,
      current_matchday: 1,
      prize_pool_stc: parseInt(newSeasonForm.prize_pool_stc) || 0,
    });
    await base44.entities.Competition.update(comp.id, { current_season: nextSeason });
    setNewSeasonForm(f => ({ ...f, competition_id: "" }));
    await loadAll();
    setCreatingLeagueSeason(false);
    alert(`Season ${nextSeason} created for ${comp.name}!`);
  }

  async function confirmQualEntry(entry) {
    const season = compSeasons.find(s => s.competition_id === entry.target_competition_id && s.status === "registration");
    if (!season) { alert("No open registration season found for this competition. Create a season first."); return; }
    const { confirmQualificationEntry } = await import("@/lib/competitionUtils");
    await confirmQualificationEntry(entry, season, adminProfile.email);
    setQualEntries(prev => prev.filter(e => e.id !== entry.id));
    alert(`${entry.club_name} confirmed for ${entry.target_competition_name}`);
  }

  async function rejectQualEntry(entry) {
    await base44.entities.QualificationEntry.update(entry.id, { status: "rejected", confirmed_by: adminProfile.email, confirmed_at: new Date().toISOString() });
    setQualEntries(prev => prev.filter(e => e.id !== entry.id));
  }

  async function seedRegionalLeagues() {
    setSeedingRegionalLeagues(true);
    try {
      const existing = new Set(regionalLeagues.map(l => l.slug));
      // Strip fields that require schema publishing so the seed always succeeds
      // with the base schema. Re-seed after publishing to persist extended fields.
      const toCreate = LEAGUE_DEFINITIONS
        .filter(d => !existing.has(d.slug))
        .map(({ linked_league_slug: _lls, ...d }) => ({
          ...d,
          platform: "Cross-Platform",
          season_number: 1,
          status: "registration",
          max_clubs: 16,
          promoted_slots: d.division === 1 ? 6 : 2,
        }));
      await Promise.all(toCreate.map(d => base44.entities.RegionalLeague.create(d)));
      await loadAll();
      alert(`Regional leagues seeded! (${toCreate.length} created)`);
    } catch (err) {
      const msg = err?.message || "";
      if (msg.includes("not found in app") || msg.includes("schema")) {
        alert(
          "⚠️ RegionalLeague entity not published yet.\n\n" +
          "To fix this:\n" +
          "1. Go to app.base44.com\n" +
          "2. Open your app → Entities\n" +
          "3. Find RegionalLeague and click Publish\n\n" +
          "Once published, come back and click Seed All Leagues again."
        );
      } else {
        alert(`Seed failed: ${msg || "Unknown error."}`);
      }
    } finally {
      setSeedingRegionalLeagues(false);
    }
  }

  async function processLeagueEnd(league) {
    setProcessingLeagueEnd(league.id);
    try {
      const standings = await base44.entities.RegionalLeagueStanding.filter({ league_id: league.id }, null, 50).catch(() => []);
      if (!standings.length) {
        alert("No standings found. Add clubs and record results before processing season end.");
        return;
      }
      const { processLeagueSeasonEnd } = await import("@/lib/regionalLeagueEngine");
      const result = await processLeagueSeasonEnd(league, standings, competitions, regionalLeagues);
      await loadAll();
      if (result.type === "div1") {
        alert(`Season processed! ${result.qualified} qualification entries created for STAGE competitions. ${result.relegated} clubs relegated.`);
      } else {
        alert(`Season processed! ${result.promoted} clubs promoted to Division 1.`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setProcessingLeagueEnd(null);
    }
  }

  async function leagueLifecycleAction(league, action) {
    try {
      if (action === "open_registration") {
        const { openLeagueRegistration } = await import("@/lib/seasonLifecycle");
        await openLeagueRegistration(league);
        await loadAll();
      } else if (action === "archive") {
        if (!confirm(`Archive ${league.name} Season ${league.season_number}? This will lock final standings and award the winner achievement. Make sure "End Season" has been run first.`)) return;
        const { archiveLeague } = await import("@/lib/seasonLifecycle");
        await archiveLeague(league);
        await loadAll();
        alert(`Season ${league.season_number} archived.`);
      } else if (action === "create_next") {
        const { createNextLeagueSeason } = await import("@/lib/seasonLifecycle");
        const next = await createNextLeagueSeason(league);
        await loadAll();
        alert(`${next.name} Season ${next.season_number} created as Draft. Open Registration when ready.`);
      }
    } catch (err) {
      alert(`Error: ${err?.message || "Unknown error."}`);
    }
  }

  async function handleApproveReg() {
    if (!approveRegDialog || !approveTargetId) return;
    setProcessingReg(true);
    try {
      const league = regionalLeagues.find(l => l.id === approveTargetId);
      if (!league) throw new Error("Selected league not found.");
      const { approveRegistration } = await import("@/lib/registrationEngine");
      await approveRegistration(approveRegDialog, league, adminProfile?.email || "admin");
      setApproveRegDialog(null);
      setApproveTargetId("");
      await loadAll();
    } catch (err) {
      alert(`Error: ${err?.message || "Unknown error."}`);
    } finally {
      setProcessingReg(false);
    }
  }

  async function handleRejectOrWaitlistReg() {
    if (!rejectNotesDialog) return;
    setProcessingReg(true);
    try {
      const { rejectRegistration, waitlistRegistration } = await import("@/lib/registrationEngine");
      if (rejectNotesDialog.action === "reject") {
        await rejectRegistration(rejectNotesDialog.reg, rejectNotes, adminProfile?.email || "admin");
      } else {
        await waitlistRegistration(rejectNotesDialog.reg, rejectNotes, adminProfile?.email || "admin");
      }
      setRejectNotesDialog(null);
      setRejectNotes("");
      await loadAll();
    } catch (err) {
      alert(`Error: ${err?.message || "Unknown error."}`);
    } finally {
      setProcessingReg(false);
    }
  }

  async function saveCompRules() {
    if (!editingComp) return;
    setSavingComp(true);
    try {
      await base44.entities.Competition.update(editingComp, {
        max_clubs_per_season:           Number(compEditForm.max_clubs_per_season) || 36,
        qualification_spots_per_region: Number(compEditForm.qualification_spots_per_region) || 2,
        promotion_spots:                0,
        relegation_spots:               0,
        playoff_spots:                  Number(compEditForm.playoff_spots) || 16,
        trophy_image_url:               compEditForm.trophy_image_url || "",
      });
      await loadAll();
      setEditingComp(null);
    } catch (err) {
      alert(`Save failed: ${err?.message || "Unknown error."}`);
    } finally {
      setSavingComp(false);
    }
  }

  async function saveLeagueRules() {
    if (!editingLeague) return;
    setSavingLeague(true);
    try {
      await base44.entities.RegionalLeague.update(editingLeague, {
        max_clubs:        Number(leagueEditForm.max_clubs) || 16,
        promoted_slots:   Number(leagueEditForm.promoted_slots) || 2,
        trophy_image_url: leagueEditForm.trophy_image_url || "",
      });
      await loadAll();
      setEditingLeague(null);
    } catch (err) {
      alert(`Save failed: ${err?.message || "Unknown error."}`);
    } finally {
      setSavingLeague(false);
    }
  }

  async function loadFixturesForPanel(panel) {
    setFixturesPanel(panel);
    setFixturesList([]);
    setLoadingFixtures(true);
    try {
      let list = [];
      if (panel.type === "competition") {
        list = await (base44.entities.CompetitionFixture?.filter({ season_id: panel.id }, null, 200) ?? Promise.resolve([])).catch(() => []);
      } else {
        list = await (base44.entities.RegionalLeagueFixture?.filter({ league_id: panel.id }, null, 200) ?? Promise.resolve([])).catch(() => []);
      }
      setFixturesList(list.sort((a, b) => (a.matchday || 0) - (b.matchday || 0)));
    } finally {
      setLoadingFixtures(false);
    }
  }

  async function loadStandingsForPanel(panel) {
    setStandingsPanel(panel);
    setStandingsList([]);
    setLoadingStandings(true);
    try {
      let list = [];
      if (panel.type === "competition") {
        list = await (base44.entities.CompetitionStanding?.filter({ season_id: panel.id }, null, 50) ?? Promise.resolve([])).catch(() => []);
      } else {
        list = await (base44.entities.RegionalLeagueStanding?.filter({ league_id: panel.id }, null, 50) ?? Promise.resolve([])).catch(() => []);
      }
      setStandingsList(list.sort((a, b) => (a.position || 99) - (b.position || 99)));
    } finally {
      setLoadingStandings(false);
    }
  }

  async function processAdminResult() {
    if (!resultDialog) return;
    const { fixture, fixtureType } = resultDialog;
    const home = parseInt(resultForm.home_score);
    const away = parseInt(resultForm.away_score);
    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
      alert("Enter valid scores (0 or above).");
      return;
    }
    setSavingResult(true);
    try {
      if (fixtureType === "competition") {
        await base44.entities.CompetitionFixture.update(fixture.id, {
          home_score: home, away_score: away, status: "completed", stats_processed: false,
        });
        const { processFixtureResult } = await import("@/lib/competitionUtils");
        await processFixtureResult({ ...fixture, home_score: home, away_score: away, stats_processed: false });
      } else {
        // Regional league — update fixture + standings + ranking
        const isDraw = home === away;
        const homeWin = home > away;
        await (base44.entities.RegionalLeagueFixture?.update(fixture.id, {
          home_score: home, away_score: away, status: "completed", stats_processed: true,
        }) ?? Promise.resolve());
        const [[homeRow], [awayRow]] = await Promise.all([
          (base44.entities.RegionalLeagueStanding?.filter({ league_id: fixture.league_id, club_id: fixture.home_club_id }, null, 1) ?? Promise.resolve([])).catch(() => []),
          (base44.entities.RegionalLeagueStanding?.filter({ league_id: fixture.league_id, club_id: fixture.away_club_id }, null, 1) ?? Promise.resolve([])).catch(() => []),
        ]);
        const updates = [];
        if (homeRow) {
          const u = {
            played: (homeRow.played||0)+1, wins: (homeRow.wins||0)+(homeWin?1:0),
            draws: (homeRow.draws||0)+(isDraw?1:0), losses: (homeRow.losses||0)+(!homeWin&&!isDraw?1:0),
            goals_for: (homeRow.goals_for||0)+home, goals_against: (homeRow.goals_against||0)+away,
            points: (homeRow.points||0)+(homeWin?3:isDraw?1:0),
          };
          u.goal_difference = u.goals_for - u.goals_against;
          updates.push(base44.entities.RegionalLeagueStanding.update(homeRow.id, u));
        }
        if (awayRow) {
          const u = {
            played: (awayRow.played||0)+1, wins: (awayRow.wins||0)+(!homeWin&&!isDraw?1:0),
            draws: (awayRow.draws||0)+(isDraw?1:0), losses: (awayRow.losses||0)+(homeWin?1:0),
            goals_for: (awayRow.goals_for||0)+away, goals_against: (awayRow.goals_against||0)+home,
            points: (awayRow.points||0)+(!homeWin&&!isDraw?3:isDraw?1:0),
          };
          u.goal_difference = u.goals_for - u.goals_against;
          updates.push(base44.entities.RegionalLeagueStanding.update(awayRow.id, u));
        }
        await Promise.all(updates);
        // Non-fatal ranking update
        try {
          const { updateClubRankingAfterMatch } = await import("@/lib/rankingEngine");
          const [[hc],[ac]] = await Promise.all([
            base44.entities.Club.filter({ id: fixture.home_club_id }, null, 1).catch(()=>[]),
            base44.entities.Club.filter({ id: fixture.away_club_id }, null, 1).catch(()=>[]),
          ]);
          if (hc && ac) {
            await updateClubRankingAfterMatch({
              homeClub: hc, awayClub: ac, homeScore: home, awayScore: away,
              competitionType: "regional_league", division: fixture.division || 1,
              phase: "league", matchId: fixture.id,
            });
          }
        } catch { /* non-fatal */ }
      }
      setResultDialog(null);
      setResultForm({ home_score: "", away_score: "" });
      if (fixturesPanel) await loadFixturesForPanel(fixturesPanel);
    } catch (err) {
      alert(`Error: ${err?.message || "Failed."}`);
    } finally {
      setSavingResult(false);
    }
  }

  async function postNews() {
    setUploadingNews(true);
    let image_url = newsForm.image_url;
    if (newsImageFile) {
      const res = await stageClient.integrations.Core.UploadFile({ file: newsImageFile });
      image_url = res.file_url;
    }
    await stageClient.entities.NewsItem.create({
      title: newsForm.title,
      body: newsForm.body,
      type: newsForm.type,
      image_url,
      published_at: new Date().toISOString(),
      is_featured: false,
    });
    setNewsForm({ title: "", body: "", type: "app_update", image_url: "" });
    setNewsImageFile(null);
    setUploadingNews(false);
    alert("News posted successfully!");
  }

  async function seedPressQuestions() {
    setSaving(true);
    const existing = await stageClient.entities.PressQuestion.list(null, 1);
    if (existing.length > 0) { alert("Press questions already seeded!"); setSaving(false); return; }
    const questions = [
      { question: "How do you rate your team's performance today?", answer_a: "Outstanding — we gave 100%", answer_b: "Decent, but we can improve", answer_c: "Disappointing overall", answer_d: "The result doesn't reflect the game", category: "performance" },
      { question: "What was the key moment of the match?", answer_a: "Our first goal changed everything", answer_b: "A great defensive block in the second half", answer_c: "The red card shifted the momentum", answer_d: "The penalty decision was crucial", category: "match" },
      { question: "How do you assess your opponent?", answer_a: "Very tough and well-organized", answer_b: "We expected more from them", answer_c: "They surprised us with their tactics", answer_d: "Respect to them — fair game", category: "opponent" },
      { question: "What's the message to your fans?", answer_a: "We play for you — thank you!", answer_b: "We'll work harder next time", answer_c: "Keep believing in us", answer_d: "Your support makes the difference", category: "fans" },
      { question: "How are you preparing for the next match?", answer_a: "Full focus on recovery and analysis", answer_b: "We'll fix the tactical issues we saw today", answer_c: "Confidence is high after this result", answer_d: "One game at a time — that's our motto", category: "preparation" },
      { question: "How would you describe the atmosphere in the dressing room?", answer_a: "Buzzing — everyone is pumped!", answer_b: "Calm and focused", answer_c: "Disappointed but determined", answer_d: "United — we face it together", category: "team" },
    ];
    await stageClient.entities.PressQuestion.bulkCreate(questions);
    alert("Press questions seeded successfully!");
    setSaving(false);
  }

  async function grantCredits() {
    if (!creditsDialog) return;
    setSaving(true);
    await stageClient.entities.Player.update(creditsDialog.id, { credits: (creditsDialog.credits || 0) + Number(creditsAmount) });
    setCreditsDialog(null); setCreditsAmount(0); setSaving(false);
    await loadAll();
  }

  // Lifestyle admin state
  const [lifestyleDialog, setLifestyleDialog] = useState(null); // null | 'add' | item (for edit)
  const [lifestyleForm, setLifestyleForm] = useState({});
  const [lifestyleSaving, setLifestyleSaving] = useState(false);
  const [lifestyleImageFile, setLifestyleImageFile] = useState(null);
  const [lifestyleImageUploading, setLifestyleImageUploading] = useState(false);

  function openAddAsset() {
    setLifestyleForm({
      name: '', category: 'houses', subcategory: '', tier: 'standard', description: '',
      image_url: '', sort_order: 0,
      price_stc: 0, rent_price_stc: 0, rent_duration_days: 30,
      invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 30,
      passive_income_stc: 0, passive_income_interval_days: 7,
      weekly_maintenance_stc: 0,
      can_buy: true, can_rent: false, can_invest: false, can_sell: true,
      sell_value_percent: 60, allows_multiple: true, is_active: true,
    });
    setLifestyleImageFile(null);
    setLifestyleDialog('add');
  }

  function openEditAsset(item) {
    setLifestyleForm({ ...item });
    setLifestyleImageFile(null);
    setLifestyleDialog(item);
  }

  async function uploadLifestyleImage() {
    if (!lifestyleImageFile) return null;
    setLifestyleImageUploading(true);
    try {
      const form = new FormData();
      form.append('file', lifestyleImageFile);
      const res = await stageClient.integrations.Core.UploadFile({ file: lifestyleImageFile });
      setLifestyleForm(prev => ({ ...prev, image_url: res.file_url }));
      return res.file_url;
    } catch { return null; }
    finally { setLifestyleImageUploading(false); }
  }

  async function saveLifestyleAsset() {
    if (!lifestyleForm.name) return;
    setLifestyleSaving(true);
    try {
      let imgUrl = lifestyleForm.image_url;
      if (lifestyleImageFile) {
        const uploaded = await uploadLifestyleImage();
        if (uploaded) imgUrl = uploaded;
      }
      const payload = { ...lifestyleForm, image_url: imgUrl };
      if (lifestyleDialog === 'add') {
        await stageClient.functions.invoke('lifestyleAdmin', { action: 'add', ...payload });
      } else {
        await stageClient.functions.invoke('lifestyleAdmin', { action: 'edit', asset_id: lifestyleDialog.id, ...payload });
      }
      setLifestyleDialog(null);
      const fresh = await stageClient.entities.LifestyleItem.list('sort_order', 300).catch(() => []);
      setLifestyleItems(fresh);
    } catch (e) { alert(e.message); }
    setLifestyleSaving(false);
  }

  async function deleteLifestyleAsset(item) {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    await stageClient.functions.invoke('lifestyleAdmin', { action: 'delete', asset_id: item.id }).catch(() => {});
    setLifestyleItems(prev => prev.filter(i => i.id !== item.id));
  }

  async function toggleLifestyleAsset(item) {
    await stageClient.functions.invoke('lifestyleAdmin', { action: 'toggle', asset_id: item.id }).catch(() => {});
    setLifestyleItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i));
  }

  const [playerWalletDialog, setPlayerWalletDialog] = useState(null);
  const [walletAdjustAmount, setWalletAdjustAmount] = useState("");
  const [walletAdjustNote,   setWalletAdjustNote]   = useState("");
  const [walletTxns, setWalletTxns] = useState([]);
  const [walletLoading, setWalletLoading] = useState(false);

  async function openPlayerWallet(p) {
    setPlayerWalletDialog(p);
    setWalletAdjustAmount("");
    setWalletAdjustNote("");
    setWalletLoading(true);
    try {
      const txns = await stageClient.entities.PlayerStcTransaction.filter({ player_id: p.id }, "-created_date", 30);
      setWalletTxns(txns || []);
    } catch { setWalletTxns([]); }
    setWalletLoading(false);
  }

  async function applyWalletAdjust() {
    if (!playerWalletDialog || walletAdjustAmount === "") return;
    setSaving(true);
    try {
      await stageClient.functions.invoke("playerWallet", {
        action: "admin_adjust",
        player_id: playerWalletDialog.id,
        amount: Number(walletAdjustAmount),
        description: walletAdjustNote || undefined,
      });
      // Refresh player list and wallet
      const fresh = await stageClient.entities.Player.filter({ id: playerWalletDialog.id }, null, 1);
      if (fresh[0]) setPlayerWalletDialog(fresh[0]);
      setPlayers(prev => prev.map(p => p.id === playerWalletDialog.id ? { ...p, stc: fresh[0]?.stc ?? p.stc } : p));
      await openPlayerWallet(fresh[0] || playerWalletDialog);
      setWalletAdjustAmount("");
      setWalletAdjustNote("");
    } catch (err) {
      alert(err?.message || "Failed");
    }
    setSaving(false);
  }

  const [clubStcDialog, setClubStcDialog] = useState(null);
  const [clubStcAmount, setClubStcAmount] = useState("");
  const [clubStcNote, setClubStcNote] = useState("");
  const [clubWageBudget, setClubWageBudget] = useState("");
  const [clubTransferBudget, setClubTransferBudget] = useState("");

  async function saveClubFinance() {
    if (!clubStcDialog) return;
    setSaving(true);
    try {
      await stageClient.functions.invoke("clubFinance", {
        action: "admin_adjust",
        club_id: clubStcDialog.id,
        ...(clubStcAmount !== "" ? { balance_delta: Number(clubStcAmount) } : {}),
        ...(clubWageBudget !== "" ? { set_wage_budget: Number(clubWageBudget) } : {}),
        ...(clubTransferBudget !== "" ? { set_transfer_budget: Number(clubTransferBudget) } : {}),
        ...(clubStcNote ? { note: clubStcNote } : {}),
      });
    } catch (err) {
      alert(err?.message || "Failed to save club finance");
      setSaving(false);
      return;
    }
    setClubStcDialog(null);
    setClubStcAmount(""); setClubStcNote(""); setClubWageBudget(""); setClubTransferBudget("");
    setSaving(false);
    await loadAll();
  }

  async function reseedLifestyle() {
    setSaving(true);
    await stageClient.functions.invoke("seedLifestyleItems", { force: true });
    setSaving(false);
    alert("Lifestyle items reseeded with correct pricing!");
  }

  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState(null);
  const [resettingRankings, setResettingRankings] = useState(false);

  // Rankings tab
  const [rankingConfig, setRankingConfig]     = useState(null);
  const [rankingConfigId, setRankingConfigId] = useState(null);
  const [savingConfig, setSavingConfig]       = useState(false);
  const [recalcBusy, setRecalcBusy]           = useState(false);
  const [recalcMsg,  setRecalcMsg]            = useState("");

  async function resetAllRankings() {
    if (!confirm("This will zero out all club ranking data (ranking points, global/regional rank, form, win/loss streak) for ALL clubs. This cannot be undone. Continue?")) return;
    setResettingRankings(true);
    try {
      const allClubs = await base44.entities.Club.list(null, 500);
      await Promise.all(allClubs.map(c =>
        base44.entities.Club.update(c.id, {
          ranking_points:   0,
          global_rank:      0,
          regional_rank:    0,
          form:             [],
          win_streak:       0,
          loss_streak:      0,
        })
      ));
      alert(`Rankings reset for ${allClubs.length} club${allClubs.length !== 1 ? "s" : ""}.`);
    } catch (err) {
      alert(`Reset failed: ${err?.message || "Unknown error."}`);
    } finally {
      setResettingRankings(false);
    }
  }

  async function saveRankingConfig() {
    if (!rankingConfig) return;
    setSavingConfig(true);
    try {
      const { DEFAULT_CONFIG } = await import("@/lib/rankingEngine");
      const payload = {};
      for (const key of Object.keys(DEFAULT_CONFIG)) {
        if (rankingConfig[key] !== undefined) payload[key] = Number(rankingConfig[key]);
      }
      payload.label     = rankingConfig.label || "Default";
      payload.is_active = true;

      if (!base44.entities.RankingConfig) {
        alert("⚠️ RankingConfig entity not published yet.\n\nPublish it on app.base44.com, then come back to save.");
        return;
      }
      if (rankingConfigId) {
        await base44.entities.RankingConfig.update(rankingConfigId, payload);
      } else {
        const created = await base44.entities.RankingConfig.create(payload);
        setRankingConfigId(created.id);
      }
      alert("Ranking config saved.");
    } catch (err) {
      alert(`Save failed: ${err?.message || "Unknown error."}`);
    } finally {
      setSavingConfig(false);
    }
  }

  async function recalculateRanks(type) {
    setRecalcBusy(true);
    setRecalcMsg("");
    try {
      const { recalculateGlobalRanks, recalculateRegionalRanks } = await import("@/lib/rankingEngine");
      if (type === "global") {
        const n = await recalculateGlobalRanks();
        setRecalcMsg(`✓ Global ranks recalculated for ${n} clubs.`);
      } else {
        const n = await recalculateRegionalRanks();
        setRecalcMsg(`✓ Regional ranks recalculated across ${n} regions.`);
      }
    } catch (err) {
      setRecalcMsg(`✗ ${err?.message || "Failed."}`);
    } finally {
      setRecalcBusy(false);
    }
  }

  async function migrateClubBalances() {
    if (!confirm("This will add +20M STC, +5M transfer budget, and +4M wage budget to ALL existing clubs. Continue?")) return;
    setMigrating(true);
    setMigrateResult(null);
    try {
      const allClubs = await stageClient.entities.Club.list(null, 500);
      let updated = 0;
      for (const club of allClubs) {
        await stageClient.entities.Club.update(club.id, {
          stc: (club.stc || 0) + 20_000_000,
          transfer_budget_stc: (club.transfer_budget_stc || 0) + 5_000_000,
          wage_budget_stc: (club.wage_budget_stc || 0) + 4_000_000,
        });
        updated++;
      }
      setMigrateResult({ success: true, count: updated });
    } catch (err) {
      setMigrateResult({ success: false, error: err?.message });
    } finally {
      setMigrating(false);
    }
  }

  if (allowed === null) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );
  if (!allowed) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
      <Shield className="w-12 h-12 text-destructive" />
      <p className="text-sm text-muted-foreground uppercase tracking-widest">Admin access required.</p>
      <Link to="/"><Button variant="outline" className="rounded">Go Home</Button></Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-8">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors mt-1">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1
              className="font-heading font-black text-5xl md:text-6xl text-foreground uppercase"
              style={{ transform: "skewX(-8deg)", letterSpacing: "-0.02em", transformOrigin: "left center" }}
            >
              ADMIN
            </h1>
            <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest">STAGE Control Panel</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-destructive border border-destructive/30 bg-destructive/5 px-2.5 py-1 rounded uppercase tracking-widest font-bold">
            {adminProfile?.email}
          </span>
          <Button variant="outline" size="sm" onClick={loadAll} className="border-border h-8 gap-1.5 rounded text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <AdminStat icon={AlertTriangle} label="Disputes" value={disputes.length} color="text-destructive" accent="border-l-destructive/50" />
        <AdminStat icon={Flag} label="Forfeits" value={forfeits.length} color="text-warning" accent="border-l-warning/50" />
        <AdminStat icon={Users} label="Players" value={players.length} color="text-primary" accent="border-l-primary/50" />
        <AdminStat icon={Trophy} label="Tournaments" value={tournaments.filter(t => t.status !== "archived" && t.status !== "cancelled").length} color="text-success" accent="border-l-success/50" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : adminTab === null ? (
        <div className="border border-dashed border-border rounded-lg p-10 text-center space-y-3 bg-card/30">
          <p className="text-sm text-muted-foreground uppercase tracking-widest font-bold">
            Choose a section
          </p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Use the <span className="text-foreground font-semibold">Admin</span> and{" "}
            <span className="text-foreground font-semibold">Operations</span> menus in the header to open disputes, players, landing page, and other tools. This dashboard shows live counts only.
          </p>
        </div>
      ) : (
        <>
          {adminTab === "disputes" && (
            <DisputesTab disputes={disputes} setResolveDialog={setResolveDialog} setSelectedWinner={setSelectedWinner} />
          )}

          {adminTab === "forfeits" && (
            <ForfeitsTab forfeits={forfeits} resolveForfeit={resolveForfeit} />
          )}

          {adminTab === "players" && (
            <PlayersTab
              players={players}
              playerSearch={playerSearch}
              setPlayerSearch={setPlayerSearch}
              setCreditsDialog={setCreditsDialog}
              setCreditsAmount={setCreditsAmount}
              openPlayerWallet={openPlayerWallet}
              kickFromClub={kickFromClub}
            />
          )}

          {adminTab === "clubs" && (
            <ClubsTab
              migrateClubBalances={migrateClubBalances}
              migrating={migrating}
              resetAllRankings={resetAllRankings}
              resettingRankings={resettingRankings}
              migrateResult={migrateResult}
              clubSearch={clubSearch}
              setClubSearch={setClubSearch}
              clubs={clubs}
              takeControl={takeControl}
              setClubStcDialog={setClubStcDialog}
              setClubStcAmount={setClubStcAmount}
              setClubWageBudget={setClubWageBudget}
              setClubTransferBudget={setClubTransferBudget}
              deleteClub={deleteClub}
            />
          )}

          {adminTab === "rankings" && (
            <RankingsTab
              recalculateRanks={recalculateRanks}
              recalcBusy={recalcBusy}
              recalcMsg={recalcMsg}
              rankingConfig={rankingConfig}
              setRankingConfig={setRankingConfig}
              saveRankingConfig={saveRankingConfig}
              savingConfig={savingConfig}
            />
          )}

          {adminTab === "leagues" && (
            <LeaguesTab
              seedCompetitions={seedCompetitions}
              seedingComps={seedingComps}
              competitions={competitions}
              compSeasons={compSeasons}
              editingComp={editingComp}
              setEditingComp={setEditingComp}
              compEditForm={compEditForm}
              setCompEditForm={setCompEditForm}
              saveCompRules={saveCompRules}
              savingComp={savingComp}
              newSeasonForm={newSeasonForm}
              setNewSeasonForm={setNewSeasonForm}
              createCompetitionSeason={createCompetitionSeason}
              creatingLeagueSeason={creatingLeagueSeason}
              regApplications={regApplications}
              regAppFilter={regAppFilter}
              setRegAppFilter={setRegAppFilter}
              setApproveRegDialog={setApproveRegDialog}
              setApproveTargetId={setApproveTargetId}
              setRejectNotesDialog={setRejectNotesDialog}
              setRejectNotes={setRejectNotes}
              regionalLeagues={regionalLeagues}
              qualEntries={qualEntries}
              confirmQualEntry={confirmQualEntry}
              rejectQualEntry={rejectQualEntry}
              loadAll={loadAll}
              fixturesOpen={fixturesOpen}
              setFixturesOpen={setFixturesOpen}
              selectedFixtureSeason={selectedFixtureSeason}
              setSelectedFixtureSeason={setSelectedFixtureSeason}
              loadingFixtures={loadingFixtures}
              fixturesPanel={fixturesPanel}
              fixturesList={fixturesList}
              loadFixturesForPanel={loadFixturesForPanel}
              selectedFixtureLeague={selectedFixtureLeague}
              setSelectedFixtureLeague={setSelectedFixtureLeague}
              setResultDialog={setResultDialog}
              setResultForm={setResultForm}
              standingsOpen={standingsOpen}
              setStandingsOpen={setStandingsOpen}
              selectedStandingsSeason={selectedStandingsSeason}
              setSelectedStandingsSeason={setSelectedStandingsSeason}
              loadingStandings={loadingStandings}
              standingsPanel={standingsPanel}
              standingsList={standingsList}
              loadStandingsForPanel={loadStandingsForPanel}
              selectedStandingsLeague={selectedStandingsLeague}
              setSelectedStandingsLeague={setSelectedStandingsLeague}
              seedRegionalLeagues={seedRegionalLeagues}
              seedingRegionalLeagues={seedingRegionalLeagues}
              editingLeague={editingLeague}
              setEditingLeague={setEditingLeague}
              leagueEditForm={leagueEditForm}
              setLeagueEditForm={setLeagueEditForm}
              saveLeagueRules={saveLeagueRules}
              savingLeague={savingLeague}
              leagueLifecycleAction={leagueLifecycleAction}
              processingLeagueEnd={processingLeagueEnd}
              processLeagueEnd={processLeagueEnd}
              expiredFixtures={expiredFixtures}
              schedulingAdminBusy={schedulingAdminBusy}
              setSchedulingAdminBusy={setSchedulingAdminBusy}
            />
          )}

          {adminTab === "tournaments" && (
            <TournamentsTab
              setCreateTournamentOpen={setCreateTournamentOpen}
              seedPressQuestions={seedPressQuestions}
              reseedLifestyle={reseedLifestyle}
              saving={saving}
              tournamentSearch={tournamentSearch}
              setTournamentSearch={setTournamentSearch}
              tournaments={tournaments}
              cancelTournament={cancelTournament}
            />
          )}

          {adminTab === "news" && (
            <NewsTab
              newsForm={newsForm}
              setNewsForm={setNewsForm}
              newsImageFile={newsImageFile}
              setNewsImageFile={setNewsImageFile}
              uploadingNews={uploadingNews}
              postNews={postNews}
            />
          )}

          {adminTab === "press-conferences" && (
            <PressConferencesTab pressConferences={pressConferences} />
          )}

          {adminTab === "lifestyles" && (
            <LifestylesTab
              reseedLifestyle={reseedLifestyle}
              saving={saving}
              openAddAsset={openAddAsset}
              lifestyleItems={lifestyleItems}
              toggleLifestyleAsset={toggleLifestyleAsset}
              openEditAsset={openEditAsset}
              deleteLifestyleAsset={deleteLifestyleAsset}
              lifestyleDialog={lifestyleDialog}
              setLifestyleDialog={setLifestyleDialog}
              lifestyleForm={lifestyleForm}
              setLifestyleForm={setLifestyleForm}
              setLifestyleImageFile={setLifestyleImageFile}
              lifestyleSaving={lifestyleSaving}
              saveLifestyleAsset={saveLifestyleAsset}
            />
          )}

          {adminTab === "transfers" && (
            <TransfersTab />
          )}

          {adminTab === "trophies" && (
            <TrophiesTab
              newTrophyName={newTrophyName}
              setNewTrophyName={setNewTrophyName}
              newTrophyFile={newTrophyFile}
              setNewTrophyFile={setNewTrophyFile}
              newTrophyAdminOnly={newTrophyAdminOnly}
              setNewTrophyAdminOnly={setNewTrophyAdminOnly}
              uploadingTrophy={uploadingTrophy}
              trophyUploadError={trophyUploadError}
              trophyFileRef={trophyFileRef}
              createTrophyItem={createTrophyItem}
              deleteTrophyItem={deleteTrophyItem}
              trophyItems={trophyItems}
            />
          )}

          {adminTab === "rewards" && (
            <RewardsTab
              competitions={competitions}
              regionalLeagues={regionalLeagues}
              rewardSource={rewardSource}
              setRewardSource={setRewardSource}
            />
          )}

          {adminTab === "landing" && (
            <LandingTab />
          )}

          {adminTab === "home" && (
            <HomeTab />
          )}
        </>
      )}

      {/* Create Tournament Dialog */}
      <Dialog open={createTournamentOpen} onOpenChange={setCreateTournamentOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader><DialogTitle className="font-heading text-xl uppercase tracking-tight flex items-center gap-2"><Trophy className="w-5 h-5 text-primary" /> Create Tournament</DialogTitle></DialogHeader>
          <div className="space-y-5 mt-2">

            {/* Tournament For */}
            <div>
              <label className="label-xs">Tournament For</label>
              <div className="grid grid-cols-2 gap-3">
                {[{v:"club",icon:"🏟️",label:"Club Tournament",sub:"Clubs register & compete"},{v:"player",icon:"👤",label:"Player Tournament",sub:"Individual players register"}].map(opt => (
                  <button key={opt.v} onClick={() => setTournamentForm(f => ({ ...f, participant_type: opt.v }))}
                    className={cn("rounded border p-3 text-left transition-all",
                      tournamentForm.participant_type === opt.v ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 bg-secondary"
                    )}>
                    <p className={cn("font-bold text-sm", tournamentForm.participant_type === opt.v ? "text-primary" : "text-foreground")}>{opt.icon} {opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="label-xs">Name</label>
              <input value={tournamentForm.name} onChange={e => setTournamentForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder="Tournament name..." />
            </div>

            {/* Description */}
            <div>
              <label className="label-xs">Description</label>
              <Textarea value={tournamentForm.description} onChange={e => setTournamentForm(f => ({ ...f, description: e.target.value }))}
                className="bg-secondary border-border" placeholder="Tournament details..." />
            </div>

            {/* Type + Max Teams */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-xs">Type</label>
                <Select value={tournamentForm.type} onValueChange={v => {
                  const updates = { type: v };
                  if (v === 'swiss_ucl') updates.max_teams = 36;
                  setTournamentForm(f => ({ ...f, ...updates }));
                }}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="knockout">Knockout</SelectItem>
                    <SelectItem value="league">League</SelectItem>
                    <SelectItem value="group_stage">Group Stage</SelectItem>
                    <SelectItem value="double_elimination">Double Elimination</SelectItem>
                    <SelectItem value="swiss_ucl">⭐ Swiss System: UCL Version</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="label-xs">Max Teams</label>
                <Select value={String(tournamentForm.max_teams)} onValueChange={v => setTournamentForm(f => ({ ...f, max_teams: Number(v) }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[4, 8, 16, 20, 32, 36, 64].map(n => <SelectItem key={n} value={String(n)}>{n} Teams</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Platform + Start Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-xs">Platform</label>
                <Select value={tournamentForm.platform} onValueChange={v => setTournamentForm(f => ({ ...f, platform: v }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PlayStation">PlayStation</SelectItem>
                    <SelectItem value="Xbox">Xbox</SelectItem>
                    <SelectItem value="PC">PC</SelectItem>
                    <SelectItem value="Cross-Platform">Cross-Platform</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="label-xs">Start Date</label>
                <input type="datetime-local" value={tournamentForm.start_date} onChange={e => setTournamentForm(f => ({ ...f, start_date: e.target.value }))}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" />
              </div>
            </div>

            {/* Entry Fee (STC only) */}
            <div>
              <label className="label-xs">Entry Fee</label>
              <div className="flex gap-2 mb-2">
                {[["free","Free"],["stc","STC Fee"]].map(([v,label]) => (
                  <button key={v} type="button" onClick={() => setAdminEntryType(v)}
                    className={cn("flex-1 py-2 rounded-lg border text-sm font-bold transition-all",
                      adminEntryType === v ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground hover:border-primary/40"
                    )}>
                    {label}
                  </button>
                ))}
              </div>
              {adminEntryType === "stc" && (
                <input type="number" min="0" value={tournamentForm.entry_fee_stc || ""} onChange={e => setTournamentForm(f => ({ ...f, entry_fee_stc: e.target.value }))}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder="STC per entry" />
              )}
            </div>

            {/* Region */}
            <div>
              <label className="label-xs">Region</label>
              <Select value={tournamentForm.region} onValueChange={v => setTournamentForm(f => ({ ...f, region: v }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Global","Europe","North America"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Country Restriction */}
            <div>
              <label className="label-xs">Country Restriction <span className="text-muted-foreground normal-case font-normal">(optional)</span></label>
              <Select value={tournamentForm.country_code || "none"} onValueChange={v => setTournamentForm(f => ({ ...f, country_code: v === "none" ? "" : v }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="All countries" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">🌍 All countries (open)</SelectItem>
                  {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {tournamentForm.country_code && <p className="text-xs text-warning mt-1">⚠️ Only clubs from this country can register.</p>}
            </div>

            {/* Custom Rules */}
            <div>
              <label className="label-xs">📋 Custom Rules (optional)</label>
              <Textarea value={tournamentForm.custom_rules} onChange={e => setTournamentForm(f => ({ ...f, custom_rules: e.target.value }))}
                className="bg-secondary border-border min-h-[80px]" placeholder="Enter your tournament-specific rules here..." />
              <p className="text-xs text-muted-foreground mt-2 mb-1">Or upload a rules document (PDF or image):</p>
              <label className="flex flex-col items-center justify-center border border-dashed border-border rounded p-4 cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">{rulesFile ? rulesFile.name : "Drop or click to upload rules file (PDF / image)"}</span>
                <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => setRulesFile(e.target.files[0])} />
              </label>
            </div>

            {/* Prize */}
            <div>
              <label className="label-xs">Prize Description (optional)</label>
              <input value={tournamentForm.prize_description} onChange={e => setTournamentForm(f => ({ ...f, prize_description: e.target.value }))}
                className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder="e.g. Bragging rights + custom badge" />
            </div>

            {/* Prize Pool STC */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground uppercase tracking-wider block">🏆 Prize Pool (STC) — paid automatically on completion</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "prize_winner_stc",        label: "🥇 Winner",       placeholder: "5000000" },
                  { key: "prize_runner_up_stc",      label: "🥈 Runner-Up",    placeholder: "2000000" },
                  { key: "prize_semi_final_stc",     label: "🥉 Semi-Final",   placeholder: "500000"  },
                  { key: "prize_participation_stc",  label: "🎖️ Participation", placeholder: "100000" },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">{f.label}</label>
                    <input type="number" min="0" value={tournamentForm[f.key] || ""}
                      onChange={e => setTournamentForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                      placeholder={f.placeholder} />
                  </div>
                ))}
              </div>
            </div>

            {/* Tournament Banner */}
            <div>
              <label className="label-xs">Tournament Banner</label>
              <label className="flex flex-col items-center justify-center border border-dashed border-border rounded p-5 cursor-pointer hover:border-primary/50 transition-colors mb-3">
                <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">{bannerFile ? bannerFile.name : "Upload custom banner"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => setBannerFile(e.target.files[0])} />
              </label>
              {!bannerFile && (
                <>
                  <p className="text-xs text-muted-foreground mb-2">Or pick a color banner:</p>
                  <div className="flex flex-wrap gap-2">
                    {BANNER_COLORS.map(color => (
                      <button key={color} onClick={() => setBannerColor(color)}
                        style={{ background: color }}
                        className={cn("w-9 h-9 rounded-lg border-2 transition-all",
                          bannerColor === color ? "border-primary scale-110" : "border-transparent hover:border-primary/50"
                        )}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Trophy Selection */}
            <div>
              <label className="label-xs">🏆 Trophy</label>
              <p className="text-[10px] text-muted-foreground mb-2">Select from library — awarded to winner's cabinet on completion.</p>
              {trophyItems.length > 0 ? (
                <TrophyCarousel trophies={trophyItems} selected={adminTrophyItemId}
                  onSelect={id => { setAdminTrophyItemId(id || ""); setAdminTrophyFile(null); }} />
              ) : (
                <p className="text-xs text-muted-foreground italic mb-2">No trophies in library yet — or upload a new one below.</p>
              )}
              <div className="mt-3">
                <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Or upload new trophy (auto-adds to library):</p>
                {adminTrophyFile ? (
                  <div className="flex items-center gap-3 bg-warning/10 border border-warning/20 rounded-lg p-3">
                    <img src={URL.createObjectURL(adminTrophyFile)} alt="trophy" className="w-10 h-10 object-contain" />
                    <span className="text-xs text-warning flex-1 truncate">{adminTrophyFile.name}</span>
                    <button onClick={() => setAdminTrophyFile(null)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <label className="w-full h-14 rounded-lg border-2 border-dashed border-warning/30 hover:border-warning/60 flex items-center justify-center gap-2 text-warning/60 hover:text-warning transition-colors cursor-pointer">
                    <Upload className="w-4 h-4" />
                    <span className="text-xs">Upload trophy PNG (auto-creates new entry in library)</span>
                    <input type="file" accept="image/png,image/*" className="hidden" onChange={e => { if (e.target.files[0]) { setAdminTrophyFile(e.target.files[0]); setAdminTrophyItemId(""); } }} />
                  </label>
                )}
              </div>
              {(adminTrophyItemId || adminTrophyFile) && (
                <p className="text-[10px] text-warning mt-1.5">✓ Trophy selected — will be awarded to the winner</p>
              )}
            </div>

            <Button onClick={createTournament} disabled={!tournamentForm.name || !tournamentForm.start_date || saving}
              className="w-full bg-primary text-primary-foreground gap-2 py-3">
              <Trophy className="w-4 h-4" /> {saving ? "Creating..." : "Create Tournament"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resolve Dispute Dialog */}
      <Dialog open={!!resolveDialog} onOpenChange={() => { setResolveDialog(null); setSelectedWinner(""); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-heading text-xl uppercase tracking-tight flex items-center gap-2"><Gavel className="w-5 h-5 text-primary" /> Resolve Dispute</DialogTitle></DialogHeader>
          {resolveDialog && (() => {
            const m = resolveDialog.match;
            const parseSub = (raw) => { try { return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null; } catch { return null; } };
            const homeSub = parseSub(m.home_submission);
            const awaySub = parseSub(m.away_submission);
            const homeScore = homeSub ? `${homeSub.home_score} – ${homeSub.away_score}` : "Not submitted";
            const awayScore = awaySub ? `${awaySub.home_score} – ${awaySub.away_score}` : "Not submitted";
            const homeProof = homeSub?.proof_url;
            const awayProof = awaySub?.proof_url;
            return (
              <div className="space-y-4 mt-2">
                <p className="text-sm text-muted-foreground"><strong className="text-foreground">{m.home_club_name || m.home_player_name}</strong> vs <strong className="text-foreground">{m.away_club_name || m.away_player_name}</strong></p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-secondary rounded-lg p-3 text-center">
                    <p className="text-muted-foreground text-xs mb-1">{m.home_club_name || m.home_player_name} submitted</p>
                    <p className="font-bold text-foreground text-lg">{homeScore}</p>
                    {homeProof && <a href={homeProof} target="_blank" rel="noreferrer" className="text-[10px] text-primary underline block mt-1">📎 Proof</a>}
                  </div>
                  <div className="bg-secondary rounded-lg p-3 text-center">
                    <p className="text-muted-foreground text-xs mb-1">{m.away_club_name || m.away_player_name} submitted</p>
                    <p className="font-bold text-foreground text-lg">{awayScore}</p>
                    {awayProof && <a href={awayProof} target="_blank" rel="noreferrer" className="text-[10px] text-primary underline block mt-1">📎 Proof</a>}
                  </div>
                </div>
                <div>
                  <label className="label-xs">Accept submission from</label>
                  <Select value={selectedWinner} onValueChange={setSelectedWinner}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select which result to accept..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={m.home_club_id || "home"}>{m.home_club_name || m.home_player_name} (Home) — {homeScore}</SelectItem>
                      <SelectItem value={m.away_club_id || "away"}>{m.away_club_name || m.away_player_name} (Away) — {awayScore}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={resolveDispute} disabled={!selectedWinner || saving} className="w-full bg-primary text-primary-foreground leading-relaxed gap-2">
                  <Gavel className="w-4 h-4" /> {saving ? "Saving..." : "Confirm Resolution"}
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Player Wallet Dialog */}
      <Dialog open={!!playerWalletDialog} onOpenChange={() => setPlayerWalletDialog(null)}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl uppercase tracking-tight flex items-center gap-2">
              <Coins className="w-5 h-5 text-success" /> Player Wallet — {playerWalletDialog?.gamertag}
            </DialogTitle>
          </DialogHeader>
          {playerWalletDialog && (
            <div className="space-y-5 mt-2">
              {/* Balance */}
              <div className="bg-gradient-to-br from-success/10 to-card rounded-2xl border border-success/20 p-5 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">STC Balance</p>
                <p className="font-heading font-black text-4xl text-success">{(playerWalletDialog.stc || 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Stage Coin</p>
              </div>

              {/* Adjust balance */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Adjust Balance</p>
                <p className="text-[10px] text-muted-foreground">Use positive amounts to credit, negative to debit. Creates a transaction record.</p>
                <input
                  type="number"
                  value={walletAdjustAmount}
                  onChange={e => setWalletAdjustAmount(e.target.value)}
                  placeholder="e.g. 5000 or -2000"
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                />
                <input
                  type="text"
                  value={walletAdjustNote}
                  onChange={e => setWalletAdjustNote(e.target.value)}
                  placeholder="Note (optional)"
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                />
                <Button onClick={applyWalletAdjust} disabled={walletAdjustAmount === "" || saving}
                  className="w-full bg-primary text-primary-foreground gap-2">
                  <Coins className="w-4 h-4" /> {saving ? "Applying…" : "Apply Adjustment"}
                </Button>
              </div>

              {/* Transaction history */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Recent Transactions</p>
                {walletLoading ? (
                  <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
                ) : walletTxns.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No transactions yet.</p>
                ) : (
                  <div className="rounded-xl border border-border overflow-hidden">
                    {walletTxns.map(tx => {
                      const isPos = Number(tx.amount) > 0;
                      return (
                        <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40 last:border-0 hover:bg-secondary/30">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{tx.description || tx.category}</p>
                            <p className="text-[10px] text-muted-foreground">{tx.source || "—"} · {new Date(tx.created_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}</p>
                          </div>
                          <span className={cn("text-xs font-bold shrink-0", isPos ? "text-success" : "text-destructive")}>
                            {isPos ? "+" : ""}{Number(tx.amount).toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Club Finance Dialog */}
      <Dialog open={!!clubStcDialog} onOpenChange={() => setClubStcDialog(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-heading text-xl uppercase tracking-tight flex items-center gap-2"><Coins className="w-5 h-5 text-success" /> Club Finance — {clubStcDialog?.name}</DialogTitle></DialogHeader>
          {clubStcDialog && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-secondary rounded-lg p-2">
                  <p className="text-muted-foreground">Balance</p>
                  <p className="font-bold text-success">{((clubStcDialog.stc||0)/1_000_000).toFixed(2)}M</p>
                </div>
                <div className="bg-secondary rounded-lg p-2">
                  <p className="text-muted-foreground">Wage Budget</p>
                  <p className="font-bold text-warning">{((clubStcDialog.wage_budget_stc||0)/1_000_000).toFixed(2)}M</p>
                </div>
                <div className="bg-secondary rounded-lg p-2">
                  <p className="text-muted-foreground">Transfer Budget</p>
                  <p className="font-bold text-primary">{((clubStcDialog.transfer_budget_stc||0)/1_000_000).toFixed(2)}M</p>
                </div>
              </div>
              <div>
                <label className="label-xs">Adjust Balance — Delta STC (e.g. +5000000 or -2000000)</label>
                <input type="number" value={clubStcAmount} onChange={e => setClubStcAmount(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder="e.g. 10000000 or -5000000" />
                <p className="text-[10px] text-muted-foreground mt-1">Amount is added/subtracted from current balance and logged as a transaction</p>
              </div>
              <div>
                <label className="label-xs">Set Weekly Wage Budget (STC)</label>
                <input type="number" value={clubWageBudget} onChange={e => setClubWageBudget(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder="e.g. 2000000" />
                <p className="text-[10px] text-muted-foreground mt-1">Recommended: 1M–5M/wk for a standard club</p>
              </div>
              <div>
                <label className="label-xs">Set Transfer Budget (STC)</label>
                <input type="number" value={clubTransferBudget} onChange={e => setClubTransferBudget(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder="e.g. 20000000" />
                <p className="text-[10px] text-muted-foreground mt-1">Recommended: 5M–50M for a standard club</p>
              </div>
              <div>
                <label className="label-xs">Note / Reason (optional)</label>
                <input type="text" value={clubStcNote} onChange={e => setClubStcNote(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder="e.g. Competition prize, correction..." />
              </div>
              <Button onClick={saveClubFinance} disabled={saving || (clubStcAmount === "" && clubWageBudget === "" && clubTransferBudget === "")} className="w-full bg-success/20 text-success hover:bg-success/30 border border-success/40">
                {saving ? "Saving..." : "Save Club Finance"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Enter Result Dialog */}
      <Dialog open={!!resultDialog} onOpenChange={() => { setResultDialog(null); setResultForm({ home_score: "", away_score: "" }); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl uppercase tracking-tight flex items-center gap-2">
              <Check className="w-5 h-5 text-success" /> Enter Result
            </DialogTitle>
          </DialogHeader>
          {resultDialog && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{resultDialog.fixture.home_club_name}</strong>
                <span className="mx-2 text-muted-foreground">vs</span>
                <strong className="text-foreground">{resultDialog.fixture.away_club_name}</strong>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-xs">{resultDialog.fixture.home_club_name} (Home)</label>
                  <input type="number" min="0" value={resultForm.home_score}
                    onChange={e => setResultForm(f => ({ ...f, home_score: e.target.value }))}
                    className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                    placeholder="0" />
                </div>
                <div>
                  <label className="label-xs">{resultDialog.fixture.away_club_name} (Away)</label>
                  <input type="number" min="0" value={resultForm.away_score}
                    onChange={e => setResultForm(f => ({ ...f, away_score: e.target.value }))}
                    className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                    placeholder="0" />
                </div>
              </div>
              <Button onClick={processAdminResult}
                disabled={savingResult || resultForm.home_score === "" || resultForm.away_score === ""}
                className="w-full bg-success/20 text-success hover:bg-success/30 border border-success/40 leading-relaxed">
                {savingResult
                  ? "Processing..."
                  : `Confirm: ${resultForm.home_score || "?"} – ${resultForm.away_score || "?"}`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Registration Dialog */}
      <Dialog open={!!approveRegDialog} onOpenChange={() => { setApproveRegDialog(null); setApproveTargetId(""); }}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading uppercase tracking-tight flex items-center gap-2">
              <Check className="w-4 h-4 text-success" /> Approve Registration
            </DialogTitle>
          </DialogHeader>
          {approveRegDialog && (
            <div className="space-y-4 mt-2">
              <div className="bg-secondary/40 border border-border rounded-lg p-3 flex items-center gap-3">
                {approveRegDialog.club_logo_url
                  ? <img src={approveRegDialog.club_logo_url} alt={approveRegDialog.club_name} className="w-8 h-8 object-contain rounded shrink-0" />
                  : <Shield className="w-6 h-6 text-muted-foreground/30 shrink-0" />}
                <div>
                  <p className="text-sm font-bold text-foreground">{approveRegDialog.club_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {approveRegDialog.region_name || approveRegDialog.region_slug}
                    {approveRegDialog.preferred_division ? ` · Prefers Div ${approveRegDialog.preferred_division}` : ""}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Assign to League
                </label>
                {(() => {
                  const candidates = regionalLeagues.filter(
                    l => l.region_slug === approveRegDialog.region_slug
                      && l.status === "registration"
                      && (l.platform === approveRegDialog.platform || l.platform === "Cross-Platform" || approveRegDialog.platform === "Cross-Platform")
                  ).sort((a, b) => (a.division || 1) - (b.division || 1));
                  if (candidates.length === 0) {
                    return (
                      <div className="bg-warning/10 border border-warning/30 rounded p-3 text-xs text-warning">
                        No open leagues found for {approveRegDialog.region_name || approveRegDialog.region_slug} in {approveRegDialog.platform}.
                        Open a league&apos;s registration first.
                      </div>
                    );
                  }
                  return (
                    <select value={approveTargetId} onChange={e => setApproveTargetId(e.target.value)}
                      className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50">
                      <option value="">— Select a league —</option>
                      {candidates.map(l => {
                        const max = l.max_clubs || 16;
                        const taken = l.num_clubs || 0;
                        const full = taken >= max;
                        return (
                          <option key={l.id} value={l.id} disabled={full}>
                            {l.name} (Div {l.division || 1}) — {taken}/{max}{full ? " FULL" : ""}
                          </option>
                        );
                      })}
                    </select>
                  );
                })()}
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1 border-border h-9 text-sm"
                  onClick={() => { setApproveRegDialog(null); setApproveTargetId(""); }}>
                  Cancel
                </Button>
                <Button disabled={!approveTargetId || processingReg} onClick={handleApproveReg}
                  className="flex-1 bg-success/20 text-success hover:bg-success/30 border border-success/30 h-9 text-sm font-bold">
                  {processingReg ? "Approving…" : "Confirm & Assign"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject / Waitlist Registration Dialog */}
      <Dialog open={!!rejectNotesDialog} onOpenChange={() => { setRejectNotesDialog(null); setRejectNotes(""); }}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading uppercase tracking-tight flex items-center gap-2">
              {rejectNotesDialog?.action === "reject"
                ? <><X className="w-4 h-4 text-destructive" /> Reject Application</>
                : <><Flag className="w-4 h-4 text-muted-foreground" /> Add to Waitlist</>}
            </DialogTitle>
          </DialogHeader>
          {rejectNotesDialog && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">
                {rejectNotesDialog.action === "reject"
                  ? `Reject ${rejectNotesDialog.reg.club_name}'s application for ${rejectNotesDialog.reg.region_name || rejectNotesDialog.reg.region_slug}?`
                  : `Add ${rejectNotesDialog.reg.club_name} to the waitlist for ${rejectNotesDialog.reg.region_name || rejectNotesDialog.reg.region_slug}.`}
              </p>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Note to club (optional)
                </label>
                <Textarea value={rejectNotes} onChange={e => setRejectNotes(e.target.value)}
                  placeholder="Reason for rejection / waitlist position, etc."
                  className="bg-secondary border-border text-foreground text-sm resize-none h-20" maxLength={300} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1 border-border h-9 text-sm"
                  onClick={() => { setRejectNotesDialog(null); setRejectNotes(""); }}>
                  Cancel
                </Button>
                <Button disabled={processingReg} onClick={handleRejectOrWaitlistReg}
                  className={cn("flex-1 h-9 text-sm font-bold",
                    rejectNotesDialog.action === "reject"
                      ? "bg-destructive/20 text-destructive hover:bg-destructive/30 border border-destructive/30"
                      : "bg-secondary text-foreground border border-border hover:bg-secondary/80")}>
                  {processingReg ? "Saving…" : rejectNotesDialog.action === "reject" ? "Reject" : "Waitlist"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Grant Credits Dialog */}
      <Dialog open={!!creditsDialog} onOpenChange={() => setCreditsDialog(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-heading text-xl uppercase tracking-tight flex items-center gap-2"><Coins className="w-5 h-5 text-warning" /> Grant Credits</DialogTitle></DialogHeader>
          {creditsDialog && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">Player: <strong className="text-foreground">{creditsDialog.gamertag}</strong></p>
              <p className="text-sm text-muted-foreground">Current balance: <strong className="text-warning">{(creditsDialog.credits || 0).toLocaleString()} credits</strong></p>
              <div>
                <label className="label-xs">Amount to Add</label>
                <input type="number" value={creditsAmount} onChange={e => setCreditsAmount(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder="e.g. 500" />
              </div>
              <Button onClick={grantCredits} disabled={!creditsAmount || saving} className="w-full bg-warning/20 text-warning hover:bg-warning/30 border border-warning/40 leading-relaxed">
                {saving ? "Saving..." : `Add ${Number(creditsAmount).toLocaleString()} Credits`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

// @ts-nocheck — shadcn/ui primitives are untyped forwardRefs under checkJs; substantive admin logic stays typed elsewhere.
import { useState, useEffect, useRef, useMemo } from "react";
// Admin sub-components (separation of concerns — moved out of this file)
import DisputesTab from "@/components/admin/sections/DisputesTab";
import ForfeitsTab from "@/components/admin/sections/ForfeitsTab";
import PlayersTab from "@/components/admin/sections/PlayersTab";
import ClubsTab from "@/components/admin/sections/ClubsTab";
import RankingsTab from "@/components/admin/sections/RankingsTab";
import LeaguesTab from "@/components/admin/sections/LeaguesTab";
import TournamentsTab from "@/components/admin/sections/TournamentsTab";
import InternationalTournamentsTab from "@/components/admin/sections/InternationalTournamentsTab";
import NewsTab from "@/components/admin/sections/NewsTab";
import PressConferencesTab from "@/components/admin/sections/PressConferencesTab";
import LifestylesTab from "@/components/admin/sections/LifestylesTab";
import TransfersTab from "@/components/admin/sections/TransfersTab";
import TrophiesTab from "@/components/admin/sections/TrophiesTab";
import RewardsTab from "@/components/admin/sections/RewardsTab";
import LandingTab from "@/components/admin/sections/LandingTab";
import HomeTab from "@/components/admin/sections/HomeTab";
import AnalyticsTab from "@/components/admin/sections/AnalyticsTab";
import StoreTab from "@/components/admin/sections/StoreTab";
import IdentityRepairTab from "@/components/admin/sections/IdentityRepairTab";
import AdminDashboardPanel from "@/components/admin/AdminDashboardPanel";
import AdminGamerLayout from "@/components/admin/AdminGamerUI";
import "@/styles/admin-gamer-theme.css";
import { ADMIN_SECTION_ALIASES } from "@/components/admin/shared/adminConstants";
import { stageClient } from "@/api/stageClient";
import { base44 } from "@/api/base44Client";
import { internationalTournamentsApi } from "@/api/internationalTournaments";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Shield, Trophy, Check, X,
  Gavel, Flag, Coins, Upload, ChevronLeft, ChevronRight
} from "lucide-react";
import { COUNTRIES } from "../lib/countries";
import { LEAGUE_DEFINITIONS } from "../lib/qualificationConfig";
import { swalAlert, swalConfirm, swalPrompt } from "@/lib/swal";
import { calculatePrizePool, getDefaultRewardRowsForSource } from "@/lib/prizeDefaults";
import { canResolveDisputeWithScore } from "@/lib/gameDayResultFlow";
import { useTranslation } from "@/hooks/useTranslation";
import {
  TOURNAMENT_CREDIT_COST,
  applyTournamentFormat,
  calculateTournamentPrizeBreakdown,
  getTournamentFormatRule,
  getTournamentMaxTeamOptions,
  normalizeTournamentMaxTeams,
} from "@/lib/tournamentRules";

/** @param {{ forcedSection?: string }} [props] */
export default function Admin(props) {
  const { t } = useTranslation();
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
  const [identityClaims, setIdentityClaims] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [internationalTournaments, setInternationalTournaments] = useState([]);
  const [internationalElections, setInternationalElections] = useState({});
  const [internationalSquads, setInternationalSquads] = useState({});
  const [savingInternationalTournament, setSavingInternationalTournament] = useState(false);
  const [playerSearch, setPlayerSearch] = useState("");
  const [clubSearch, setClubSearch] = useState("");
  const [tournamentSearch, setTournamentSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [resolveDialog, setResolveDialog] = useState(null);
  const [selectedWinner, setSelectedWinner] = useState("");
  const [resolutionScore, setResolutionScore] = useState({ home_score: "", away_score: "" });
  const [creditsDialog, setCreditsDialog] = useState(null);
  const [creditsAmount, setCreditsAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setResolutionScore({ home_score: "", away_score: "" });
  }, [resolveDialog?.match?.id]);

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
    region: "Global", country_code: "", max_teams: 8, start_date: "", description: "",
    entry_credits: 50, win_credits: 200, entry_fee_stc: "1000", custom_rules: "",
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
  const [newTrophyLinkedSource, setNewTrophyLinkedSource] = useState(null);
  const [uploadingTrophy, setUploadingTrophy] = useState(false);
  const [trophyUploadError, setTrophyUploadError] = useState(null);
  const trophyFileRef = useRef(null);

  // Admin create tournament extras
  const [adminTrophyItemId, setAdminTrophyItemId] = useState("");
  const [adminModalStep, setAdminModalStep] = useState(1);

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
  const [generatingRegionalFixtures, setGeneratingRegionalFixtures] = useState(null);

  // Competition & league inline editing
  const [editingComp, setEditingComp]       = useState(null);
  const [compEditForm, setCompEditForm]     = useState(() =>
    ({ max_clubs_per_season: "", qualification_spots_per_region: "", playoff_spots: "" }));
  const [savingComp, setSavingComp]         = useState(false);
  const [editingLeague, setEditingLeague]   = useState(null);
  const [leagueEditForm, setLeagueEditForm] = useState(() => ({ max_clubs: "", promoted_slots: "" }));
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
  const [removingCompetitionClub, setRemovingCompetitionClub] = useState(null);

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
        const isAdmin = u?.role_name === "admin"
          || u?.role === "admin"
          || Number(u?.role_id) === 0;
        if (!isAdmin) { setAllowed(false); return; }
        setAllowed(true);
        setAdminProfile(u);
        await loadAll();
      } catch(e) {
        console.log("error",e);
        setAllowed(false);
      }
    })();
  }, []);

  const adminTab = useMemo(
    () => (section && ADMIN_SECTION_ALIASES[section] ? ADMIN_SECTION_ALIASES[section] : null),
    [section]
  );

  useEffect(() => {
    if (!allowed || adminTab !== "international-tournaments") return;
    loadInternationalTournaments({ withSquads: true }).catch(() => {});
  }, [allowed, adminTab]);

  async function loadAll() {
    setLoading(true);
    try {
      const [disputedMatches, allPlayers, allTournaments, allClubs, allTrophies, allComps, allCompSeasons, allQual, allRegLeagues, expiredLeagueFixtures, expiredCompFixtures, allRegApps, allPressConferences, allLifestyleItems, pendingIdentityClaims] = await Promise.all([
        stageClient.entities.Match.filter({ status: "disputed" }, "-updated_date", 50).catch(() => []),
        stageClient.entities.Player.list("-created_date", 100).catch(() => []),
        stageClient.entities.Tournament.list("-created_date", 200).catch(() => []),
        stageClient.entities.Club.list("-created_date", 100).catch(() => []),
        stageClient.entities.TrophyItem.list("sort_order", 100).catch(() => []),
        stageClient.entities.Competition.list("tier", 10).catch(() => []),
        stageClient.entities.CompetitionSeason.list("-season_number", 30).catch(() => []),
        stageClient.entities.QualificationEntry.filter({ status: "pending" }, null, 50).catch(() => []),
        stageClient.entities.RegionalLeague.list("-season_number", 50).catch(() => []),
        (stageClient.entities.RegionalLeagueFixture?.filter({ scheduling_status: "expired" }, null, 50) ?? Promise.resolve([])).catch(() => []),
        (stageClient.entities.CompetitionFixture?.filter({ scheduling_status: "expired" }, null, 50) ?? Promise.resolve([])).catch(() => []),
        (stageClient.entities.SeasonRegistration?.list("-applied_at", 200) ?? Promise.resolve([])).catch(() => []),
        stageClient.entities.PressConference.list("-created_date", 200).catch(() => []),
        stageClient.entities.LifestyleItem.list("sort_order", 300).catch(() => []),
        stageClient.identityClaims.list({ status: "pending" }, "-created_date", 100).catch(() => []),
      ]);
      const forfeitMatches = await stageClient.entities.Match.filter({ forfeit_status: "pending" }, "-updated_date", 50).catch(() => []);
      setDisputes(disputedMatches.map(m => ({ ...m, _source: "tournament" })));
      setForfeits(forfeitMatches);
      setPlayers(allPlayers);
      setIdentityClaims(pendingIdentityClaims);
      setClubs(allClubs);
      setTournaments((allTournaments || []).filter(t => !["archived", "cancelled"].includes(String(t.status || "").toLowerCase())));
      setTrophyItems(allTrophies);
      setCompetitions(allComps);
      setCompSeasons(allCompSeasons);
      setQualEntries(allQual);
      setRegionalLeagues(allRegLeagues);
      setRegApplications(await cleanupStaleSeasonRegistrations(allRegApps));
      setPressConferences(allPressConferences);
      setLifestyleItems(allLifestyleItems);
      seedDefaultRewardConfigsForSources([
        ...allComps.map(c => ({ id: c.id, type: "competition", name: c.name, slug: c.slug, tier: c.tier })),
        ...allRegLeagues
          .filter(l => l.status !== "archived")
          .map(l => ({ id: l.id, type: "regional_league", name: l.name, division: l.division || 1, max_clubs: l.max_clubs || 16 })),
      ]).catch(() => {});
      await loadInternationalTournaments({ withSquads: false });
      setExpiredFixtures([
        ...expiredLeagueFixtures.map(f => ({ ...f, _fixtureType: "regional_league" })),
        ...expiredCompFixtures.map(f => ({ ...f, _fixtureType: "competition" })),
      ]);

      // Load ranking config (non-fatal)
      const cfgRows = await (stageClient.entities.RankingConfig?.list(null, 10) ?? Promise.resolve([])).catch(() => []);
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

  async function loadInternationalTournaments({ withSquads = false } = {}) {
    const rows = await internationalTournamentsApi.list(100).catch(() => []);
    setInternationalTournaments(rows);
    const pairs = await Promise.all(rows.map(async (row) => [
      row.id,
      await internationalTournamentsApi.elections(row.id).catch(() => []),
    ]));
    const electionsByTournament = Object.fromEntries(pairs);
    setInternationalElections(electionsByTournament);

    if (!withSquads) return;

    const jobs = pairs.flatMap(([tournamentId, elections]) =>
      elections
        .filter((election) => election.country_code)
        .map((election) => ({
          key: `${tournamentId}:${String(election.country_code).toUpperCase()}`,
          tournamentId,
          countryCode: String(election.country_code).toUpperCase(),
        }))
    );

    const squadPairs = [];
    const batchSize = 4;
    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(async (job) => {
        const squad = await internationalTournamentsApi
          .squad(job.tournamentId, job.countryCode)
          .catch(() => ({ squad: null, players: [] }));
        return [job.key, squad];
      }));
      squadPairs.push(...results);
    }
    setInternationalSquads(Object.fromEntries(squadPairs));
  }

  async function cleanupStaleSeasonRegistrations(registrations) {
    if (!base44.entities.SeasonRegistration || !base44.entities.RegionalLeagueStanding) return registrations;
    const activeStatuses = new Set(["pending", "waitlisted", "approved"]);
    const candidates = registrations.filter(reg => (
      activeStatuses.has(String(reg.status || "").toLowerCase()) &&
      (String(reg.admin_notes || "").toLowerCase().includes("removed from") || reg.assigned_league_id)
    ));
    if (!candidates.length) return registrations;

    const leagueIds = [...new Set(candidates.map(reg => reg.assigned_league_id).filter(Boolean))];
    const standingRows = (await Promise.all(leagueIds.map(leagueId =>
      (base44.entities.RegionalLeagueStanding?.filter({ league_id: leagueId }, null, 200) ?? Promise.resolve([])).catch(() => [])
    ))).flat();
    const standingKeys = new Set(standingRows.map(row => `${row.league_id}:${row.club_id}`));

    const updates = [];
    const next = registrations.map(reg => {
      const removedByNote = String(reg.admin_notes || "").toLowerCase().includes("removed from");
      const missingStanding = reg.assigned_league_id && !standingKeys.has(`${reg.assigned_league_id}:${reg.club_id}`);
      if (!activeStatuses.has(String(reg.status || "").toLowerCase()) || (!removedByNote && !missingStanding)) {
        return reg;
      }
      const patch = {
        status: "removed",
        admin_notes: reg.admin_notes || "Removed from league registration.",
        reviewed_by: reg.reviewed_by || adminProfile?.email || "admin",
        reviewed_at: reg.reviewed_at || new Date().toISOString(),
      };
      updates.push(base44.entities.SeasonRegistration.update(reg.id, patch).catch(() => null));
      return { ...reg, ...patch };
    });
    if (updates.length) await Promise.all(updates);
    return next;
  }

  async function createInternationalTournament(form) {
    setSavingInternationalTournament(true);
    try {
      await internationalTournamentsApi.create(form);
      await loadInternationalTournaments({ withSquads: true });
      await swalAlert(t("admin.alerts.internationalCreated"));
      return true;
    } catch (err) {
      await swalAlert(err?.message || err?.error || t("admin.alerts.internationalCreateFailed"));
      return false;
    } finally {
      setSavingInternationalTournament(false);
    }
  }

  async function updateInternationalTournament(id, form) {
    setSavingInternationalTournament(true);
    try {
      await internationalTournamentsApi.update(id, form);
      await loadInternationalTournaments({ withSquads: true });
      await swalAlert(t("admin.alerts.internationalUpdated"));
      return true;
    } catch (err) {
      await swalAlert(err?.message || err?.error || t("admin.alerts.internationalUpdateFailed"));
      return false;
    } finally {
      setSavingInternationalTournament(false);
    }
  }

  async function openInternationalVoting(id) {
    try {
      await internationalTournamentsApi.openVoting(id);
      await loadInternationalTournaments({ withSquads: true });
      await swalAlert(t("admin.alerts.votingOpened"));
    } catch (err) {
      await swalAlert(err?.message || err?.error || t("admin.alerts.votingOpenFailed"));
    }
  }

  async function closeInternationalVoting(id) {
    try {
      await internationalTournamentsApi.closeVoting(id);
      await loadInternationalTournaments({ withSquads: true });
      await swalAlert(t("admin.alerts.votingClosed"));
    } catch (err) {
      await swalAlert(err?.message || err?.error || t("admin.alerts.votingCloseFailed"));
    }
  }

  async function lockInternationalSquad(tournamentId, squadId) {
    try {
      await internationalTournamentsApi.lockSquad(tournamentId, squadId);
      await loadInternationalTournaments({ withSquads: true });
      await swalAlert(t("admin.alerts.squadLocked"));
    } catch (err) {
      await swalAlert(err?.message || err?.error || t("admin.alerts.squadLockFailed"));
    }
  }

  async function reviewIdentityClaim(claim, status) {
    if (!claim?.id) return;
    const reason = status === "rejected"
      ? ((await swalPrompt(t("admin.alerts.rejectIdentityReason", { name: claim.gamertag || t("admin.alerts.thisPlayer") }), {
          title: t("admin.alerts.rejectIdentityTitle"),
          placeholder: t("admin.alerts.rejectIdentityPlaceholder"),
        })) ?? "")
      : "";
    await stageClient.identityClaims.review(claim.id, {
      status,
      review_notes: status === "approved" ? "Verified by admin review" : "",
      rejection_reason: status === "rejected" ? reason : null,
    });
    await loadAll();
  }

  async function createTrophyItem() {
    if (!newTrophyName.trim() || !newTrophyFile) return;
    setUploadingTrophy(true);
    setTrophyUploadError(null);
    try {
      const uploadResult = await stageClient.integrations.Core.UploadFile({ file: newTrophyFile });
      if (!uploadResult?.file_url) throw new Error("Upload succeeded but no URL was returned.");
      const linked = newTrophyLinkedSource?.id ? newTrophyLinkedSource : null;
      await stageClient.entities.TrophyItem.create({
        name: newTrophyName.trim(),
        image_url: uploadResult.file_url,
        is_official: !!linked || newTrophyAdminOnly,
        admin_only: newTrophyAdminOnly,
        sort_order: trophyItems.length,
        linked_source_type: linked?.type || null,
        linked_source_id: linked?.id || null,
        linked_source_name: linked?.name || null,
      });
      // Sync trophy_image_url on the linked competition/league
      if (linked?.id) {
        if (linked.type === "competition") {
          await stageClient.entities.Competition.update(linked.id, { trophy_image_url: uploadResult.file_url }).catch(() => {});
        } else if (linked.type === "regional_league") {
          await stageClient.entities.RegionalLeague.update(linked.id, { trophy_image_url: uploadResult.file_url }).catch(() => {});
        }
      }
      setNewTrophyName("");
      setNewTrophyFile(null);
      setNewTrophyAdminOnly(false);
      setNewTrophyLinkedSource(null);
      if (trophyFileRef.current) trophyFileRef.current.value = "";
      const updated = await stageClient.entities.TrophyItem.list("sort_order", 200).catch(() => []);
      setTrophyItems(updated);
    } catch (err) {
      setTrophyUploadError(err?.message || JSON.stringify(err) || "Failed to add trophy. Check console.");
      console.error("createTrophyItem error:", err);
    } finally {
      setUploadingTrophy(false);
    }
  }

  async function seedDefaultRewardConfig(sourceId, sourceType, sourceName, source, maxPositions) {
    if (!sourceId || !stageClient.entities.RewardConfig) return;
    const existing = await stageClient.entities.RewardConfig.filter({ source_id: sourceId }, null, 1).catch(() => []);
    if (existing.length) return;
    const rows = getDefaultRewardRowsForSource(sourceType, { ...source, name: sourceName }, maxPositions);
    await Promise.all(rows.map(row => stageClient.entities.RewardConfig.create({
      source_id: sourceId,
      source_type: sourceType,
      source_name: sourceName,
      position: row.position,
      position_label: row.position_label,
      badge_type: row.badge_type,
      stc_amount: row.stc_amount,
    }).catch(() => null)));
  }

  async function seedDefaultRewardConfigsForSources(sources) {
    await Promise.all((sources || []).map(source => seedDefaultRewardConfig(
      source.id,
      source.type,
      source.name,
      source,
      source.type === "regional_league" ? (source.max_clubs || 16) : 36
    )));
  }

  async function updateTrophyItem(id, editForm, replaceFile) {
    let imageUrl = null;
    if (replaceFile) {
      const res = await stageClient.integrations.Core.UploadFile({ file: replaceFile });
      if (!res?.file_url) throw new Error("Image upload failed.");
      imageUrl = res.file_url;
    }
    const linked = editForm.source?.id ? editForm.source : null;
    const patch = {
      name: editForm.name,
      admin_only: editForm.admin_only ? 1 : 0,
      linked_source_type: linked?.type || null,
      linked_source_id: linked?.id || null,
      linked_source_name: linked?.name || null,
    };
    if (imageUrl) patch.image_url = imageUrl;
    await stageClient.entities.TrophyItem.update(id, patch);
    // Sync trophy_image_url on linked source
    const syncUrl = imageUrl || trophyItems.find(t => t.id === id)?.image_url;
    if (linked?.id && syncUrl) {
      if (linked.type === "competition") {
        await stageClient.entities.Competition.update(linked.id, { trophy_image_url: syncUrl }).catch(() => {});
      } else if (linked.type === "regional_league") {
        await stageClient.entities.RegionalLeague.update(linked.id, { trophy_image_url: syncUrl }).catch(() => {});
      }
    }
    const updated = await stageClient.entities.TrophyItem.list("sort_order", 200).catch(() => []);
    setTrophyItems(updated);
  }

  async function deleteTrophyItem(id) {
    if (!(await swalConfirm(t("admin.alerts.deleteTrophyConfirm")))) return;
    await stageClient.entities.TrophyItem.delete(id);
    setTrophyItems(prev => prev.filter(t => t.id !== id));
  }

  async function resolveDispute() {
    if (!resolveDialog || !canResolveDisputeWithScore(selectedWinner, resolutionScore)) return;
    setSaving(true);
    const m = resolveDialog.match;
    try {
      const isHome = selectedWinner === (m.home_club_id || m.home_player_id || "home");
      await stageClient.functions.invoke("matchKickoff", {
        match_id: m.id,
        action: "admin_resolve",
        admin_resolve_winner: isHome ? "home" : "away",
        admin_home_score: Number(resolutionScore.home_score),
        admin_away_score: Number(resolutionScore.away_score),
      });
      setResolveDialog(null); setSelectedWinner(""); setResolutionScore({ home_score: "", away_score: "" });
      await loadAll();
    } catch (err) {
      await swalAlert(t("admin.alerts.resolveDisputeFailed", { message: err?.message || t("admin.alerts.unknownError") }));
    } finally {
      setSaving(false);
    }
  }

  async function resolveForfeit(matchId, approve) {
    const m = forfeits.find(f => f.id === matchId);
    if (!m) return;
    // Defensive: a forfeit on an already-completed match would overwrite the
    // real result. Surface a clear message before hitting the server (which
    // will refuse this same case anyway).
    if (approve && (m.status === "completed" || m.status === "forfeit")) {
      await swalAlert(t("admin.alerts.forfeitAlreadyResolved", {
        status: m.status === "forfeit" ? t("admin.alerts.forfeited") : t("admin.alerts.completed"),
      }));
      return;
    }
    try {
      await stageClient.functions.invoke("adminMatchActions", {
        action: "resolve_forfeit",
        match_id: matchId,
        approve,
        reason: approve ? "Approved from admin forfeits panel" : "Rejected from admin forfeits panel",
      });
      setForfeits(prev => prev.filter(f => f.id !== matchId));
    } catch (err) {
      const serverMsg = err?.data?.error || err?.message || t("admin.alerts.unknownError");
      await swalAlert(t("admin.alerts.forfeitActionFailed", { action: approve ? t("admin.alerts.approve") : t("admin.alerts.reject"), message: serverMsg }));
    }
  }

  async function kickFromClub(playerId) {
    await stageClient.functions.invoke("adminMembershipActions", {
      action: "kick_from_club",
      player_id: playerId,
      reason: "Removed from club in admin players panel",
    });
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, club_id: null, role: "member", club_roles: ["member"], status: "free_agent" } : p));
  }

  async function grantStagePlus(player) {
    const reason = await swalPrompt(t("admin.alerts.grantStagePlusPrompt", { name: player.gamertag || player.email }), {
      placeholder: t("admin.alerts.grantStagePlusReason"),
      confirmText: t("admin.alerts.grantStagePlusConfirm"),
    });
    if (reason === null) return;
    try {
      const res = await stageClient.functions.invoke("adminSubscriptionGrant", {
        player_id: player.id,
        action: "grant_stage_plus",
        months: 1,
        billing: "monthly",
        reason: reason || "Admin test access",
      });
      const updated = res?.data?.player;
      if (updated?.id) setPlayers(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
      await swalAlert(t("admin.alerts.stagePlusGranted"));
    } catch (err) {
      await swalAlert(t("admin.alerts.stagePlusGrantFailed", { message: err?.message || t("admin.alerts.unknownError") }));
    }
  }

  async function removeStagePlus(player) {
    if (!(await swalConfirm(t("admin.alerts.removeStagePlusConfirm", { name: player.gamertag || player.email })))) return;
    try {
      const res = await stageClient.functions.invoke("adminSubscriptionGrant", {
        player_id: player.id,
        action: "remove_stage_plus",
        reason: "Admin removed STAGE Plus",
      });
      const updated = res?.data?.player;
      if (updated?.id) setPlayers(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
      await swalAlert(t("admin.alerts.stagePlusRemoved"));
    } catch (err) {
      await swalAlert(t("admin.alerts.stagePlusRemoveFailed", { message: err?.message || t("admin.alerts.unknownError") }));
    }
  }

  async function deleteUserCompletely(emailOrPlayer) {
    const email =
      typeof emailOrPlayer === "string"
        ? emailOrPlayer.trim()
        : String(emailOrPlayer?.email || "").trim();
    const playerId = typeof emailOrPlayer === "object" ? emailOrPlayer?.id : null;
    const label = email || playerId;
    if (!label || !email) return;
    const typed = prompt(t("admin.alerts.deleteUserPrompt", { label }));
    if (!typed || typed.trim().toLowerCase() !== email.toLowerCase()) return;
    try {
      await stageClient.functions.invoke("adminDeleteUserAccount", playerId
        ? { player_id: playerId }
        : { email });
      setPlayers(prev => prev.filter(p => p.id !== playerId && (!email || String(p.email || "").toLowerCase() !== email.toLowerCase())));
      setIdentityClaims(prev => prev.filter(c => (!email || String(c.email || "").toLowerCase() !== email.toLowerCase()) && (!playerId || c.player_id !== playerId)));
      alert(t("admin.alerts.deleteUserCompleted", { label }));
      await loadAll();
    } catch (err) {
      const message = err?.message || err?.data?.error || "Delete user reset failed";
      alert(t("admin.alerts.deleteUserFailed", { message }));
      throw err;
    }
  }

  async function deleteClub(clubId) {
    if (!(await swalConfirm(t("admin.alerts.deleteClubConfirm")))) return;
    await stageClient.functions.invoke("clubAdminActions", {
      action: "delete",
      club_id: clubId,
      reason: "Deleted from admin clubs panel",
    });
    setClubs(prev => prev.filter(c => c.id !== clubId));
  }

  async function cancelTournament(tournamentId) {
    const res = await stageClient.functions.invoke("tournamentCancellation", { tournament_id: tournamentId });
    if (!res?.data?.success) {
      await swalAlert(res?.data?.error || t("admin.alerts.tournamentCancelFailed"));
      return;
    }
    setTournaments(prev => prev.filter(t => t.id !== tournamentId));
  }

  async function deleteTournament(tournamentId) {
    if (!(await swalConfirm(t("admin.alerts.deleteTournamentConfirm")))) return;
    try {
      const res = await stageClient.functions.invoke("adminDeleteTournament", {
        tournament_id: tournamentId,
        reason: "Deleted from admin tournaments panel",
      });
      if (!res?.data?.success) {
        await swalAlert(res?.data?.error || t("admin.alerts.tournamentDeleteFailed"));
        return;
      }
      setTournaments(prev => prev.filter(t => t.id !== tournamentId));
    } catch (err) {
      await swalAlert(err?.data?.error || err?.message || t("admin.alerts.tournamentDeleteFailed"));
    }
  }

  async function createTournament() {
    setSaving(true);
    try {
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
      let resolvedTrophyItemId = adminTrophyItemId || null;
      if (adminTrophyFile) {
        const res = await stageClient.integrations.Core.UploadFile({ file: adminTrophyFile });
        trophy_url = res.file_url;
        if (!adminTrophyItemId && tournamentForm.name) {
          const created = await stageClient.entities.TrophyItem.create({
            name: `By STAGE · ${tournamentForm.name}`,
            image_url: trophy_url,
            is_official: true,
            sort_order: trophyItems.length,
          }).catch(() => null);
          if (created?.id) resolvedTrophyItemId = created.id;
        }
      }
      const resolvedTrophyUrl = trophy_url || trophyItems.find(t => t.id === resolvedTrophyItemId)?.image_url || "";

      const maxTeams = normalizeTournamentMaxTeams(tournamentForm.type, tournamentForm.max_teams);
      const prizes = calculateTournamentPrizeBreakdown(tournamentForm.entry_fee_stc, maxTeams);

      await stageClient.entities.Tournament.create({
        ...tournamentForm,
        max_teams: maxTeams,
        entry_credits: TOURNAMENT_CREDIT_COST,
        entry_fee_stc: prizes.entryFee,
        prize_pool_stc: prizes.pool,
        prize_winner_stc: prizes.winner,
        prize_runner_up_stc: prizes.runnerUp,
        prize_semi_final_stc: prizes.thirdPlace,
        prize_participation_stc: 0,
        prize_description: "",
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
      setTournamentForm({
        name: "", type: "knockout", participant_type: "club", platform: "PlayStation", region: "Global", country_code: "",
        max_teams: 8, start_date: "", description: "",
        entry_credits: 50, win_credits: 200, entry_fee_stc: "1000", custom_rules: "",
        prize_winner_stc: "", prize_runner_up_stc: "", prize_semi_final_stc: "", prize_participation_stc: "",
      });
      setRulesFile(null); setBannerFile(null); setBannerColor("#1e2a3a"); setAdminTrophyFile(null);
      setAdminTrophyItemId(""); setAdminModalStep(1);
      loadAll();
    } catch (err) {
      console.error("createTournament error:", err);
      await swalAlert(t("admin.alerts.createTournamentFailed", { message: err?.message || t("admin.alerts.unknownError") }));
    } finally {
      setSaving(false);
    }
  }

  async function seedCompetitions() {
    if (competitions.length >= 3) { await swalAlert(t("admin.alerts.competitionsAlreadySeeded")); return; }
    setSeedingComps(true);
    try {
      const defs = [
        { name: "STAGE Supreme League",    slug: "supreme",    tier: 1, primary_color: "#FFD700", description: "The pinnacle of STAGE competition. Only the elite qualify.",          max_clubs_per_season: 36, promotion_spots: 0, relegation_spots: 0, playoff_spots: 16, qualification_spots_per_region: 2, current_season: 1, is_active: true, platform: "Cross-Platform", region: "Global" },
        { name: "STAGE Elite League",      slug: "elite",      tier: 2, primary_color: "#00E5BD", description: "The proving ground. Earn your place in the Supreme League.",           max_clubs_per_season: 36, promotion_spots: 0, relegation_spots: 0, playoff_spots: 16, qualification_spots_per_region: 2, current_season: 1, is_active: true, platform: "Cross-Platform", region: "Global" },
        { name: "STAGE Challenger League", slug: "challenger", tier: 3, primary_color: "#A78BFA", description: "Where every STAGE career begins. Rise through the ranks.",             max_clubs_per_season: 36, promotion_spots: 0, relegation_spots: 0, playoff_spots: 16, qualification_spots_per_region: 3, current_season: 1, is_active: true, platform: "Cross-Platform", region: "Global" },
      ];
      const existing = new Set(competitions.map(c => c.slug));
      const toCreate = defs.filter(d => !existing.has(d.slug));
      const created = await Promise.all(toCreate.map(d => stageClient.entities.Competition.create(d)));
      await seedDefaultRewardConfigsForSources(created.map(c => ({
        id: c.id,
        type: "competition",
        name: c.name,
        slug: c.slug,
        tier: c.tier,
      })));
      await loadAll();
      await swalAlert(t("admin.alerts.competitionsSeeded", { count: toCreate.length }));
    } catch (err) {
      const msg = err?.message || "";
      if (msg.includes("not found in app") || msg.includes("schema")) {
        await swalAlert(t("admin.alerts.competitionNotPublished"));
      } else {
        await swalAlert(t("admin.alerts.seedFailed", { message: msg || t("admin.alerts.unknownError") }));
      }
    } finally {
      setSeedingComps(false);
    }
  }

  async function createCompetitionSeason() {
    if (!newSeasonForm.competition_id) { await swalAlert(t("admin.alerts.selectCompetition")); return; }
    setCreatingLeagueSeason(true);
    const comp = competitions.find(c => c.id === newSeasonForm.competition_id);
    if (!comp) { setCreatingLeagueSeason(false); return; }
    const existingSeasons = compSeasons.filter(s => s.competition_id === comp.id);
    const nextSeason = existingSeasons.length > 0 ? Math.max(...existingSeasons.map(s => s.season_number)) + 1 : 1;
    const numMatchdays = Number(newSeasonForm.num_league_matchdays) || 8;
    const targetClubs = Number(newSeasonForm.num_clubs) || Number(comp.max_clubs_per_season) || 36;
    const defaultPrizePool = calculatePrizePool("competition", comp, targetClubs);
    await stageClient.entities.CompetitionSeason.create({
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
      num_clubs: 0,
      max_clubs: targetClubs,
      target_clubs: targetClubs,
      current_matchday: 1,
      prize_pool_stc: parseInt(newSeasonForm.prize_pool_stc) || defaultPrizePool,
    });
    await seedDefaultRewardConfig(comp.id, "competition", comp.name, comp, targetClubs);
    await stageClient.entities.Competition.update(comp.id, { current_season: nextSeason });
    setNewSeasonForm(f => ({ ...f, competition_id: "" }));
    await loadAll();
    setCreatingLeagueSeason(false);
    await swalAlert(t("admin.alerts.seasonCreated", { season: nextSeason, name: comp.name, target: targetClubs }));
  }

  async function confirmQualEntry(entry) {
    const eligibleSeasons = compSeasons
      .filter(s =>
        s.competition_id === entry.target_competition_id &&
        !s.fixtures_generated &&
        ["draft", "qualification", "registration"].includes(s.status)
      )
      .sort((a, b) => (b.season_number || 0) - (a.season_number || 0));
    const season = eligibleSeasons[0];
    if (!season) { await swalAlert(t("admin.alerts.noQualificationSeason")); return; }
    const { confirmQualificationEntry } = await import("@/lib/competitionUtils");
    await confirmQualificationEntry(entry, season, adminProfile.email);
    setQualEntries(prev => prev.filter(e => e.id !== entry.id));
    await swalAlert(t("admin.alerts.qualEntryConfirmed", { club: entry.club_name, competition: entry.target_competition_name }));
  }

  async function rejectQualEntry(entry) {
    await stageClient.entities.QualificationEntry.update(entry.id, { status: "rejected", confirmed_by: adminProfile.email, confirmed_at: new Date().toISOString() });
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
          prize_pool_stc: calculatePrizePool("regional_league", d, 16),
        }));
      const created = await Promise.all(toCreate.map(d => stageClient.entities.RegionalLeague.create(d)));
      await seedDefaultRewardConfigsForSources(created.map(l => ({
        id: l.id,
        type: "regional_league",
        name: l.name,
        division: l.division || 1,
        max_clubs: l.max_clubs || 16,
      })));
      await loadAll();
      await swalAlert(t("admin.alerts.regionalLeaguesSeeded", { count: toCreate.length }));
    } catch (err) {
      const msg = err?.message || "";
      if (msg.includes("not found in app") || msg.includes("schema")) {
        await swalAlert(t("admin.alerts.regionalLeagueNotPublished"));
      } else {
        await swalAlert(t("admin.alerts.seedFailed", { message: msg || t("admin.alerts.unknownError") }));
      }
    } finally {
      setSeedingRegionalLeagues(false);
    }
  }

  async function processLeagueEnd(league) {
    setProcessingLeagueEnd(league.id);
    try {
      const standings = await stageClient.entities.RegionalLeagueStanding.filter({ league_id: league.id }, null, 50).catch(() => []);
      if (!standings.length) {
        await swalAlert(t("admin.alerts.noStandingsForSeasonEnd"));
        return;
      }
      const { processLeagueSeasonEnd } = await import("@/lib/regionalLeagueEngine");
      const result = await processLeagueSeasonEnd(league, standings, competitions, regionalLeagues);
      await loadAll();
      if (result.type === "div1") {
        await swalAlert(t("admin.alerts.seasonProcessedQualified", { qualified: result.qualified, relegated: result.relegated }));
      } else {
        await swalAlert(t("admin.alerts.seasonProcessedPromoted", { promoted: result.promoted }));
      }
    } catch (err) {
      await swalAlert(t("admin.alerts.errorWithMessage", { message: err.message }));
    } finally {
      setProcessingLeagueEnd(null);
    }
  }

  async function generateRegionalFixturesForAdmin(league) {
    setGeneratingRegionalFixtures(league.id);
    try {
      const standings = await stageClient.entities.RegionalLeagueStanding.filter({ league_id: league.id }, null, 100).catch(() => []);
      if (standings.length < 2) {
        await swalAlert(t("admin.alerts.needTwoClubs"));
        return;
      }
      const maxClubs = Number(league.max_clubs) || 16;
      if (standings.length < maxClubs) {
        const ok = await swalConfirm(t("admin.alerts.leagueNotFullConfirm", { name: league.name, current: standings.length, max: maxClubs }));
        if (!ok) return;
      }
      const clubsForFixtures = standings.map(s => ({
        id: s.club_id,
        name: s.club_name,
        logo_url: s.club_logo_url || "",
        tag: s.club_tag || "",
      }));
      const { generateRegionalLeagueFixtures } = await import("@/lib/competitionUtils");
      await generateRegionalLeagueFixtures(league, clubsForFixtures);
      await loadAll();
      await swalAlert(t("admin.alerts.fixturesGenerated", { name: league.name }));
    } catch (err) {
      await swalAlert(t("admin.alerts.errorWithMessage", { message: err?.message || t("admin.alerts.unknownError") }));
    } finally {
      setGeneratingRegionalFixtures(null);
    }
  }

  async function leagueLifecycleAction(league, action) {
    try {
      if (action === "open_registration") {
        const { openLeagueRegistration } = await import("@/lib/seasonLifecycle");
        await openLeagueRegistration(league);
        await loadAll();
      } else if (action === "archive") {
        if (!(await swalConfirm(t("admin.alerts.archiveSeasonConfirm", { name: league.name, number: league.season_number })))) return;
        const { archiveLeague } = await import("@/lib/seasonLifecycle");
        await archiveLeague(league);
        await loadAll();
        await swalAlert(t("admin.alerts.seasonArchived", { number: league.season_number }));
      } else if (action === "create_next") {
        const { createNextLeagueSeason } = await import("@/lib/seasonLifecycle");
        const next = await createNextLeagueSeason(league);
        await loadAll();
        await swalAlert(t("admin.alerts.nextSeasonDraft", { name: next.name, number: next.season_number }));
      }
    } catch (err) {
      await swalAlert(t("admin.alerts.errorWithMessage", { message: err?.message || t("admin.alerts.unknownError") }));
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
      await swalAlert(t("admin.alerts.errorWithMessage", { message: err?.message || t("admin.alerts.unknownError") }));
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
      await swalAlert(t("admin.alerts.errorWithMessage", { message: err?.message || t("admin.alerts.unknownError") }));
    } finally {
      setProcessingReg(false);
    }
  }

  async function saveCompRules() {
    if (!editingComp) return;
    setSavingComp(true);
    try {
      await stageClient.entities.Competition.update(editingComp, {
        max_clubs_per_season:           Number(compEditForm.max_clubs_per_season) || 36,
        qualification_spots_per_region: Number(compEditForm.qualification_spots_per_region) || 2,
        promotion_spots:                0,
        relegation_spots:               0,
        playoff_spots:                  Number(compEditForm.playoff_spots) || 16,
      });
      await loadAll();
      setEditingComp(null);
    } catch (err) {
      await swalAlert(t("admin.alerts.saveFailed", { message: err?.message || t("admin.alerts.unknownError") }));
    } finally {
      setSavingComp(false);
    }
  }

  async function saveLeagueRules() {
    if (!editingLeague) return;
    setSavingLeague(true);
    try {
      await stageClient.entities.RegionalLeague.update(editingLeague, {
        max_clubs:        Number(leagueEditForm.max_clubs) || 16,
        promoted_slots:   Number(leagueEditForm.promoted_slots) || 2,
      });
      await loadAll();
      setEditingLeague(null);
    } catch (err) {
      await swalAlert(t("admin.alerts.saveFailed", { message: err?.message || t("admin.alerts.unknownError") }));
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
        list = await (stageClient.entities.CompetitionFixture?.filter({ season_id: panel.id }, null, 200) ?? Promise.resolve([])).catch(() => []);
      } else {
        list = await (stageClient.entities.RegionalLeagueFixture?.filter({ league_id: panel.id }, null, 200) ?? Promise.resolve([])).catch(() => []);
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
        list = await (stageClient.entities.CompetitionStanding?.filter({ season_id: panel.id }, null, 50) ?? Promise.resolve([])).catch(() => []);
      } else {
        list = await (stageClient.entities.RegionalLeagueStanding?.filter({ league_id: panel.id }, null, 50) ?? Promise.resolve([])).catch(() => []);
      }
      setStandingsList(list.sort((a, b) => (a.position || 99) - (b.position || 99)));
    } finally {
      setLoadingStandings(false);
    }
  }

  async function removeClubFromCompetition(standing) {
    if (!standing?.club_id || !standingsPanel?.id) return;
    const targetLabel = standingsPanel.type === "competition" ? t("admin.alerts.competitionSeason") : t("admin.alerts.regionalLeague");
    const played = Number(standing.played || 0);
    const warning = played > 0
      ? t("admin.alerts.removeClubPlayedWarning", { club: standing.club_name, count: played, plural: played === 1 ? "" : "es" })
      : "";
    const ok = await swalConfirm(
      t("admin.alerts.removeClubConfirm", { club: standing.club_name || t("admin.alerts.thisClub"), target: targetLabel, warning })
    );
    if (!ok) return;

    const panel = standingsPanel;
    const reason = `Removed from ${panel.name || targetLabel} in admin Leagues panel`;
    setRemovingCompetitionClub(standing.id);
    try {
      await stageClient.functions.invoke("adminRemoveClubFromCompetition", {
        target_type: panel.type,
        target_id: panel.id,
        club_id: standing.club_id,
        standing_id: standing.id,
        reason,
      });
      setStandingsList(prev => prev.filter(row => row.id !== standing.id));
      await loadAll();
      await loadStandingsForPanel(panel);
      await swalAlert(t("admin.alerts.clubRemoved", { club: standing.club_name || t("admin.actions.club"), target: panel.name || targetLabel }));
    } catch (err) {
      await swalAlert(t("admin.alerts.removeClubFailed", { message: err?.message || err?.error || t("admin.alerts.unknownError") }));
    } finally {
      setRemovingCompetitionClub(null);
    }
  }

  async function processAdminResult() {
    if (!resultDialog) return;
    const { fixture, fixtureType } = resultDialog;
    const home = parseInt(resultForm.home_score);
    const away = parseInt(resultForm.away_score);
    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
      await swalAlert(t("admin.alerts.invalidScores"));
      return;
    }
    setSavingResult(true);
    try {
      if (fixtureType === "competition") {
        const winnerId = home > away ? fixture.home_club_id : away > home ? fixture.away_club_id : null;
        const winnerName = winnerId === fixture.home_club_id ? fixture.home_club_name
          : winnerId === fixture.away_club_id ? fixture.away_club_name : null;
        await stageClient.functions.invoke("competitionFixtureResult", {
          fixture_id: fixture.id,
          home_score: home,
          away_score: away,
          winner_club_id: winnerId,
          winner_club_name: winnerName,
          reason: "Submitted from admin fixtures panel",
        });
      } else {
        const winnerId = home > away ? fixture.home_club_id : away > home ? fixture.away_club_id : null;
        const winnerName = winnerId === fixture.home_club_id ? fixture.home_club_name
          : winnerId === fixture.away_club_id ? fixture.away_club_name : null;
        await stageClient.functions.invoke("regionalLeagueFixtureResult", {
          fixture_id: fixture.id,
          home_score: home,
          away_score: away,
          winner_club_id: winnerId,
          winner_club_name: winnerName,
          reason: "Submitted from admin fixtures panel",
        });
      }
      setResultDialog(null);
      setResultForm({ home_score: "", away_score: "" });
      if (fixturesPanel) await loadFixturesForPanel(fixturesPanel);
    } catch (err) {
      await swalAlert(t("admin.alerts.errorWithMessage", { message: err?.message || t("admin.alerts.failed") }));
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
    await swalAlert(t("admin.alerts.newsPosted"));
  }

  async function seedPressQuestions() {
    setSaving(true);
    const existing = await stageClient.entities.PressQuestion.list(null, 1);
    if (existing.length > 0) { await swalAlert(t("admin.alerts.pressQuestionsSeeded")); setSaving(false); return; }
    const questions = [
      { question: "How do you rate your team's performance today?", answer_a: "Outstanding — we gave 100%", answer_b: "Decent, but we can improve", answer_c: "Disappointing overall", answer_d: "The result doesn't reflect the game", category: "performance" },
      { question: "What was the key moment of the match?", answer_a: "Our first goal changed everything", answer_b: "A great defensive block in the second half", answer_c: "The red card shifted the momentum", answer_d: "The penalty decision was crucial", category: "match" },
      { question: "How do you assess your opponent?", answer_a: "Very tough and well-organized", answer_b: "We expected more from them", answer_c: "They surprised us with their tactics", answer_d: "Respect to them — fair game", category: "opponent" },
      { question: "What's the message to your fans?", answer_a: "We play for you — thank you!", answer_b: "We'll work harder next time", answer_c: "Keep believing in us", answer_d: "Your support makes the difference", category: "fans" },
      { question: "How are you preparing for the next match?", answer_a: "Full focus on recovery and analysis", answer_b: "We'll fix the tactical issues we saw today", answer_c: "Confidence is high after this result", answer_d: "One game at a time — that's our motto", category: "preparation" },
      { question: "How would you describe the atmosphere in the dressing room?", answer_a: "Buzzing — everyone is pumped!", answer_b: "Calm and focused", answer_c: "Disappointed but determined", answer_d: "United — we face it together", category: "team" },
    ];
    await stageClient.entities.PressQuestion.bulkCreate(questions);
    await swalAlert(t("admin.alerts.pressQuestionsSeedSuccess"));
    setSaving(false);
  }

  async function grantCredits() {
    if (!creditsDialog) return;
    setSaving(true);
    await stageClient.entities.Player.update(creditsDialog.id, { credits: (creditsDialog.credits || 0) + Number(creditsAmount) });
    setCreditsDialog(null); setCreditsAmount(""); setSaving(false);
    await loadAll();
  }

  // Lifestyle admin state
  const [lifestyleDialog, setLifestyleDialog] = useState(null); // null | 'add' | item (for edit)
  const [lifestyleForm, setLifestyleForm] = useState(
    /** @type {Record<string, unknown> & { name?: string; image_url?: string }} */ ({}),
  );
  const [lifestyleSaving, setLifestyleSaving] = useState(false);
  const [lifestyleImageFile, setLifestyleImageFile] = useState(null);
  const [lifestyleImageUploading, setLifestyleImageUploading] = useState(false);

  function openAddAsset() {
    setLifestyleForm({
      name: '', category: 'houses', subcategory: '', tier: 'standard', description: '',
      image_url: '', emoji: '', available_cities: '', sort_order: 0,
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
    } catch (e) { await swalAlert(e.message); }
    setLifestyleSaving(false);
  }

  async function deleteLifestyleAsset(item) {
    if (!(await swalConfirm(t("admin.alerts.deleteItemConfirm", { name: item.name })))) return;
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
      const fresh = await stageClient.entities.Player.get(playerWalletDialog.id).catch(() => null);
      if (fresh) setPlayerWalletDialog(fresh);
      setPlayers(prev => prev.map(p => p.id === playerWalletDialog.id ? { ...p, stc: fresh?.stc ?? p.stc } : p));
      await openPlayerWallet(fresh || playerWalletDialog);
      setWalletAdjustAmount("");
      setWalletAdjustNote("");
    } catch (err) {
      await swalAlert(err?.message || t("admin.alerts.failed"));
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
      await swalAlert(err?.message || t("admin.alerts.saveClubFinanceFailed"));
      setSaving(false);
      return;
    }
    setClubStcDialog(null);
    setClubStcAmount(""); setClubStcNote(""); setClubWageBudget(""); setClubTransferBudget("");
    setSaving(false);
    await loadAll();
  }

  async function reseedLifestyle() {
    if (!(await swalConfirm(t("admin.alerts.lifestyleReseedConfirm")))) return;
    setSaving(true);
    try {
      const result = await stageClient.functions.invoke('seedLifestyleItems', {});
      const fresh = await stageClient.entities.LifestyleItem.list('sort_order', 300).catch(() => []);
      setLifestyleItems(fresh);
      const data = result?.data || {};
      await swalAlert(t("admin.alerts.lifestyleReseedSuccess", { inserted: data.inserted || 0, updated: data.updated || 0 }));
    } catch (err) {
      await swalAlert(t("admin.alerts.reseedFailed", { message: err?.message || t("admin.alerts.unknownError") }));
    } finally {
      setSaving(false);
    }
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
    if (!(await swalConfirm(t("admin.alerts.rankingsResetConfirm")))) return;
    setResettingRankings(true);
    try {
      const allClubs = await stageClient.entities.Club.list(null, 500);
      await Promise.all(allClubs.map(c =>
        stageClient.entities.Club.update(c.id, {
          ranking_points:   0,
          global_rank:      0,
          regional_rank:    0,
          form:             [],
          win_streak:       0,
          loss_streak:      0,
        })
      ));
      await swalAlert(t("admin.alerts.rankingsResetSuccess", { count: allClubs.length, plural: allClubs.length !== 1 ? "s" : "" }));
    } catch (err) {
      await swalAlert(t("admin.alerts.resetFailed", { message: err?.message || t("admin.alerts.unknownError") }));
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

      if (!stageClient.entities.RankingConfig) {
        await swalAlert(t("admin.alerts.rankingConfigNotPublished"));
        return;
      }
      if (rankingConfigId) {
        await stageClient.entities.RankingConfig.update(rankingConfigId, payload);
      } else {
        const created = await stageClient.entities.RankingConfig.create(payload);
        setRankingConfigId(created.id);
      }
      await swalAlert(t("admin.alerts.rankingConfigSaved"));
    } catch (err) {
      await swalAlert(t("admin.alerts.saveFailed", { message: err?.message || t("admin.alerts.unknownError") }));
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
    if (!(await swalConfirm(t("admin.alerts.migrateClubsConfirm")))) return;
    setMigrating(true);
    setMigrateResult(null);
    try {
      const res = await stageClient.functions.invoke("clubFinance", {
        action: "rebalance_all_starter_clubs",
      });
      setMigrateResult({ success: true, count: res?.data?.count || 0 });
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
      <p className="text-sm text-muted-foreground uppercase tracking-widest">{t("admin.shell.adminAccessRequired")}</p>
      <Link to="/"><Button variant="outline" className="rounded">{t("admin.shell.goHome")}</Button></Link>
    </div>
  );

  const adminFormatRule = getTournamentFormatRule(tournamentForm.type);
  const adminMaxTeamOptions = getTournamentMaxTeamOptions(tournamentForm.type);
  const adminPrizeBreakdown = calculateTournamentPrizeBreakdown(tournamentForm.entry_fee_stc, tournamentForm.max_teams);

  const sectionContent = (
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
              identityClaims={identityClaims}
              playerSearch={playerSearch}
              setPlayerSearch={setPlayerSearch}
              setCreditsDialog={setCreditsDialog}
              setCreditsAmount={setCreditsAmount}
              openPlayerWallet={openPlayerWallet}
              kickFromClub={kickFromClub}
              grantStagePlus={grantStagePlus}
              removeStagePlus={removeStagePlus}
              reviewIdentityClaim={reviewIdentityClaim}
              deleteUserCompletely={deleteUserCompletely}
              onPlayerAccountDeleted={(playerId) => {
                setPlayers((prev) => prev.filter((p) => p.id !== playerId));
              }}
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
              onClubsChanged={loadAll}
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
              trophyItems={trophyItems}
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
              removeClubFromCompetition={removeClubFromCompetition}
              removingCompetitionClub={removingCompetitionClub}
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
              generateRegionalFixturesForAdmin={generateRegionalFixturesForAdmin}
              generatingRegionalFixtures={generatingRegionalFixtures}
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
              deleteTournament={deleteTournament}
              onRefresh={loadAll}
            />
          )}

          {adminTab === "international-tournaments" && (
            <InternationalTournamentsTab
              tournaments={internationalTournaments}
              electionsByTournament={internationalElections}
              squadsByTournament={internationalSquads}
              onCreate={createInternationalTournament}
              onUpdate={updateInternationalTournament}
              onOpenVoting={openInternationalVoting}
              onCloseVoting={closeInternationalVoting}
              onLockSquad={lockInternationalSquad}
              saving={savingInternationalTournament}
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
            <PressConferencesTab
              pressConferences={pressConferences}
              seedPressQuestions={seedPressQuestions}
              saving={saving}
            />
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
              newTrophyLinkedSource={newTrophyLinkedSource}
              setNewTrophyLinkedSource={setNewTrophyLinkedSource}
              uploadingTrophy={uploadingTrophy}
              trophyUploadError={trophyUploadError}
              trophyFileRef={trophyFileRef}
              createTrophyItem={createTrophyItem}
              deleteTrophyItem={deleteTrophyItem}
              updateTrophyItem={updateTrophyItem}
              trophyItems={trophyItems}
              competitions={competitions}
              regionalLeagues={regionalLeagues}
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

          {adminTab === "analytics" && (
            <AnalyticsTab />
          )}

          {adminTab === "store" && (
            <StoreTab />
          )}

          {adminTab === "identity-repair" && (
            <IdentityRepairTab />
          )}
    </>
  );

  const adminDialogs = (
    <>
      {/* Create Tournament Dialog */}
      <Dialog open={createTournamentOpen} onOpenChange={open => { if (!open) setAdminModalStep(1); setCreateTournamentOpen(open); }}>
        <DialogContent className="bg-card border-border max-w-2xl p-0 gap-0 flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
            <DialogTitle className="font-heading text-lg uppercase tracking-tight flex items-center gap-2 m-0">
              <Trophy className="w-4 h-4 text-primary" /> {t("admin.dialogs.createTournament")}
            </DialogTitle>
            <button type="button" onClick={() => { setAdminModalStep(1); setCreateTournamentOpen(false); }}
              className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step tabs */}
          <div className="flex border-b border-border shrink-0 px-6">
            {[
              { n: 1, label: t("admin.dialogs.stepSetup") },
              { n: 2, label: t("admin.dialogs.stepPrizeRules") },
              { n: 3, label: t("admin.dialogs.stepTrophyBanner") },
            ].map(({ n, label }) => (
              <button key={n} type="button" onClick={() => setAdminModalStep(n)}
                className={cn(
                  "pb-3 pt-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors -mb-px",
                  adminModalStep === n ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                )}>
                <span className={cn(
                  "inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] mr-1.5 font-black",
                  adminModalStep === n ? "bg-primary text-black" : "bg-secondary text-muted-foreground"
                )}>{n}</span>
                {label}
              </button>
            ))}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

            {/* ── Step 1: Setup ── */}
            {adminModalStep === 1 && (
              <>
                <div>
                  <label className="label-xs">{t("admin.dialogs.tournamentFor")}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[{v:"club",label:t("admin.dialogs.clubOption"),sub:t("admin.dialogs.clubOptionSub")},{v:"player",label:t("admin.dialogs.playerOption"),sub:t("admin.dialogs.playerOptionSub")}].map(opt => (
                      <button key={opt.v} type="button" onClick={() => setTournamentForm(f => ({ ...f, participant_type: opt.v }))}
                        className={cn("text-left px-3 py-2.5 rounded border transition-all",
                          tournamentForm.participant_type === opt.v ? "border-primary bg-primary/10" : "border-border bg-secondary hover:border-primary/40"
                        )}>
                        <p className={cn("text-sm font-bold", tournamentForm.participant_type === opt.v ? "text-primary" : "text-foreground")}>{opt.label}</p>
                        <p className="text-[10px] mt-0.5 text-muted-foreground">{opt.sub}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label-xs">{t("admin.dialogs.name")} <span className="text-destructive">{t("admin.dialogs.required")}</span></label>
                  <input value={tournamentForm.name} onChange={e => setTournamentForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder={t("admin.dialogs.namePlaceholder")} />
                </div>

                <div>
                  <label className="label-xs">{t("admin.dialogs.descriptionLabel")} <span className="font-normal lowercase text-muted-foreground">{t("admin.dialogs.optional")}</span></label>
                  <Textarea value={tournamentForm.description} onChange={e => setTournamentForm(f => ({ ...f, description: e.target.value }))}
                    className="bg-secondary border-border" rows={2} placeholder={t("admin.dialogs.descriptionPlaceholder")} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-xs">{t("admin.dialogs.format")}</label>
                    <Select value={tournamentForm.type} onValueChange={v => {
                      setTournamentForm(f => ({
                        ...applyTournamentFormat(f, v),
                        max_teams: Number(getTournamentFormatRule(v).defaultMaxTeams),
                      }));
                    }}>
                      <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="knockout">{t("admin.dialogs.formats.knockout")}</SelectItem>
                        <SelectItem value="league">{t("admin.dialogs.formats.league")}</SelectItem>
                        <SelectItem value="group_stage">{t("admin.dialogs.formats.group_stage")}</SelectItem>
                        <SelectItem value="double_elimination">{t("admin.dialogs.formats.double_elimination")}</SelectItem>
                        <SelectItem value="swiss_ucl">{t("admin.dialogs.formats.swiss_ucl")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="label-xs">{t("admin.dialogs.maxTeams")}</label>
                    <Select value={String(tournamentForm.max_teams)} onValueChange={v => setTournamentForm(f => ({ ...f, max_teams: Number(v) }))}>
                      <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {adminMaxTeamOptions.map(n => <SelectItem key={n} value={String(n)}>{t("admin.dialogs.teamsCount", { count: n })}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground mt-1">{adminFormatRule.hint}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-xs">{t("admin.dialogs.platform")}</label>
                    <Select value={tournamentForm.platform} onValueChange={v => setTournamentForm(f => ({ ...f, platform: v }))}>
                      <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PlayStation">{t("admin.dialogs.platforms.playstation")}</SelectItem>
                        <SelectItem value="Xbox">{t("admin.dialogs.platforms.xbox")}</SelectItem>
                        <SelectItem value="PC">{t("admin.dialogs.platforms.pc")}</SelectItem>
                        <SelectItem value="Cross-Platform">{t("admin.dialogs.platforms.crossPlatform")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="label-xs">{t("admin.dialogs.startDate")} <span className="text-destructive">{t("admin.dialogs.required")}</span></label>
                    <input type="datetime-local" value={tournamentForm.start_date} onChange={e => setTournamentForm(f => ({ ...f, start_date: e.target.value }))}
                      className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" />
                  </div>
                </div>

                <div>
                  <label className="label-xs">{t("admin.dialogs.region")}</label>
                  <Select value={tournamentForm.region} onValueChange={v => setTournamentForm(f => ({ ...f, region: v }))}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[["Global","🌍"],["Europe","🇪🇺"],["North America","🌎"]].map(([v,e]) => (
                        <SelectItem key={v} value={v}>{e} {v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="label-xs">{t("admin.dialogs.countryRestriction")} <span className="text-muted-foreground normal-case font-normal">{t("admin.dialogs.countryOptional")}</span></label>
                  <Select value={tournamentForm.country_code || "none"} onValueChange={v => setTournamentForm(f => ({ ...f, country_code: v === "none" ? "" : v }))}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder={t("admin.dialogs.allCountries")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("admin.dialogs.allCountriesOpen")}</SelectItem>
                      {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {tournamentForm.country_code && <p className="text-xs text-warning mt-1">{t("admin.dialogs.countryRestrictionWarning")}</p>}
                </div>
              </>
            )}

            {/* ── Step 2: Prize & Rules ── */}
            {adminModalStep === 2 && (
              <>
                <div>
                  <label className="label-xs">{t("admin.dialogs.entryFee")}</label>
                  <input type="number" min="0" value={tournamentForm.entry_fee_stc || ""} onChange={e => setTournamentForm(f => ({ ...f, entry_fee_stc: e.target.value }))}
                    className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder={t("admin.dialogs.stcPerEntry")} />
                  <div className="mt-3 border border-primary/20 bg-primary/5 rounded p-3 text-sm space-y-2">
                    <div className="flex justify-between"><span className="text-muted-foreground text-xs">{t("admin.dialogs.entryCost")}</span><span className="font-bold text-xs">{TOURNAMENT_CREDIT_COST} credits + {adminPrizeBreakdown.entryFee.toLocaleString()} STC</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground text-xs">{t("admin.dialogs.maxTeamsLabel")}</span><span className="font-bold text-xs">{tournamentForm.max_teams}</span></div>
                    <div className="h-px bg-primary/20" />
                    <div className="flex justify-between"><span className="text-xs text-yellow-400 font-bold">{t("admin.dialogs.winner70")}</span><span className="font-black text-warning">{adminPrizeBreakdown.winner.toLocaleString()} STC</span></div>
                    <div className="flex justify-between"><span className="text-xs text-muted-foreground font-bold">{t("admin.dialogs.runnerUp20")}</span><span className="font-bold text-foreground">{adminPrizeBreakdown.runnerUp.toLocaleString()} STC</span></div>
                    <div className="flex justify-between"><span className="text-xs text-muted-foreground font-bold">{t("admin.dialogs.thirdPlace10")}</span><span className="font-bold text-foreground">{adminPrizeBreakdown.thirdPlace.toLocaleString()} STC</span></div>
                    <div className="h-px bg-primary/20" />
                    <div className="flex justify-between"><span className="text-xs text-warning font-bold">{t("admin.dialogs.prizePoolLabel")}</span><span className="font-black text-warning">{adminPrizeBreakdown.pool.toLocaleString()} STC</span></div>
                  </div>
                </div>

                <div>
                  <label className="label-xs">{t("admin.dialogs.customRules")} <span className="font-normal lowercase text-muted-foreground">{t("admin.dialogs.optional")}</span></label>
                  <Textarea value={tournamentForm.custom_rules} onChange={e => setTournamentForm(f => ({ ...f, custom_rules: e.target.value }))}
                    className="bg-secondary border-border" rows={3} placeholder={t("admin.dialogs.customRulesPlaceholder")} />
                  <div className="mt-2">
                    <label className="flex items-center justify-center gap-2 h-9 rounded border border-dashed border-border hover:border-primary/40 text-muted-foreground text-xs cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      {rulesFile ? rulesFile.name : t("admin.dialogs.attachRulesFile")}
                      <input type="file" accept=".pdf,image/*" className="sr-only" onChange={e => setRulesFile(e.target.files[0])} />
                    </label>
                    {rulesFile && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-success flex-1 truncate">✓ {rulesFile.name}</span>
                        <button type="button" onClick={() => setRulesFile(null)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ── Step 3: Trophy & Banner ── */}
            {adminModalStep === 3 && (
              <>
                <div>
                  <label className="label-xs">{t("admin.dialogs.trophy")} <span className="font-normal lowercase text-muted-foreground">{t("admin.dialogs.trophyOptional")}</span></label>
                  <p className="text-[10px] text-muted-foreground mb-2">{t("admin.dialogs.selectFromLibrary")}</p>
                  {trophyItems.length > 0 ? (
                    <div className="border border-border rounded overflow-hidden mb-3">
                      <div className="grid grid-cols-4 gap-0 divide-x divide-y divide-border max-h-52 overflow-y-auto">
                        {trophyItems.map(t => (
                          <button key={t.id} type="button"
                            onClick={() => { setAdminTrophyItemId(t.id); setAdminTrophyFile(null); }}
                            className={cn(
                              "flex flex-col items-center gap-1 p-3 text-center transition-colors hover:bg-primary/5",
                              adminTrophyItemId === t.id && "bg-warning/10"
                            )}>
                            {t.image_url
                              ? <img src={t.image_url} alt={t.name} className="w-10 h-10 object-contain drop-shadow" />
                              : <Trophy className="w-8 h-8 text-warning/20" />}
                            <span className="text-[9px] text-muted-foreground leading-tight line-clamp-2 w-full">{t.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic mb-3">{t("admin.dialogs.noTrophiesInLibrary")}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">{t("admin.dialogs.uploadNewTrophy")}</p>
                  {adminTrophyFile ? (
                    <div className="flex items-center gap-3 bg-warning/10 border border-warning/20 rounded-lg p-3">
                      <img src={URL.createObjectURL(adminTrophyFile)} alt="trophy" className="w-10 h-10 object-contain" />
                      <span className="text-xs text-warning flex-1 truncate">{adminTrophyFile.name}</span>
                      <button type="button" onClick={() => setAdminTrophyFile(null)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <label className="w-full h-12 rounded-lg border-2 border-dashed border-warning/30 hover:border-warning/60 flex items-center justify-center gap-2 text-warning/60 hover:text-warning transition-colors cursor-pointer">
                      <Upload className="w-4 h-4" />
                      <span className="text-xs">{t("admin.dialogs.uploadTrophyPng")}</span>
                      <input type="file" accept="image/png,image/*" className="sr-only" onChange={e => { if (e.target.files[0]) { setAdminTrophyFile(e.target.files[0]); setAdminTrophyItemId(""); } }} />
                    </label>
                  )}
                  {(adminTrophyItemId || adminTrophyFile) && (
                    <p className="text-[10px] text-warning mt-1.5">{t("admin.dialogs.trophySelected")}</p>
                  )}
                </div>

                <div>
                  <label className="label-xs">{t("admin.dialogs.tournamentBanner")}</label>
                  <label className="flex items-center justify-center gap-2 border border-dashed border-border rounded p-4 cursor-pointer hover:border-primary/50 transition-colors mb-3">
                    <Upload className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{bannerFile ? bannerFile.name : t("admin.dialogs.uploadBanner")}</span>
                    <input type="file" accept="image/*" className="sr-only" onChange={e => setBannerFile(e.target.files[0])} />
                  </label>
                  {!bannerFile && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-2">{t("admin.dialogs.pickColor")}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {BANNER_COLORS.map(color => (
                          <button key={color} type="button" onClick={() => setBannerColor(color)}
                            style={{ background: color }}
                            className={cn("w-8 h-8 rounded border-2 transition-all",
                              bannerColor === color ? "border-primary scale-110" : "border-transparent hover:border-primary/50"
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {bannerFile && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-success flex-1 truncate">✓ {bannerFile.name}</span>
                      <button type="button" onClick={() => setBannerFile(null)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 border-t border-border px-6 py-4 flex items-center justify-between gap-3">
            <button type="button"
              onClick={() => setAdminModalStep(s => Math.max(1, s - 1))}
              disabled={adminModalStep === 1}
              className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center gap-1 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" /> {t("admin.actions.back")}
            </button>
            <div className="flex items-center gap-1.5">
              {[1,2,3].map(n => (
                <div key={n} className={cn("h-1.5 rounded-full transition-all", adminModalStep === n ? "w-5 bg-primary" : "w-1.5 bg-border")} />
              ))}
            </div>
            {adminModalStep < 3 ? (
              <button type="button"
                onClick={() => setAdminModalStep(s => Math.min(3, s + 1))}
                disabled={adminModalStep === 1 && !tournamentForm.name}
                className="text-xs font-bold text-primary hover:text-primary/80 disabled:opacity-30 flex items-center gap-1 transition-colors">
                {t("admin.actions.next")} <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <Button onClick={createTournament} disabled={!tournamentForm.name || !tournamentForm.start_date || saving}
                className="bg-primary text-primary-foreground gap-2 h-9 text-xs font-bold rounded">
                <Trophy className="w-3.5 h-3.5" />
                {saving ? t("admin.actions.creating") : t("admin.dialogs.createTournamentBtn")}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Resolve Dispute Dialog */}
      <Dialog open={!!resolveDialog} onOpenChange={() => { setResolveDialog(null); setSelectedWinner(""); setResolutionScore({ home_score: "", away_score: "" }); }}>
        <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle className="font-heading text-xl uppercase tracking-tight flex items-center gap-2"><Gavel className="w-5 h-5 text-primary" /> {t("admin.dialogs.resolveDispute")}</DialogTitle></DialogHeader>
          {resolveDialog && (() => {
            const m = resolveDialog.match;
            const parseSub = (raw) => { try { return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null; } catch { return null; } };
            const homeSub = parseSub(m.home_submission);
            const awaySub = parseSub(m.away_submission);
            const homeScore = homeSub ? `${homeSub.home_score} – ${homeSub.away_score}` : t("admin.actions.notSubmitted");
            const awayScore = awaySub ? `${awaySub.home_score} – ${awaySub.away_score}` : t("admin.actions.notSubmitted");
            const homeProof = homeSub?.proof_url;
            const awayProof = awaySub?.proof_url;
            const homeChoiceValue = m.home_club_id || m.home_player_id || "home";
            const awayChoiceValue = m.away_club_id || m.away_player_id || "away";
            const chooseSubmittedScore = (choice) => {
              const submission = choice === homeChoiceValue ? homeSub : awaySub;
              setSelectedWinner(choice);
              setResolutionScore({
                home_score: submission?.home_score != null ? String(submission.home_score) : "",
                away_score: submission?.away_score != null ? String(submission.away_score) : "",
              });
            };
            return (
              <div className="space-y-4 mt-2">
                <p className="text-sm text-muted-foreground"><strong className="text-foreground">{m.home_club_name || m.home_player_name}</strong> vs <strong className="text-foreground">{m.away_club_name || m.away_player_name}</strong></p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-secondary rounded-lg p-3 text-center">
                    <p className="text-muted-foreground text-xs mb-1">{m.home_club_name || m.home_player_name} {t("admin.dialogs.submitted")}</p>
                    <p className="font-bold text-foreground text-lg">{homeScore}</p>
                    {homeProof && <a href={homeProof} target="_blank" rel="noreferrer" className="text-[10px] text-primary underline block mt-1">{t("admin.actions.proof")}</a>}
                  </div>
                  <div className="bg-secondary rounded-lg p-3 text-center">
                    <p className="text-muted-foreground text-xs mb-1">{m.away_club_name || m.away_player_name} {t("admin.dialogs.submitted")}</p>
                    <p className="font-bold text-foreground text-lg">{awayScore}</p>
                    {awayProof && <a href={awayProof} target="_blank" rel="noreferrer" className="text-[10px] text-primary underline block mt-1">{t("admin.actions.proof")}</a>}
                  </div>
                </div>
                <div>
                  <label className="label-xs">{t("admin.dialogs.acceptSubmissionFrom")}</label>
                  <Select value={selectedWinner} onValueChange={chooseSubmittedScore}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder={t("admin.dialogs.selectResultPlaceholder")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={homeChoiceValue}>{m.home_club_name || m.home_player_name} ({t("admin.actions.home")}) — {homeScore}</SelectItem>
                      <SelectItem value={awayChoiceValue}>{m.away_club_name || m.away_player_name} ({t("admin.actions.away")}) — {awayScore}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="label-xs">{t("admin.dialogs.finalScore")}</label>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1 truncate">{m.home_club_name || m.home_player_name || t("admin.actions.home")}</p>
                      <input
                        type="number"
                        min="0"
                        value={resolutionScore.home_score}
                        onChange={e => setResolutionScore(score => ({ ...score, home_score: e.target.value }))}
                        className="w-full bg-secondary border border-border rounded px-3 py-2 text-center text-lg font-bold text-foreground outline-none focus:border-primary/50"
                        placeholder="0"
                      />
                    </div>
                    <span className="pb-2 text-lg font-bold text-muted-foreground">–</span>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1 truncate">{m.away_club_name || m.away_player_name || t("admin.actions.away")}</p>
                      <input
                        type="number"
                        min="0"
                        value={resolutionScore.away_score}
                        onChange={e => setResolutionScore(score => ({ ...score, away_score: e.target.value }))}
                        className="w-full bg-secondary border border-border rounded px-3 py-2 text-center text-lg font-bold text-foreground outline-none focus:border-primary/50"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
                <Button onClick={resolveDispute} disabled={!canResolveDisputeWithScore(selectedWinner, resolutionScore) || saving} className="w-full bg-primary text-primary-foreground leading-relaxed gap-2">
                  <Gavel className="w-4 h-4" /> {saving ? t("admin.actions.savingDots") : t("admin.dialogs.confirmResolution")}
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
              <Coins className="w-5 h-5 text-success" /> {t("admin.dialogs.playerWallet", { name: playerWalletDialog?.gamertag })}
            </DialogTitle>
          </DialogHeader>
          {playerWalletDialog && (
            <div className="space-y-5 mt-2">
              {/* Balance */}
              <div className="bg-gradient-to-br from-success/10 to-card rounded-2xl border border-success/20 p-5 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t("admin.dialogs.stcBalance")}</p>
                <p className="font-heading font-black text-4xl text-success">{(playerWalletDialog.stc || 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("admin.dialogs.stageCoin")}</p>
              </div>

              {/* Adjust balance */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("admin.dialogs.adjustBalance")}</p>
                <p className="text-[10px] text-muted-foreground">{t("admin.dialogs.adjustBalanceHint")}</p>
                <input
                  type="number"
                  value={walletAdjustAmount}
                  onChange={e => setWalletAdjustAmount(e.target.value)}
                  placeholder={t("admin.dialogs.adjustAmountPlaceholder")}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                />
                <input
                  type="text"
                  value={walletAdjustNote}
                  onChange={e => setWalletAdjustNote(e.target.value)}
                  placeholder={t("admin.dialogs.noteOptional")}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                />
                <Button onClick={applyWalletAdjust} disabled={walletAdjustAmount === "" || saving}
                  className="w-full bg-primary text-primary-foreground gap-2">
                  <Coins className="w-4 h-4" /> {saving ? t("admin.actions.applying") : t("admin.dialogs.applyAdjustment")}
                </Button>
              </div>

              {/* Transaction history */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{t("admin.dialogs.recentTransactions")}</p>
                {walletLoading ? (
                  <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
                ) : walletTxns.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">{t("admin.dialogs.noTransactions")}</p>
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
          <DialogHeader><DialogTitle className="font-heading text-xl uppercase tracking-tight flex items-center gap-2"><Coins className="w-5 h-5 text-success" /> {t("admin.dialogs.clubFinance", { name: clubStcDialog?.name })}</DialogTitle></DialogHeader>
          {clubStcDialog && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-secondary rounded-lg p-2">
                  <p className="text-muted-foreground">{t("admin.dialogs.balance")}</p>
                  <p className="font-bold text-success">{((clubStcDialog.stc||0)/1_000_000).toFixed(2)}M</p>
                </div>
                <div className="bg-secondary rounded-lg p-2">
                  <p className="text-muted-foreground">{t("admin.dialogs.wageBudget")}</p>
                  <p className="font-bold text-warning">{((clubStcDialog.wage_budget_stc||0)/1_000_000).toFixed(2)}M</p>
                </div>
                <div className="bg-secondary rounded-lg p-2">
                  <p className="text-muted-foreground">{t("admin.dialogs.transferBudgetLabel")}</p>
                  <p className="font-bold text-primary">{((clubStcDialog.transfer_budget_stc||0)/1_000_000).toFixed(2)}M</p>
                </div>
              </div>
              <div>
                <label className="label-xs">{t("admin.dialogs.adjustBalanceDelta")}</label>
                <input type="number" value={clubStcAmount} onChange={e => setClubStcAmount(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder={t("admin.dialogs.deltaPlaceholder")} />
                <p className="text-[10px] text-muted-foreground mt-1">{t("admin.dialogs.deltaHint")}</p>
              </div>
              <div>
                <label className="label-xs">{t("admin.dialogs.weeklyWageBudget")}</label>
                <input type="number" value={clubWageBudget} onChange={e => setClubWageBudget(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder={t("admin.dialogs.wageBudgetPlaceholder")} />
                <p className="text-[10px] text-muted-foreground mt-1">{t("admin.dialogs.wageBudgetHint")}</p>
              </div>
              <div>
                <label className="label-xs">{t("admin.dialogs.transferBudget")}</label>
                <input type="number" value={clubTransferBudget} onChange={e => setClubTransferBudget(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder={t("admin.dialogs.transferBudgetPlaceholder")} />
                <p className="text-[10px] text-muted-foreground mt-1">{t("admin.dialogs.transferBudgetHint")}</p>
              </div>
              <div>
                <label className="label-xs">{t("admin.dialogs.noteReason")}</label>
                <input type="text" value={clubStcNote} onChange={e => setClubStcNote(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder={t("admin.dialogs.noteReasonPlaceholder")} />
              </div>
              <Button onClick={saveClubFinance} disabled={saving || (clubStcAmount === "" && clubWageBudget === "" && clubTransferBudget === "")} className="w-full bg-success/20 text-success hover:bg-success/30 border border-success/40">
                {saving ? t("admin.actions.savingDots") : t("admin.dialogs.saveClubFinance")}
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
              <Check className="w-5 h-5 text-success" /> {t("admin.dialogs.enterResult")}
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
                  <label className="label-xs">{resultDialog.fixture.home_club_name} ({t("admin.actions.home")})</label>
                  <input type="number" min="0" value={resultForm.home_score}
                    onChange={e => setResultForm(f => ({ ...f, home_score: e.target.value }))}
                    className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                    placeholder="0" />
                </div>
                <div>
                  <label className="label-xs">{resultDialog.fixture.away_club_name} ({t("admin.actions.away")})</label>
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
                  ? t("admin.actions.processing")
                  : t("admin.dialogs.confirmScore", { home: resultForm.home_score || "?", away: resultForm.away_score || "?" })}
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
              <Check className="w-4 h-4 text-success" /> {t("admin.dialogs.approveRegistration")}
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
                    {approveRegDialog.preferred_division ? ` · ${t("admin.dialogs.prefersDiv", { n: approveRegDialog.preferred_division })}` : ""}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("admin.dialogs.assignToLeague")}
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
                        {t("admin.dialogs.noOpenLeagues", { region: approveRegDialog.region_name || approveRegDialog.region_slug, platform: approveRegDialog.platform })}
                      </div>
                    );
                  }
                  return (
                    <select value={approveTargetId} onChange={e => setApproveTargetId(e.target.value)}
                      className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50">
                      <option value="">{t("admin.dialogs.selectLeague")}</option>
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
                  {t("admin.actions.cancel")}
                </Button>
                <Button disabled={!approveTargetId || processingReg} onClick={handleApproveReg}
                  className="flex-1 bg-success/20 text-success hover:bg-success/30 border border-success/30 h-9 text-sm font-bold">
                  {processingReg ? t("admin.dialogs.approving") : t("admin.dialogs.confirmAssign")}
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
                ? <><X className="w-4 h-4 text-destructive" /> {t("admin.dialogs.rejectApplication")}</>
                : <><Flag className="w-4 h-4 text-muted-foreground" /> {t("admin.dialogs.addToWaitlist")}</>}
            </DialogTitle>
          </DialogHeader>
          {rejectNotesDialog && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">
                {rejectNotesDialog.action === "reject"
                  ? t("admin.dialogs.rejectApplicationMsg", { club: rejectNotesDialog.reg.club_name, region: rejectNotesDialog.reg.region_name || rejectNotesDialog.reg.region_slug })
                  : t("admin.dialogs.waitlistApplicationMsg", { club: rejectNotesDialog.reg.club_name, region: rejectNotesDialog.reg.region_name || rejectNotesDialog.reg.region_slug })}
              </p>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("admin.dialogs.noteToClub")}
                </label>
                <Textarea value={rejectNotes} onChange={e => setRejectNotes(e.target.value)}
                  placeholder={t("admin.dialogs.rejectNotePlaceholder")}
                  className="bg-secondary border-border text-foreground text-sm resize-none h-20" maxLength={300} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1 border-border h-9 text-sm"
                  onClick={() => { setRejectNotesDialog(null); setRejectNotes(""); }}>
                  {t("admin.actions.cancel")}
                </Button>
                <Button disabled={processingReg} onClick={handleRejectOrWaitlistReg}
                  className={cn("flex-1 h-9 text-sm font-bold",
                    rejectNotesDialog.action === "reject"
                      ? "bg-destructive/20 text-destructive hover:bg-destructive/30 border border-destructive/30"
                      : "bg-secondary text-foreground border border-border hover:bg-secondary/80")}>
                  {processingReg ? t("admin.actions.saving") : rejectNotesDialog.action === "reject" ? t("admin.actions.reject") : t("admin.actions.waitlist")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Grant Credits Dialog */}
      <Dialog open={!!creditsDialog} onOpenChange={() => setCreditsDialog(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-heading text-xl uppercase tracking-tight flex items-center gap-2"><Coins className="w-5 h-5 text-warning" /> {t("admin.dialogs.grantCredits")}</DialogTitle></DialogHeader>
          {creditsDialog && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">{t("admin.dialogs.playerLabel")} <strong className="text-foreground">{creditsDialog.gamertag}</strong></p>
              <p className="text-sm text-muted-foreground">{t("admin.dialogs.currentBalance")} <strong className="text-warning">{(creditsDialog.credits || 0).toLocaleString()} {t("admin.dialogs.credits")}</strong></p>
              <div>
                <label className="label-xs">{t("admin.dialogs.amountToAdd")}</label>
                <input type="number" value={creditsAmount} onChange={e => setCreditsAmount(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder={t("admin.dialogs.creditsPlaceholder")} />
              </div>
              <Button onClick={grantCredits} disabled={!creditsAmount || saving} className="w-full bg-warning/20 text-warning hover:bg-warning/30 border border-warning/40 leading-relaxed">
                {saving ? t("admin.actions.savingDots") : t("admin.dialogs.addCredits", { amount: Number(creditsAmount).toLocaleString() })}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );

  if (adminTab === null) {
    return (
      <>
        <AdminGamerLayout
          sectionKey={null}
          adminProfile={adminProfile}
          disputes={disputes}
          forfeits={forfeits}
          players={players}
          clubs={clubs}
          tournaments={tournaments}
          identityClaims={identityClaims}
          loading={loading}
          onRefresh={loadAll}
        >
          <AdminDashboardPanel
            disputes={disputes}
            forfeits={forfeits}
            players={players}
            clubs={clubs}
            tournaments={tournaments}
            identityClaims={identityClaims}
            expiredFixtures={expiredFixtures}
            regApplications={regApplications}
            loading={loading}
            onRefresh={loadAll}
          />
        </AdminGamerLayout>
        {adminDialogs}
      </>
    );
  }

  return (
    <>
      <AdminGamerLayout
        sectionKey={adminTab}
        adminProfile={adminProfile}
        disputes={disputes}
        forfeits={forfeits}
        players={players}
        clubs={clubs}
        tournaments={tournaments}
        identityClaims={identityClaims}
        loading={loading}
        onRefresh={loadAll}
      >
        {sectionContent}
      </AdminGamerLayout>
      {adminDialogs}
    </>
  );
}

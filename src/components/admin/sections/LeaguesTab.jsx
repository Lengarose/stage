import { useMemo, useState } from "react";
import SeasonCard from "@/components/admin/seasons/SeasonCard";
import ExpiredFixtureRow from "@/components/admin/disputes/ExpiredFixtureRow";
import { stageClient } from "@/api/stageClient";
import {
  OFFICIAL_STAGE_TOURNAMENT_MAX_CLUBS,
  REGIONS,
  LEAGUE_DEFINITIONS,
  STAGE_QUALIFICATION_RULES,
} from "@/lib/qualificationConfig";
import { getRegionalLeagueMaxClubs, isRegionalLeagueSetupSeedingOpen } from "@/lib/regionalLeagueRules";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/hooks/useTranslation";
import { getSeasonStatusLabel } from "@/lib/adminI18n";
import { Shield, Check, X, Pencil, ChevronDown, AlertTriangle, Trash2, ImagePlus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { calculatePrizePool, formatStcCompact } from "@/lib/prizeDefaults";
import { swalAlert, swalConfirm, swalPrompt } from "@/lib/swal";

function getQualificationRuleForCompetition(slug) {
  return STAGE_QUALIFICATION_RULES.find(rule => rule.competitionSlug === slug);
}

function formatPositionRange(positions = []) {
  if (!positions.length) return "—";
  return positions.length === 1 ? String(positions[0]) : `${positions[0]}-${positions[positions.length - 1]}`;
}

function isFirstSeasonAdminSeedingOpen(league) {
  const status = String(league?.status || "").toLowerCase();
  if (["in_progress", "active", "completed", "archived"].includes(status)) return false;
  return (Number(league?.season_number) || 1) === 1;
}

const SEED_CLUB_PAGE_SIZE = 12;

export default function LeaguesTab({
  mode = "all",
  seedCompetitions,
  seedingComps,
  competitions,
  compSeasons,
  clubs = [],
  editingComp,
  setEditingComp,
  compEditForm,
  setCompEditForm,
  saveCompRules,
  savingComp,
  trophyItems = [],
  newSeasonForm,
  setNewSeasonForm,
  createCompetitionSeason,
  creatingLeagueSeason,
  regApplications,
  regAppFilter,
  setRegAppFilter,
  setApproveRegDialog,
  setApproveTargetId,
  setRejectNotesDialog,
  setRejectNotes,
  regionalLeagues,
  qualEntries,
  confirmQualEntry,
  rejectQualEntry,
  loadAll,
  fixturesOpen,
  setFixturesOpen,
  selectedFixtureSeason,
  setSelectedFixtureSeason,
  loadingFixtures,
  fixturesPanel,
  fixturesList,
  loadFixturesForPanel,
  selectedFixtureLeague,
  setSelectedFixtureLeague,
  setResultDialog,
  setResultForm,
  standingsOpen,
  setStandingsOpen,
  selectedStandingsSeason,
  setSelectedStandingsSeason,
  loadingStandings,
  standingsPanel,
  standingsList,
  loadStandingsForPanel,
  removeClubFromCompetition,
  removingCompetitionClub,
  selectedStandingsLeague,
  setSelectedStandingsLeague,
  seedRegionalLeagues,
  seedingRegionalLeagues,
  editingLeague,
  setEditingLeague,
  leagueEditForm,
  setLeagueEditForm,
  saveLeagueRules,
  savingLeague,
  leagueLifecycleAction,
  generateRegionalFixturesForAdmin,
  generatingRegionalFixtures,
  processingLeagueEnd,
  processLeagueEnd,
  expiredFixtures,
  schedulingAdminBusy,
  setSchedulingAdminBusy,
}) {
  const { t } = useTranslation();
  const showGost = mode !== "regional";
  const showRegional = mode !== "gost";
  const [replaceClubByStanding, setReplaceClubByStanding] = useState({});
  const [replacingCompetitionClub, setReplacingCompetitionClub] = useState(null);
  const [resettingLeagueScope, setResettingLeagueScope] = useState(null);
  const [adminClubByLeague, setAdminClubByLeague] = useState({});
  const [seedClubModalLeagueId, setSeedClubModalLeagueId] = useState(null);
  const [seedClubSearchByLeague, setSeedClubSearchByLeague] = useState({});
  const [seedClubPageByLeague, setSeedClubPageByLeague] = useState({});
  const [registeringLeagueClub, setRegisteringLeagueClub] = useState(null);
  const [simulatingLeagueFixtures, setSimulatingLeagueFixtures] = useState(null);
  const activeStandingClubIds = useMemo(
    () => new Set((standingsList || []).filter(row => !row.is_excluded).map(row => String(row.club_id))),
    [standingsList]
  );

  function getLeagueRegisteredIds(league) {
    const ids = Array.isArray(league?.registered_club_ids)
      ? league.registered_club_ids
      : [];
    return new Set(ids.map(id => String(id)));
  }

  function getAvailableClubsForLeague(league) {
    const registeredIds = getLeagueRegisteredIds(league);
    return (clubs || [])
      .filter(club => club?.id && !registeredIds.has(String(club.id)))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }

  function getSelectedClubIdsForLeague(leagueId) {
    const value = adminClubByLeague[leagueId];
    if (Array.isArray(value)) return value.map(String);
    return value ? [String(value)] : [];
  }

  function setSelectedClubIdsForLeague(leagueId, updater) {
    setAdminClubByLeague(prev => {
      const current = Array.isArray(prev[leagueId])
        ? prev[leagueId].map(String)
        : prev[leagueId]
          ? [String(prev[leagueId])]
          : [];
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [leagueId]: [...new Set((next || []).map(String))] };
    });
  }

  function toggleSelectedClubForLeague(leagueId, clubId) {
    setSelectedClubIdsForLeague(leagueId, current => (
      current.includes(String(clubId))
        ? current.filter(id => id !== String(clubId))
        : [...current, String(clubId)]
    ));
  }

  function setSeedClubSearch(leagueId, value) {
    setSeedClubSearchByLeague(prev => ({ ...prev, [leagueId]: value }));
    setSeedClubPageByLeague(prev => ({ ...prev, [leagueId]: 1 }));
  }

  function setSeedClubPage(leagueId, page) {
    setSeedClubPageByLeague(prev => ({ ...prev, [leagueId]: page }));
  }

  async function uploadPublicMedia(entityName, row, fieldName, file) {
    if (!file || !row?.id) return;
    try {
      const res = await stageClient.integrations.Core.UploadFile({ file, timeoutMs: 45000 });
      await stageClient.entities[entityName].update(row.id, { [fieldName]: res.file_url });
      await loadAll?.();
    } catch (err) {
      window.alert(err?.message || `Could not upload ${fieldName.replace("_", " ")}.`);
    }
  }

  async function replaceClubInCompetition(standing) {
    if (!standing?.club_id || !standingsPanel?.id) return;
    const replacementClubId = replaceClubByStanding[standing.id];
    const replacementClub = clubs.find(club => String(club.id) === String(replacementClubId));
    if (!replacementClub) {
      await swalAlert("Choose a replacement club first.");
      return;
    }
    const played = Number(standing.played || 0);
    const targetName = standingsPanel.name || (standingsPanel.type === "competition" ? "GOST season" : "Regional League");
    const warning = played > 0
      ? `\n\nWarning: ${standing.club_name} already has ${played} played fixture${played === 1 ? "" : "s"}. Played fixtures will stay as history, future fixtures move to ${replacementClub.name}, and ${standing.club_name} will be excluded from rewards.`
      : "";
    const ok = await swalConfirm(`Replace ${standing.club_name} with ${replacementClub.name} in ${targetName}?${warning}`);
    if (!ok) return;

    const payload = {
      target_type: standingsPanel.type,
      target_id: standingsPanel.id,
      club_id: standing.club_id,
      standing_id: standing.id,
      action: "replace",
      replacement_club_id: replacementClub.id,
      force: played > 0,
      reason: `Replaced ${standing.club_name} with ${replacementClub.name} in admin Leagues panel`,
    };

    setReplacingCompetitionClub(standing.id);
    try {
      await stageClient.functions.invoke("adminManageLeagueClub", payload);
      setReplaceClubByStanding(prev => ({ ...prev, [standing.id]: "" }));
      await loadAll?.();
      await loadStandingsForPanel?.(standingsPanel);
      await swalAlert(`${standing.club_name} was replaced by ${replacementClub.name}.`);
    } catch (err) {
      const message = err?.message || err?.error || "";
      if (message.startsWith("PLAYED_FIXTURES_REQUIRE_CONFIRMATION:")) {
        const count = Number(message.split(":")[1] || 0);
        const forceOk = await swalConfirm(`${standing.club_name} has ${count} played fixture${count === 1 ? "" : "s"}. Continue and keep played fixtures as history while excluding the old club from rewards?`);
        if (forceOk) {
          await stageClient.functions.invoke("adminManageLeagueClub", { ...payload, force: true });
          await loadAll?.();
          await loadStandingsForPanel?.(standingsPanel);
          await swalAlert(`${standing.club_name} was replaced by ${replacementClub.name}.`);
        }
      } else {
        await swalAlert(`Could not replace club: ${message || "Unknown error"}`);
      }
    } finally {
      setReplacingCompetitionClub(null);
    }
  }

  async function resetLeagueCompetitionData(scope) {
    const label = scope === "gost"
      ? "GOST"
      : scope === "regional"
        ? "Regional League"
        : "Regional League and GOST";
    const ok = await swalConfirm(
      `This will permanently clear generated ${label} fixtures, standings, season rows, qualification/registration entries, old league achievements, availability rows, and linked engine rows.\n\nReward configs, trophy items, clubs, and players will stay available.\n\nDo you want to continue?`,
      {
        title: `Reset ${label} data?`,
        confirmText: "Continue",
        cancelText: "Cancel",
        icon: "warning",
      }
    );
    if (!ok) return;

    const confirmation = await swalPrompt(
      `Type RESET LEAGUES to confirm this fresh-start reset for ${label}.`,
      {
        title: "Final confirmation",
        placeholder: "RESET LEAGUES",
        confirmText: "Reset data",
        cancelText: "Cancel",
      }
    );
    if (confirmation !== "RESET LEAGUES") {
      await swalAlert("Reset cancelled. Confirmation phrase did not match.");
      return;
    }

    setResettingLeagueScope(scope);
    try {
      const response = await stageClient.functions.invoke("adminResetLeagueCompetitionData", {
        scope,
        confirmation,
        reason: `Fresh-start reset for ${label}`,
      });
      const summary = response?.data || response || {};
      await loadAll?.();
      await swalAlert(
        `${label} reset complete.\n\nDeleted league rows: ${summary.deleted_league_entities || 0}\nDeleted matches: ${summary.deleted_matches || 0}\nDeleted availability rows: ${summary.deleted_availability || 0}\nDeleted lineups: ${summary.deleted_lineups || 0}\nReset competitions: ${summary.reset_competitions || 0}\nReset regional leagues: ${summary.reset_regional_leagues || 0}`
      );
    } catch (err) {
      await swalAlert(`Could not reset ${label}: ${err?.message || err?.error || "Unknown error"}`);
    } finally {
      setResettingLeagueScope(null);
    }
  }

  async function adminRegisterClubToRegionalLeague(league) {
    const selectedClubIds = getSelectedClubIdsForLeague(league.id);
    const selectedClubs = selectedClubIds
      .map(clubId => clubs.find(item => String(item.id) === String(clubId)))
      .filter(Boolean);
    if (!selectedClubs.length) {
      await swalAlert("Choose at least one club first.");
      return;
    }
    const seedingOpen = isRegionalLeagueSetupSeedingOpen(league) || isFirstSeasonAdminSeedingOpen(league);
    const capacityRemaining = Math.max(0, getRegionalLeagueMaxClubs(league) - Number(league.num_clubs || 0));
    if (selectedClubs.length > capacityRemaining) {
      await swalAlert(`This division only has ${capacityRemaining} open spot${capacityRemaining === 1 ? "" : "s"}. Untick ${selectedClubs.length - capacityRemaining} club${selectedClubs.length - capacityRemaining === 1 ? "" : "s"} first.`);
      return;
    }
    const clubNames = selectedClubs.map(club => club.name).join(", ");
    const ok = await swalConfirm(
      seedingOpen
        ? `Seed ${selectedClubs.length} club${selectedClubs.length === 1 ? "" : "s"} into ${league.name}?\n\n${clubNames}\n\nThis is allowed during season setup. Once fixtures are generated, placement locks and promotion/relegation rules take over.`
        : `Add ${selectedClubs.length} club${selectedClubs.length === 1 ? "" : "s"} to ${league.name}?\n\n${clubNames}\n\nThis league is outside setup seeding, so normal placement rules should apply.`
    );
    if (!ok) return;

    setRegisteringLeagueClub(league.id);
    try {
      let added = 0;
      const failed = [];
      for (const club of selectedClubs) {
        try {
          const response = await stageClient.functions.invoke("adminRegisterClubToRegionalLeague", {
            league_id: league.id,
            club_id: club.id,
            admin_seeding: seedingOpen,
            reason: seedingOpen
              ? `Admin season setup seeding for ${club.name}`
              : `Admin direct Regional League registration for ${club.name}`,
          });
          const data = response?.data || response || {};
          added += Number(data.added || 0);
        } catch (err) {
          failed.push(`${club.name}: ${err?.message || err?.error || "Unknown error"}`);
        }
      }
      setAdminClubByLeague(prev => ({ ...prev, [league.id]: [] }));
      await loadAll?.();
      if (failed.length) {
        await swalAlert(`${added} club${added === 1 ? "" : "s"} added to ${league.name}.\n\nCould not add:\n${failed.join("\n")}`);
      } else {
        setSeedClubModalLeagueId(null);
        await swalAlert(`${added} club${added === 1 ? "" : "s"} added to ${league.name}.`);
      }
    } catch (err) {
      await swalAlert(`Could not add club: ${err?.message || err?.error || "Unknown error"}`);
    } finally {
      setRegisteringLeagueClub(null);
    }
  }

  async function simulateRegionalLeagueFixtures(league) {
    const ok = await swalConfirm(`Simulate all unplayed fixtures for ${league.name}? This will enter scores and update the table.`);
    if (!ok) return;

    setSimulatingLeagueFixtures(league.id);
    try {
      const response = await stageClient.functions.invoke("simulateRegionalLeagueFixtures", {
        league_id: league.id,
        reason: `Admin simulated fixtures for ${league.name}`,
      });
      const data = response?.data || response || {};
      await loadAll?.();
      if (fixturesPanel?.type === "league" && fixturesPanel.id === league.id) {
        await loadFixturesForPanel?.(fixturesPanel);
      }
      if (standingsPanel?.type === "league" && standingsPanel.id === league.id) {
        await loadStandingsForPanel?.(standingsPanel);
      }
      await swalAlert(`Simulated ${data.simulated || 0} fixture${Number(data.simulated || 0) === 1 ? "" : "s"} for ${league.name}.`);
    } catch (err) {
      await swalAlert(`Could not simulate fixtures: ${err?.message || err?.error || "Unknown error"}`);
    } finally {
      setSimulatingLeagueFixtures(null);
    }
  }

  const seedModalLeague = useMemo(
    () => regionalLeagues.find(league => String(league.id) === String(seedClubModalLeagueId)) || null,
    [regionalLeagues, seedClubModalLeagueId]
  );
  const seedModalAvailableClubs = seedModalLeague ? getAvailableClubsForLeague(seedModalLeague) : [];
  const seedModalSearch = seedModalLeague ? (seedClubSearchByLeague[seedModalLeague.id] || "") : "";
  const seedModalSelectedClubIds = seedModalLeague ? getSelectedClubIdsForLeague(seedModalLeague.id) : [];
  const seedModalSelectedClubIdSet = new Set(seedModalSelectedClubIds);
  const seedModalCapacityRemaining = seedModalLeague
    ? Math.max(0, getRegionalLeagueMaxClubs(seedModalLeague) - Number(seedModalLeague.num_clubs || 0))
    : 0;
  const seedModalFilteredClubs = seedModalAvailableClubs.filter(club => {
    const q = seedModalSearch.trim().toLowerCase();
    if (!q) return true;
    return `${club.name || ""} ${club.tag || ""}`.toLowerCase().includes(q);
  });
  const seedModalPageCount = Math.max(1, Math.ceil(seedModalFilteredClubs.length / SEED_CLUB_PAGE_SIZE));
  const seedModalPage = Math.min(
    seedModalPageCount,
    Math.max(1, Number(seedClubPageByLeague[seedModalLeague?.id] || 1))
  );
  const seedModalPageClubs = seedModalFilteredClubs.slice(
    (seedModalPage - 1) * SEED_CLUB_PAGE_SIZE,
    seedModalPage * SEED_CLUB_PAGE_SIZE
  );

  return (
    <div className="max-w-3xl space-y-6">

      <div className="border border-destructive/30 bg-destructive/5 rounded p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <h3 className="font-heading text-sm uppercase tracking-widest">Fresh-start reset</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Clears generated league/GOST history only. Reward configs, trophy items, clubs, and players are kept.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {showGost && (
              <Button
                type="button"
                variant="outline"
                disabled={Boolean(resettingLeagueScope)}
                onClick={() => resetLeagueCompetitionData("gost")}
                className="h-8 rounded border-destructive/40 px-3 text-xs font-bold uppercase tracking-wider text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {resettingLeagueScope === "gost" ? "Resetting..." : "Reset GOST"}
              </Button>
            )}
            {showRegional && (
              <Button
                type="button"
                variant="outline"
                disabled={Boolean(resettingLeagueScope)}
                onClick={() => resetLeagueCompetitionData("regional")}
                className="h-8 rounded border-destructive/40 px-3 text-xs font-bold uppercase tracking-wider text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {resettingLeagueScope === "regional" ? "Resetting..." : "Reset Regional"}
              </Button>
            )}
            {showGost && showRegional && (
              <Button
                type="button"
                variant="outline"
                disabled={Boolean(resettingLeagueScope)}
                onClick={() => resetLeagueCompetitionData("all")}
                className="h-8 rounded border-destructive/50 px-3 text-xs font-bold uppercase tracking-wider text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {resettingLeagueScope === "all" ? "Resetting..." : "Reset All"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Official STAGE Tournaments — qualification-only rules */}
      <div className={cn("bg-card border border-border rounded p-5 space-y-3", !showGost && "hidden")}>
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="font-heading text-base uppercase tracking-tight text-foreground">{t("admin.leagues.stageCompetitions")}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{t("admin.leagues.stageCompetitionsDesc")}</p>
      </div>
      <Button onClick={seedCompetitions} disabled={seedingComps || competitions.length >= 3} className="bg-primary text-primary-foreground h-8 text-xs rounded gap-1.5">
        {seedingComps ? t("admin.leagues.seeding") : competitions.length >= 3 ? t("admin.leagues.seeded") : t("admin.leagues.seedCompetitions")}
      </Button>
    </div>
    <div className="space-y-3">
      {[{slug:"supreme",color:"#FFD700"},{slug:"elite",color:"#00E5BD"},{slug:"challenger",color:"#A78BFA"}].map(tier => {
        const comp = competitions.find(c => c.slug === tier.slug);
        if (!comp) return (
          <div key={tier.slug} className="border border-dashed border-border rounded p-3 opacity-40">
            <p className="text-xs text-muted-foreground capitalize">{t("admin.leagues.notSeeded", { slug: tier.slug })}</p>
          </div>
        );
        const seasons = compSeasons.filter(s => s.competition_id === comp.id);
        const isEditing = editingComp === comp.id;
        const qualificationRule = getQualificationRuleForCompetition(comp.slug);
        const qualifyingRange = formatPositionRange(qualificationRule?.positions);
        return (
          <div key={tier.slug} className="border border-border rounded p-3 space-y-2" style={{ borderLeftColor: tier.color, borderLeftWidth: 2 }}>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <p className="text-xs font-bold text-foreground">{comp.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Tier {comp.tier} · {seasons.length} season{seasons.length !== 1 ? "s" : ""} · {comp.max_clubs_per_season || OFFICIAL_STAGE_TOURNAMENT_MAX_CLUBS} clubs · Division 1 positions {qualifyingRange}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Six qualifiers per top-flight regional league. No public entry, wildcards or manual invites.
                </p>
              </div>
              <Button size="sm" variant="outline"
                className={cn("h-7 text-xs rounded gap-1.5 shrink-0", isEditing ? "border-destructive/30 text-destructive" : "border-border text-muted-foreground hover:text-foreground")}
                onClick={() => {
                  if (isEditing) { setEditingComp(null); }
                  else { setEditingComp(comp.id); setCompEditForm({ max_clubs_per_season: comp.max_clubs_per_season ?? OFFICIAL_STAGE_TOURNAMENT_MAX_CLUBS, playoff_spots: comp.playoff_spots ?? 16 }); }
                }}>
                {isEditing ? <X className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                {isEditing ? t("admin.actions.cancel") : t("admin.leagues.editRules")}
              </Button>
              <Link to={`/competitions/${comp.slug}`}>
                <Button size="sm" variant="outline" className="h-7 text-xs rounded border-border text-muted-foreground hover:text-foreground shrink-0">{t("admin.actions.view")}</Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { field: "logo_url", label: "Logo" },
                { field: "banner_url", label: "Banner" },
              ].map(item => (
                <label key={item.field} className="flex cursor-pointer items-center gap-2 rounded border border-border/60 bg-secondary/30 p-2 text-[10px] text-muted-foreground hover:border-primary/40 hover:text-foreground">
                  {comp[item.field]
                    ? <img src={comp[item.field]} alt="" className="h-8 w-10 shrink-0 object-cover" />
                    : <ImagePlus className="h-4 w-4 shrink-0 text-primary" />}
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold uppercase tracking-wider text-foreground">{item.label}</span>
                    <span className="block truncate">Upload PNG/image for public tournament page</span>
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/*"
                    className="sr-only"
                    onChange={e => uploadPublicMedia("Competition", comp, item.field, e.target.files?.[0])}
                  />
                </label>
              ))}
            </div>
            {isEditing && (
              <div className="pt-2 border-t border-border/50 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: "max_clubs_per_season",           label: t("admin.leagues.maxClubsSeason") },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="text-[10px] text-muted-foreground mb-1 block">{label}</label>
                      <Input type="number" min={0} value={compEditForm[key] ?? ""}
                        onChange={e => setCompEditForm(f => ({ ...f, [key]: e.target.value }))}
                        className="bg-secondary border-border text-xs h-8" />
                    </div>
                  ))}
                </div>
                {(() => {
                  const linked = trophyItems.find(t => t.linked_source_id === comp.id);
                  return linked ? (
                    <div className="flex items-center gap-2 p-2 bg-warning/5 border border-warning/20 rounded">
                      {linked.image_url
                        ? <img src={linked.image_url} alt={linked.name} className="w-8 h-8 object-contain" />
                        : <div className="w-8 h-8" />}
                      <div>
                        <p className="text-[10px] font-bold text-warning">{linked.name}</p>
                        <p className="text-[9px] text-muted-foreground">{t("admin.leagues.linkedTrophyHint")}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">{t("admin.leagues.noTrophyLinked")}</p>
                  );
                })()}
                <Button size="sm" onClick={saveCompRules} disabled={savingComp}
                  className="bg-primary text-primary-foreground h-8 text-xs gap-1.5">
                  {savingComp ? <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin inline-block" /> : <Check className="w-3.5 h-3.5" />}
                  {savingComp ? t("admin.actions.saving") : t("admin.leagues.saveRules")}
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>

  {/* Start New Season */}
  {showGost && competitions.length > 0 && (
    <div className="bg-card border border-border rounded p-5 space-y-4">
      <h3 className="font-heading text-base uppercase tracking-tight text-foreground">{t("admin.leagues.startNewSeason")}</h3>
      <p className="text-xs text-muted-foreground">
        {t("admin.leagues.startNewSeasonDesc")}
      </p>
      <div>
        <label className="label-xs">{t("admin.leagues.competition")}</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {competitions.map(c => (
            <button key={c.id} type="button"
              onClick={() => setNewSeasonForm(f => ({
                ...f,
                competition_id: c.id,
                num_clubs: OFFICIAL_STAGE_TOURNAMENT_MAX_CLUBS,
                prize_pool_stc: calculatePrizePool("competition", c, OFFICIAL_STAGE_TOURNAMENT_MAX_CLUBS),
              }))}
              className={cn("rounded border px-3 py-2 text-left text-xs font-bold transition-all",
                newSeasonForm.competition_id === c.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
              )}>
              {c.name.replace("STAGE ", "")}
              <span className="block text-[9px] font-normal mt-0.5 opacity-60">
                Season {compSeasons.filter(s => s.competition_id === c.id).length > 0
                  ? Math.max(...compSeasons.filter(s => s.competition_id === c.id).map(s => s.season_number)) + 1
                  : 1} next
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-xs">{t("admin.leagues.platform")}</label>
          <select value={newSeasonForm.platform} onChange={e => setNewSeasonForm(f => ({ ...f, platform: e.target.value }))}
            className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50">
            {["Cross-Platform","PlayStation","Xbox","PC"].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label-xs">{t("admin.leagues.region")}</label>
          <select value={newSeasonForm.region} onChange={e => setNewSeasonForm(f => ({ ...f, region: e.target.value }))}
            className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50">
            {["Global","Europe","North America"].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-xs">{t("admin.leagues.targetQualifiedClubs")}</label>
          <div className="w-full bg-secondary/70 border border-border rounded px-3 py-2 text-sm text-foreground">
            {OFFICIAL_STAGE_TOURNAMENT_MAX_CLUBS}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Official STAGE tournaments are fixed 36-club events.</p>
        </div>
        <div>
          <label className="label-xs">{t("admin.leagues.leagueMatchdays")}</label>
          <input type="number" min="2" max="20" value={newSeasonForm.num_league_matchdays ?? 8}
            onChange={e => setNewSeasonForm(f => ({ ...f, num_league_matchdays: e.target.value }))}
            className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" />
        </div>
      </div>
      <div>
        <label className="label-xs">{t("admin.leagues.prizePool")}</label>
        <input type="number" min="0" value={newSeasonForm.prize_pool_stc}
          onChange={e => setNewSeasonForm(f => ({ ...f, prize_pool_stc: e.target.value }))}
          className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
          placeholder="e.g. 5000000" />
        <p className="text-[10px] text-muted-foreground mt-1">
          Defaults fill automatically from the selected tier. Current pool: {formatStcCompact(newSeasonForm.prize_pool_stc || 0)}.
        </p>
      </div>
      <Button onClick={createCompetitionSeason} disabled={creatingLeagueSeason || !newSeasonForm.competition_id}
        className="w-full bg-primary text-primary-foreground h-9 text-xs rounded font-bold gap-2">
        {creatingLeagueSeason ? t("admin.leagues.creating") : t("admin.leagues.createSeason")}
      </Button>
    </div>
  )}

  {/* ── Registration Applications ── */}
  <div className={cn(!showRegional && "hidden")}>
    {(() => {
      const actionable = regApplications.filter(r => r.status === "pending" || r.status === "waitlisted");
      const displayApps = regAppFilter === "actionable" ? actionable : regApplications;
      const pendingCount = regApplications.filter(r => r.status === "pending").length;
      const waitlistCount = regApplications.filter(r => r.status === "waitlisted").length;
      return (
        <>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="font-heading text-base uppercase tracking-tight text-foreground">
              {t("admin.leagues.registrationApplications")}
              {actionable.length > 0 && (
                <span className="ml-2 text-[10px] text-warning border border-warning/30 bg-warning/5 px-1.5 py-0.5 rounded font-bold">
                  {actionable.length}
                </span>
              )}
            </h3>
            <div className="flex gap-1">
              {[["actionable", t("admin.leagues.needsAction")], ["all", t("admin.leagues.all")]].map(([v, label]) => (
                <button key={v} type="button" onClick={() => setRegAppFilter(v)}
                  className={cn("text-[10px] px-2 py-1 rounded border font-bold uppercase tracking-wider transition-colors",
                    regAppFilter === v
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:text-foreground")}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {pendingCount > 0 || waitlistCount > 0 ? (
            <p className="text-[10px] text-muted-foreground mb-3">
              {pendingCount > 0 && `${pendingCount} pending`}
              {pendingCount > 0 && waitlistCount > 0 && " · "}
              {waitlistCount > 0 && `${waitlistCount} waitlisted`}
            </p>
          ) : null}
          {displayApps.length === 0 ? (
            <div className="border border-dashed border-border rounded p-8 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                {regAppFilter === "actionable" ? t("admin.leagues.noApplicationsNeedAction") : t("admin.leagues.noRegistrationApplications")}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayApps.map(reg => {
                const statusCls = {
                  pending:    "text-warning border-warning/30 bg-warning/5",
                  approved:   "text-success border-success/30 bg-success/5",
                  rejected:   "text-destructive border-destructive/30 bg-destructive/5",
                  waitlisted: "text-muted-foreground border-border bg-secondary",
                }[reg.status] || "text-muted-foreground border-border";
                // Open leagues in the same region for approve target
                const candidateLeagues = regionalLeagues.filter(
                  l => l.region_slug === reg.region_slug
                    && l.status === "registration"
                    && (l.platform === reg.platform || l.platform === "Cross-Platform" || reg.platform === "Cross-Platform")
                ).sort((a, b) => (a.division || 1) - (b.division || 1));
                return (
                  <div key={reg.id} className="bg-card border border-border rounded p-3">
                    <div className="flex items-center gap-3">
                      {reg.club_logo_url
                        ? <img src={reg.club_logo_url} alt={reg.club_name} className="w-8 h-8 object-contain rounded shrink-0" />
                        : <Shield className="w-6 h-6 text-muted-foreground/30 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{reg.club_name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {reg.region_name || reg.region_slug} · {reg.platform}
                          {reg.applied_at ? ` · ${new Date(reg.applied_at).toLocaleDateString()}` : ""}
                        </p>
                        {reg.note_from_club && (
                          <p className="text-[10px] text-muted-foreground italic mt-0.5">"{reg.note_from_club}"</p>
                        )}
                        {reg.assigned_league_name && (
                          <p className="text-[10px] text-success mt-0.5">→ {reg.assigned_league_name}</p>
                        )}
                        {reg.admin_notes && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">Note: {reg.admin_notes}</p>
                        )}
                      </div>
                      <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0", statusCls)}>
                        {reg.status}
                      </span>
                    </div>
                    {(reg.status === "pending" || reg.status === "waitlisted") && (
                      <div className="flex gap-2 mt-2.5 pl-11">
                        <Button size="sm"
                          onClick={() => { setApproveRegDialog(reg); setApproveTargetId(candidateLeagues[0]?.id || ""); }}
                          className="bg-success/20 text-success hover:bg-success/30 border-0 h-7 text-xs rounded gap-1">
                          <Check className="w-3 h-3" />
                          {reg.status === "waitlisted" ? t("admin.leagues.promote") : t("admin.actions.approve")}
                        </Button>
                        <Button size="sm" variant="outline"
                          onClick={() => { setRejectNotesDialog({ reg, action: "waitlist" }); setRejectNotes(""); }}
                          className="border-border text-muted-foreground hover:text-foreground h-7 text-xs rounded gap-1"
                          disabled={reg.status === "waitlisted"}>
                          {t("admin.leagues.waitlist")}
                        </Button>
                        <Button size="sm" variant="outline"
                          onClick={() => { setRejectNotesDialog({ reg, action: "reject" }); setRejectNotes(""); }}
                          className="border-destructive/30 text-destructive hover:bg-destructive/10 h-7 text-xs rounded gap-1">
                          <X className="w-3 h-3" /> {t("admin.actions.reject")}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      );
    })()}
  </div>

  {/* Official tournament qualification entries */}
  <div className={cn(!showGost && "hidden")}>
    <h3 className="font-heading text-base uppercase tracking-tight text-foreground mb-3">
      {t("admin.leagues.pendingQualificationEntries")}
      {qualEntries.length > 0 && <span className="ml-2 text-[10px] text-primary border border-primary/30 bg-primary/5 px-1.5 py-0.5 rounded font-bold">{qualEntries.length}</span>}
    </h3>
    {qualEntries.length === 0 ? (
      <div className="border border-dashed border-border rounded p-8 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">{t("admin.leagues.noPendingEntries")}</p>
      </div>
    ) : (
      <div className="space-y-2">
        {qualEntries.map(e => (
          <div key={e.id} className="bg-card border border-border rounded p-3 flex items-center gap-3">
            {e.club_logo_url
              ? <img src={e.club_logo_url} alt={e.club_name} className="w-8 h-8 object-contain shrink-0" />
              : <Shield className="w-6 h-6 text-muted-foreground/30 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{e.club_name}</p>
              <p className="text-[10px] text-muted-foreground">
                {e.regional_league_name || e.source_type} · Pos. {e.regional_finish_position || "—"} → {e.target_competition_name}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" onClick={() => confirmQualEntry(e)} className="bg-success/20 text-success hover:bg-success/30 border-0 h-7 text-xs rounded gap-1">
                <Check className="w-3 h-3" /> {t("admin.actions.confirm")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => rejectQualEntry(e)} className="border-destructive/30 text-destructive hover:bg-destructive/10 h-7 text-xs rounded gap-1">
                <X className="w-3 h-3" /> {t("admin.actions.reject")}
              </Button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>

  {/* All Seasons */}
  {showGost && compSeasons.length > 0 && (
    <div>
      <h3 className="font-heading text-base uppercase tracking-tight text-foreground mb-3">{t("admin.leagues.allSeasons")}</h3>
      <div className="space-y-2">
        {compSeasons.map(s => (
          <SeasonCard key={s.id} season={s} onRefresh={loadAll} />
        ))}
      </div>
    </div>
  )}

  {/* Fixtures & Results — accordion */}
  <div className="bg-card border border-border rounded overflow-hidden">
    <button type="button" className="w-full flex items-center justify-between px-5 py-4 text-left"
      onClick={() => setFixturesOpen(v => !v)}>
      <h3 className="font-heading text-base uppercase tracking-tight text-foreground">{t("admin.leagues.fixturesResults")}</h3>
      <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", fixturesOpen && "rotate-180")} />
    </button>
    {fixturesOpen && (
      <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {showGost && (
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t("admin.leagues.competitionSeason")}</label>
            <select value={selectedFixtureSeason} onChange={e => setSelectedFixtureSeason(e.target.value)}
              className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50">
              <option value="">{t("admin.leagues.selectSeason")}</option>
              {compSeasons.map(s => (
                <option key={s.id} value={s.id}>{s.competition_name} — {s.season_label || `S${s.season_number}`} ({s.status})</option>
              ))}
            </select>
            <Button size="sm" disabled={!selectedFixtureSeason || loadingFixtures}
              onClick={() => { const s = compSeasons.find(x => x.id === selectedFixtureSeason); if (s) loadFixturesForPanel({ type: "competition", id: s.id, name: `${s.competition_name} ${s.season_label || ""}` }); }}
              className="h-7 text-xs bg-primary text-primary-foreground rounded gap-1.5">
              {loadingFixtures && fixturesPanel?.type === "competition" ? t("admin.actions.loading") : t("admin.leagues.loadFixtures")}
            </Button>
          </div>
          )}
          {showRegional && (
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t("admin.leagues.regionalLeague")}</label>
            <select value={selectedFixtureLeague} onChange={e => setSelectedFixtureLeague(e.target.value)}
              className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50">
              <option value="">{t("admin.leagues.selectLeague")}</option>
              {regionalLeagues.map(l => (
                <option key={l.id} value={l.id}>{l.name} (D{l.division || 1} · S{l.season_number})</option>
              ))}
            </select>
            <Button size="sm" disabled={!selectedFixtureLeague || loadingFixtures}
              onClick={() => { const l = regionalLeagues.find(x => x.id === selectedFixtureLeague); if (l) loadFixturesForPanel({ type: "league", id: l.id, name: l.name }); }}
              className="h-7 text-xs bg-primary text-primary-foreground rounded gap-1.5">
              {loadingFixtures && fixturesPanel?.type === "league" ? t("admin.actions.loading") : t("admin.leagues.loadFixtures")}
            </Button>
          </div>
          )}
        </div>
        {fixturesPanel && (
          <div>
            <p className="text-xs font-bold text-foreground mb-2">
              {fixturesPanel.name}
              <span className="ml-2 text-[10px] text-muted-foreground font-normal">({t("admin.leagues.fixtureCount", { count: fixturesList.length })})</span>
            </p>
            {loadingFixtures ? (
              <div className="flex justify-center py-6"><div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
            ) : fixturesList.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">{t("admin.leagues.noFixturesFound")}</p>
            ) : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {fixturesList.map(f => (
                  <div key={f.id} className="border border-border rounded p-2.5 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {f.home_club_name} <span className="text-muted-foreground text-[10px]">vs</span> {f.away_club_name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {f.matchday ? `MD ${f.matchday}` : f.phase || "—"} · {f.status || "scheduled"}
                      </p>
                    </div>
                    {(f.status === "completed" || f.stats_processed) ? (
                      <span className="text-xs font-bold text-success shrink-0">{f.home_score ?? "?"} – {f.away_score ?? "?"}</span>
                    ) : (
                      <Button size="sm" variant="outline"
                        onClick={() => { setResultDialog({ fixture: f, fixtureType: fixturesPanel.type === "competition" ? "competition" : "league" }); setResultForm({ home_score: "", away_score: "" }); }}
                        className="h-6 text-[10px] rounded border-primary/30 text-primary hover:bg-primary/10 shrink-0">
                        {t("admin.leagues.enterResult")}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )}
  </div>

  {/* Standings — accordion */}
  <div className="bg-card border border-border rounded overflow-hidden">
    <button type="button" className="w-full flex items-center justify-between px-5 py-4 text-left"
      onClick={() => setStandingsOpen(v => !v)}>
      <h3 className="font-heading text-base uppercase tracking-tight text-foreground">{t("admin.leagues.standings")}</h3>
      <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", standingsOpen && "rotate-180")} />
    </button>
    {standingsOpen && (
      <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {showGost && (
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Competition Season</label>
            <select value={selectedStandingsSeason} onChange={e => setSelectedStandingsSeason(e.target.value)}
              className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50">
              <option value="">— Select season —</option>
              {compSeasons.map(s => <option key={s.id} value={s.id}>{s.competition_name} — {s.season_label || `S${s.season_number}`}</option>)}
            </select>
            <Button size="sm" disabled={!selectedStandingsSeason || loadingStandings}
              onClick={() => { const s = compSeasons.find(x => x.id === selectedStandingsSeason); if (s) loadStandingsForPanel({ type: "competition", id: s.id, name: `${s.competition_name} ${s.season_label || ""}` }); }}
              className="h-7 text-xs bg-primary text-primary-foreground rounded gap-1.5">
              {loadingStandings && standingsPanel?.type === "competition" ? t("admin.actions.loading") : t("admin.leagues.loadStandings")}
            </Button>
          </div>
          )}
          {showRegional && (
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Regional League</label>
            <select value={selectedStandingsLeague} onChange={e => setSelectedStandingsLeague(e.target.value)}
              className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50">
              <option value="">— Select league —</option>
              {regionalLeagues.map(l => <option key={l.id} value={l.id}>{l.name} (D{l.division || 1} · S{l.season_number})</option>)}
            </select>
            <Button size="sm" disabled={!selectedStandingsLeague || loadingStandings}
              onClick={() => { const l = regionalLeagues.find(x => x.id === selectedStandingsLeague); if (l) loadStandingsForPanel({ type: "league", id: l.id, name: l.name }); }}
              className="h-7 text-xs bg-primary text-primary-foreground rounded gap-1.5">
              {loadingStandings && standingsPanel?.type === "league" ? t("admin.actions.loading") : t("admin.leagues.loadStandings")}
            </Button>
          </div>
          )}
        </div>
        {standingsPanel && (
          <div>
            <p className="text-xs font-bold text-foreground mb-2">{standingsPanel.name}</p>
            {loadingStandings ? (
              <div className="flex justify-center py-6"><div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
            ) : standingsList.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">{t("admin.leagues.noStandingsFound")}</p>
            ) : (
              <div className="border border-border rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="px-2 py-2 text-left text-[10px] text-muted-foreground uppercase">#</th>
                      <th className="px-2 py-2 text-left text-[10px] text-muted-foreground uppercase">{t("admin.leagues.club")}</th>
                      <th className="px-2 py-2 text-center text-[10px] text-muted-foreground uppercase w-8">P</th>
                      <th className="px-2 py-2 text-center text-[10px] text-success uppercase w-8">W</th>
                      <th className="px-2 py-2 text-center text-[10px] text-muted-foreground uppercase w-8">D</th>
                      <th className="px-2 py-2 text-center text-[10px] text-destructive uppercase w-8">L</th>
                      <th className="px-2 py-2 text-center text-[10px] text-muted-foreground uppercase w-10">GD</th>
                      <th className="px-2 py-2 text-center text-[10px] text-foreground font-bold uppercase w-10">Pts</th>
                      <th className="px-2 py-2 text-right text-[10px] text-muted-foreground uppercase w-72">{t("admin.leagues.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standingsList.map((s, i) => (
                      <tr key={s.id} className={cn("border-b border-border/40", i % 2 === 0 ? "" : "bg-secondary/20")}>
                        <td className="px-2 py-2 text-center text-muted-foreground font-bold">{s.position || i + 1}</td>
                        <td className="px-2 py-2 font-medium text-foreground truncate max-w-[110px]">{s.club_name}</td>
                        <td className="px-2 py-2 text-center text-muted-foreground">{s.played || 0}</td>
                        <td className="px-2 py-2 text-center text-success">{s.wins || 0}</td>
                        <td className="px-2 py-2 text-center text-muted-foreground">{s.draws || 0}</td>
                        <td className="px-2 py-2 text-center text-destructive">{s.losses || 0}</td>
                        <td className="px-2 py-2 text-center text-muted-foreground">{(s.goal_difference || 0) > 0 ? `+${s.goal_difference}` : (s.goal_difference || 0)}</td>
                        <td className="px-2 py-2 text-center font-bold text-foreground">{s.points || 0}</td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={removingCompetitionClub === s.id || replacingCompetitionClub === s.id}
                              onClick={() => removeClubFromCompetition?.(s)}
                              className="h-7 text-[10px] rounded border-destructive/30 text-destructive hover:bg-destructive/10 gap-1">
                              {removingCompetitionClub === s.id ? (
                                <span className="w-3 h-3 border-2 border-destructive/30 border-t-destructive rounded-full animate-spin inline-block" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                              {t("admin.actions.remove")}
                            </Button>
                            <select
                              value={replaceClubByStanding[s.id] || ""}
                              onChange={event => setReplaceClubByStanding(prev => ({ ...prev, [s.id]: event.target.value }))}
                              className="h-7 min-w-36 max-w-44 rounded border border-border bg-secondary px-2 text-[10px] text-foreground outline-none focus:border-primary/50">
                              <option value="">Replace with…</option>
                              {clubs
                                .filter(club => String(club.id) !== String(s.club_id) && !activeStandingClubIds.has(String(club.id)))
                                .map(club => (
                                  <option key={club.id} value={club.id}>
                                    {club.name}{club.tag ? ` [${club.tag}]` : ""}
                                  </option>
                                ))}
                            </select>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={!replaceClubByStanding[s.id] || replacingCompetitionClub === s.id || removingCompetitionClub === s.id}
                              onClick={() => replaceClubInCompetition(s)}
                              className="h-7 text-[10px] rounded border-primary/30 text-primary hover:bg-primary/10 gap-1">
                              {replacingCompetitionClub === s.id ? (
                                <span className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin inline-block" />
                              ) : (
                                <Pencil className="w-3 h-3" />
                              )}
                              Replace
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    )}
  </div>

  {/* Regional Leagues — editable rules */}
  <div className={cn("bg-card border border-border rounded p-5 space-y-4", !showRegional && "hidden")}>
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="font-heading text-base uppercase tracking-tight text-foreground">{t("admin.leagues.regionalLeagues")}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{t("admin.leagues.regionalLeaguesDesc", { count: REGIONS.length })}</p>
      </div>
      <Button onClick={seedRegionalLeagues}
        disabled={seedingRegionalLeagues || regionalLeagues.length >= LEAGUE_DEFINITIONS.length}
        className="bg-primary text-primary-foreground h-8 text-xs rounded gap-1.5 shrink-0">
        {seedingRegionalLeagues ? t("admin.leagues.seeding") : regionalLeagues.length >= LEAGUE_DEFINITIONS.length ? t("admin.leagues.seeded") : t("admin.leagues.seedAllLeagues")}
      </Button>
    </div>

    {regionalLeagues.length > 0 && (
      <div className="space-y-4">
        {REGIONS.map(region => {
          const div1 = regionalLeagues.find(l => l.region_slug === region.slug && (l.division || 1) === 1);
          const div2 = regionalLeagues.find(l => l.region_slug === region.slug && l.division === 2);
          if (!div1 && !div2) return null;
          return (
            <div key={region.slug}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">{region.name}</p>
              <div className="space-y-1.5">
                {[div1, div2].filter(Boolean).map(league => {
                  const isEditingL = editingLeague === league.id;
                  const availableClubs = getAvailableClubsForLeague(league);
                  const selectedClubIds = getSelectedClubIdsForLeague(league.id);
                  const capacityRemaining = Math.max(0, getRegionalLeagueMaxClubs(league) - Number(league.num_clubs || 0));
                  const canAdminAddClub = !["in_progress", "active", "completed", "archived"].includes(String(league.status || "").toLowerCase());
                  const seedingOpen = isRegionalLeagueSetupSeedingOpen(league) || isFirstSeasonAdminSeedingOpen(league);
                  const canSimulateFixtures = String(league.status || "").toLowerCase() === "in_progress";
                  return (
                    <div key={league.id} className="border border-border rounded p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider shrink-0">D{league.division || 1}</span>
                            <p className="text-sm font-bold text-foreground truncate">{league.name}</p>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Season {league.season_number} · {league.num_clubs || 0}/{getRegionalLeagueMaxClubs(league)} clubs · {(league.division || 1) === 1 ? "bottom 2 relegated" : "top 2 promoted"}
                            {seedingOpen ? " · setup seeding open" : ""}
                          </p>
                        </div>
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0",
                          league.status === "in_progress" ? "text-success border-success/30 bg-success/5" :
                          league.status === "registration" ? "text-primary border-primary/30 bg-primary/5" :
                          league.status === "completed" ? "text-muted-foreground border-border" :
                          "text-warning border-warning/30 bg-warning/5"
                        )}>{getSeasonStatusLabel(t, league.status)}</span>
                        <Button size="sm" variant="outline"
                          className={cn("h-7 w-7 p-0 rounded shrink-0", isEditingL ? "border-destructive/30 text-destructive" : "border-border text-muted-foreground hover:text-foreground")}
                          onClick={() => {
                            if (isEditingL) { setEditingLeague(null); }
                            else { setEditingLeague(league.id); setLeagueEditForm({ max_clubs: getRegionalLeagueMaxClubs(league), promoted_slots: league.promoted_slots ?? 2 }); }
                          }}>
                          {isEditingL ? <X className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                        </Button>
                        <Link to={`/leagues/${league.slug}`}>
                          <Button size="sm" variant="outline" className="h-7 text-xs rounded border-border text-muted-foreground hover:text-foreground shrink-0">{t("admin.actions.view")}</Button>
                        </Link>
                        {league.status === "draft" && (
                          <Button size="sm" onClick={() => leagueLifecycleAction(league, "open_registration")}
                            className="h-7 text-xs rounded bg-primary text-primary-foreground shrink-0">
                            {t("admin.leagues.openRegistration")}
                          </Button>
                        )}
                        {league.status === "registration" && (
                          <Button size="sm" disabled={generatingRegionalFixtures === league.id}
                            onClick={() => generateRegionalFixturesForAdmin(league)}
                            className="h-7 text-xs rounded bg-success/20 text-success hover:bg-success/30 border-0 shrink-0">
                            {generatingRegionalFixtures === league.id ? t("admin.leagues.starting") : t("admin.leagues.startLeague")}
                          </Button>
                        )}
                        {league.status === "in_progress" && (
                          <Button size="sm" variant="outline" disabled={processingLeagueEnd === league.id}
                            onClick={() => processLeagueEnd(league)}
                            className="h-7 text-xs rounded border-warning/40 text-warning hover:bg-warning/10 shrink-0">
                            {processingLeagueEnd === league.id ? t("admin.leagues.processing") : t("admin.leagues.endSeason")}
                          </Button>
                        )}
                        {league.status === "completed" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => leagueLifecycleAction(league, "archive")}
                              className="h-7 text-xs rounded border-muted-foreground/30 text-muted-foreground hover:text-foreground shrink-0">
                              {t("admin.leagues.archive")}
                            </Button>
                            <Button size="sm" onClick={() => leagueLifecycleAction(league, "create_next")}
                              className="h-7 text-xs rounded bg-success/20 text-success hover:bg-success/30 border-0 shrink-0">
                              {t("admin.leagues.newSeason")}
                            </Button>
                          </>
                        )}
                        {league.status === "archived" && (
                          <Button size="sm" onClick={() => leagueLifecycleAction(league, "create_next")}
                            className="h-7 text-xs rounded bg-success/20 text-success hover:bg-success/30 border-0 shrink-0">
                            {t("admin.leagues.newSeason")}
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-2 border-t border-border/40 pt-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-col gap-2 rounded border border-border bg-secondary/25 p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                                {canAdminAddClub ? (seedingOpen ? "Seed clubs into this division" : "Add eligible clubs") : "Fixtures already generated"}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {selectedClubIds.length} selected · {capacityRemaining} open spot{capacityRemaining === 1 ? "" : "s"} · {availableClubs.length} available
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!canAdminAddClub || registeringLeagueClub === league.id || availableClubs.length === 0 || capacityRemaining <= 0}
                                onClick={() => setSeedClubModalLeagueId(league.id)}
                                className="h-8 rounded border-border px-3 text-[11px] font-bold uppercase tracking-wider text-foreground hover:border-primary/40 hover:bg-primary/10">
                                Choose clubs
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={registeringLeagueClub === league.id || selectedClubIds.length === 0}
                                onClick={() => setSelectedClubIdsForLeague(league.id, [])}
                                className="h-8 rounded border-border px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                                Clear
                              </Button>
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!canAdminAddClub || selectedClubIds.length === 0 || registeringLeagueClub === league.id}
                            onClick={() => adminRegisterClubToRegionalLeague(league)}
                            className="h-8 rounded border-primary/30 px-3 text-[11px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10">
                            {registeringLeagueClub === league.id
                              ? "Adding..."
                              : seedingOpen
                                ? `Seed ${selectedClubIds.length || ""} club${selectedClubIds.length === 1 ? "" : "s"}`
                                : `Add ${selectedClubIds.length || ""} club${selectedClubIds.length === 1 ? "" : "s"}`}
                          </Button>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!canSimulateFixtures || simulatingLeagueFixtures === league.id}
                          onClick={() => simulateRegionalLeagueFixtures(league)}
                          className="h-8 rounded border-warning/40 px-3 text-[11px] font-bold uppercase tracking-wider text-warning hover:bg-warning/10 disabled:opacity-45">
                          {simulatingLeagueFixtures === league.id ? "Simulating..." : "Simulate fixtures"}
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          { field: "logo_url", label: "Logo" },
                          { field: "banner_url", label: "Banner" },
                        ].map(item => (
                          <label key={item.field} className="flex cursor-pointer items-center gap-2 rounded border border-border/60 bg-secondary/30 p-2 text-[10px] text-muted-foreground hover:border-primary/40 hover:text-foreground">
                            {league[item.field]
                              ? <img src={league[item.field]} alt="" className="h-8 w-10 shrink-0 object-cover" />
                              : <ImagePlus className="h-4 w-4 shrink-0 text-primary" />}
                            <span className="min-w-0 flex-1">
                              <span className="block font-bold uppercase tracking-wider text-foreground">{item.label}</span>
                              <span className="block truncate">Upload PNG/image for public league page</span>
                            </span>
                            <input
                              type="file"
                              accept="image/png,image/*"
                              className="sr-only"
                              onChange={e => uploadPublicMedia("RegionalLeague", league, item.field, e.target.files?.[0])}
                            />
                          </label>
                        ))}
                      </div>
                      {isEditingL && (
                        <div className="pt-2 border-t border-border/50 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] text-muted-foreground mb-1 block">{t("admin.leagues.maxClubs")}</label>
                              <Input type="number" min={1} value={leagueEditForm.max_clubs ?? ""}
                                onChange={e => setLeagueEditForm(f => ({ ...f, max_clubs: e.target.value }))}
                                className="bg-secondary border-border text-xs h-8" />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground mb-1 block">{t("admin.leagues.promotedSlots")}</label>
                              <Input type="number" min={0} value={leagueEditForm.promoted_slots ?? ""}
                                onChange={e => setLeagueEditForm(f => ({ ...f, promoted_slots: e.target.value }))}
                                className="bg-secondary border-border text-xs h-8" />
                            </div>
                          </div>
                          {(() => {
                            const linked = trophyItems.find(t => t.linked_source_id === league.id);
                            return linked ? (
                              <div className="flex items-center gap-2 p-2 bg-warning/5 border border-warning/20 rounded col-span-2">
                                {linked.image_url
                                  ? <img src={linked.image_url} alt={linked.name} className="w-8 h-8 object-contain" />
                                  : <div className="w-8 h-8" />}
                                <div>
                                  <p className="text-[10px] font-bold text-warning">{linked.name}</p>
                                  <p className="text-[9px] text-muted-foreground">Linked trophy — manage in Trophies tab</p>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[10px] text-muted-foreground col-span-2">No trophy linked — go to Trophies tab to link one</p>
                            );
                          })()}
                          <Button size="sm" onClick={saveLeagueRules} disabled={savingLeague}
                            className="bg-primary text-primary-foreground h-8 text-xs gap-1.5">
                            {savingLeague ? <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin inline-block" /> : <Check className="w-3.5 h-3.5" />}
                            {savingLeague ? "Saving…" : "Save Rules"}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    )}

    {/* Qualification info — live from competition records */}
    <div className="bg-muted/20 border border-border/40 rounded p-3 space-y-1">
      <p className="text-[10px] font-bold text-foreground uppercase tracking-wider">{t("admin.leagues.div1Qualification")}</p>
      {competitions.length > 0 ? (
        [{slug:"supreme",label:"STAGE Supreme"},{slug:"elite",label:"STAGE Elite"},{slug:"challenger",label:"STAGE Challenger"}].map(({ slug, label }) => {
          const comp = competitions.find(c => c.slug === slug);
          const rule = getQualificationRuleForCompetition(slug);
          const range = formatPositionRange(rule?.positions);
          const spots = rule?.positions?.length || 6;
          return comp ? (
            <p key={slug} className="text-[10px] text-muted-foreground">
              {label}: Division 1 positions <strong className="text-foreground">{range}</strong> · {spots} spots per regional league
            </p>
          ) : null;
        })
      ) : (
        <p className="text-[10px] text-muted-foreground">{t("admin.leagues.seedCompetitionsFirst")}</p>
      )}
      <p className="text-[10px] text-muted-foreground mt-1">
        {t("admin.leagues.qualificationEditHint")}
      </p>
    </div>
  </div>

  <Dialog open={Boolean(seedModalLeague)} onOpenChange={(open) => { if (!open) setSeedClubModalLeagueId(null); }}>
    <DialogContent className="max-h-[86vh] max-w-3xl overflow-hidden border-border bg-card p-0 text-foreground">
      {seedModalLeague && (
        <div className="flex max-h-[86vh] flex-col">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle className="font-heading text-base uppercase tracking-tight">
              Seed clubs into {seedModalLeague.name}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              {seedModalSelectedClubIds.length}/{seedModalCapacityRemaining} selected · {seedModalFilteredClubs.length} matching club{seedModalFilteredClubs.length === 1 ? "" : "s"}
            </p>
          </DialogHeader>

          <div className="border-b border-border bg-secondary/20 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={seedModalSearch}
                onChange={event => setSeedClubSearch(seedModalLeague.id, event.target.value)}
                placeholder="Search by club name or tag..."
                className="h-10 rounded border-border bg-background pl-9 text-sm"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={registeringLeagueClub === seedModalLeague.id || seedModalCapacityRemaining <= 0 || seedModalFilteredClubs.length === 0}
                onClick={() => setSelectedClubIdsForLeague(seedModalLeague.id, seedModalFilteredClubs.slice(0, seedModalCapacityRemaining).map(club => club.id))}
                className="h-8 rounded border-border px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                Select available spots
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={registeringLeagueClub === seedModalLeague.id || seedModalPageClubs.length === 0}
                onClick={() => {
                  const room = seedModalCapacityRemaining - seedModalSelectedClubIds.length;
                  if (room <= 0) return;
                  const nextIds = seedModalPageClubs
                    .filter(club => !seedModalSelectedClubIdSet.has(String(club.id)))
                    .slice(0, room)
                    .map(club => club.id);
                  setSelectedClubIdsForLeague(seedModalLeague.id, [...seedModalSelectedClubIds, ...nextIds]);
                }}
                className="h-8 rounded border-border px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                Select page
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={registeringLeagueClub === seedModalLeague.id || seedModalSelectedClubIds.length === 0}
                onClick={() => setSelectedClubIdsForLeague(seedModalLeague.id, [])}
                className="h-8 rounded border-border px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                Clear
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {seedModalFilteredClubs.length === 0 ? (
              <div className="rounded border border-border bg-secondary/20 px-4 py-8 text-center text-sm text-muted-foreground">
                No clubs match your search.
              </div>
            ) : seedModalCapacityRemaining <= 0 ? (
              <div className="rounded border border-border bg-secondary/20 px-4 py-8 text-center text-sm text-muted-foreground">
                This division is already full.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {seedModalPageClubs.map(club => {
                  const checked = seedModalSelectedClubIdSet.has(String(club.id));
                  const disabled = registeringLeagueClub === seedModalLeague.id || (!checked && seedModalSelectedClubIds.length >= seedModalCapacityRemaining);
                  return (
                    <label
                      key={club.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded border px-3 py-2 text-sm transition-colors",
                        checked
                          ? "border-primary/60 bg-primary/10 text-foreground"
                          : "border-border/70 bg-secondary/20 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        disabled && "cursor-not-allowed opacity-50"
                      )}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleSelectedClubForLeague(seedModalLeague.id, club.id)}
                        className="h-4 w-4 accent-primary"
                      />
                      {club.logo_url || club.avatar_url ? (
                        <img src={club.logo_url || club.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-border bg-background text-[10px] font-bold text-muted-foreground">
                          {(club.tag || club.name || "?").slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-foreground">{club.name}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{club.tag ? `[${club.tag}]` : "No tag"}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-border bg-secondary/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-2 sm:justify-start">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={seedModalPage <= 1}
                onClick={() => setSeedClubPage(seedModalLeague.id, seedModalPage - 1)}
                className="h-8 rounded border-border px-2 text-muted-foreground hover:text-foreground">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {seedModalPage} of {seedModalPageCount}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={seedModalPage >= seedModalPageCount}
                onClick={() => setSeedClubPage(seedModalLeague.id, seedModalPage + 1)}
                className="h-8 rounded border-border px-2 text-muted-foreground hover:text-foreground">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSeedClubModalLeagueId(null)}
                className="h-9 flex-1 rounded border-border px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground sm:flex-none">
                Close
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={seedModalSelectedClubIds.length === 0 || registeringLeagueClub === seedModalLeague.id}
                onClick={() => adminRegisterClubToRegionalLeague(seedModalLeague)}
                className="h-9 flex-1 rounded border-primary/40 px-4 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary/10 sm:flex-none">
                {registeringLeagueClub === seedModalLeague.id
                  ? "Seeding..."
                  : `Seed ${seedModalSelectedClubIds.length} club${seedModalSelectedClubIds.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DialogContent>
  </Dialog>

  {/* Scheduling — expired fixtures */}
  {showRegional && expiredFixtures.length > 0 && (
    <div className="bg-card border border-destructive/30 rounded p-5 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-destructive" />
        <h3 className="font-heading text-base uppercase tracking-tight text-foreground">
          {t("admin.leagues.schedulingDisputes", { count: expiredFixtures.length })}
        </h3>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("admin.leagues.schedulingDisputesDesc")}
      </p>
      <div className="space-y-2">
        {expiredFixtures.map(f => (
          <ExpiredFixtureRow key={f.id} fixture={f} onResolved={loadAll} busy={schedulingAdminBusy} setBusy={setSchedulingAdminBusy} />
        ))}
      </div>
    </div>
  )}

</div>
  );
}

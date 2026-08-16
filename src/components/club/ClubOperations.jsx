import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import OfferContractDialog from "@/components/contracts/OfferContractDialog";
import { useTranslation } from "@/hooks/useTranslation";
import {
  BadgeCheck,
  CalendarDays,
  ClipboardList,
  FileText,
  History,
  Loader2,
  UserCog,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { canManageClubIdentity, isClubPresidentForUser, isAdminUser } from "@/lib/clubPresidentAccess";
import { getContractTargetPlayerId, normalizePlayerContracts } from "@/lib/playerContractFields";
import { canCreateContractOffer } from "@/lib/transferWindowAccess";
import { useTransferWindowStatus } from "@/lib/useTransferWindowStatus";

const PERMISSIONS = [
  "edit_club_profile",
  "manage_recruitment",
  "review_applicants",
  "offer_contracts",
  "manage_formation",
  "manage_lineup",
  "view_finances",
  "manage_finances",
  "manage_staff",
];

const STAFF_ROLES = [
  { id: "captain", labelKey: "commonPages.cdCaptain" },
  { id: "vice_captain", labelKey: "commonPages.cdViceCaptain" },
];
const AVAILABILITY = ["available", "maybe", "unavailable"];
const AVAILABILITY_LABEL_KEYS = {
  available: "commonPages.coopStatusAvailable",
  maybe: "commonPages.coopStatusMaybe",
  unavailable: "commonPages.coopStatusUnavailable",
};
const APPLICANT_NOTICE_KEYS = {
  review: "commonPages.coopApplicantReviewed",
  decline: "commonPages.coopApplicantDeclined",
  "offer-trial": "commonPages.coopTrialOfferSent",
};
const FORMATIONS = ["4-3-3", "4-2-3-1", "4-4-2", "3-5-2", "5-2-1-2"];

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value); } catch { return []; }
}

function sourceLabel(source) {
  return String(source || "manual").replace(/_/g, " ");
}

function fixtureLabel(fixture, clubId, t) {
  const isHome = fixture.home_club_id === clubId;
  const name = isHome ? fixture.away_club_name : fixture.home_club_name;
  return t("commonPages.eafcVs", { name });
}

export default function ClubOperations({ club, players = [], currentUser, myPlayer, upcomingFixtures = [], defaultFormation, onStaffRolesChanged }) {
  const { t } = useTranslation();
  const { windowOpen } = useTransferWindowStatus();
  const [activeSection, setActiveSection] = useState("applicants");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [staffRoles, setStaffRoles] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [lineups, setLineups] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [selectedStaffPlayer, setSelectedStaffPlayer] = useState("");
  const [selectedStaffRole, setSelectedStaffRole] = useState("captain");
  const [offerApplicant, setOfferApplicant] = useState(null);
  const [lineupFixtureId, setLineupFixtureId] = useState("");
  const [lineupForm, setLineupForm] = useState({
    formation: defaultFormation || "4-3-3",
    starting_players: [],
    bench_players: [],
    captain_player_id: "",
    notes: "",
  });

  const lineupPlayers = (players || []).filter((player) => player.selectable !== false);

  const myClubRoles = normalizeList(myPlayer?.club_roles);
  const isAdmin = isAdminUser(currentUser);
  const isOwner = isAdmin || isClubPresidentForUser({ user: currentUser, club });
  const isClubMember = !!myPlayer?.id && myPlayer?.club_id === club?.id;
  const isCaptain = myPlayer?.role === "captain" || myPlayer?.role === "vice-captain" || myClubRoles.includes("captain") || myClubRoles.includes("vice-captain");
  const isPresident =
    isOwner ||
    myPlayer?.role === "president" ||
    myClubRoles.includes("president");
  const myStaffRoles = staffRoles.filter((role) => role.user_id === currentUser?.id || role.player_id === myPlayer?.id);
  const staffPermissions = new Set(myStaffRoles.flatMap((role) => normalizeList(role.permissions)));
  const hasOperationalPower =
    canManageClubIdentity({
      user: currentUser,
      club,
      staffPermissions: [...staffPermissions],
    }) ||
    isPresident ||
    isCaptain ||
    myStaffRoles.length > 0;

  useEffect(() => {
    load();
  }, [club?.id]);

  useEffect(() => {
    if (!lineupFixtureId && upcomingFixtures[0]?.id) setLineupFixtureId(upcomingFixtures[0].id);
  }, [upcomingFixtures, lineupFixtureId]);

  useEffect(() => {
    if (!hasOperationalPower && activeSection !== "availability") {
      setActiveSection("availability");
    }
    if (hasOperationalPower && activeSection === "overview") {
      setActiveSection("applicants");
    }
  }, [activeSection, hasOperationalPower]);

  useEffect(() => {
    const existing = lineups.find((row) => row.fixture_id === lineupFixtureId);
    if (existing) {
      setLineupForm({
        formation: existing.formation || defaultFormation || "4-3-3",
        starting_players: normalizeList(existing.starting_players),
        bench_players: normalizeList(existing.bench_players),
        captain_player_id: existing.captain_player_id || "",
        notes: existing.notes || "",
      });
    } else {
      setLineupForm({
        formation: defaultFormation || "4-3-3",
        starting_players: [],
        bench_players: [],
        captain_player_id: "",
        notes: "",
      });
    }
  }, [lineupFixtureId, lineups, defaultFormation]);

  async function load() {
    if (!club?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [appRows, staffRows, availRows, lineupRows, auditRows, contractRows] = await Promise.all([
        stageClient.entities.ClubApplicant.filter({ club_id: club.id }, "-created_date", 200).catch(() => []),
        stageClient.entities.ClubStaffRole.filter({ club_id: club.id }, "-created_date", 200).catch(() => []),
        stageClient.entities.ClubFixtureAvailability.filter({ club_id: club.id }, "-updated_date", 300).catch(() => []),
        stageClient.entities.ClubFixtureLineup.filter({ club_id: club.id }, "-updated_date", 100).catch(() => []),
        stageClient.entities.ClubOperationAuditLog.filter({ club_id: club.id }, "-created_date", 100).catch(() => []),
        stageClient.entities.PlayerContract.filter({ team_id: club.id }, "-created_date", 200).catch(() => []),
      ]);
      setApplicants(appRows);
      setStaffRoles(staffRows);
      onStaffRolesChanged?.(staffRows);
      setAvailability(availRows);
      setLineups(lineupRows);
      setAuditLogs(auditRows);
      setContracts(normalizePlayerContracts(contractRows));
    } catch (err) {
      setError(err?.message || t("commonPages.coopLoadFailed"));
    } finally {
      setLoading(false);
    }
  }

  const pendingApplicants = applicants.filter((a) => ["new", "reviewed", "invited"].includes(a.status));
  const expiringContracts = contracts.filter((c) => c.status === "active" && c.end_date && new Date(c.end_date).getTime() < Date.now() + 14 * 86400000);
  const pendingContracts = contracts.filter((c) => ["pending", "pending_window", "negotiating"].includes(c.status));
  const selectedLineup = lineups.find((row) => row.fixture_id === lineupFixtureId);

  const availabilityByFixture = useMemo(() => {
    const map = {};
    for (const row of availability) {
      if (!map[row.fixture_id]) map[row.fixture_id] = [];
      map[row.fixture_id].push(row);
    }
    return map;
  }, [availability]);

  async function applicantAction(applicant, action, body = {}) {
    setBusy(`${action}:${applicant.id}`);
    setError(null);
    setNotice(null);
    try {
      await stageClient.http.post(`/club-applicants/${applicant.id}/${action}`, body);
      setNotice(t(APPLICANT_NOTICE_KEYS[action] || "commonPages.coopApplicantUpdated"));
      await load();
    } catch (err) {
      setError(err?.message || t("commonPages.coopActionFailed", { action: sourceLabel(action) }));
    } finally {
      setBusy(null);
    }
  }

  async function handleOfferContract(terms) {
    if (!offerApplicant) return;
    if (!canCreateContractOffer(windowOpen)) return;
    await applicantAction(offerApplicant, "offer-contract", terms);
    setOfferApplicant(null);
  }

  async function assignStaffRole() {
    if (!selectedStaffPlayer) return;
    setBusy("staff");
    setError(null);
    setNotice(null);
    try {
      await stageClient.http.post(`/clubs/${club.id}/staff`, {
        player_id: selectedStaffPlayer,
        role: selectedStaffRole,
      });
      setSelectedStaffPlayer("");
      setNotice(t("commonPages.coopStaffAssigned"));
      await load();
    } catch (err) {
      setError(err?.message || t("commonPages.coopStaffAssignFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function updateStaffPermissions(role, permissions) {
    if (!role?.player_id) return;
    setBusy(`permissions:${role.id}`);
    setError(null);
    setNotice(null);
    try {
      await stageClient.http.post(`/clubs/${club.id}/staff/${role.player_id}/permissions`, { permissions });
      setNotice(t("commonPages.coopStaffPermissionsUpdated"));
      await load();
    } catch (err) {
      setError(err?.message || t("commonPages.coopStaffPermissionsFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function removeStaffRole(role) {
    if (!role?.player_id) return;
    setBusy(`remove-staff:${role.id}`);
    setError(null);
    setNotice(null);
    try {
      await stageClient.http.post(`/clubs/${club.id}/staff/${role.player_id}/remove`, {});
      setNotice(t("commonPages.coopStaffRemoved"));
      await load();
    } catch (err) {
      setError(err?.message || t("commonPages.coopStaffRemoveFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function setMyAvailability(fixture, status) {
    if (!myPlayer?.id) return;
    setBusy(`availability:${fixture.id}:${status}`);
    setError(null);
    setNotice(null);
    const existing = availability.find((row) => row.fixture_id === fixture.id && row.player_id === myPlayer.id);
    const body = {
      club_id: club.id,
      fixture_id: fixture.id,
      fixture_type: fixture._fixtureType || "match",
      player_id: myPlayer.id,
      status,
    };
    try {
      if (existing) await stageClient.http.patch(`/club-fixture-availabilities/${existing.id}`, body);
      else await stageClient.http.post("/club-fixture-availabilities", body);
      setNotice(t("commonPages.coopAvailabilitySet", { status: t(AVAILABILITY_LABEL_KEYS[status] || status) }));
      await load();
    } catch (err) {
      setError(err?.message || t("commonPages.coopAvailabilityFailed"));
    } finally {
      setBusy(null);
    }
  }

  function toggleLineupPlayer(listName, playerId) {
    setLineupForm((prev) => {
      const otherName = listName === "starting_players" ? "bench_players" : "starting_players";
      const has = prev[listName].includes(playerId);
      return {
        ...prev,
        [listName]: has ? prev[listName].filter((id) => id !== playerId) : [...prev[listName], playerId],
        [otherName]: prev[otherName].filter((id) => id !== playerId),
      };
    });
  }

  async function saveLineup(status = "draft") {
    if (!lineupFixtureId) return;
    setBusy(`lineup:${status}`);
    setError(null);
    setNotice(null);
    const fixture = upcomingFixtures.find((row) => row.id === lineupFixtureId);
    const body = {
      club_id: club.id,
      fixture_id: lineupFixtureId,
      fixture_type: fixture?._fixtureType || "match",
      ...lineupForm,
      status,
    };
    try {
      if (selectedLineup) await stageClient.http.patch(`/club-fixture-lineups/${selectedLineup.id}`, body);
      else await stageClient.http.post("/club-fixture-lineups", body);
      if (status === "published") await stageClient.http.post(`/clubs/${club.id}/lineups/${lineupFixtureId}/publish`);
      setNotice(status === "published" ? t("commonPages.coopLineupPublished") : t("commonPages.coopLineupDraftSaved"));
      await load();
    } catch (err) {
      setError(err?.message || t("commonPages.coopLineupSaveFailed"));
    } finally {
      setBusy(null);
    }
  }

  const sections = [
    ...(hasOperationalPower ? [
      ["applicants", "coopTabApplicants", ClipboardList],
      ["staff", "coopTabStaff", UserCog],
    ] : []),
    ["availability", "coopTabAvailability", CalendarDays],
    ...(hasOperationalPower ? [
      ["lineup", "coopTabLineup", Users],
      ["audit", "coopTabAudit", History],
    ] : []),
  ];

  const overviewStats = [
    ["coopStatPendingApplicants", pendingApplicants.length],
    ["coopStatUpcomingFixtures", upcomingFixtures.length],
    ["coopStatExpiringContracts", expiringContracts.length],
    ["coopStatPendingContracts", pendingContracts.length],
    ["coopStatStaffRoles", staffRoles.length],
  ];

  if (loading) {
    return <div className="flex justify-center py-16"><div className="w-7 h-7 rounded-full border-4 border-primary/20 border-t-primary animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center justify-between gap-3 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-xs font-bold uppercase">{t("commonPages.coopDismiss")}</button>
        </div>
      )}
      {notice && (
        <div className="flex items-center justify-between gap-3 rounded border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-xs font-bold uppercase">{t("commonPages.coopDismiss")}</button>
        </div>
      )}
      {hasOperationalPower ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {overviewStats.map(([labelKey, value]) => (
            <div key={labelKey} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-2xl font-heading font-black text-white">{value}</p>
              <p className="text-xs uppercase tracking-wider text-white/45">{t(`commonPages.${labelKey}`)}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {sections.map(([key, labelKey, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveSection(key)}
            className={cn(
              "flex items-center gap-2 rounded border px-3 py-2 text-xs uppercase tracking-wider whitespace-nowrap",
              activeSection === key ? "border-primary bg-primary/10 text-primary" : "border-white/10 text-white/50"
            )}
          >
            <Icon className="w-4 h-4" /> {t(`commonPages.${labelKey}`)}
          </button>
        ))}
      </div>

      {isClubMember && !hasOperationalPower && (
        <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
          {t("commonPages.coopMemberTip")}
        </div>
      )}

      {activeSection === "applicants" && (
        <div className="space-y-3">
          {applicants.length === 0 ? <Empty label={t("commonPages.coopNoApplicants")} /> : applicants.map((applicant) => (
            <div key={applicant.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-white">{applicant.player_gamertag || t("commonPages.coopUnknownPlayer")}</p>
                    {Number(applicant.player_is_verified) === 1 && <BadgeCheck className="w-4 h-4 text-primary" />}
                  </div>
                  <p className="text-xs text-white/45 capitalize">
                    {sourceLabel(applicant.source_type)} · {applicant.preferred_position || applicant.player_position || t("commonPages.coopAny")} · {applicant.platform || applicant.player_platform || t("commonPages.anyPlatform")}
                  </p>
                </div>
                <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wider text-white/60">{applicant.status}</span>
              </div>
              {applicant.message && <p className="text-sm text-white/60 whitespace-pre-wrap line-clamp-3">{applicant.message}</p>}
              <div className="flex gap-2 flex-wrap">
                {applicant.player_id && <Link to={`/players/${applicant.player_id}`}><Button type="button" size="sm" variant="outline" className="text-xs">{t("commonPages.viewProfile")}</Button></Link>}
                <Button type="button" size="sm" variant="outline" disabled={busy === `review:${applicant.id}`} onClick={() => applicantAction(applicant, "review")} className="text-xs">{t("commonPages.coopMarkReviewed")}</Button>
                <Button type="button" size="sm" disabled={busy === `offer-trial:${applicant.id}`} onClick={() => applicantAction(applicant, "offer-trial")} className="text-xs">{t("commonPages.coopOfferTrial")}</Button>
                {canCreateContractOffer(windowOpen) ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => setOfferApplicant(applicant)} className="text-xs">{t("commonPages.offerContract")}</Button>
                ) : null}
                <Button type="button" size="sm" variant="outline" disabled={busy === `decline:${applicant.id}`} onClick={() => applicantAction(applicant, "decline")} className="text-xs border-destructive/30 text-destructive">{t("commonPages.profDecline")}</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeSection === "staff" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 grid md:grid-cols-[1fr_220px_auto] gap-2">
            <select value={selectedStaffPlayer} onChange={(e) => setSelectedStaffPlayer(e.target.value)} className="rounded border border-white/10 bg-[#0d1225] px-3 py-2 text-sm text-white">
              <option value="">{t("commonPages.coopSelectClubMember")}</option>
              {players.map((player) => <option key={player.id} value={player.id}>{player.gamertag}</option>)}
            </select>
            <select value={selectedStaffRole} onChange={(e) => setSelectedStaffRole(e.target.value)} className="rounded border border-white/10 bg-[#0d1225] px-3 py-2 text-sm text-white">
              {STAFF_ROLES.map((role) => <option key={role.id} value={role.id}>{t(role.labelKey)}</option>)}
            </select>
            <Button type="button" onClick={assignStaffRole} disabled={busy === "staff" || !selectedStaffPlayer}>{busy === "staff" ? <Loader2 className="w-4 h-4 animate-spin" /> : t("commonPages.coopAssign")}</Button>
          </div>
          {staffRoles.map((role) => {
            const permissions = normalizeList(role.permissions);
            return (
              <div key={role.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-white">{role.player_gamertag || role.player_email}</p>
                    <p className="text-xs text-white/45 capitalize">{sourceLabel(role.role)}</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" disabled={busy === `remove-staff:${role.id}`} onClick={() => removeStaffRole(role)} className="text-xs border-destructive/30 text-destructive">{t("commonPages.coopRemove")}</Button>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {PERMISSIONS.map((permission) => (
                    <label key={permission} className="flex items-center gap-2 rounded border border-white/10 px-2 py-2 text-xs text-white/60">
                      <input
                        type="checkbox"
                        checked={permissions.includes(permission)}
                        disabled={busy === `permissions:${role.id}`}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...permissions, permission]
                            : permissions.filter((p) => p !== permission);
                          updateStaffPermissions(role, next);
                        }}
                      />
                      {sourceLabel(permission)}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeSection === "availability" && (
        <div className="space-y-3">
          {upcomingFixtures.length === 0 ? <Empty label={t("commonPages.coopNoUpcomingFixtures")} /> : upcomingFixtures.map((fixture) => {
            const rows = availabilityByFixture[fixture.id] || [];
            const counts = Object.fromEntries(["available", "maybe", "unavailable", "no_response"].map((status) => [status, rows.filter((row) => row.status === status).length]));
            return (
              <div key={fixture.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-white">{fixtureLabel(fixture, club.id, t)}</p>
                    <p className="text-xs text-white/45">{fixture.scheduled_date ? new Date(fixture.scheduled_date).toLocaleString() : t("matchFlow.tbd")}</p>
                  </div>
                  <div className="text-xs text-white/45">{t("commonPages.coopAvailabilityCounts", { available: counts.available, maybe: counts.maybe, unavailable: counts.unavailable })}</div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {AVAILABILITY.map((status) => (
                    <Button
                      key={status}
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy === `availability:${fixture.id}:${status}`}
                      onClick={() => setMyAvailability(fixture, status)}
                      className="text-xs capitalize"
                    >
                      {busy === `availability:${fixture.id}:${status}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t(AVAILABILITY_LABEL_KEYS[status])}
                    </Button>
                  ))}
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {rows.map((row) => (
                    <div key={row.id} className="rounded border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
                      <span className="text-white">{row.player_gamertag}</span> · {row.status}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeSection === "lineup" && (
        <div className="space-y-3">
          {upcomingFixtures.length === 0 ? <Empty label={t("commonPages.coopNoLineupFixtures")} /> : (
            <>
              <div className="grid md:grid-cols-2 gap-2">
                <select value={lineupFixtureId} onChange={(e) => setLineupFixtureId(e.target.value)} className="rounded border border-white/10 bg-[#0d1225] px-3 py-2 text-sm text-white">
                  {upcomingFixtures.map((fixture) => <option key={fixture.id} value={fixture.id}>{fixtureLabel(fixture, club.id, t)}</option>)}
                </select>
                <select value={lineupForm.formation} onChange={(e) => setLineupForm((prev) => ({ ...prev, formation: e.target.value }))} className="rounded border border-white/10 bg-[#0d1225] px-3 py-2 text-sm text-white">
                  {FORMATIONS.map((formation) => <option key={formation} value={formation}>{formation}</option>)}
                </select>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <LineupPickList title={t("commonPages.coopStartingXi")} players={lineupPlayers} selected={lineupForm.starting_players} onToggle={(id) => toggleLineupPlayer("starting_players", id)} />
                <LineupPickList title={t("commonPages.coopBench")} players={lineupPlayers} selected={lineupForm.bench_players} onToggle={(id) => toggleLineupPlayer("bench_players", id)} />
              </div>
              <select value={lineupForm.captain_player_id} onChange={(e) => setLineupForm((prev) => ({ ...prev, captain_player_id: e.target.value }))} className="w-full rounded border border-white/10 bg-[#0d1225] px-3 py-2 text-sm text-white">
                <option value="">{t("commonPages.coopSelectCaptain")}</option>
                {lineupPlayers.map((player) => <option key={player.id} value={player.id}>{player.gamertag}</option>)}
              </select>
              <Textarea value={lineupForm.notes} onChange={(e) => setLineupForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder={t("commonPages.coopLineupNotesPlaceholder")} className="bg-white/5 border-white/10" />
              <div className="flex gap-2">
                <Button type="button" disabled={busy === "lineup:draft"} onClick={() => saveLineup("draft")} className="gap-1.5">
                  {busy === "lineup:draft" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} {t("commonPages.coopSaveDraft")}
                </Button>
                <Button type="button" variant="outline" disabled={busy === "lineup:published"} onClick={() => saveLineup("published")}>
                  {busy === "lineup:published" ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {t("commonPages.coopPublish")}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {activeSection === "audit" && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <Button type="button" size="sm" variant="outline" onClick={load} className="text-xs">{t("commonPages.coopRefreshAudit")}</Button>
          </div>
          {auditLogs.length === 0 ? <Empty label={t("commonPages.coopNoAuditHistory")} /> : auditLogs.map((log) => (
            <div key={log.id} className="rounded border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
              <p className="text-white capitalize">{sourceLabel(log.action)}</p>
              <p className="text-xs text-white/45">{log.actor_email || t("commonPages.coopSystem")} · {log.created_date ? new Date(log.created_date).toLocaleString() : ""}</p>
              {log.reason && <p className="text-xs text-white/45 mt-1">{log.reason}</p>}
            </div>
          ))}
        </div>
      )}

      <OfferContractDialog
        open={!!offerApplicant}
        onClose={() => setOfferApplicant(null)}
        player={offerApplicant ? {
          id: offerApplicant.player_id,
          gamertag: offerApplicant.player_gamertag,
          position: offerApplicant.player_position,
          secondary_position: offerApplicant.player_secondary_position,
          overall_rating: offerApplicant.player_overall_rating || 70,
        } : null}
        existingActiveContract={false}
        playerContracts={normalizePlayerContracts(contracts).filter((contract) => getContractTargetPlayerId(contract) === offerApplicant?.player_id)}
        onOffer={handleOfferContract}
        windowOpen={windowOpen}
        club={club}
      />
    </div>
  );
}

function Empty({ label }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
      <p className="text-sm text-white/45">{label}</p>
    </div>
  );
}

function LineupPickList({ title, players, selected, onToggle }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs uppercase tracking-wider text-white/45 mb-2">{title}</p>
      <div className="space-y-1 max-h-72 overflow-y-auto">
        {players.map((player) => (
          <label key={player.id} className="flex items-center gap-2 rounded border border-white/10 px-2 py-2 text-xs text-white/70">
            <input type="checkbox" checked={selected.includes(player.id)} onChange={() => onToggle(player.id)} />
            <span className="font-semibold text-white">{player.gamertag}</span>
            <span className="text-white/40">{player.position}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

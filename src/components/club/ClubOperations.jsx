import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import OfferContractDialog from "@/components/contracts/OfferContractDialog";
import {
  BadgeCheck,
  CalendarDays,
  ClipboardList,
  FileText,
  History,
  Loader2,
  Shield,
  UserCog,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const STAFF_ROLES = ["president", "captain", "vice_captain", "recruiter", "finance_manager", "match_coordinator"];
const AVAILABILITY = ["available", "maybe", "unavailable"];
const FORMATIONS = ["4-3-3", "4-2-3-1", "4-4-2", "3-5-2", "5-2-1-2"];

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value); } catch { return []; }
}

function sourceLabel(source) {
  return String(source || "manual").replace(/_/g, " ");
}

function fixtureLabel(fixture, clubId) {
  const isHome = fixture.home_club_id === clubId;
  return `vs ${isHome ? fixture.away_club_name : fixture.home_club_name}`;
}

export default function ClubOperations({ club, players = [], currentUser, myPlayer, upcomingFixtures = [], defaultFormation }) {
  const [activeSection, setActiveSection] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [staffRoles, setStaffRoles] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [lineups, setLineups] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [recruitmentPosts, setRecruitmentPosts] = useState([]);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [selectedStaffPlayer, setSelectedStaffPlayer] = useState("");
  const [selectedStaffRole, setSelectedStaffRole] = useState("recruiter");
  const [offerApplicant, setOfferApplicant] = useState(null);
  const [lineupFixtureId, setLineupFixtureId] = useState("");
  const [lineupForm, setLineupForm] = useState({
    formation: defaultFormation || "4-3-3",
    starting_players: [],
    bench_players: [],
    captain_player_id: "",
    notes: "",
  });

  useEffect(() => {
    load();
  }, [club?.id]);

  useEffect(() => {
    if (!lineupFixtureId && upcomingFixtures[0]?.id) setLineupFixtureId(upcomingFixtures[0].id);
  }, [upcomingFixtures, lineupFixtureId]);

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
      const [appRows, staffRows, availRows, lineupRows, auditRows, contractRows, postRows] = await Promise.all([
        stageClient.entities.ClubApplicant.filter({ club_id: club.id }, "-created_date", 200).catch(() => []),
        stageClient.entities.ClubStaffRole.filter({ club_id: club.id }, "-created_date", 200).catch(() => []),
        stageClient.entities.ClubFixtureAvailability.filter({ club_id: club.id }, "-updated_date", 300).catch(() => []),
        stageClient.entities.ClubFixtureLineup.filter({ club_id: club.id }, "-updated_date", 100).catch(() => []),
        stageClient.entities.ClubOperationAuditLog.filter({ club_id: club.id }, "-created_date", 100).catch(() => []),
        stageClient.entities.PlayerContract.filter({ team_id: club.id }, "-created_date", 200).catch(() => []),
        stageClient.entities.RecruitmentPost.filter({ author_club_id: club.id }, "-created_date", 50).catch(() => []),
      ]);
      setApplicants(appRows);
      setStaffRoles(staffRows);
      setAvailability(availRows);
      setLineups(lineupRows);
      setAuditLogs(auditRows);
      setContracts(contractRows);
      setRecruitmentPosts(postRows);
    } catch (err) {
      setError(err?.message || "Could not load club operations.");
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
      setNotice(action === "review" ? "Applicant marked as reviewed." : action === "decline" ? "Applicant declined." : action === "offer-trial" ? "Trial offer sent." : "Applicant updated.");
      await load();
    } catch (err) {
      setError(err?.message || `Could not ${sourceLabel(action)}.`);
    } finally {
      setBusy(null);
    }
  }

  async function handleOfferContract(terms) {
    if (!offerApplicant) return;
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
      setNotice("Staff role assigned.");
      await load();
    } catch (err) {
      setError(err?.message || "Could not assign staff role.");
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
      setNotice("Staff permissions updated.");
      await load();
    } catch (err) {
      setError(err?.message || "Could not update staff permissions.");
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
      setNotice("Staff role removed.");
      await load();
    } catch (err) {
      setError(err?.message || "Could not remove staff role.");
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
      setNotice(`Availability set to ${sourceLabel(status)}.`);
      await load();
    } catch (err) {
      setError(err?.message || "Could not update availability.");
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
      setNotice(status === "published" ? "Lineup published." : "Lineup draft saved.");
      await load();
    } catch (err) {
      setError(err?.message || "Could not save lineup.");
    } finally {
      setBusy(null);
    }
  }

  const sections = [
    ["overview", "Overview", Shield],
    ["applicants", "Applicants", ClipboardList],
    ["staff", "Staff", UserCog],
    ["availability", "Availability", CalendarDays],
    ["lineup", "Lineup", Users],
    ["audit", "Audit", History],
  ];

  if (loading) {
    return <div className="flex justify-center py-16"><div className="w-7 h-7 rounded-full border-4 border-primary/20 border-t-primary animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center justify-between gap-3 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-xs font-bold uppercase">Dismiss</button>
        </div>
      )}
      {notice && (
        <div className="flex items-center justify-between gap-3 rounded border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-xs font-bold uppercase">Dismiss</button>
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {sections.map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveSection(key)}
            className={cn(
              "flex items-center gap-2 rounded border px-3 py-2 text-xs uppercase tracking-wider whitespace-nowrap",
              activeSection === key ? "border-primary bg-primary/10 text-primary" : "border-white/10 text-white/50"
            )}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {activeSection === "overview" && (
        <div className="grid md:grid-cols-3 gap-3">
          {[
            ["Pending applicants", pendingApplicants.length],
            ["Open recruitment posts", recruitmentPosts.filter((p) => p.status === "open").length],
            ["Upcoming fixtures", upcomingFixtures.length],
            ["Expiring contracts", expiringContracts.length],
            ["Pending contract offers", pendingContracts.length],
            ["Staff roles", staffRoles.length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-2xl font-heading font-black text-white">{value}</p>
              <p className="text-xs uppercase tracking-wider text-white/45">{label}</p>
            </div>
          ))}
          <div className="md:col-span-3 flex gap-2 flex-wrap">
            <Link to={`/recruitment?create=club_recruiting&club_id=${club.id}`}><Button type="button" size="sm">Create Recruitment Post</Button></Link>
            <Button type="button" size="sm" variant="outline" onClick={() => setActiveSection("applicants")}>Review Applicants</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setActiveSection("lineup")}>Edit Lineup</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setActiveSection("staff")}>Manage Staff</Button>
          </div>
        </div>
      )}

      {activeSection === "applicants" && (
        <div className="space-y-3">
          {applicants.length === 0 ? <Empty label="No applicants yet." /> : applicants.map((applicant) => (
            <div key={applicant.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-white">{applicant.player_gamertag || "Unknown player"}</p>
                    {Number(applicant.player_is_verified) === 1 && <BadgeCheck className="w-4 h-4 text-primary" />}
                  </div>
                  <p className="text-xs text-white/45 capitalize">
                    {sourceLabel(applicant.source_type)} · {applicant.preferred_position || applicant.player_position || "Any"} · {applicant.platform || applicant.player_platform || "Any platform"}
                  </p>
                </div>
                <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wider text-white/60">{applicant.status}</span>
              </div>
              {applicant.message && <p className="text-sm text-white/60 whitespace-pre-wrap line-clamp-3">{applicant.message}</p>}
              <div className="flex gap-2 flex-wrap">
                {applicant.player_id && <Link to={`/players/${applicant.player_id}`}><Button size="sm" variant="outline" className="text-xs">View Profile</Button></Link>}
                <Button type="button" size="sm" variant="outline" disabled={busy === `review:${applicant.id}`} onClick={() => applicantAction(applicant, "review")} className="text-xs">Mark Reviewed</Button>
                <Button type="button" size="sm" disabled={busy === `offer-trial:${applicant.id}`} onClick={() => applicantAction(applicant, "offer-trial")} className="text-xs">Offer Trial</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setOfferApplicant(applicant)} className="text-xs">Offer Contract</Button>
                <Button type="button" size="sm" variant="outline" disabled={busy === `decline:${applicant.id}`} onClick={() => applicantAction(applicant, "decline")} className="text-xs border-destructive/30 text-destructive">Decline</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeSection === "staff" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 grid md:grid-cols-[1fr_220px_auto] gap-2">
            <select value={selectedStaffPlayer} onChange={(e) => setSelectedStaffPlayer(e.target.value)} className="rounded border border-white/10 bg-[#0d1225] px-3 py-2 text-sm text-white">
              <option value="">Select club member</option>
              {players.map((player) => <option key={player.id} value={player.id}>{player.gamertag}</option>)}
            </select>
            <select value={selectedStaffRole} onChange={(e) => setSelectedStaffRole(e.target.value)} className="rounded border border-white/10 bg-[#0d1225] px-3 py-2 text-sm text-white">
              {STAFF_ROLES.map((role) => <option key={role} value={role}>{sourceLabel(role)}</option>)}
            </select>
            <Button type="button" onClick={assignStaffRole} disabled={busy === "staff" || !selectedStaffPlayer}>{busy === "staff" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Assign"}</Button>
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
                  <Button type="button" size="sm" variant="outline" disabled={busy === `remove-staff:${role.id}`} onClick={() => removeStaffRole(role)} className="text-xs border-destructive/30 text-destructive">Remove</Button>
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
          {upcomingFixtures.length === 0 ? <Empty label="No upcoming fixtures." /> : upcomingFixtures.map((fixture) => {
            const rows = availabilityByFixture[fixture.id] || [];
            const counts = Object.fromEntries(["available", "maybe", "unavailable", "no_response"].map((status) => [status, rows.filter((row) => row.status === status).length]));
            return (
              <div key={fixture.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-white">{fixtureLabel(fixture, club.id)}</p>
                    <p className="text-xs text-white/45">{fixture.scheduled_date ? new Date(fixture.scheduled_date).toLocaleString() : "TBD"}</p>
                  </div>
                  <div className="text-xs text-white/45">{counts.available} available · {counts.maybe} maybe · {counts.unavailable} out</div>
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
                      {busy === `availability:${fixture.id}:${status}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : status}
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
          {upcomingFixtures.length === 0 ? <Empty label="No upcoming fixtures to plan a lineup for." /> : (
            <>
              <div className="grid md:grid-cols-2 gap-2">
                <select value={lineupFixtureId} onChange={(e) => setLineupFixtureId(e.target.value)} className="rounded border border-white/10 bg-[#0d1225] px-3 py-2 text-sm text-white">
                  {upcomingFixtures.map((fixture) => <option key={fixture.id} value={fixture.id}>{fixtureLabel(fixture, club.id)}</option>)}
                </select>
                <select value={lineupForm.formation} onChange={(e) => setLineupForm((prev) => ({ ...prev, formation: e.target.value }))} className="rounded border border-white/10 bg-[#0d1225] px-3 py-2 text-sm text-white">
                  {FORMATIONS.map((formation) => <option key={formation} value={formation}>{formation}</option>)}
                </select>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <LineupPickList title="Starting XI" players={players} selected={lineupForm.starting_players} onToggle={(id) => toggleLineupPlayer("starting_players", id)} />
                <LineupPickList title="Bench" players={players} selected={lineupForm.bench_players} onToggle={(id) => toggleLineupPlayer("bench_players", id)} />
              </div>
              <select value={lineupForm.captain_player_id} onChange={(e) => setLineupForm((prev) => ({ ...prev, captain_player_id: e.target.value }))} className="w-full rounded border border-white/10 bg-[#0d1225] px-3 py-2 text-sm text-white">
                <option value="">Select match captain</option>
                {players.map((player) => <option key={player.id} value={player.id}>{player.gamertag}</option>)}
              </select>
              <Textarea value={lineupForm.notes} onChange={(e) => setLineupForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Lineup notes..." className="bg-white/5 border-white/10" />
              <div className="flex gap-2">
                <Button type="button" disabled={busy === "lineup:draft"} onClick={() => saveLineup("draft")} className="gap-1.5">
                  {busy === "lineup:draft" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Save Draft
                </Button>
                <Button type="button" variant="outline" disabled={busy === "lineup:published"} onClick={() => saveLineup("published")}>
                  {busy === "lineup:published" ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Publish
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {activeSection === "audit" && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <Button type="button" size="sm" variant="outline" onClick={load} className="text-xs">Refresh Audit</Button>
          </div>
          {auditLogs.length === 0 ? <Empty label="No operations history yet." /> : auditLogs.map((log) => (
            <div key={log.id} className="rounded border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
              <p className="text-white capitalize">{sourceLabel(log.action)}</p>
              <p className="text-xs text-white/45">{log.actor_email || "System"} · {log.created_date ? new Date(log.created_date).toLocaleString() : ""}</p>
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
        playerContracts={contracts.filter((contract) => contract.user_id === offerApplicant?.player_id)}
        onOffer={handleOfferContract}
        windowOpen={null}
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

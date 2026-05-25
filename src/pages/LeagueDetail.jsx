import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import { cn } from "@/lib/utils";
import { format, isPast } from "@/lib/momentDate";
import {
  Trophy, ArrowLeft, Calendar, ChevronDown, ChevronRight,
  AlertTriangle, Check, Clock, Shield, Plus, Zap, ExternalLink
} from "lucide-react";
import TrophyHistorySection from "@/components/rewards/TrophyHistorySection";
import { Button } from "@/components/ui/button";
import FixtureSchedulerPanel from "@/components/schedule/FixtureSchedulerPanel";
import { LEAGUE_DEFINITIONS } from "@/lib/qualificationConfig";
import { generateRegionalLeagueFixtures } from "@/lib/competitionUtils";
import { openMatchdayWindows } from "@/lib/scheduleEngine";
import { swalAlert, swalConfirm } from "@/lib/swal";

const SCHEDULING_BADGE = {
  open:          { label: "Awaiting",   cls: "text-muted-foreground border-border"           },
  home_proposed: { label: "Proposed",   cls: "text-primary border-primary/30"                },
  away_proposed: { label: "Counter",    cls: "text-warning border-warning/30"                },
  confirmed:     { label: "Confirmed",  cls: "text-success border-success/30"                },
  expired:       { label: "Expired",    cls: "text-destructive border-destructive/30"        },
  admin_review:  { label: "Review",     cls: "text-warning border-warning/30"                },
};

export default function LeagueDetail() {
  const { slug }   = useParams();
  const navigate    = useNavigate();
  const [league,   setLeague]   = useState(null);
  const [standings,setStandings]= useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [playerStats, setPlayerStats] = useState([]);
  const [playersByEmail, setPlayersByEmail] = useState({});
  const [myClub,   setMyClub]   = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);
  const [user,     setUser]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState("overview");
  const [openMd,   setOpenMd]   = useState(null);
  const [generating, setGenerating] = useState(false);
  const [openingWindows, setOpeningWindows] = useState(null);
  const [fixtureEntityMissing, setFixtureEntityMissing] = useState(false);
  const [prevSeasons, setPrevSeasons]   = useState([]);
  const [prevOpen,    setPrevOpen]      = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const u = await stageClient.auth.me().catch(() => null);
    setUser(u);

    const [allLeagues] = await Promise.all([
      stageClient.entities.RegionalLeague.list("-season_number", 100).catch(() => []),
    ]);

    const found = allLeagues.find(l => l.slug === slug);
    if (!found) { setLoading(false); return; }
    setLeague(found);

    const siblings = allLeagues
      .filter(l => l.id !== found.id && l.region_slug === found.region_slug && (l.division || 1) === (found.division || 1))
      .sort((a, b) => (b.season_number || 1) - (a.season_number || 1));
    setPrevSeasons(siblings);

    const [leagueStandings, leagueFixtures] = await Promise.all([
      stageClient.entities.RegionalLeagueStanding.filter({ league_id: found.id }, null, 50).catch(() => []),
      (stageClient.entities.RegionalLeagueFixture
        ?.filter({ league_id: found.id }, null, 500)
        ?? Promise.resolve([])
      ).catch(err => {
        if (err?.response?.status === 404 || String(err).includes("not found")) setFixtureEntityMissing(true);
        return [];
      }),
    ]);
    setStandings(leagueStandings);
    setFixtures(leagueFixtures);

    const matchIds = [...new Set(leagueFixtures.map(f => f.match_id).filter(Boolean))];
    const stats = matchIds.length
      ? (await Promise.all(matchIds.map(id =>
          stageClient.entities.MatchPlayerStat.filter({ match_id: id }, null, 100).catch(() => [])
        ))).flat()
      : [];
    setPlayerStats(stats);
    const statEmails = [...new Set(stats.map(s => s.player_email).filter(Boolean).map(e => String(e).toLowerCase()))];
    const playerRows = statEmails.length
      ? (await Promise.all(statEmails.map(email =>
          stageClient.entities.Player.filter({ email }, null, 1).catch(() => [])
        ))).flat()
      : [];
    setPlayersByEmail(Object.fromEntries(playerRows.map(p => [String(p.email || "").toLowerCase(), p])));

    if (u) {
      const { player, club } = await resolveMyPlayerAndClub();
      setMyPlayer(player);
      setMyClub(club);
      // Auto-open the matchday that involves my club
      if (club) {
        const myMatchday = leagueFixtures.find(f => f.home_club_id === club.id || f.away_club_id === club.id);
        if (myMatchday) setOpenMd(myMatchday.matchday);
      }
    }
    setLoading(false);
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  async function handleGenerateFixtures() {
    if (!league) return;
    if (!standings.length) { await swalAlert("Add clubs to the league before generating fixtures."); return; }
    if (!(await swalConfirm(`Generate home-and-away fixtures for all ${standings.length} clubs? This cannot be undone.`))) return;
    setGenerating(true);
    try {
      const clubs = standings.map(s => ({
        id: s.club_id, name: s.club_name, logo_url: s.club_logo_url || "", tag: s.club_tag || "",
      }));
      await generateRegionalLeagueFixtures(league, clubs);
      await load();
    } catch (err) {
      const msg = String(err?.message || err);
      if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("404")) {
        setFixtureEntityMissing(true);
        setTab("fixtures");
      } else {
        await swalAlert(`Error: ${msg}`);
      }
    } finally { setGenerating(false); }
  }

  async function handleOpenMatchdayWindows(matchday) {
    const mdFixtures = fixtures.filter(f => f.matchday === matchday);
    if (!mdFixtures.length) return;
    setOpeningWindows(matchday);
    try {
      await openMatchdayWindows(mdFixtures, "regional_league");
      await load();
    } catch (err) {
      await swalAlert(`Could not open windows: ${err?.message || "Unknown error"}`);
    } finally { setOpeningWindows(null); }
  }

  async function openGameDayForFixture(fixture) {
    if (!fixture.match_id) {
      const { createMatchFromFixture } = await import("@/lib/gameDayIntegration");
      await createMatchFromFixture(fixture, "regional_league");
      await load();
    }
    navigate("/game-day");
  }

  const isAdmin = user?.role === "admin";
  const ldef    = LEAGUE_DEFINITIONS.find(d => d.slug === slug);

  // Group fixtures by matchday
  const matchdays = [...new Set(fixtures.map(f => f.matchday))].sort((a, b) => a - b);

  // Sort standings
  const sortedStandings = [...standings].sort((a, b) =>
    b.points - a.points || (b.goals_for - b.goals_against) - (a.goals_for - a.goals_against)
  );
  const playedFixtures = fixtures.filter(f => f.status === "played" || f.status === "completed");
  const scheduledFixtures = fixtures.filter(f => f.scheduling_status === "confirmed" || f.status === "scheduled");
  const myFixtures = myClub ? fixtures.filter(f => f.home_club_id === myClub.id || f.away_club_id === myClub.id) : [];
  const leader = sortedStandings[0];
  const topScorers = buildLeaguePlayerStats(playerStats, playersByEmail).sort((a, b) =>
    b.goals - a.goals || b.assists - a.assists || b.avg_rating - a.avg_rating || a.name.localeCompare(b.name)
  );
  const clubStatsRows = sortedStandings.map(row => ({
    ...row,
    winRate: row.played ? Math.round((Number(row.wins || 0) / Number(row.played || 1)) * 1000) / 10 : 0,
    goalsPerMatch: row.played ? Math.round((Number(row.goals_for || 0) / Number(row.played || 1)) * 100) / 100 : 0,
    cleanSheets: playedFixtures.filter(f =>
      (f.home_club_id === row.club_id && Number(f.away_score || 0) === 0) ||
      (f.away_club_id === row.club_id && Number(f.home_score || 0) === 0)
    ).length,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!league) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-muted-foreground">League not found.</p>
        <Link to="/admin"><Button variant="outline" size="sm">Back to Admin</Button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Back */}
        <Link to="/competitions" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Competitions
        </Link>

        {/* Header */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {ldef?.region || league.region} · Division {league.division || 1}
                </span>
              </div>
              <h1
                className="font-heading font-black text-3xl md:text-4xl text-foreground uppercase"
                style={{ transform: "skewX(-8deg)", letterSpacing: "-0.02em", transformOrigin: "left center" }}
              >
                {league.name}
              </h1>
              <p className="text-xs text-muted-foreground">
                Season {league.season_number} · {standings.length}/{league.max_clubs || 16} clubs
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <span className={cn("text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-wider",
                league.status === "in_progress" ? "text-success border-success/30 bg-success/5"
                : league.status === "registration" ? "text-primary border-primary/30 bg-primary/5"
                : league.status === "completed"   ? "text-muted-foreground border-border bg-secondary"
                : "text-warning border-warning/30 bg-warning/5"
              )}>{league.status.replace("_", " ")}</span>
              {isAdmin && fixtures.length === 0 && standings.length >= 2 && (
                <Button size="sm" onClick={handleGenerateFixtures} disabled={generating}
                  className="bg-primary text-primary-foreground h-8 text-xs gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  {generating ? "Generating…" : "Generate Fixtures"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Qualification info */}
        {(league.division || 1) === 1 && (
          <div className="bg-card border border-border rounded-lg p-3 text-xs text-muted-foreground space-y-0.5">
            <p className="font-semibold text-foreground text-[11px] uppercase tracking-wider mb-1">Division 1 Qualification Paths</p>
            <p>1st–2nd → STAGE Supreme League</p>
            <p>3rd–4th → STAGE Elite League</p>
            <p>5th–6th → STAGE Challenger League</p>
            <p className="mt-1">Bottom 2 relegated to Division 2</p>
          </div>
        )}
        {(league.division || 1) === 2 && (
          <div className="bg-card border border-border rounded-lg p-3 text-xs text-muted-foreground">
            <p>Top 2 clubs promoted to Division 1 next season. Bottom 2 relegated.</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-border gap-0">
          {["overview", "fixtures", "standings", "club stats", "player stats"].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors",
                tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}>
              {t}
            </button>
          ))}
        </div>

        {/* ── Overview tab ── */}
        {tab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Clubs", value: `${standings.length}/${league.max_clubs || 16}`, icon: Shield },
                { label: "Fixtures", value: fixtures.length, icon: Calendar },
                { label: "Played", value: playedFixtures.length, icon: Check },
                { label: "Scheduled", value: scheduledFixtures.length, icon: Zap },
              ].map(item => (
                <div key={item.label} className="bg-card border border-border rounded-xl p-4">
                  <item.icon className="w-4 h-4 text-primary mb-3" />
                  <p className="font-heading text-3xl text-foreground">{item.value}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-4 h-4 text-warning" />
                  <h2 className="text-xs font-black uppercase tracking-widest text-foreground">League Leader</h2>
                </div>
                {leader ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {leader.club_logo_url
                        ? <img src={leader.club_logo_url} alt={leader.club_name} className="w-10 h-10 rounded object-cover" />
                        : <Shield className="w-8 h-8 text-muted-foreground" />}
                      <div className="min-w-0">
                        <Link to={`/clubs/${leader.club_id}`} className="font-bold text-foreground hover:text-primary truncate block">
                          {leader.club_name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{leader.wins || 0}W {leader.draws || 0}D {leader.losses || 0}L</p>
                      </div>
                    </div>
                    <p className="font-heading text-4xl text-primary">{leader.points || 0}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No leader yet.</p>
                )}
              </div>

              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-primary" />
                  <h2 className="text-xs font-black uppercase tracking-widest text-foreground">Your Club Fixtures</h2>
                </div>
                {myClub && myFixtures.length ? (
                  <div className="space-y-2">
                    {myFixtures.slice(0, 4).map(f => (
                      <button key={f.id} type="button" onClick={() => { setTab("fixtures"); setOpenMd(f.matchday); }}
                        className="w-full flex items-center justify-between gap-3 rounded border border-border px-3 py-2 text-left hover:border-primary/40">
                        <span className="text-xs text-foreground truncate">{f.home_club_name} vs {f.away_club_name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">MD {f.matchday}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{myClub ? "Your club has no fixtures in this league." : "Join or manage a club to see your fixtures here."}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Fixtures tab ── */}
        {tab === "fixtures" && (
          <div className="space-y-3">
            {fixtureEntityMissing && (
              <div className="bg-warning/10 border border-warning/30 rounded-lg px-4 py-3 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-warning">Schema not published</p>
                  <p className="text-[11px] text-muted-foreground">
                    Publish <code className="font-mono bg-secondary px-1 rounded">RegionalLeagueFixture</code> on{" "}
                    <span className="text-foreground">app.stageClient.com</span> to enable fixture generation and scheduling.
                  </p>
                </div>
              </div>
            )}
            {fixtures.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center space-y-3">
                <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">No fixtures yet.</p>
                {isAdmin && standings.length >= 2 && (
                  <Button size="sm" onClick={handleGenerateFixtures} disabled={generating}
                    className="bg-primary text-primary-foreground gap-1.5 text-xs">
                    <Plus className="w-3.5 h-3.5" />
                    {generating ? "Generating…" : "Generate Fixtures"}
                  </Button>
                )}
              </div>
            ) : (
              matchdays.map(md => {
                const mdFixtures = fixtures.filter(f => f.matchday === md);
                const myFixture  = mdFixtures.find(f =>
                  f.home_club_id === myClub?.id || f.away_club_id === myClub?.id
                );
                const allConfirmed = mdFixtures.every(f => f.scheduling_status === "confirmed" || f.status === "played");
                const anyExpired   = mdFixtures.some(f => f.scheduling_status === "expired" || f.scheduling_status === "admin_review");
                const isOpen       = openMd === md;

                return (
                  <div key={md} className="bg-card border border-border rounded-xl overflow-hidden">
                    {/* Matchday header */}
                    <button
                      onClick={() => setOpenMd(isOpen ? null : md)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-foreground">Matchday {md}</span>
                        {myFixture && (
                          <span className="text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5">
                            Your match
                          </span>
                        )}
                        {allConfirmed && (
                          <span className="text-[10px] font-semibold text-success bg-success/5 border border-success/20 rounded px-1.5 py-0.5 flex items-center gap-1">
                            <Check className="w-3 h-3" /> All confirmed
                          </span>
                        )}
                        {anyExpired && (
                          <span className="text-[10px] font-semibold text-destructive bg-destructive/5 border border-destructive/20 rounded px-1.5 py-0.5 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Issues
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isAdmin && !allConfirmed && (
                          <Button size="sm" variant="outline"
                            onClick={e => { e.stopPropagation(); handleOpenMatchdayWindows(md); }}
                            disabled={openingWindows === md}
                            className="h-6 text-[10px] border-border text-muted-foreground hover:text-foreground px-2">
                            {openingWindows === md ? "Opening…" : "Open Windows"}
                          </Button>
                        )}
                        {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {/* Fixtures list */}
                    {isOpen && (
                      <div className="divide-y divide-border border-t border-border">
                        {mdFixtures.map(f => (
                          <FixtureRow
                            key={f.id}
                            fixture={f}
                            myClub={myClub}
                            myEmail={user?.email}
                            myGamertag={myPlayer?.gamertag}
                            onUpdate={load}
                            onOpenGameDay={openGameDayForFixture}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Club stats tab ── */}
        {tab === "club stats" && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {clubStatsRows.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground text-sm">No club stats yet.</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    {["Club", "P", "W%", "GF", "GA", "GD", "CS", "G/M"].map((h, i) => (
                      <th key={h} className={cn("px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold", i === 0 ? "text-left" : "text-center")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {clubStatsRows.map(row => (
                    <tr key={row.id}>
                      <td className="px-3 py-2.5">
                        <Link to={`/clubs/${row.club_id}`} className="font-semibold text-foreground hover:text-primary">{row.club_name}</Link>
                      </td>
                      <td className="text-center px-3 py-2.5">{row.played || 0}</td>
                      <td className="text-center px-3 py-2.5">{row.winRate}%</td>
                      <td className="text-center px-3 py-2.5">{row.goals_for || 0}</td>
                      <td className="text-center px-3 py-2.5">{row.goals_against || 0}</td>
                      <td className="text-center px-3 py-2.5">{row.goal_difference || 0}</td>
                      <td className="text-center px-3 py-2.5">{row.cleanSheets}</td>
                      <td className="text-center px-3 py-2.5">{row.goalsPerMatch}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Player stats tab ── */}
        {tab === "player stats" && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {topScorers.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground text-sm">No player stats yet. Stats appear after Game Day results are submitted.</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    {["Player", "Club", "M", "G", "A", "CS", "MOTM", "AVG"].map((h, i) => (
                      <th key={h} className={cn("px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold", i < 2 ? "text-left" : "text-center")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {topScorers.map(row => (
                    <tr key={row.key}>
                      <td className="px-3 py-2.5">
                        {row.player_id ? (
                          <Link to={`/players/${row.player_id}`} className="font-semibold text-foreground hover:text-primary">{row.name}</Link>
                        ) : (
                          <span className="font-semibold text-foreground">{row.name}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{row.club_name || "—"}</td>
                      <td className="text-center px-3 py-2.5">{row.matches}</td>
                      <td className="text-center px-3 py-2.5 font-bold text-foreground">{row.goals}</td>
                      <td className="text-center px-3 py-2.5">{row.assists}</td>
                      <td className="text-center px-3 py-2.5">{row.clean_sheets}</td>
                      <td className="text-center px-3 py-2.5">{row.motm}</td>
                      <td className="text-center px-3 py-2.5">{row.avg_rating || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Standings tab ── */}
        {tab === "standings" && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {sortedStandings.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground text-sm">No standings yet.</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-8">#</th>
                    <th className="text-left px-2 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Club</th>
                    <th className="text-center px-2 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-8">P</th>
                    <th className="text-center px-2 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-8">W</th>
                    <th className="text-center px-2 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-8">D</th>
                    <th className="text-center px-2 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-8">L</th>
                    <th className="text-center px-2 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-10">GD</th>
                    <th className="text-center px-2 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-10">Pts</th>
                    <th className="text-center px-2 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-12">Zone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedStandings.map((s, idx) => {
                    const pos = idx + 1;
                    const div = league.division || 1;
                    const zone = div === 1
                      ? pos <= 2 ? "supreme"
                      : pos <= 4 ? "elite"
                      : pos <= 6 ? "challenger"
                      : pos > sortedStandings.length - 2 ? "relegated"
                      : ""
                      : pos <= 2 ? "promoted" : pos > sortedStandings.length - 2 ? "relegated" : "";

                    const zoneClass = {
                      supreme:   "bg-yellow-400/10 border-l-2 border-l-yellow-400",
                      elite:     "bg-primary/5 border-l-2 border-l-primary",
                      challenger:"bg-purple-500/5 border-l-2 border-l-purple-500",
                      promoted:  "bg-success/5 border-l-2 border-l-success",
                      relegated: "bg-destructive/5 border-l-2 border-l-destructive",
                    }[zone] || "";

                    const isMyClub = s.club_id === myClub?.id;

                    return (
                      <tr key={s.id} className={cn("transition-colors", zoneClass, isMyClub && "bg-primary/10")}>
                        <td className="px-4 py-2.5 text-center text-muted-foreground font-mono">{pos}</td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-2">
                            {s.club_logo_url
                              ? <img src={s.club_logo_url} alt={s.club_name} className="w-5 h-5 rounded-sm object-cover shrink-0" />
                              : <Shield className="w-4 h-4 text-muted-foreground shrink-0" />}
                            <span className={cn("font-medium text-foreground truncate max-w-[140px]", isMyClub && "text-primary")}>
                              {s.club_name}
                            </span>
                            {s.club_tag && <span className="text-[10px] text-muted-foreground font-mono">[{s.club_tag}]</span>}
                          </div>
                        </td>
                        <td className="text-center text-muted-foreground px-2 py-2.5">{s.played || 0}</td>
                        <td className="text-center text-foreground font-medium px-2 py-2.5">{s.wins || 0}</td>
                        <td className="text-center text-muted-foreground px-2 py-2.5">{s.draws || 0}</td>
                        <td className="text-center text-muted-foreground px-2 py-2.5">{s.losses || 0}</td>
                        <td className={cn("text-center font-medium px-2 py-2.5",
                          (s.goal_difference || 0) > 0 ? "text-success" : (s.goal_difference || 0) < 0 ? "text-destructive" : "text-muted-foreground")}>
                          {(s.goal_difference || 0) > 0 ? "+" : ""}{s.goal_difference || 0}
                        </td>
                        <td className="text-center font-bold text-foreground px-2 py-2.5">{s.points || 0}</td>
                        <td className="text-center px-2 py-2.5">
                          {zone && (
                            <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded",
                              zone === "supreme"   ? "text-yellow-400 bg-yellow-400/10"
                              : zone === "elite"   ? "text-primary bg-primary/10"
                              : zone === "challenger" ? "text-purple-400 bg-purple-500/10"
                              : zone === "promoted"   ? "text-success bg-success/10"
                              : "text-destructive bg-destructive/10"
                            )}>
                              {zone === "supreme" ? "SL" : zone === "elite" ? "EL" : zone === "challenger" ? "CL"
                              : zone === "promoted" ? "UP" : "↓"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
        {/* Trophy History */}
        {league && (
          <TrophyHistorySection
            sourceId={league.id}
            trophyImageUrl={league.trophy_image_url}
            className="bg-card border border-border rounded-xl p-4"
          />
        )}

        {/* Previous Seasons */}
        {prevSeasons.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setPrevOpen(v => !v)}
              className="w-full flex items-center justify-between px-5 py-3 text-sm font-bold text-foreground hover:bg-secondary/30 transition-colors"
            >
              <span>Previous Seasons ({prevSeasons.length})</span>
              {prevOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </button>
            {prevOpen && (
              <div className="divide-y divide-border">
                {prevSeasons.map(ps => (
                  <Link
                    key={ps.id}
                    to={`/leagues/${ps.slug}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-secondary/30 transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        {ps.name} — Season {ps.season_number}
                      </p>
                      {ps.winner_club_name && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Trophy className="w-3 h-3 text-warning" />
                          {ps.winner_club_name}
                        </p>
                      )}
                    </div>
                    <span className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0",
                      ps.status === "archived"    ? "text-muted-foreground/50 border-border/50" :
                      ps.status === "completed"   ? "text-muted-foreground border-border" :
                      ps.status === "in_progress" ? "text-success border-success/30" :
                      "text-warning border-warning/30"
                    )}>
                      {ps.status.replace("_", " ")}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Fixture row ──────────────────────────────────────────────────────────────

function FixtureRow({ fixture, myClub, myEmail, myGamertag, onUpdate, onOpenGameDay }) {
  const [expanded, setExpanded] = useState(false);
  const sched = fixture.scheduling_status || "open";
  const badge = SCHEDULING_BADGE[sched] || SCHEDULING_BADGE.open;
  const isMyFixture = myClub && (fixture.home_club_id === myClub.id || fixture.away_club_id === myClub.id);
  const isPlayed = fixture.status === "played";
  const canOpenGameDay = fixture.match_id || fixture.scheduling_status === "confirmed" || fixture.status === "scheduled";

  return (
    <div className={cn("transition-colors", isMyFixture && "bg-primary/5")}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Team names */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <span className={cn("font-medium truncate max-w-[120px]",
              myClub?.id === fixture.home_club_id ? "text-primary font-semibold" : "text-foreground")}>
              {fixture.home_club_name}
            </span>
            <span className="text-muted-foreground text-xs shrink-0">vs</span>
            <span className={cn("font-medium truncate max-w-[120px]",
              myClub?.id === fixture.away_club_id ? "text-primary font-semibold" : "text-foreground")}>
              {fixture.away_club_name}
            </span>
          </div>
          {/* Confirmed date or played score */}
          {isPlayed && (
            <p className="text-xs text-success font-bold mt-0.5">
              {fixture.home_score}–{fixture.away_score}
            </p>
          )}
          {!isPlayed && sched === "confirmed" && fixture.confirmed_date && (
            <p className="text-[11px] text-success mt-0.5">
              <Check className="w-3 h-3 inline mr-0.5" />
              {format(new Date(fixture.confirmed_date), "EEE d MMM, HH:mm")}
            </p>
          )}
          {!isPlayed && sched !== "confirmed" && fixture.window_end && (
            <p className={cn("text-[11px] mt-0.5 flex items-center gap-1",
              isPast(new Date(fixture.window_end)) ? "text-destructive" : "text-muted-foreground")}>
              <Clock className="w-3 h-3" />
              {isPast(new Date(fixture.window_end))
                ? "Deadline passed"
                : `Deadline ${format(new Date(fixture.window_end), "d MMM")}`}
            </p>
          )}
        </div>

        {/* Status badge */}
        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0", badge.cls)}>
          {badge.label}
        </span>

        {canOpenGameDay && (
          <button
            type="button"
            onClick={() => onOpenGameDay(fixture)}
            className="inline-flex items-center gap-1 rounded border border-primary/30 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10"
          >
            Game Day <ExternalLink className="w-3 h-3" />
          </button>
        )}

        {/* Expand toggle (only for my fixture or admin) */}
        {(isMyFixture || !isPlayed) && (
          <button onClick={() => setExpanded(v => !v)}
            className="p-1 rounded hover:bg-secondary text-muted-foreground transition-colors shrink-0">
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-3">
          <FixtureSchedulerPanel
            fixture={fixture}
            fixtureType="regional_league"
            myClub={myClub}
            myEmail={myEmail}
            myGamertag={myGamertag}
            onUpdate={onUpdate}
          />
        </div>
      )}
    </div>
  );
}

function buildLeaguePlayerStats(stats, playersByEmail) {
  const rows = new Map();
  for (const stat of stats || []) {
    const email = String(stat.player_email || "").toLowerCase();
    const player = playersByEmail[email] || null;
    const key = stat.player_id || player?.id || email || stat.player_gamertag || stat.id;
    if (!key) continue;
    if (!rows.has(key)) {
      rows.set(key, {
        key,
        player_id: stat.player_id || player?.id || "",
        name: player?.gamertag || stat.player_gamertag || stat.player_name || stat.player_email || "Unknown Player",
        club_id: stat.club_id || player?.club_id || "",
        club_name: stat.club_name || player?.club_name || "",
        matches: 0,
        goals: 0,
        assists: 0,
        clean_sheets: 0,
        motm: 0,
        rating_total: 0,
        rated_matches: 0,
        avg_rating: 0,
      });
    }
    const row = rows.get(key);
    row.matches += 1;
    row.goals += Number(stat.goals || 0);
    row.assists += Number(stat.assists || 0);
    row.clean_sheets += Number(stat.clean_sheet || 0);
    row.motm += Number(stat.is_motm || 0);
    if (Number(stat.rating || 0) > 0) {
      row.rating_total += Number(stat.rating);
      row.rated_matches += 1;
      row.avg_rating = Math.round((row.rating_total / row.rated_matches) * 100) / 100;
    }
  }
  return [...rows.values()];
}

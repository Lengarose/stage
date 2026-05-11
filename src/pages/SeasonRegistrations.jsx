import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { Trophy, Shield, ArrowLeft, CheckCircle, Clock, X, AlertTriangle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { REGIONS } from "@/lib/qualificationConfig";
import { applyForLeague } from "@/lib/registrationEngine";

const STATUS_CONFIG = {
  pending:    { label: "Pending",     cls: "text-warning border-warning/30 bg-warning/5",                icon: Clock         },
  approved:   { label: "Approved",    cls: "text-success border-success/30 bg-success/5",                icon: CheckCircle   },
  rejected:   { label: "Rejected",    cls: "text-destructive border-destructive/30 bg-destructive/5",    icon: X             },
  waitlisted: { label: "Waitlisted",  cls: "text-muted-foreground border-border bg-secondary",           icon: Clock         },
};

export default function SeasonRegistrations() {
  const [_user,        setUser]         = useState(null);
  const [myClub,       setMyClub]       = useState(null);
  const [leagues,      setLeagues]      = useState([]);  // all open leagues
  const [myApps,       setMyApps]       = useState([]);  // my SeasonRegistration records
  const [loading,      setLoading]      = useState(true);
  const [applying,     setApplying]     = useState(false);

  // Dialog state
  const [applyDialog,  setApplyDialog]  = useState(null); // { region }
  const [prefDiv,      setPrefDiv]      = useState("1");
  const [appNote,      setAppNote]      = useState("");

  // Which region cards are expanded
  const [expanded,     setExpanded]     = useState({});

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const u = await base44.auth.me().catch(() => null);
      setUser(u);

      const [allLeagues, apps] = await Promise.all([
        base44.entities.RegionalLeague.filter({ status: "registration" }, null, 100).catch(() => []),
        u
          ? (base44.entities.SeasonRegistration?.filter({ owner_email: u.email }, "-applied_at", 50) ?? Promise.resolve([])).catch(() => [])
          : Promise.resolve([]),
      ]);

      setLeagues(allLeagues);
      // Defense-in-depth: only keep applications that actually belong to the
      // signed-in user. Backends prior to the leagueEntityController JSON-filter
      // fix silently ignored ?owner_email=… and returned other users' rows;
      // this guard makes sure we never render someone else's application
      // even against a stale/older backend.
      const myEmail = (u?.email || "").toLowerCase();
      const ownedApps = myEmail
        ? apps.filter(a => String(a.owner_email || "").toLowerCase() === myEmail)
        : [];
      setMyApps(ownedApps);

      if (u) {
        const players = await base44.entities.Player.filter({ email: u.email }).catch(() => []);
        const player = players[0];
        if (player?.club_id) {
          const clubs = await base44.entities.Club.filter({ id: player.club_id }, null, 1).catch(() => []);
          setMyClub(clubs[0] || null);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  function openApplyDialog(region) {
    setPrefDiv("1");
    setAppNote("");
    setApplyDialog(region);
  }

  async function submitApplication() {
    if (!myClub || !applyDialog) return;
    setApplying(true);
    try {
      // Find any open league in this region to get the season label
      const regionLeagues = leagues.filter(l => l.region_slug === applyDialog.slug);
      const seasonLabel = regionLeagues.length > 0
        ? `Season ${regionLeagues[0].season_number}`
        : "Season 1";

      await applyForLeague(
        myClub,
        applyDialog.slug,
        applyDialog.name,
        myClub.platform || "Cross-Platform",
        { preferredDivision: Number(prefDiv), note: appNote.trim(), seasonLabel }
      );
      setApplyDialog(null);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setApplying(false);
    }
  }

  // Map region_slug → my application (if any)
  const appByRegion = {};
  for (const app of myApps) {
    if (!appByRegion[app.region_slug]) appByRegion[app.region_slug] = app;
  }

  // Group open leagues by region_slug
  const leaguesByRegion = {};
  for (const l of leagues) {
    if (!leaguesByRegion[l.region_slug]) leaguesByRegion[l.region_slug] = [];
    leaguesByRegion[l.region_slug].push(l);
  }

  // Regions that have at least one open league
  const openRegions = REGIONS.filter(r => leaguesByRegion[r.slug]?.length > 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Back */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>

        {/* Header */}
        <div>
          <h1 className="font-heading font-black text-3xl md:text-4xl text-foreground uppercase tracking-tight"
            style={{ transform: "skewX(-8deg)", letterSpacing: "-0.02em", transformOrigin: "left center" }}>
            Season Registration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Register your club for a STAGE Regional League. Spots are limited — apply early.
          </p>
        </div>

        {/* No club warning */}
        {!myClub && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-warning">No club found</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You need a club to register for a league. Create one first from the{" "}
                <Link to="/clubs" className="text-primary underline">Clubs</Link> page.
              </p>
            </div>
          </div>
        )}

        {/* My applications summary */}
        {myApps.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">My Applications</h2>
            {myApps.map(app => {
              const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending;
              const Icon = cfg.icon;
              return (
                <div key={app.id} className="flex items-center gap-3">
                  <Icon className={cn("w-3.5 h-3.5 shrink-0", app.status === "approved" ? "text-success" : app.status === "rejected" ? "text-destructive" : "text-warning")} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {app.region_name || app.region_slug}
                      {app.preferred_division ? ` — Div ${app.preferred_division} preferred` : ""}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {app.season_label || ""} · Applied {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : "—"}
                      {app.assigned_league_name ? ` · Assigned to ${app.assigned_league_name}` : ""}
                      {app.admin_notes ? ` · "${app.admin_notes}"` : ""}
                    </p>
                  </div>
                  <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0", cfg.cls)}>
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* No open registrations */}
        {openRegions.length === 0 && (
          <div className="border border-dashed border-border rounded-xl p-12 text-center">
            <Trophy className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground uppercase tracking-widest">
              No league registrations are currently open
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Check back when a season is in Registration status.
            </p>
          </div>
        )}

        {/* Open regions */}
        {openRegions.map(region => {
          const regionLeagues = (leaguesByRegion[region.slug] || []).sort((a, b) => (a.division || 1) - (b.division || 1));
          const myApp = appByRegion[region.slug];
          const isOpen = expanded[region.slug];
          const totalSpots = regionLeagues.reduce((sum, l) => sum + (l.max_clubs || 16), 0);
          const takenSpots = regionLeagues.reduce((sum, l) => sum + (l.num_clubs || 0), 0);
          const spotsLeft = totalSpots - takenSpots;

          return (
            <div key={region.slug} className={cn(
              "bg-card border rounded-xl overflow-hidden transition-colors",
              myApp?.status === "approved" ? "border-success/30" :
              myApp?.status === "pending"  ? "border-warning/30" :
              myApp?.status === "waitlisted" ? "border-border" :
              "border-border"
            )}>
              {/* Region header */}
              <button
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-secondary/30 transition-colors text-left"
                onClick={() => setExpanded(prev => ({ ...prev, [region.slug]: !prev[region.slug] }))}
              >
                <Trophy className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-black text-base uppercase tracking-tight text-foreground">
                    {region.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {regionLeagues.length} division{regionLeagues.length !== 1 ? "s" : ""} open
                    {spotsLeft > 0 ? ` · ${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} available` : " · Full"}
                  </p>
                </div>
                {myApp ? (
                  <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0", STATUS_CONFIG[myApp.status]?.cls)}>
                    {STATUS_CONFIG[myApp.status]?.label}
                  </span>
                ) : spotsLeft <= 0 ? (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-muted-foreground/30 text-muted-foreground uppercase tracking-wider shrink-0">
                    Full
                  </span>
                ) : null}
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", isOpen && "rotate-180")} />
              </button>

              {/* Expanded: divisions breakdown + apply button */}
              {isOpen && (
                <div className="border-t border-border">
                  {/* Division rows */}
                  <div className="divide-y divide-border">
                    {regionLeagues.map(league => {
                      const max = league.max_clubs || 16;
                      const taken = league.num_clubs || 0;
                      const full = taken >= max;
                      const pct = Math.round((taken / max) * 100);
                      return (
                        <div key={league.id} className="px-5 py-3 flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Shield className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <p className="text-sm font-semibold text-foreground truncate">{league.name}</p>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-border text-muted-foreground uppercase tracking-wider shrink-0">
                                Division {league.division || 1}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex-1 bg-secondary rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={cn("h-full rounded-full transition-all", full ? "bg-destructive" : pct > 75 ? "bg-warning" : "bg-success")}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className={cn("text-[10px] font-bold shrink-0", full ? "text-destructive" : "text-muted-foreground")}>
                                {taken}/{max}
                              </span>
                            </div>
                          </div>
                          <Link to={`/leagues/${league.slug}`} className="text-[10px] text-primary hover:underline shrink-0">
                            View →
                          </Link>
                        </div>
                      );
                    })}
                  </div>

                  {/* Apply / status footer */}
                  <div className="px-5 py-4 bg-secondary/20 flex items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>Register your club for <span className="text-foreground font-semibold">{region.name}</span>.</p>
                      <p>Admin will assign you to a division after reviewing your application.</p>
                    </div>
                    {myApp ? (
                      <div className="shrink-0 text-right">
                        <span className={cn("text-[9px] font-bold px-2 py-1 rounded border uppercase tracking-wider", STATUS_CONFIG[myApp.status]?.cls)}>
                          {STATUS_CONFIG[myApp.status]?.label}
                        </span>
                        {myApp.preferred_division && (
                          <p className="text-[10px] text-muted-foreground mt-1">Preferred Div {myApp.preferred_division}</p>
                        )}
                      </div>
                    ) : !myClub ? (
                      <Link to="/clubs">
                        <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs">
                          Create Club First
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => openApplyDialog(region)}
                        className={cn(
                          "shrink-0 h-8 text-xs font-bold",
                          spotsLeft <= 0
                            ? "bg-secondary text-muted-foreground border border-border hover:bg-secondary"
                            : "bg-primary text-primary-foreground"
                        )}
                      >
                        {spotsLeft <= 0 ? "Join Waitlist" : "Apply Now"}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* How it works */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">How It Works</h2>
          <ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside">
            <li>Submit your application for a region before registration closes.</li>
            <li>State your preferred division (1 or 2) — admin will consider it based on availability and club history.</li>
            <li>Admin reviews and assigns you to a division. You'll see your status update here.</li>
            <li>Once approved, your club appears in the league standings automatically.</li>
            <li>Registration closes when the season goes Active. Late applications are not accepted.</li>
          </ol>
        </div>

      </div>

      {/* Apply dialog */}
      {applyDialog && (
        <Dialog open onOpenChange={() => setApplyDialog(null)}>
          <DialogContent className="bg-card border-border text-foreground max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading uppercase tracking-tight">
                Apply — {applyDialog.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {myClub && (
                <div className="bg-secondary/40 border border-border rounded-lg p-3 flex items-center gap-3">
                  {myClub.logo_url
                    ? <img src={myClub.logo_url} alt={myClub.name} className="w-8 h-8 object-contain rounded shrink-0" />
                    : <Shield className="w-6 h-6 text-muted-foreground/40 shrink-0" />}
                  <div>
                    <p className="text-sm font-bold text-foreground">{myClub.name}</p>
                    <p className="text-[10px] text-muted-foreground">{myClub.tag ? `[${myClub.tag}]` : ""} · {myClub.platform || "—"}</p>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Preferred Division
                </label>
                <Select value={prefDiv} onValueChange={setPrefDiv}>
                  <SelectTrigger className="bg-secondary border-border text-foreground h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    <SelectItem value="1">Division 1 — Top flight</SelectItem>
                    <SelectItem value="2">Division 2 — Development</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  This is a preference — final placement is decided by the admin.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Note (optional)
                </label>
                <Textarea
                  value={appNote}
                  onChange={e => setAppNote(e.target.value)}
                  placeholder="Any context for the admin — club history, previous season results, etc."
                  className="bg-secondary border-border text-foreground text-sm resize-none h-20"
                  maxLength={300}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1 border-border h-9 text-sm" onClick={() => setApplyDialog(null)}>
                  Cancel
                </Button>
                <Button disabled={applying || !myClub} onClick={submitApplication}
                  className="flex-1 bg-primary text-primary-foreground h-9 text-sm font-bold">
                  {applying ? "Submitting…" : "Submit Application"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

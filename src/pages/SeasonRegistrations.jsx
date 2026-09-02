import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import { cn } from "@/lib/utils";
import { Trophy, Shield, ArrowLeft, CheckCircle, Clock, X, AlertTriangle, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { REGIONS, withCanonicalRegionalLeagueName } from "@/lib/qualificationConfig";
import { getRegionalLeagueMaxClubs } from "@/lib/regionalLeagueRules";
import { applyForLeague } from "@/lib/registrationEngine";
import { swalAlert } from "@/lib/swal";
import { useTranslation } from "@/hooks/useTranslation";
import { GamerHeroAction, GamerMetaPill, GamerProfileShell, GamerSectionCard } from "@/components/profile/gamer/GamerProfileUI";

const CARD_CLIP = { clipPath: "polygon(2% 0, 100% 0, 98% 100%, 0 100%)" };
const ROW_CLIP = { clipPath: "polygon(4% 0, 100% 0, 96% 100%, 0 100%)" };

const STATUS_CONFIG = {
  pending:    { key: "pending",    cls: "text-amber-300 border-amber-400/30 bg-amber-400/10", icon: Clock },
  approved:   { key: "approved",   cls: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10", icon: CheckCircle },
  rejected:   { key: "rejected",   cls: "text-rose-400 border-rose-400/30 bg-rose-400/10", icon: X },
  waitlisted: { key: "waitlisted", cls: "text-white/50 border-white/15 bg-white/[0.04]", icon: Clock },
  removed:    { key: "removed",    cls: "text-white/40 border-white/10 bg-white/[0.03]", icon: X },
};

const ACTIVE_APPLICATION_STATUSES = new Set(["pending", "waitlisted", "approved"]);

function isRemovedApplication(app) {
  return String(app?.status || "").toLowerCase() === "removed" ||
    String(app?.admin_notes || "").toLowerCase().includes("removed from");
}

function StatusBadge({ status }) {
  const { t } = useTranslation();
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={cn("text-[9px] font-black px-2 py-1 border uppercase tracking-wider shrink-0", cfg.cls)}>
      {t(`competitionFlow.${cfg.key}`)}
    </span>
  );
}

export default function SeasonRegistrations() {
  const { t } = useTranslation();
  const [_user, setUser] = useState(null);
  const [myClub, setMyClub] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [myApps, setMyApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applyDialog, setApplyDialog] = useState(null);
  const [appNote, setAppNote] = useState("");
  const [expanded, setExpanded] = useState({});

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { user: u, club } = await resolveMyPlayerAndClub();
      setUser(u);
      setMyClub(club);

      const [allLeagues, apps] = await Promise.all([
        stageClient.entities.RegionalLeague.filter({ status: "registration" }, null, 100).catch(() => []),
        u
          ? (stageClient.entities.SeasonRegistration?.filter({ owner_email: u.email }, "-applied_at", 50) ?? Promise.resolve([])).catch(() => [])
          : Promise.resolve([]),
      ]);

      setLeagues(allLeagues.map(withCanonicalRegionalLeagueName));
      const myEmail = (u?.email || "").toLowerCase();
      let ownedApps = myEmail
        ? apps.filter(a => String(a.owner_email || "").toLowerCase() === myEmail)
        : [];
      ownedApps = await cleanupStaleOwnedApplications(ownedApps);
      setMyApps(ownedApps);
    } finally {
      setLoading(false);
    }
  }

  async function cleanupStaleOwnedApplications(apps) {
    if (!stageClient.entities.SeasonRegistration) return apps;
    const candidates = apps.filter(app => (
      ACTIVE_APPLICATION_STATUSES.has(String(app.status || "").toLowerCase()) &&
      (isRemovedApplication(app) || app.assigned_league_id)
    ));
    if (!candidates.length) return apps;

    const leagueIds = [...new Set(candidates.map(app => app.assigned_league_id).filter(Boolean))];
    const standingRows = (await Promise.all(leagueIds.map(leagueId =>
      (stageClient.entities.RegionalLeagueStanding?.filter({ league_id: leagueId }, null, 100) ?? Promise.resolve([])).catch(() => [])
    ))).flat();
    const standingKeys = new Set(standingRows.map(row => `${row.league_id}:${row.club_id}`));
    const updates = [];
    const nextApps = apps.map(app => {
      const removedByNote = isRemovedApplication(app);
      const missingStanding = app.assigned_league_id && !standingKeys.has(`${app.assigned_league_id}:${app.club_id}`);
      if (!ACTIVE_APPLICATION_STATUSES.has(String(app.status || "").toLowerCase()) || (!removedByNote && !missingStanding)) {
        return app;
      }
      const patch = {
        status: "removed",
        admin_notes: app.admin_notes || "Removed from league registration.",
        reviewed_at: app.reviewed_at || new Date().toISOString(),
      };
      updates.push(stageClient.entities.SeasonRegistration.update(app.id, patch).catch(() => null));
      return { ...app, ...patch };
    });
    if (updates.length) await Promise.all(updates);
    return nextApps;
  }

  function openApplyDialog(region) {
    setAppNote("");
    setApplyDialog(region);
  }

  async function submitApplication() {
    if (!myClub || !applyDialog) return;
    setApplying(true);
    try {
      const regionLeagues = leagues.filter(l => l.region_slug === applyDialog.slug);
      const seasonLabel = regionLeagues.length > 0
        ? `Season ${regionLeagues[0].season_number}`
        : "Season 1";

      await applyForLeague(
        myClub,
        applyDialog.slug,
        applyDialog.name,
        myClub.platform || "Cross-Platform",
        { note: appNote.trim(), seasonLabel },
      );
      setApplyDialog(null);
      await load();
    } catch (err) {
      await swalAlert(err.message);
    } finally {
      setApplying(false);
    }
  }

  const appByRegion = {};
  for (const app of myApps) {
    if (!ACTIVE_APPLICATION_STATUSES.has(String(app.status || "").toLowerCase()) || isRemovedApplication(app)) continue;
    if (!appByRegion[app.region_slug]) appByRegion[app.region_slug] = app;
  }

  const leaguesByRegion = {};
  for (const l of leagues) {
    if (!leaguesByRegion[l.region_slug]) leaguesByRegion[l.region_slug] = [];
    leaguesByRegion[l.region_slug].push(l);
  }

  const openRegions = REGIONS.filter(r => leaguesByRegion[r.slug]?.length > 0);
  const totalSpotsOpen = openRegions.reduce((sum, region) => {
    const regionLeagues = leaguesByRegion[region.slug] || [];
    const total = regionLeagues.reduce((s, l) => s + getRegionalLeagueMaxClubs(l), 0);
    const taken = regionLeagues.reduce((s, l) => s + (l.num_clubs || 0), 0);
    return sum + Math.max(0, total - taken);
  }, 0);

  if (loading) {
    return (
      <GamerProfileShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />
        </div>
      </GamerProfileShell>
    );
  }

  return (
    <GamerProfileShell>
      <div className="px-5 py-8 lg:px-10">
        <div className="mx-auto max-w-4xl space-y-6">

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-white/45 transition-colors hover:text-cyan-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {t("competitionFlow.back")}
          </Link>

          <header>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">STAGE</p>
            <h1 className="font-heading text-4xl font-black uppercase leading-none text-white sm:text-5xl">
              {t("competitionFlow.registrationTitle")}
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-white/50">
              {t("competitionFlow.registrationSubtitle")}
            </p>
          </header>

          {openRegions.length > 0 ? (
            <div
              className="grid gap-3 border border-cyan-300/20 bg-gradient-to-br from-[#070b14]/95 via-black/88 to-[#070b14]/92 p-4 backdrop-blur-md sm:grid-cols-3"
              style={CARD_CLIP}
            >
              <SummaryStat icon={Trophy} label={t("competitionFlow.regionalLeagues")} value={openRegions.length} />
              <SummaryStat icon={Shield} label={t("competitionFlow.division")} value={leagues.length} />
              <SummaryStat icon={Clock} label={t("competitionFlow.spotsAvailable", { count: totalSpotsOpen })} compact />
            </div>
          ) : null}

          {!myClub ? (
            <div
              className="flex items-start gap-3 border border-amber-400/25 bg-gradient-to-r from-amber-950/50 via-[#070b14]/95 to-black/90 p-4 backdrop-blur-md"
              style={CARD_CLIP}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <div>
                <p className="text-sm font-bold text-amber-200">{t("competitionFlow.noClubFound")}</p>
                <p className="mt-0.5 text-xs text-white/45">
                  {t("competitionFlow.needClub", { clubs: t("competitionFlow.clubs") })}
                </p>
              </div>
            </div>
          ) : null}

          {myApps.length > 0 ? (
            <GamerSectionCard title={t("competitionFlow.myApplications")}>
              <div className="space-y-2 -mt-1">
                {myApps.map((app) => {
                  const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending;
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={app.id}
                      className="flex items-center gap-3 border border-cyan-300/15 bg-black/40 px-4 py-3"
                      style={ROW_CLIP}
                    >
                      <Icon className={cn(
                        "h-4 w-4 shrink-0",
                        app.status === "approved" ? "text-emerald-300" : app.status === "rejected" ? "text-rose-400" : "text-amber-300",
                      )} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-heading text-sm font-black uppercase text-white">
                          {app.region_name || app.region_slug}
                        </p>
                        <p className="text-[10px] text-white/40">
                          {app.season_label || ""} · {t("competitionFlow.applied")} {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : "—"}
                          {app.assigned_league_name ? ` · ${t("competitionFlow.assignedTo", { league: app.assigned_league_name })}` : ""}
                          {app.admin_notes ? ` · "${app.admin_notes}"` : ""}
                        </p>
                      </div>
                      <StatusBadge status={app.status} />
                    </div>
                  );
                })}
              </div>
            </GamerSectionCard>
          ) : null}

          {openRegions.length === 0 ? (
            <div
              className="border border-dashed border-cyan-300/20 bg-[#070b14]/82 p-12 text-center backdrop-blur-md"
              style={CARD_CLIP}
            >
              <Trophy className="mx-auto mb-3 h-10 w-10 text-white/15" />
              <p className="text-sm uppercase tracking-widest text-white/45">
                {t("competitionFlow.noOpenRegistrations")}
              </p>
              <p className="mt-1 text-xs text-white/35">
                {t("competitionFlow.checkBackRegistration")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {openRegions.map((region) => {
                const regionLeagues = (leaguesByRegion[region.slug] || []).sort((a, b) => (a.division || 1) - (b.division || 1));
                const myApp = appByRegion[region.slug];
                const isOpen = expanded[region.slug];
                const totalSpots = regionLeagues.reduce((sum, l) => sum + getRegionalLeagueMaxClubs(l), 0);
                const takenSpots = regionLeagues.reduce((sum, l) => sum + (l.num_clubs || 0), 0);
                const spotsLeft = totalSpots - takenSpots;

                return (
                  <div
                    key={region.slug}
                    className={cn(
                      "overflow-hidden border backdrop-blur-md transition-colors",
                      myApp?.status === "approved"
                        ? "border-emerald-400/30 bg-gradient-to-br from-emerald-950/40 via-[#070b14]/95 to-black/92"
                        : myApp?.status === "pending"
                          ? "border-amber-400/25 bg-gradient-to-br from-amber-950/30 via-[#070b14]/95 to-black/92"
                          : "border-cyan-300/20 bg-gradient-to-br from-[#070b14]/95 via-black/88 to-[#070b14]/92",
                    )}
                    style={CARD_CLIP}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-cyan-300/[0.04]"
                      onClick={() => setExpanded(prev => ({ ...prev, [region.slug]: !prev[region.slug] }))}
                    >
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center border border-cyan-300/25 bg-cyan-300/10 text-cyan-300"
                        style={{ clipPath: "polygon(12% 0, 100% 0, 88% 100%, 0 100%)" }}
                      >
                        <Trophy className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-heading text-lg font-black uppercase tracking-tight text-white">
                          {region.name}
                        </p>
                        <p className="text-[10px] text-white/45">
                          {t("competitionFlow.divisionsOpen", { count: regionLeagues.length })}
                          {spotsLeft > 0 ? ` · ${t("competitionFlow.spotsAvailable", { count: spotsLeft })}` : ` · ${t("competitionFlow.full")}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {myApp ? <StatusBadge status={myApp.status} /> : null}
                        {!myApp && spotsLeft <= 0 ? (
                          <GamerMetaPill className="text-white/45">{t("competitionFlow.full")}</GamerMetaPill>
                        ) : null}
                        <ChevronDown className={cn("h-4 w-4 text-white/40 transition-transform", isOpen && "rotate-180")} />
                      </div>
                    </button>

                    {isOpen ? (
                      <div className="border-t border-cyan-300/10">
                        <div className="space-y-2 px-4 py-3">
                          {regionLeagues.map((league) => {
                            const max = getRegionalLeagueMaxClubs(league);
                            const taken = league.num_clubs || 0;
                            const full = taken >= max;
                            const pct = Math.round((taken / max) * 100);
                            return (
                              <div
                                key={league.id}
                                className="border border-cyan-300/15 bg-black/40 px-4 py-3"
                                style={ROW_CLIP}
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Shield className="h-3.5 w-3.5 shrink-0 text-cyan-300/70" />
                                      <p className="truncate text-sm font-bold text-white">{league.name}</p>
                                      <GamerMetaPill className="text-cyan-200/80 border-cyan-300/20">
                                        {t("competitionFlow.division")} {league.division || 1}
                                      </GamerMetaPill>
                                    </div>
                                    <div className="mt-2 flex items-center gap-2">
                                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                                        <div
                                          className={cn(
                                            "h-full rounded-full transition-all",
                                            full ? "bg-rose-500" : pct > 75 ? "bg-amber-400" : "bg-emerald-400",
                                          )}
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                      <span className={cn("shrink-0 text-[10px] font-bold", full ? "text-rose-400" : "text-white/45")}>
                                        {taken}/{max}
                                      </span>
                                    </div>
                                  </div>
                                  <Link
                                    to={`/leagues/${league.slug}`}
                                    className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-cyan-300 hover:text-cyan-200"
                                  >
                                    {t("competitionFlow.viewFullStandings")} →
                                  </Link>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div
                          className="flex flex-wrap items-center justify-between gap-4 border-t border-cyan-300/10 bg-black/35 px-5 py-4"
                        >
                          <div className="space-y-0.5 text-xs text-white/45">
                            <p>{t("competitionFlow.registerClubForRegion", { region: region.name })}</p>
                            <p>{t("competitionFlow.adminAssignsDivision")}</p>
                          </div>
                          {myApp ? (
                            <StatusBadge status={myApp.status} />
                          ) : !myClub ? (
                            <GamerHeroAction as={Link} to="/clubs">
                              {t("competitionFlow.createClubFirst")}
                            </GamerHeroAction>
                          ) : (
                            <GamerHeroAction
                              type="button"
                              onClick={() => openApplyDialog(region)}
                              className={spotsLeft <= 0 ? "border-white/15 text-white/45 hover:text-white/60" : undefined}
                            >
                              {spotsLeft <= 0 ? t("competitionFlow.joinWaitlist") : t("competitionFlow.applyNow")}
                            </GamerHeroAction>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          <GamerSectionCard title={t("competitionFlow.howItWorks")}>
            <ol className="list-inside list-decimal space-y-2 text-xs text-white/50 -mt-1">
              <li>{t("competitionFlow.registrationStep1")}</li>
              <li>{t("competitionFlow.registrationStep2")}</li>
              <li>{t("competitionFlow.registrationStep3")}</li>
              <li>{t("competitionFlow.registrationStep4")}</li>
              <li>{t("competitionFlow.registrationStep5")}</li>
            </ol>
          </GamerSectionCard>
        </div>
      </div>

      {applyDialog ? (
        <Dialog open onOpenChange={() => setApplyDialog(null)}>
          <DialogContent className="max-w-md border border-cyan-300/20 bg-[#070b14] text-white">
            <DialogHeader>
              <DialogTitle className="font-heading uppercase tracking-tight text-white">
                {t("competitionFlow.applyTo", { region: applyDialog.name })}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {myClub ? (
                <div
                  className="flex items-center gap-3 border border-cyan-300/15 bg-black/40 p-3"
                  style={ROW_CLIP}
                >
                  {myClub.logo_url ? (
                    <img src={myClub.logo_url} alt={myClub.name} className="h-10 w-10 shrink-0 rounded object-contain" />
                  ) : (
                    <Shield className="h-6 w-6 shrink-0 text-white/35" />
                  )}
                  <div>
                    <p className="text-sm font-bold text-white">{myClub.name}</p>
                    <p className="text-[10px] text-white/45">{myClub.tag ? `[${myClub.tag}]` : ""} · {myClub.platform || "—"}</p>
                  </div>
                </div>
              ) : null}

              <div
                className="border border-cyan-300/20 bg-cyan-300/[0.06] p-3"
                style={ROW_CLIP}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                  {t("competitionFlow.divisionPlacement")}
                </p>
                <p className="mt-1 text-xs text-white/45">
                  {t("competitionFlow.placementPreference")}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                  {t("competitionFlow.noteOptional")}
                </label>
                <Textarea
                  value={appNote}
                  onChange={(e) => setAppNote(e.target.value)}
                  placeholder={t("competitionFlow.adminContextPlaceholder")}
                  className="h-20 resize-none border-cyan-300/15 bg-black/40 text-sm text-white placeholder:text-white/30"
                  maxLength={300}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <GamerHeroAction type="button" onClick={() => setApplyDialog(null)} className="flex-1 max-w-none border-white/15 text-white/60">
                  {t("competitionFlow.cancel")}
                </GamerHeroAction>
                <GamerHeroAction
                  type="button"
                  disabled={applying || !myClub}
                  onClick={submitApplication}
                  className="flex-1 max-w-none disabled:opacity-50"
                >
                  {applying ? t("competitionFlow.submitting") : t("competitionFlow.submitApplication")}
                </GamerHeroAction>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </GamerProfileShell>
  );
}

function SummaryStat({ icon: Icon, label, value, compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-5 w-5 shrink-0 text-cyan-300" />
      <div>
        {compact ? (
          <div className="font-heading text-sm font-black leading-snug text-white">{label}</div>
        ) : (
          <>
            <div className="font-heading text-xl font-black text-white">{value}</div>
            <div className="text-[10px] uppercase tracking-widest text-white/35">{label}</div>
          </>
        )}
      </div>
    </div>
  );
}

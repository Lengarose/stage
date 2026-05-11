import SeasonCard from "@/components/admin/seasons/SeasonCard";
import ExpiredFixtureRow from "@/components/admin/disputes/ExpiredFixtureRow";
import { REGIONS, LEAGUE_DEFINITIONS } from "@/lib/qualificationConfig";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Check, X, Pencil, ChevronDown, AlertTriangle } from "lucide-react";

export default function LeaguesTab({
  seedCompetitions,
  seedingComps,
  competitions,
  compSeasons,
  editingComp,
  setEditingComp,
  compEditForm,
  setCompEditForm,
  saveCompRules,
  savingComp,
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
  processingLeagueEnd,
  processLeagueEnd,
  expiredFixtures,
  schedulingAdminBusy,
  setSchedulingAdminBusy,
}) {
  return (
    <div className="max-w-3xl space-y-6">

      {/* STAGE Competitions — editable rules */}
      <div className="bg-card border border-border rounded p-5 space-y-3">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="font-heading text-base uppercase tracking-tight text-foreground">STAGE Competitions</h3>
        <p className="text-xs text-muted-foreground mt-0.5">3 permanent competitions (Champions League format). No promotion/relegation. Click Edit Rules to adjust club limits and playoff spots.</p>
      </div>
      <Button onClick={seedCompetitions} disabled={seedingComps || competitions.length >= 3} className="bg-primary text-primary-foreground h-8 text-xs rounded gap-1.5">
        {seedingComps ? "Seeding..." : competitions.length >= 3 ? "✓ Seeded" : "Seed Competitions"}
      </Button>
    </div>
    <div className="space-y-3">
      {[{slug:"supreme",color:"#FFD700"},{slug:"elite",color:"#00E5BD"},{slug:"challenger",color:"#A78BFA"}].map(t => {
        const comp = competitions.find(c => c.slug === t.slug);
        if (!comp) return (
          <div key={t.slug} className="border border-dashed border-border rounded p-3 opacity-40">
            <p className="text-xs text-muted-foreground capitalize">{t.slug} — not seeded</p>
          </div>
        );
        const seasons = compSeasons.filter(s => s.competition_id === comp.id);
        const isEditing = editingComp === comp.id;
        return (
          <div key={t.slug} className="border border-border rounded p-3 space-y-2" style={{ borderLeftColor: t.color, borderLeftWidth: 2 }}>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <p className="text-xs font-bold text-foreground">{comp.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Tier {comp.tier} · {seasons.length} season{seasons.length !== 1 ? "s" : ""} · Max {comp.max_clubs_per_season || 16} clubs · {comp.qualification_spots_per_region || 2} spots/region
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {comp.playoff_spots || 16} playoff spots · Top 8 direct R16 · 9-24 play-in · No relegation
                </p>
              </div>
              <Button size="sm" variant="outline"
                className={cn("h-7 text-xs rounded gap-1.5 shrink-0", isEditing ? "border-destructive/30 text-destructive" : "border-border text-muted-foreground hover:text-foreground")}
                onClick={() => {
                  if (isEditing) { setEditingComp(null); }
                  else { setEditingComp(comp.id); setCompEditForm({ max_clubs_per_season: comp.max_clubs_per_season ?? 36, qualification_spots_per_region: comp.qualification_spots_per_region ?? 2, playoff_spots: comp.playoff_spots ?? 16, trophy_image_url: comp.trophy_image_url || "" }); }
                }}>
                {isEditing ? <X className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                {isEditing ? "Cancel" : "Edit Rules"}
              </Button>
            </div>
            {isEditing && (
              <div className="pt-2 border-t border-border/50 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { key: "max_clubs_per_season",           label: "Max Clubs/Season" },
                    { key: "qualification_spots_per_region", label: "Qual. Spots/Region" },
                    { key: "playoff_spots",                  label: "Playoff Spots (9-24)" },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="text-[10px] text-muted-foreground mb-1 block">{label}</label>
                      <Input type="number" min={0} value={compEditForm[key] ?? ""}
                        onChange={e => setCompEditForm(f => ({ ...f, [key]: e.target.value }))}
                        className="bg-secondary border-border text-xs h-8" />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Trophy Image URL</label>
                  <Input value={compEditForm.trophy_image_url ?? ""}
                    onChange={e => setCompEditForm(f => ({ ...f, trophy_image_url: e.target.value }))}
                    placeholder="https://… trophy PNG"
                    className="bg-secondary border-border text-xs h-8" />
                </div>
                <Button size="sm" onClick={saveCompRules} disabled={savingComp}
                  className="bg-primary text-primary-foreground h-8 text-xs gap-1.5">
                  {savingComp ? <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin inline-block" /> : <Check className="w-3.5 h-3.5" />}
                  {savingComp ? "Saving…" : "Save Rules"}
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>

  {/* Start New Season */}
  {competitions.length > 0 && (
    <div className="bg-card border border-border rounded p-5 space-y-4">
      <h3 className="font-heading text-base uppercase tracking-tight text-foreground">Start New Season</h3>
      <div>
        <label className="label-xs">Competition</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {competitions.map(c => (
            <button key={c.id} type="button"
              onClick={() => setNewSeasonForm(f => ({ ...f, competition_id: c.id }))}
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
          <label className="label-xs">Platform</label>
          <select value={newSeasonForm.platform} onChange={e => setNewSeasonForm(f => ({ ...f, platform: e.target.value }))}
            className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50">
            {["Cross-Platform","PlayStation","Xbox","PC"].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label-xs">Region</label>
          <select value={newSeasonForm.region} onChange={e => setNewSeasonForm(f => ({ ...f, region: e.target.value }))}
            className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50">
            {["Global","Europe","North America"].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-xs">Number of Clubs</label>
          <input type="number" min="4" max="128" value={newSeasonForm.num_clubs ?? 36}
            onChange={e => setNewSeasonForm(f => ({ ...f, num_clubs: e.target.value }))}
            className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" />
        </div>
        <div>
          <label className="label-xs">League Matchdays</label>
          <input type="number" min="2" max="20" value={newSeasonForm.num_league_matchdays ?? 8}
            onChange={e => setNewSeasonForm(f => ({ ...f, num_league_matchdays: e.target.value }))}
            className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" />
        </div>
      </div>
      <div>
        <label className="label-xs">Prize Pool (STC) — optional</label>
        <input type="number" min="0" value={newSeasonForm.prize_pool_stc}
          onChange={e => setNewSeasonForm(f => ({ ...f, prize_pool_stc: e.target.value }))}
          className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
          placeholder="e.g. 5000000" />
      </div>
      <Button onClick={createCompetitionSeason} disabled={creatingLeagueSeason || !newSeasonForm.competition_id}
        className="w-full bg-primary text-primary-foreground h-9 text-xs rounded font-bold gap-2">
        {creatingLeagueSeason ? "Creating..." : "Create Season"}
      </Button>
    </div>
  )}

  {/* ── Registration Applications ── */}
  <div>
    {(() => {
      const actionable = regApplications.filter(r => r.status === "pending" || r.status === "waitlisted");
      const displayApps = regAppFilter === "actionable" ? actionable : regApplications;
      const pendingCount = regApplications.filter(r => r.status === "pending").length;
      const waitlistCount = regApplications.filter(r => r.status === "waitlisted").length;
      return (
        <>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="font-heading text-base uppercase tracking-tight text-foreground">
              Registration Applications
              {actionable.length > 0 && (
                <span className="ml-2 text-[10px] text-warning border border-warning/30 bg-warning/5 px-1.5 py-0.5 rounded font-bold">
                  {actionable.length}
                </span>
              )}
            </h3>
            <div className="flex gap-1">
              {[["actionable","Needs Action"],["all","All"]].map(([v, label]) => (
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
                {regAppFilter === "actionable" ? "No applications need action" : "No registration applications yet"}
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
                          {reg.preferred_division ? ` · Prefers Div ${reg.preferred_division}` : ""}
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
                          {reg.status === "waitlisted" ? "Promote" : "Approve"}
                        </Button>
                        <Button size="sm" variant="outline"
                          onClick={() => { setRejectNotesDialog({ reg, action: "waitlist" }); setRejectNotes(""); }}
                          className="border-border text-muted-foreground hover:text-foreground h-7 text-xs rounded gap-1"
                          disabled={reg.status === "waitlisted"}>
                          Waitlist
                        </Button>
                        <Button size="sm" variant="outline"
                          onClick={() => { setRejectNotesDialog({ reg, action: "reject" }); setRejectNotes(""); }}
                          className="border-destructive/30 text-destructive hover:bg-destructive/10 h-7 text-xs rounded gap-1">
                          <X className="w-3 h-3" /> Reject
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

  {/* Pending qualification entries */}
  <div>
    <h3 className="font-heading text-base uppercase tracking-tight text-foreground mb-3">
      Pending Qualification Entries
      {qualEntries.length > 0 && <span className="ml-2 text-[10px] text-primary border border-primary/30 bg-primary/5 px-1.5 py-0.5 rounded font-bold">{qualEntries.length}</span>}
    </h3>
    {qualEntries.length === 0 ? (
      <div className="border border-dashed border-border rounded p-8 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">No pending entries</p>
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
                <Check className="w-3 h-3" /> Confirm
              </Button>
              <Button size="sm" variant="outline" onClick={() => rejectQualEntry(e)} className="border-destructive/30 text-destructive hover:bg-destructive/10 h-7 text-xs rounded gap-1">
                <X className="w-3 h-3" /> Reject
              </Button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>

  {/* All Seasons */}
  {compSeasons.length > 0 && (
    <div>
      <h3 className="font-heading text-base uppercase tracking-tight text-foreground mb-3">All Seasons</h3>
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
      <h3 className="font-heading text-base uppercase tracking-tight text-foreground">Fixtures & Results</h3>
      <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", fixturesOpen && "rotate-180")} />
    </button>
    {fixturesOpen && (
      <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Competition Season</label>
            <select value={selectedFixtureSeason} onChange={e => setSelectedFixtureSeason(e.target.value)}
              className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50">
              <option value="">— Select season —</option>
              {compSeasons.map(s => (
                <option key={s.id} value={s.id}>{s.competition_name} — {s.season_label || `S${s.season_number}`} ({s.status})</option>
              ))}
            </select>
            <Button size="sm" disabled={!selectedFixtureSeason || loadingFixtures}
              onClick={() => { const s = compSeasons.find(x => x.id === selectedFixtureSeason); if (s) loadFixturesForPanel({ type: "competition", id: s.id, name: `${s.competition_name} ${s.season_label || ""}` }); }}
              className="h-7 text-xs bg-primary text-primary-foreground rounded gap-1.5">
              {loadingFixtures && fixturesPanel?.type === "competition" ? "Loading…" : "Load Fixtures"}
            </Button>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Regional League</label>
            <select value={selectedFixtureLeague} onChange={e => setSelectedFixtureLeague(e.target.value)}
              className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50">
              <option value="">— Select league —</option>
              {regionalLeagues.map(l => (
                <option key={l.id} value={l.id}>{l.name} (D{l.division || 1} · S{l.season_number})</option>
              ))}
            </select>
            <Button size="sm" disabled={!selectedFixtureLeague || loadingFixtures}
              onClick={() => { const l = regionalLeagues.find(x => x.id === selectedFixtureLeague); if (l) loadFixturesForPanel({ type: "league", id: l.id, name: l.name }); }}
              className="h-7 text-xs bg-primary text-primary-foreground rounded gap-1.5">
              {loadingFixtures && fixturesPanel?.type === "league" ? "Loading…" : "Load Fixtures"}
            </Button>
          </div>
        </div>
        {fixturesPanel && (
          <div>
            <p className="text-xs font-bold text-foreground mb-2">
              {fixturesPanel.name}
              <span className="ml-2 text-[10px] text-muted-foreground font-normal">({fixturesList.length} fixtures)</span>
            </p>
            {loadingFixtures ? (
              <div className="flex justify-center py-6"><div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
            ) : fixturesList.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No fixtures found. Generate fixtures first via the season card above.</p>
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
                        Enter Result
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
      <h3 className="font-heading text-base uppercase tracking-tight text-foreground">Standings</h3>
      <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", standingsOpen && "rotate-180")} />
    </button>
    {standingsOpen && (
      <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              {loadingStandings && standingsPanel?.type === "competition" ? "Loading…" : "Load Standings"}
            </Button>
          </div>
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
              {loadingStandings && standingsPanel?.type === "league" ? "Loading…" : "Load Standings"}
            </Button>
          </div>
        </div>
        {standingsPanel && (
          <div>
            <p className="text-xs font-bold text-foreground mb-2">{standingsPanel.name}</p>
            {loadingStandings ? (
              <div className="flex justify-center py-6"><div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
            ) : standingsList.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No standings found. Confirm clubs and generate fixtures first.</p>
            ) : (
              <div className="border border-border rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="px-2 py-2 text-left text-[10px] text-muted-foreground uppercase w-8">#</th>
                      <th className="px-2 py-2 text-left text-[10px] text-muted-foreground uppercase">Club</th>
                      <th className="px-2 py-2 text-center text-[10px] text-muted-foreground uppercase w-8">P</th>
                      <th className="px-2 py-2 text-center text-[10px] text-success uppercase w-8">W</th>
                      <th className="px-2 py-2 text-center text-[10px] text-muted-foreground uppercase w-8">D</th>
                      <th className="px-2 py-2 text-center text-[10px] text-destructive uppercase w-8">L</th>
                      <th className="px-2 py-2 text-center text-[10px] text-muted-foreground uppercase w-10">GD</th>
                      <th className="px-2 py-2 text-center text-[10px] text-foreground font-bold uppercase w-10">Pts</th>
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
  <div className="bg-card border border-border rounded p-5 space-y-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="font-heading text-base uppercase tracking-tight text-foreground">Regional Leagues</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{REGIONS.length} regions · 2 divisions each. Click the edit icon to change max clubs or promoted slots.</p>
      </div>
      <Button onClick={seedRegionalLeagues}
        disabled={seedingRegionalLeagues || regionalLeagues.length >= LEAGUE_DEFINITIONS.length}
        className="bg-primary text-primary-foreground h-8 text-xs rounded gap-1.5 shrink-0">
        {seedingRegionalLeagues ? "Seeding..." : regionalLeagues.length >= LEAGUE_DEFINITIONS.length ? "✓ Seeded" : "Seed All Leagues"}
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
                  return (
                    <div key={league.id} className="border border-border rounded p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider shrink-0">D{league.division || 1}</span>
                            <p className="text-sm font-bold text-foreground truncate">{league.name}</p>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Season {league.season_number} · {league.num_clubs || 0}/{league.max_clubs || 16} clubs · {league.promoted_slots || 2} promoted
                          </p>
                        </div>
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0",
                          league.status === "in_progress" ? "text-success border-success/30 bg-success/5" :
                          league.status === "registration" ? "text-primary border-primary/30 bg-primary/5" :
                          league.status === "completed" ? "text-muted-foreground border-border" :
                          "text-warning border-warning/30 bg-warning/5"
                        )}>{league.status.replace("_", " ")}</span>
                        <Button size="sm" variant="outline"
                          className={cn("h-7 w-7 p-0 rounded shrink-0", isEditingL ? "border-destructive/30 text-destructive" : "border-border text-muted-foreground hover:text-foreground")}
                          onClick={() => {
                            if (isEditingL) { setEditingLeague(null); }
                            else { setEditingLeague(league.id); setLeagueEditForm({ max_clubs: league.max_clubs ?? 16, promoted_slots: league.promoted_slots ?? 2, trophy_image_url: league.trophy_image_url || "" }); }
                          }}>
                          {isEditingL ? <X className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                        </Button>
                        <Link to={`/leagues/${league.slug}`}>
                          <Button size="sm" variant="outline" className="h-7 text-xs rounded border-border text-muted-foreground hover:text-foreground shrink-0">View</Button>
                        </Link>
                        {league.status === "draft" && (
                          <Button size="sm" onClick={() => leagueLifecycleAction(league, "open_registration")}
                            className="h-7 text-xs rounded bg-primary text-primary-foreground shrink-0">
                            Open Registration
                          </Button>
                        )}
                        {league.status === "in_progress" && (
                          <Button size="sm" variant="outline" disabled={processingLeagueEnd === league.id}
                            onClick={() => processLeagueEnd(league)}
                            className="h-7 text-xs rounded border-warning/40 text-warning hover:bg-warning/10 shrink-0">
                            {processingLeagueEnd === league.id ? "Processing..." : "End Season"}
                          </Button>
                        )}
                        {league.status === "completed" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => leagueLifecycleAction(league, "archive")}
                              className="h-7 text-xs rounded border-muted-foreground/30 text-muted-foreground hover:text-foreground shrink-0">
                              Archive
                            </Button>
                            <Button size="sm" onClick={() => leagueLifecycleAction(league, "create_next")}
                              className="h-7 text-xs rounded bg-success/20 text-success hover:bg-success/30 border-0 shrink-0">
                              New Season
                            </Button>
                          </>
                        )}
                        {league.status === "archived" && (
                          <Button size="sm" onClick={() => leagueLifecycleAction(league, "create_next")}
                            className="h-7 text-xs rounded bg-success/20 text-success hover:bg-success/30 border-0 shrink-0">
                            New Season
                          </Button>
                        )}
                      </div>
                      {isEditingL && (
                        <div className="pt-2 border-t border-border/50 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] text-muted-foreground mb-1 block">Max Clubs</label>
                              <Input type="number" min={1} value={leagueEditForm.max_clubs ?? ""}
                                onChange={e => setLeagueEditForm(f => ({ ...f, max_clubs: e.target.value }))}
                                className="bg-secondary border-border text-xs h-8" />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground mb-1 block">Promoted Slots</label>
                              <Input type="number" min={0} value={leagueEditForm.promoted_slots ?? ""}
                                onChange={e => setLeagueEditForm(f => ({ ...f, promoted_slots: e.target.value }))}
                                className="bg-secondary border-border text-xs h-8" />
                            </div>
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] text-muted-foreground mb-1 block">Trophy Image URL</label>
                            <Input value={leagueEditForm.trophy_image_url ?? ""}
                              onChange={e => setLeagueEditForm(f => ({ ...f, trophy_image_url: e.target.value }))}
                              placeholder="https://… trophy PNG"
                              className="bg-secondary border-border text-xs h-8" />
                          </div>
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
      <p className="text-[10px] font-bold text-foreground uppercase tracking-wider">Division 1 qualification (live from competition rules)</p>
      {competitions.length > 0 ? (
        [{slug:"supreme",label:"STAGE Supreme"},{slug:"elite",label:"STAGE Elite"},{slug:"challenger",label:"STAGE Challenger"}].map(({ slug, label }) => {
          const comp = competitions.find(c => c.slug === slug);
          return comp ? (
            <p key={slug} className="text-[10px] text-muted-foreground">
              {label}: <strong className="text-foreground">{comp.qualification_spots_per_region || 2}</strong> spot{(comp.qualification_spots_per_region || 2) !== 1 ? "s" : ""}/region
            </p>
          ) : null;
        })
      ) : (
        <p className="text-[10px] text-muted-foreground">Seed competitions first to see qualification rules here.</p>
      )}
      <p className="text-[10px] text-muted-foreground mt-1">
        Promotion/relegation spots are editable per league row above. Edit competition rules to adjust qualification spots.
      </p>
    </div>
  </div>

  {/* Scheduling — expired fixtures */}
  {expiredFixtures.length > 0 && (
    <div className="bg-card border border-destructive/30 rounded p-5 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-destructive" />
        <h3 className="font-heading text-base uppercase tracking-tight text-foreground">
          Scheduling Disputes ({expiredFixtures.length})
        </h3>
      </div>
      <p className="text-xs text-muted-foreground">
        These fixtures expired without both teams agreeing on a time. Resolve each one below.
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

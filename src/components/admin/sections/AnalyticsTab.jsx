import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { stageClient } from "@/api/stageClient";
import AdminStat from "@/components/admin/shared/AdminStat";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Activity, AlertTriangle, BarChart3, BookOpen, CheckCircle2, ChevronRight,
  Clock, Flag, RefreshCw, Shield, Trophy, Users, UserPlus, Swords, Coins,
  Calendar, ArrowRight, Sparkles,
} from "lucide-react";

const PERIOD_OPTIONS = [
  { value: 7, label: "7 jours" },
  { value: 30, label: "30 jours" },
  { value: 90, label: "90 jours" },
];

const CHART_LINES = [
  { key: "users", label: "Comptes", color: "#38bdf8" },
  { key: "players", label: "Joueurs", color: "#a78bfa" },
  { key: "clubs", label: "Clubs", color: "#34d399" },
  { key: "tournaments", label: "Tournois", color: "#fbbf24" },
  { key: "matches", label: "Matchs joués", color: "#f87171" },
  { key: "contracts", label: "Contrats", color: "#fb923c" },
];

const HEALTH_META = {
  healthy: { label: "En bonne voie", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  at_risk: { label: "À surveiller", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  stalled: { label: "Bloqué", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  completed: { label: "Terminé", cls: "bg-muted text-muted-foreground border-border" },
  cancelled: { label: "Annulé", cls: "bg-muted/50 text-muted-foreground border-border" },
};

const GUIDE_STEPS = [
  {
    step: 1,
    icon: UserPlus,
    title: "Créer un compte & un joueur",
    body: "L'utilisateur s'inscrit, configure son profil joueur (gamertag, plateforme, pays) et reçoit son portefeuille STC de départ.",
    paths: ["/login", "/profile"],
  },
  {
    step: 2,
    icon: Shield,
    title: "Rejoindre ou fonder un club",
    body: "Le joueur crée un club (devient président) ou envoie une demande d'adhésion. Le club reçoit budgets STC, formation et effectif.",
    paths: ["/clubs", "/profile"],
  },
  {
    step: 3,
    icon: Trophy,
    title: "S'inscrire aux compétitions",
    body: "Tournois communautaires, ligues régionales et compétitions officielles STAGE. Chaque format a ses règles d'inscription et de calendrier.",
    paths: ["/tournaments", "/competitions", "/leagues"],
  },
  {
    step: 4,
    icon: Calendar,
    title: "Planifier & jouer les matchs",
    body: "Les capitaines proposent des créneaux via l'inbox, confirment le Game Day, soumettent les scores et gèrent les litiges si besoin.",
    paths: ["/schedule", "/inbox"],
  },
  {
    step: 5,
    icon: Coins,
    title: "Économie & contrats",
    body: "Salaires hebdomadaires, transferts, paris (wagers), billetterie stade, ventes de maillots et récompenses de compétition alimentent l'écosystème STC.",
    paths: ["/transfer-market", "/store"],
  },
  {
    step: 6,
    icon: BarChart3,
    title: "Classements & trophées",
    body: "Les performances officielles alimentent le ranking STAGE, le cabinet à trophées et la réputation du club sur la plateforme.",
    paths: ["/rankings", "/profile"],
  },
];

function formatDayLabel(day) {
  if (!day) return "";
  const d = new Date(`${day}T12:00:00`);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function UsageChart({ data, hiddenKeys, onToggle }) {
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="day" tickFormatter={formatDayLabel} stroke="#888" fontSize={11} />
          <YAxis allowDecimals={false} stroke="#888" fontSize={11} />
          <Tooltip
            labelFormatter={(v) => formatDayLabel(v)}
            contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {CHART_LINES.filter((line) => !hiddenKeys.has(line.key)).map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.label}
              stroke={line.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap gap-2">
        {CHART_LINES.map((line) => {
          const off = hiddenKeys.has(line.key);
          return (
            <button
              key={line.key}
              type="button"
              onClick={() => onToggle(line.key)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-opacity",
                off ? "opacity-40 border-border text-muted-foreground" : "border-transparent text-foreground"
              )}
              style={off ? undefined : { background: `${line.color}22`, color: line.color }}
            >
              {line.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TournamentRow({ tournament: t }) {
  const health = HEALTH_META[t.health] || HEALTH_META.healthy;
  const creator = t.creator_gamertag || t.creator_email || t.organizer_email || "—";

  return (
    <details className="group rounded-xl border border-border bg-card/40 open:bg-card/70">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-bold text-foreground">{t.name}</p>
            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", health.cls)}>
              {health.label}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
              {t.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Créé {formatDateTime(t.created_date)} · par {creator}
          </p>
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <p className="text-xs font-semibold text-foreground">{t.registered}/{t.max_teams} inscrits</p>
          <p className="text-[10px] text-muted-foreground">{t.progress_pct}% progression</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
      </summary>

      <div className="border-t border-border/60 px-4 py-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Format" value={`${t.type || "—"} · ${t.participant_type || "club"}`} />
          <MiniStat label="Plateforme / Région" value={`${t.platform || "—"} · ${t.region || "—"}`} />
          <MiniStat label="Remplissage" value={`${t.fill_pct}% (${t.registered}/${t.max_teams})`} />
          <MiniStat label="Manche" value={t.total_rounds ? `${t.current_round}/${t.total_rounds}` : `${t.current_round || 0}`} />
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <MiniStat label="Matchs total" value={t.match_stats?.total ?? 0} icon={Swords} />
          <MiniStat label="Terminés" value={t.match_stats?.completed ?? 0} icon={CheckCircle2} />
          <MiniStat label="En attente" value={t.match_stats?.pending ?? 0} icon={Clock} />
          <MiniStat label="Litiges" value={t.match_stats?.disputed ?? 0} icon={Flag} />
        </div>

        {t.issues?.length > 0 && (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" /> Points d'attention
            </p>
            <ul className="list-disc pl-5 text-xs text-amber-100/90 space-y-0.5">
              {t.issues.map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="h-8 text-xs">
            <Link to={`/tournaments/${t.id}`}>Voir le tournoi</Link>
          </Button>
          <Button asChild size="sm" variant="ghost" className="h-8 text-xs">
            <Link to="/admin/tournaments">Admin tournois</Link>
          </Button>
        </div>
      </div>
    </details>
  );
}

function MiniStat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-foreground">
        {Icon ? <Icon className="h-3.5 w-3.5 text-primary" /> : null}
        {value}
      </p>
    </div>
  );
}

function AppGuideVisual() {
  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-wide text-foreground">Guide visuel STAGE</h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Parcours type d'un utilisateur sur la plateforme — de l'inscription jusqu'aux classements officiels.
              Utilisez ce guide pour former les admins et expliquer le produit aux organisateurs.
            </p>
          </div>
        </div>
      </section>

      <div className="relative">
        <div className="absolute left-6 top-8 bottom-8 hidden w-px bg-gradient-to-b from-primary/60 via-primary/20 to-transparent md:block" />
        <div className="space-y-6">
          {GUIDE_STEPS.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={item.step} className="relative md:pl-16">
                <div className="absolute left-3 top-5 hidden h-6 w-6 items-center justify-center rounded-full border-2 border-primary bg-background text-[10px] font-black text-primary md:flex">
                  {item.step}
                </div>
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary md:hidden">
                          Étape {item.step}
                        </p>
                        <h4 className="text-base font-bold text-foreground">{item.title}</h4>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
                      {item.paths.map((path) => (
                        <Link
                          key={path}
                          to={path}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-3 py-1 text-[11px] font-semibold text-foreground hover:border-primary/40 hover:text-primary"
                        >
                          {path} <ArrowRight className="h-3 w-3" />
                        </Link>
                      ))}
                    </div>
                  </div>
                  {index < GUIDE_STEPS.length - 1 && (
                    <div className="mt-4 flex justify-center md:hidden">
                      <ChevronRight className="h-5 w-5 rotate-90 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <GuideCard
          icon={Sparkles}
          title="Boucle de valeur"
          body="Inscription → compétition → matchs → récompenses STC → progression club → rétention."
        />
        <GuideCard
          icon={AlertTriangle}
          title="Signaux admin"
          body="Surveillez les tournois bloqués, litiges non résolus et faible taux d'inscription dans l'onglet Tournois ci-dessus."
        />
        <GuideCard
          icon={Activity}
          title="Santé plateforme"
          body="Les courbes d'activité montrent si les créations (joueurs, clubs, tournois) se traduisent en matchs joués."
        />
      </section>
    </div>
  );
}

function GuideCard({ icon: Icon, title, body }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <Icon className="mb-2 h-5 w-5 text-primary" />
      <p className="text-sm font-bold text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

export default function AnalyticsTab() {
  const [days, setDays] = useState(30);
  const [panel, setPanel] = useState("stats");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hiddenKeys, setHiddenKeys] = useState(new Set());
  const [tournamentFilter, setTournamentFilter] = useState("all");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await stageClient.http.get(`/admin-analytics?days=${days}`);
      setData(res);
    } catch (err) {
      setError(err?.message || "Impossible de charger les statistiques.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [days]);

  const chartData = data?.usage?.series?.combined || [];
  const totals = data?.overview?.totals || {};
  const tournaments = data?.tournaments || [];

  const filteredTournaments = useMemo(() => {
    if (tournamentFilter === "all") return tournaments;
    if (tournamentFilter === "issues") {
      return tournaments.filter((t) => ["at_risk", "stalled"].includes(t.health));
    }
    return tournaments.filter((t) => t.health === tournamentFilter || t.status === tournamentFilter);
  }, [tournaments, tournamentFilter]);

  const healthCounts = useMemo(() => ({
    healthy: tournaments.filter((t) => t.health === "healthy").length,
    at_risk: tournaments.filter((t) => t.health === "at_risk").length,
    stalled: tournaments.filter((t) => t.health === "stalled").length,
    completed: tournaments.filter((t) => t.health === "completed").length,
  }), [tournaments]);

  function toggleLine(key) {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="max-w-6xl space-y-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground">
              <BarChart3 className="h-4 w-4 text-primary" />
              Analytics & Guide
            </h3>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              Statistiques d'utilisation, suivi de santé des tournois et guide visuel du parcours utilisateur STAGE.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {PERIOD_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                type="button"
                size="sm"
                variant={days === opt.value ? "default" : "outline"}
                className="h-8 text-xs"
                onClick={() => setDays(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
            <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={load} disabled={loading}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Actualiser
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { id: "stats", label: "Statistiques", icon: Activity },
            { id: "tournaments", label: "Tournois", icon: Trophy },
            { id: "guide", label: "Guide visuel", icon: BookOpen },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPanel(tab.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  panel === tab.id
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {tab.label}
              </button>
            );
          })}
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}
      </section>

      {loading && !data ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        </div>
      ) : null}

      {panel === "stats" && data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <AdminStat icon={Users} label="Comptes" value={totals.users} color="text-sky-400" accent="border-l-sky-400/50" />
            <AdminStat icon={Users} label="Joueurs" value={totals.players} color="text-violet-400" accent="border-l-violet-400/50" />
            <AdminStat icon={Shield} label="Clubs" value={totals.clubs} color="text-emerald-400" accent="border-l-emerald-400/50" />
            <AdminStat icon={Trophy} label="Tournois actifs" value={totals.tournaments} color="text-amber-400" accent="border-l-amber-400/50" />
            <AdminStat icon={Swords} label="Matchs joués" value={totals.completed_matches} color="text-rose-400" accent="border-l-rose-400/50" />
            <AdminStat icon={Activity} label="Actifs 30j" value={totals.active_users_30d} color="text-primary" accent="border-l-primary/50" />
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h4 className="mb-1 text-sm font-bold text-foreground">Activité quotidienne</h4>
            <p className="mb-4 font-subtitle text-xs text-muted-foreground">
              Courbes sur {days} jours — nouvelles inscriptions, créations et matchs terminés.
            </p>
            <UsageChart data={chartData} hiddenKeys={hiddenKeys} onToggle={toggleLine} />
          </section>

          {(data.overview?.tournament_status_counts || []).length > 0 && (
            <section className="rounded-xl border border-border bg-card p-5">
              <h4 className="mb-3 text-sm font-bold text-foreground">Tournois par statut</h4>
              <div className="flex flex-wrap gap-2">
                {data.overview.tournament_status_counts.map((row) => (
                  <span key={row.status} className="rounded-full border border-border bg-background/50 px-3 py-1 text-xs font-semibold">
                    <span className="text-muted-foreground">{row.status}</span>
                    <span className="ml-2 text-foreground">{row.count}</span>
                  </span>
                ))}
              </div>
            </section>
          )}
        </>
      ) : null}

      {panel === "tournaments" && data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-4">
            <MiniStat label="En bonne voie" value={healthCounts.healthy} icon={CheckCircle2} />
            <MiniStat label="À surveiller" value={healthCounts.at_risk} icon={AlertTriangle} />
            <MiniStat label="Bloqués" value={healthCounts.stalled} icon={Flag} />
            <MiniStat label="Terminés" value={healthCounts.completed} icon={Trophy} />
          </section>

          <section className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-foreground">Suivi des tournois</h4>
                <p className="text-xs text-muted-foreground">
                  Créateur, date de création, remplissage, matchs et signaux d'alerte.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "all", label: "Tous" },
                  { id: "issues", label: "Problèmes" },
                  { id: "in_progress", label: "Live" },
                  { id: "registration", label: "Inscriptions" },
                  { id: "completed", label: "Terminés" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTournamentFilter(f.id)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                      tournamentFilter === f.id
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {filteredTournaments.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Aucun tournoi pour ce filtre.</p>
              ) : (
                filteredTournaments.map((t) => <TournamentRow key={t.id} tournament={t} />)
              )}
            </div>
          </section>
        </>
      ) : null}

      {panel === "guide" ? <AppGuideVisual /> : null}
    </div>
  );
}

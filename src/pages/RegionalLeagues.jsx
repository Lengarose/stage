import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import { Globe, Shield, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { COMPETITIONS, getCompetitionMeta } from "@/lib/competitionUtils";
import { getRegionalLeagueMaxClubs, sortRegionalLeaguesByDivision } from "@/lib/regionalLeagueRules";

const STATUS_STYLE = {
  registration: "border-primary/35 bg-primary/10 text-primary",
  in_progress: "border-emerald-400/35 bg-emerald-400/10 text-emerald-200",
  completed: "border-amber-300/35 bg-amber-300/10 text-amber-200",
  archived: "border-white/15 bg-white/5 text-white/45",
};

function statusLabel(status) {
  if (status === "in_progress") return "Live";
  if (status === "registration") return "Open";
  if (status === "completed") return "Completed";
  return status || "Draft";
}

function resolveTargetMeta(league) {
  const targetSlug = COMPETITIONS.find(c => c.name === league.target_competition_name)?.slug || "challenger";
  return getCompetitionMeta(targetSlug);
}

function LeagueCard({ league }) {
  const targetMeta = resolveTargetMeta(league);
  const maxClubs = getRegionalLeagueMaxClubs(league);
  const clubCount = league.num_clubs || 0;
  const division = league.division || 1;

  return (
    <Link
      to={`/leagues/${league.slug}`}
      className="group block min-h-[15rem] overflow-hidden border border-white/10 bg-black/45 transition hover:border-primary/45"
      style={{ clipPath: "polygon(4% 0, 100% 0, 96% 100%, 0 100%)" }}
    >
      <article className="relative h-full p-5">
        <div
          className="absolute inset-0 opacity-70 transition group-hover:opacity-100"
          style={{
            background:
              division === 1
                ? "linear-gradient(135deg, rgba(34,211,238,0.22), rgba(15,23,42,0.1) 45%, rgba(245,197,66,0.12))"
                : "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(15,23,42,0.1) 45%, rgba(34,211,238,0.1))",
          }}
        />
        <div className="relative flex h-full flex-col">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="border border-primary/35 bg-primary/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                Division {division}
              </span>
              <span className={cn("border px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em]", STATUS_STYLE[league.status] || STATUS_STYLE.archived)}>
                {statusLabel(league.status)}
              </span>
            </div>
            <Globe className="h-4 w-4 shrink-0 text-primary transition group-hover:translate-x-0.5" />
          </div>

          <div className="min-w-0">
            <h2 className="font-heading text-2xl font-black uppercase leading-none text-foreground">
              {league.name}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {league.region || "Global"} · Season {league.season_number || 1}
            </p>
          </div>

          <div className="mt-auto grid grid-cols-2 gap-3 pt-8 text-xs">
            <div className="border border-white/10 bg-black/25 p-3">
              <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                <Users className="h-3.5 w-3.5 text-primary" />
                Clubs
              </div>
              <p className="font-heading text-xl text-foreground">{clubCount}/{maxClubs}</p>
            </div>
            <div className="border border-white/10 bg-black/25 p-3">
              <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                <Trophy className={cn("h-3.5 w-3.5", targetMeta.textColor)} />
                Qualification
              </div>
              <p className={cn("truncate text-sm font-black", targetMeta.textColor)}>
                {league.target_competition_name || "Official STAGE"}
              </p>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default function RegionalLeagues() {
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await stageClient.entities.RegionalLeague.list("-season_number", 100).catch(() => []);
        if (!cancelled) setLeagues(sortRegionalLeaguesByDivision(rows));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const grouped = useMemo(() => {
    return leagues.reduce((acc, league) => {
      const key = league.region || "Global";
      if (!acc[key]) acc[key] = [];
      acc[key].push(league);
      return acc;
    }, {});
  }, [leagues]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="relative overflow-hidden px-5 py-14 lg:px-12 lg:py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.22),transparent_34%),linear-gradient(135deg,rgba(7,16,28,0.98),rgba(2,6,23,0.76))]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="mb-4 flex items-center gap-3">
            <Globe className="h-7 w-7 text-primary" />
            <span className="text-xs font-black uppercase tracking-[0.35em] text-primary">Regional System</span>
          </div>
          <h1
            className="font-heading text-6xl font-black uppercase leading-none text-foreground md:text-7xl"
            style={{ transform: "skewX(-7deg)", transformOrigin: "left center" }}
          >
            Regional Leagues
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Clubs fight through regional divisions first. Division 1 positions decide which clubs qualify for Supreme, Elite and Challenger.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/competitions"
              className="px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-primary"
              style={{
                clipPath: "polygon(9% 0, 100% 0, 91% 100%, 0 100%)",
                background: "linear-gradient(135deg, rgba(34,211,238,0.14), rgba(15,23,42,0.72))",
                border: "1px solid rgba(34,211,238,0.34)",
              }}
            >
              Official STAGE Tournaments
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-10 px-5 py-10 lg:px-8">
        {leagues.length === 0 ? (
          <div className="border border-dashed border-border p-16 text-center">
            <Shield className="mx-auto mb-4 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm uppercase tracking-[0.22em] text-muted-foreground">No regional leagues yet.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([region, rows]) => (
            <section key={region} className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="h-px w-10 bg-primary/60" />
                <h2 className="font-heading text-xl uppercase tracking-[0.12em] text-foreground">{region}</h2>
                <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{rows.length} divisions</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {rows.map(league => <LeagueCard key={league.id} league={league} />)}
              </div>
            </section>
          ))
        )}
      </section>
    </main>
  );
}

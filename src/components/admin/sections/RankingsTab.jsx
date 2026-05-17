import { useEffect, useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Activity, AlertCircle, CheckCircle2, RefreshCw, Shield, Trophy, Users } from "lucide-react";

function formatNumber(value) {
  return Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(Number(value) || 0);
}

export default function RankingsTab() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [message, setMessage] = useState("");

  async function loadSummary() {
    setLoading(true);
    try {
      const data = await stageClient.http.get("/rankings/summary");
      setSummary(data);
      setMessage("");
    } catch (err) {
      setMessage(err?.message || "Failed to load rankings.");
      setSummary({ clubs: [], players: [], positions: [], meta: {} });
    } finally {
      setLoading(false);
    }
  }

  async function rebuildRankings() {
    setRebuilding(true);
    setMessage("");
    try {
      const data = await stageClient.http.post("/rankings/rebuild", { reason: "Admin rebuilt official rankings" });
      setSummary(data);
      setMessage("Rankings rebuilt from official STAGE fixtures.");
    } catch (err) {
      setMessage(err?.message || "Failed to rebuild rankings.");
    } finally {
      setRebuilding(false);
    }
  }

  useEffect(() => {
    loadSummary();
  }, []);

  const clubs = summary?.clubs || [];
  const players = summary?.players || [];
  const meta = summary?.meta || {};
  const sources = Object.entries(meta.source_counts || {}).map(([key, value]) => `${key}: ${value}`).join(" · ");

  return (
    <div className="max-w-6xl space-y-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground">
              <Trophy className="h-4 w-4 text-primary" />
              Official Rankings Engine
            </h3>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              Rebuilds club and player rankings from STAGE competitions, regional leagues, and tournaments only.
              Arrange Game fixtures are excluded from this computation.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={loadSummary} disabled={loading || rebuilding} className="gap-2">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh Preview
            </Button>
            <Button type="button" size="sm" onClick={rebuildRankings} disabled={rebuilding} className="gap-2 bg-primary text-primary-foreground">
              <Activity className={cn("h-4 w-4", rebuilding && "animate-pulse")} />
              {rebuilding ? "Rebuilding..." : "Rebuild & Save Rankings"}
            </Button>
          </div>
        </div>

        {message ? (
          <div className={cn(
            "mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold",
            message.startsWith("Rankings")
              ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
              : "border-destructive/25 bg-destructive/10 text-destructive"
          )}>
            {message.startsWith("Rankings") ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {message}
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <Stat label="Official Fixtures" value={meta.official_fixtures_count || 0} icon={Trophy} />
        <Stat label="Player Stat Rows" value={meta.player_stat_rows_count || 0} icon={Activity} />
        <Stat label="Ranked Clubs" value={clubs.length} icon={Shield} />
        <Stat label="Ranked Players" value={players.length} icon={Users} />
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-xs font-black uppercase tracking-wider text-foreground">Sources</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {sources || "No completed official fixtures found yet."}
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <PreviewTable
          title="Top Clubs"
          rows={clubs.slice(0, 10)}
          empty="No club rankings yet."
          renderRow={(club, index) => (
            <RankingRow
              key={club.id}
              rank={index + 1}
              name={club.name}
              meta={`${club.region || "Global"} · ${club.matches_ranked || 0} GP · ${club.wins || 0}W ${club.draws || 0}D ${club.losses || 0}L`}
              points={club.ranking_points}
            />
          )}
        />
        <PreviewTable
          title="Top Players"
          rows={players.slice(0, 10)}
          empty="No player rankings yet."
          renderRow={(player, index) => (
            <RankingRow
              key={player.id}
              rank={index + 1}
              name={player.gamertag}
              meta={`${player.position || "?"} · ${player.ranking_matches || 0} GP · ${player.ranking_goals || 0}G ${player.ranking_assists || 0}A · ${formatNumber(player.ranking_avg_rating)} AVG`}
              points={player.ranking_points}
            />
          )}
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-xs font-black uppercase tracking-wider text-foreground">Position Leaders</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(summary?.positions || []).map((group) => {
            const leader = group.players?.[0];
            return (
              <div key={group.group} className="rounded-lg border border-border bg-background/35 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{group.group}</p>
                {leader ? (
                  <div className="mt-2">
                    <p className="font-heading text-lg font-black uppercase text-foreground">{leader.gamertag}</p>
                    <p className="text-xs text-muted-foreground">{leader.position} · {formatNumber(leader.ranking_points)} pts</p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">No ranked player yet.</p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <Icon className="mb-3 h-5 w-5 text-primary" />
      <div className="font-heading text-2xl font-black text-foreground">{formatNumber(value)}</div>
      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function PreviewTable({ title, rows, renderRow, empty }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-4 text-xs font-black uppercase tracking-wider text-foreground">{title}</h3>
      <div className="space-y-2">
        {rows.length ? rows.map(renderRow) : <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>}
      </div>
    </div>
  );
}

function RankingRow({ rank, name, meta, points }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background/30 px-3 py-3">
      <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-sm font-black text-primary">{rank}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-foreground">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
      </div>
      <div className="font-heading text-lg font-black text-primary">{formatNumber(points)}</div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import { RefreshCw, Shield, Trophy } from "lucide-react";

const categories = {
  participants: [
    { id: "goals", label: "Most Goals Scored", value: "goals" },
    { id: "conceded", label: "Most Goals Conceded", value: "conceded" },
    { id: "fewest_conceded", label: "Fewest Goals Conceded", value: "conceded" },
  ],
  players: [
    { id: "goals", label: "Top Scorers", value: "goals" },
    { id: "assists", label: "Top Assists", value: "assists" },
    { id: "rating", label: "Highest Average Rating", value: "average_rating", rated: "rated_matches" },
    { id: "awards", label: "Most Player of the Match Awards", value: "awards" },
    { id: "appearances", label: "Most Appearances", value: "appearances" },
  ],
  goalkeepers: [
    { id: "clean_sheets", label: "Most Clean Sheets", value: "clean_sheets" },
    { id: "conceded_per_match", label: "Fewest Goals Conceded per Match", value: "conceded_per_match" },
    { id: "rating", label: "Highest Average Goalkeeper Rating", value: "goalkeeper_average_rating", rated: "goalkeeper_rated_matches" },
  ],
};

export default function TournamentLeaderboard({ tournamentId }) {
  const [stats, setStats] = useState(null);
  const [group, setGroup] = useState("participants");
  const [categoryId, setCategoryId] = useState("goals");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => { setStats(null); setGroup("participants"); setCategoryId("goals"); }, [tournamentId]);
  useEffect(() => {
    let stopped = false;
    let fetching = false;
    async function refresh() {
      if (fetching) return;
      fetching = true;
      try {
        const data = await stageClient.http.get(`/public/tournaments/${encodeURIComponent(tournamentId)}/statistics`);
        if (!stopped) { setStats(data); setError(""); }
      } catch (err) { if (!stopped) setError(err?.message || "Could not load tournament statistics."); }
      finally { fetching = false; }
    }
    void refresh();
    const interval = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    const unsubscribe = stageClient.entities.Match.subscribe(() => { void refresh(); });
    return () => { stopped = true; clearInterval(interval); window.removeEventListener("focus", refresh); unsubscribe(); };
  }, [tournamentId, revision]);
  const effectiveGroup = stats?.participant_type === "player" ? "participants" : group;
  const category = categories[effectiveGroup].find(c => c.id === categoryId) || categories[effectiveGroup][0];
  const rows = stats?.[effectiveGroup]?.[category.id] || [];
  const goalkeeper = effectiveGroup === "goalkeepers";
  const appearances = goalkeeper ? "goalkeeper_appearances" : "appearances";
  const individual = effectiveGroup !== "participants";
  const participantLabel = stats?.participant_type === "player" ? "Participants" : "Clubs";
  return <section className="min-w-0 border border-border bg-card">
    <div className="flex items-center gap-3 border-b border-border p-4"><Trophy className="h-5 w-5 text-primary" /><h2 className="font-heading text-xl font-bold">Tournament Statistics</h2><button type="button" aria-label="Refresh statistics" title="Refresh statistics" onClick={() => setRevision(v => v + 1)} className="ml-auto p-2 text-muted-foreground hover:text-primary"><RefreshCw className="h-4 w-4" /></button></div>
    {stats?.participant_type !== "player" && <div className="flex flex-wrap gap-2 border-b border-border p-3" role="group" aria-label="Statistics section">{[["participants", participantLabel], ["players", "Individual Players"], ["goalkeepers", "Goalkeepers"]].map(([id, label]) => <button type="button" key={id} aria-pressed={effectiveGroup === id} onClick={() => { setGroup(id); setCategoryId(categories[id][0].id); }} className={`border px-3 py-2 text-sm ${effectiveGroup === id ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{label}</button>)}</div>}
    <div className="p-4"><label className="text-xs font-bold uppercase text-muted-foreground" htmlFor="tournament-statistic">Ranking</label><select id="tournament-statistic" value={category.id} onChange={e => setCategoryId(e.target.value)} className="mt-2 block w-full max-w-lg border border-border bg-background p-2 text-sm">{categories[effectiveGroup].map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
    {goalkeeper && <p className="px-4 pb-3 text-xs text-muted-foreground">Only confirmed full-match goalkeeper appearances are included. Goals conceded use the official full-match score.</p>}
    {error && <p role="alert" className="p-4 text-sm text-destructive">{error}</p>}
    {!stats && !error ? <p className="p-8 text-sm text-muted-foreground">Loading statistics…</p> : <>
      {stats?.confirmed_matches === 0 && <p className="px-4 pb-3 text-sm text-muted-foreground">No confirmed results yet.</p>}
      {rows.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">{goalkeeper ? "No goalkeeper appearances recorded yet." : individual ? "No player statistics recorded yet." : "No confirmed results yet."}</p> : <div className="max-h-[65vh] overflow-auto" role="region" aria-label={category.label} tabIndex={0}>
        <table className="w-full text-sm"><thead className="sticky top-0 bg-background text-xs text-muted-foreground"><tr><th className="p-3 text-left">Rank</th><th className="p-3 text-left">{individual ? "Player / Club represented" : participantLabel}</th><th className="p-3">{goalkeeper ? "Goalkeeper Appearances" : individual ? "Appearances" : "Matches Played"}</th>{category.rated && <th className="p-3">Rated Matches</th>}{category.id === "conceded_per_match" && <th className="p-3">Goals Conceded</th>}<th className="p-3">{category.label}</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t border-border/60 even:bg-secondary/20"><td className="p-3 tabular-nums">{row.rank ?? "—"}</td><td className="p-3"><div className="flex items-center gap-2">{row.avatar ? <img src={row.avatar} alt="" className="h-8 w-8 shrink-0 object-contain" /> : <Shield className="h-5 w-5 shrink-0 text-muted-foreground" />}<div className="min-w-0"><Link className="break-words font-semibold hover:text-primary" to={individual || stats.participant_type === "player" ? `/players/${row.player_id || row.id}` : `/clubs/${row.id}`}>{row.name}</Link>{individual && <Link className="block text-xs text-muted-foreground hover:text-primary" to={`/clubs/${row.club_id}`}>{row.club_name}</Link>}{row[appearances] === 0 && <span className="block text-xs text-muted-foreground">Not played</span>}</div></div></td><td className="p-3 text-center tabular-nums">{row[appearances]}</td>{category.rated && <td className="p-3 text-center">{row[category.rated]}</td>}{category.id === "conceded_per_match" && <td className="p-3 text-center">{row.goalkeeper_conceded}</td>}<td className="p-3 text-center font-bold tabular-nums text-primary">{row[category.value] == null ? "—" : category.rated || category.id === "conceded_per_match" ? Number(row[category.value]).toFixed(2) : row[category.value]}</td></tr>)}</tbody></table>
      </div>}
    </>}
  </section>;
}

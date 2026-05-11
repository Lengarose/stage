import EmptyState from "@/components/admin/shared/EmptyState";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Search, Trophy, X } from "lucide-react";

export default function TournamentsTab({
  setCreateTournamentOpen,
  seedPressQuestions,
  reseedLifestyle,
  saving,
  tournamentSearch,
  setTournamentSearch,
  tournaments,
  cancelTournament,
}) {
  return (
    <>
      <div className="mb-4 flex gap-2 flex-wrap">
        <Button onClick={() => setCreateTournamentOpen(true)} className="bg-primary text-primary-foreground gap-2 text-xs h-8 rounded">
          <Plus className="w-3.5 h-3.5" /> Create Tournament
        </Button>
        <Button variant="outline" size="sm" onClick={seedPressQuestions} disabled={saving} className="border-border text-muted-foreground hover:text-foreground text-xs h-8 rounded gap-1.5">
          Seed Press Questions
        </Button>
        <Button variant="outline" size="sm" onClick={reseedLifestyle} disabled={saving} className="border-border text-muted-foreground hover:text-foreground text-xs h-8 rounded gap-1.5">
          Reseed Lifestyle Prices
        </Button>
      </div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={tournamentSearch} onChange={e => setTournamentSearch(e.target.value)}
          className="w-full bg-secondary border border-border rounded pl-9 pr-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
          placeholder="Search by tournament name..." />
      </div>
      {tournaments.length === 0 ? (
        <EmptyState icon={Trophy} text="No active tournaments." />
      ) : (
        <div className="space-y-3">
          {tournaments.filter(t => t.name?.toLowerCase().includes(tournamentSearch.toLowerCase()) && t.status !== "archived" && t.status !== "cancelled").map(t => (
            <div key={t.id} className="bg-card border border-border rounded p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <p className="font-bold text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t.type} · {t.platform} · Round {t.current_round}/{t.total_rounds || "?"} · {(t.registered_clubs || []).length} clubs
                </p>
                <span className={cn("text-[10px] px-2 py-0.5 rounded border mt-1 inline-block uppercase tracking-wider font-bold",
                  t.status === "registration" ? "bg-primary/10 text-primary border-primary/20" :
                  t.status === "in_progress" ? "bg-success/10 text-success border-success/20" :
                  t.status === "completed" ? "bg-muted text-muted-foreground border-border" :
                  "bg-destructive/10 text-destructive border-destructive/20"
                )}>{t.status}</span>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link to={`/tournaments/${t.id}`}><Button size="sm" variant="outline" className="border-border text-muted-foreground text-xs">View</Button></Link>
                <Button size="sm" variant="outline" onClick={() => cancelTournament(t.id)} className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs gap-1"><X className="w-3.5 h-3.5" /> Cancel</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

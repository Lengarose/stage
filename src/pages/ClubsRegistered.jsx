import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import { ArrowLeft, Shield, Search, Users, Check, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ClubsRegistered() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [allClubs, setAllClubs] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRegion, setFilterRegion] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  useEffect(() => {
    async function load() {
      const [tData, clubs] = await Promise.all([
        stageClient.entities.Tournament.filter({ id }, null, 1),
        stageClient.entities.Club.list("-wins", 200),
      ]);
      const t = tData[0];
      setTournament(t);
      setAllClubs(clubs);
      if (t?.registered_clubs?.length > 0) {
        setSelected(new Set(t.registered_clubs));
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const maxTeams = tournament?.max_teams || 0;
  const isFull = selected.size >= maxTeams;

  function toggle(clubId) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(clubId)) {
        next.delete(clubId);
      } else {
        if (next.size >= maxTeams) return prev; // full
        next.add(clubId);
      }
      return next;
    });
  }

  async function save() {
    setSaving(true);
    await stageClient.entities.Tournament.update(id, { registered_clubs: [...selected] });
    setTournament(prev => ({ ...prev, registered_clubs: [...selected] }));
    setSaving(false);
    alert("Participants saved!");
  }

  const regions = [...new Set(allClubs.map(c => c.region).filter(Boolean))];
  const filtered = allClubs
    .filter(c => {
      const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.tag?.toLowerCase().includes(search.toLowerCase());
      const matchRegion = filterRegion === "all" || c.region === filterRegion;
      return matchSearch && matchRegion;
    })
    .sort((a, b) => (b.wins || 0) - (a.wins || 0));

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Add Participants — Clubs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tournament?.name} · <span className={cn("font-semibold", isFull ? "text-destructive" : "text-success")}>{selected.size}/{maxTeams} slots filled</span>
          </p>
        </div>
        <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground gap-2">
          <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Participants"}
        </Button>
      </div>

      {isFull && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium">
          🔒 Tournament is full ({maxTeams}/{maxTeams}). Remove a club to add another.
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search club or tag..." className="pl-9 bg-secondary border-border" />
        </div>
        {regions.length > 0 && (
          <Select value={filterRegion} onValueChange={setFilterRegion}>
            <SelectTrigger className="w-40 bg-secondary border-border"><SelectValue placeholder="Region" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider bg-secondary/50">
              <th className="w-10 px-4 py-3"></th>
              <th className="text-left px-4 py-3">Club</th>
              <th className="hidden sm:table-cell px-3 py-3 text-left">Region</th>
              <th className="hidden md:table-cell px-3 py-3 text-center">W/D/L</th>
              <th className="px-3 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((club) => {
              const isSelected = selected.has(club.id);
              const disabled = !isSelected && isFull;
              return (
                <tr
                  key={club.id}
                  onClick={() => !disabled && toggle(club.id)}
                  className={cn(
                    "border-b border-border/50 transition-colors cursor-pointer",
                    isSelected ? "bg-primary/5 hover:bg-primary/10" : disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-secondary/30"
                  )}
                >
                  <td className="px-4 py-3 text-center">
                    <div className={cn(
                      "w-5 h-5 rounded-md border-2 flex items-center justify-center mx-auto transition-all",
                      isSelected ? "bg-primary border-primary" : "border-border"
                    )}>
                      {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
                        {club.logo_url
                          ? <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover" style={{ objectPosition: club.logo_position || "50% 50%" }} />
                          : <Shield className="w-4 h-4 text-primary" />}
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{club.name}</p>
                        <p className="text-[10px] text-primary font-mono">[{club.tag}]</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-3 py-3 text-muted-foreground text-xs">{club.region || "—"}</td>
                  <td className="hidden md:table-cell px-3 py-3 text-center text-xs">
                    <span className="text-success">{club.wins || 0}W</span>
                    <span className="text-muted-foreground mx-1">/</span>
                    <span className="text-muted-foreground">{club.draws || 0}D</span>
                    <span className="text-muted-foreground mx-1">/</span>
                    <span className="text-destructive">{club.losses || 0}L</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {isSelected
                      ? <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-success/10 text-success border border-success/20">Registered</span>
                      : <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-secondary text-muted-foreground border border-border">Add</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {hasMore && (
          <div className="p-4 text-center border-t border-border">
            <Button variant="outline" onClick={() => setPage(p => p + 1)}>Load More</Button>
          </div>
        )}
        {filtered.length === 0 && (
          <div className="p-12 text-center">
            <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No clubs found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
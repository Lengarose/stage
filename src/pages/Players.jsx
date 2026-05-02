import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Star, Target, TrendingUp, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const PLATFORMS = ["All Platforms", "PlayStation", "Xbox", "PC"];
const POSITIONS = ["All Positions", "GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST", "CF"];

const PAGE_SIZE = 10;

export default function Players() {
  const [players, setPlayers] = useState([]);
  const [clubs, setClubs] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("All Platforms");
  const [position, setPosition] = useState("All Positions");
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function load() {
      const [data, clubData] = await Promise.all([
        base44.entities.Player.list("-overall_rating", 500),
        base44.entities.Club.list(),
      ]);
      setPlayers(data);
      const clubMap = {};
      clubData.forEach(c => { clubMap[c.id] = c; });
      setClubs(clubMap);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = players.filter(p => {
    const matchSearch = !search || (p.gamertag || "").toLowerCase().includes(search.toLowerCase());
    const matchPlatform = platform === "All Platforms" || p.platform === platform;
    const matchPosition = position === "All Positions" || p.position === position;
    return matchSearch && matchPlatform && matchPosition;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const getRankColor = (rank) => {
    if (rank === 1) return "bg-yellow-500 text-black";
    if (rank === 2) return "bg-gray-400 text-black";
    if (rank === 3) return "bg-amber-600 text-white";
    return "bg-secondary text-muted-foreground";
  };

  return (
    <div className="min-h-screen bg-background p-6 lg:p-10">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="font-heading font-black text-5xl md:text-6xl text-foreground uppercase"
          style={{ transform: "skewX(-8deg)", letterSpacing: "-0.02em", transformOrigin: "left center" }}
        >
          PLAYERS
        </h1>
        <p className="text-sm text-muted-foreground mt-2">Browse and discover Pro Clubs players</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search players..."
          className="flex-1 bg-secondary border border-border rounded-xl px-5 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
        />
        <select
          value={platform}
          onChange={e => setPlatform(e.target.value)}
          className="bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none cursor-pointer min-w-[160px]"
        >
          {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={position}
          onChange={e => setPosition(e.target.value)}
          className="bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none cursor-pointer min-w-[160px]"
        >
          {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">No players found.</div>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map((player, i) => {
              const globalRank = (page - 1) * PAGE_SIZE + i + 1;
              const matches = player.matches_played_club || player.matches_played || 0;
              const wins = player.wins_count || 0;
              const losses = player.losses_count || 0;
              const draws = player.draws_count || 0;
              const wr = matches > 0 ? Math.round((wins / matches) * 100) : 0;

              return (
                <div
                  key={player.id}
                  className="flex items-center gap-4 bg-card border border-border rounded-2xl px-5 py-4 hover:border-primary/40 hover:bg-card/80 transition-all group"
                >
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0", getRankColor(globalRank))}>
                    {globalRank}
                  </div>
                  <Link to={`/players/${player.id}`} className="w-12 h-12 rounded-xl overflow-hidden border border-border shrink-0 bg-secondary">
                    {player.avatar_url ? (
                      <img src={player.avatar_url} alt={player.gamertag} className="w-full h-full object-cover" style={{ objectPosition: player.avatar_position || "50% 50%" }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-lg font-bold">
                        {(player.gamertag || "?")[0].toUpperCase()}
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/players/${player.id}`} className="block">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-heading text-lg font-bold text-foreground group-hover:text-primary transition-colors">{player.gamertag}</span>
                        {player.position && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded border border-primary/30 text-primary bg-primary/10">{player.position}</span>
                        )}
                      </div>
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      {player.platform && <span>{player.platform}</span>}
                      {player.country && <><span>•</span><span>{player.country}</span></>}
                      {player.club_id && clubs[player.club_id] && (
                        <>
                          <span>•</span>
                          <Link
                            to={`/clubs/${player.club_id}`}
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <Shield className="w-3 h-3" />
                            {clubs[player.club_id].name}
                          </Link>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-warning"><Star className="w-3 h-3" /> {player.overall_rating || 70}</span>
                      <span className="flex items-center gap-1 text-xs text-success"><Target className="w-3 h-3" /> {player.goals || 0} goals</span>
                      <span className="flex items-center gap-1 text-xs text-primary"><TrendingUp className="w-3 h-3" /> {player.assists || 0} assists</span>
                      <span className="text-xs text-muted-foreground">{wins}W {draws}D {losses}L</span>
                      <span className={cn("text-xs font-bold", wr >= 60 ? "text-success" : wr >= 40 ? "text-warning" : "text-muted-foreground")}>{wr}% WR</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground disabled:opacity-40 hover:border-primary/50 transition-colors"
              >← Prev</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-9 h-9 rounded-lg text-sm font-bold border transition-colors ${
                    n === page ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-foreground hover:border-primary/50"
                  }`}
                >{n}</button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground disabled:opacity-40 hover:border-primary/50 transition-colors"
              >Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
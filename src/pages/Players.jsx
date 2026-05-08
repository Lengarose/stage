import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { Link } from "react-router-dom";
import { Shield, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const PLATFORMS = ["All Platforms", "PlayStation", "Xbox", "PC"];
const POSITIONS = ["All Positions", "GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST", "CF"];
const PAGE_SIZE = 15;

function ratingStyle(r) {
  if (r >= 90) return { cls: "text-yellow-300", shadow: "0 0 18px rgba(253,224,71,0.7)" };
  if (r >= 85) return { cls: "text-yellow-400", shadow: "0 0 14px rgba(234,179,8,0.5)" };
  if (r >= 80) return { cls: "text-slate-200",  shadow: "0 0 10px rgba(226,232,240,0.4)" };
  if (r >= 75) return { cls: "text-amber-500",  shadow: "0 0 8px rgba(245,158,11,0.3)"  };
  return { cls: "text-[hsl(189,100%,52%)]", shadow: "0 0 8px hsl(189 100% 52% / 0.4)" };
}

function rankBadge(rank) {
  if (rank === 1) return "bg-yellow-400 text-black shadow-[0_0_16px_rgba(234,179,8,0.7)] font-black";
  if (rank === 2) return "bg-slate-300 text-black shadow-[0_0_10px_rgba(203,213,225,0.5)] font-black";
  if (rank === 3) return "bg-amber-600 text-white shadow-[0_0_10px_rgba(217,119,6,0.5)] font-black";
  return "bg-white/8 text-white/50 font-semibold";
}

export default function Players() {
  const [players, setPlayers]   = useState([]);
  const [clubs,   setClubs]     = useState({});
  const [loading, setLoading]   = useState(true);
  const [search,  setSearch]    = useState("");
  const [platform, setPlatform] = useState("All Platforms");
  const [position, setPosition] = useState("All Positions");
  const [page,    setPage]      = useState(1);

  useEffect(() => {
    async function load() {
      const [data, clubData] = await Promise.all([
        stageClient.entities.Player.list("-overall_rating", 500),
        stageClient.entities.Club.list(),
      ]);
      setPlayers(data);
      const m = {};
      clubData.forEach(c => { m[c.id] = c; });
      setClubs(m);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = players.filter(p => {
    const matchSearch   = !search   || (p.gamertag || "").toLowerCase().includes(search.toLowerCase());
    const matchPlatform = platform === "All Platforms" || p.platform === platform;
    const matchPosition = position === "All Positions"  || p.position === position;
    return matchSearch && matchPlatform && matchPosition;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const inputCls = "bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[hsl(189,100%,52%)]/50 focus:bg-white/8 transition-all";
  const selectCls = "bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm outline-none cursor-pointer appearance-none min-w-[150px]";

  return (
    <div className="min-h-screen p-6 lg:p-10 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="mb-10">
        <p className="text-[hsl(189,100%,52%)]/80 text-[10px] uppercase tracking-[0.35em] font-bold mb-1">STAGE</p>
        <h1
          className="font-heading font-black uppercase leading-none text-foreground"
          style={{ fontSize: "clamp(2rem, 5vw, 3.25rem)", letterSpacing: "-0.02em" }}
        >
          PLAYERS
        </h1>
        <p className="text-muted-foreground text-sm mt-3">
          {loading ? "Loading…" : `${filtered.length} player${filtered.length !== 1 ? "s" : ""} registered`}
        </p>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search players…"
            className={cn(inputCls, "pl-10 w-full")}
          />
        </div>
        <select value={platform} onChange={e => { setPlatform(e.target.value); setPage(1); }} className={selectCls}>
          {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={position} onChange={e => { setPosition(e.target.value); setPage(1); }} className={selectCls}>
          {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* ── List ── */}
      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-9 h-9 border-4 border-[hsl(189,100%,52%)]/20 border-t-[hsl(189,100%,52%)] rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-white/30 text-sm">No players found.</div>
      ) : (
        <>
          {/* Column labels */}
          <div className="hidden sm:grid grid-cols-[2.5rem_2.5rem_3rem_1fr_auto] gap-4 px-5 mb-2 items-center">
            <span />
            <span className="text-white/25 text-[9px] uppercase tracking-widest text-center">#</span>
            <span />
            <span className="text-white/25 text-[9px] uppercase tracking-widest">Player</span>
            <div className="flex items-center gap-8 pr-1">
              <span className="text-white/25 text-[9px] uppercase tracking-widest w-8 text-center">GLS</span>
              <span className="text-white/25 text-[9px] uppercase tracking-widest w-8 text-center">AST</span>
              <span className="text-white/25 text-[9px] uppercase tracking-widest w-16 text-center">W/D/L</span>
              <span className="text-white/25 text-[9px] uppercase tracking-widest w-10 text-center">WR%</span>
            </div>
          </div>

          <div className="space-y-2">
            {paginated.map((player, i) => {
              const globalRank = (page - 1) * PAGE_SIZE + i + 1;
              const rating  = player.overall_rating || 70;
              const rs      = ratingStyle(rating);
              const wins    = player.wins_count || 0;
              const losses  = player.losses_count || 0;
              const draws   = player.draws_count || 0;
              const matches = wins + losses + draws;
              const wr      = matches > 0 ? Math.round((wins / matches) * 100) : 0;
              const club    = player.club_id ? clubs[player.club_id] : null;

              return (
                <Link key={player.id} to={`/players/${player.id}`} className="block group">
                  <div className="relative rounded-2xl overflow-hidden" style={{ minHeight: "80px" }}>

                    {/* Banner background */}
                    {player.banner_url ? (
                      <div
                        className="absolute inset-0 scale-105 group-hover:scale-110 transition-transform duration-700"
                        style={{
                          backgroundImage:    `url(${player.banner_url})`,
                          backgroundSize:     `${player.banner_zoom || 150}%`,
                          backgroundPosition: player.banner_position || "50% 50%",
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-r from-slate-900 to-slate-800" />
                    )}

                    {/* Dark gradient for readability */}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/88 via-black/65 to-black/25" />
                    {/* Subtle left accent line */}
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[hsl(189,100%,52%)]/0 group-hover:bg-[hsl(189,100%,52%)]/80 transition-all duration-300 rounded-l-2xl" />
                    {/* Border */}
                    <div className="absolute inset-0 rounded-2xl border border-white/8 group-hover:border-[hsl(189,100%,52%)]/35 transition-colors duration-300" />
                    {/* Glow on hover */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ boxShadow: "inset 0 0 40px hsl(189 100% 52% / 0.05)" }} />

                    {/* Content */}
                    <div className="relative z-10 flex items-center gap-4 px-5 py-4">

                      {/* Rank badge */}
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs shrink-0", rankBadge(globalRank))}>
                        {globalRank}
                      </div>

                      {/* OVR rating — EA FC style */}
                      <div className="shrink-0 text-center w-10">
                        <div
                          className={cn("font-heading font-black text-2xl leading-none", rs.cls)}
                          style={{ textShadow: rs.shadow }}
                        >
                          {rating}
                        </div>
                        <div className="text-white/30 text-[8px] uppercase tracking-widest mt-0.5">OVR</div>
                      </div>

                      {/* Avatar */}
                      <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/15 shrink-0 bg-black/40 group-hover:border-white/30 transition-colors">
                        {player.avatar_url ? (
                          <img
                            src={player.avatar_url}
                            alt={player.gamertag}
                            className="w-full h-full object-cover"
                            style={{ objectPosition: player.avatar_position || "50% 50%" }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/40 font-black text-base">
                            {(player.gamertag || "?")[0].toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Name + meta */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-heading font-black text-base text-white uppercase tracking-wide group-hover:text-[hsl(189,100%,52%)] transition-colors truncate">
                            {player.gamertag}
                          </span>
                          {player.position && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-[hsl(189,100%,52%)]/15 text-[hsl(189,100%,52%)] border border-[hsl(189,100%,52%)]/25 uppercase tracking-wider shrink-0">
                              {player.position}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-white/35 mt-0.5 flex-wrap">
                          {player.country && <span>{player.country}</span>}
                          {player.platform && <><span>·</span><span>{player.platform}</span></>}
                          {club && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-1 text-[hsl(189,100%,52%)]/70">
                                <Shield className="w-2.5 h-2.5" />
                                {club.name}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Stats — hidden on mobile */}
                      <div className="hidden sm:flex items-center gap-6 shrink-0 pr-1">
                        <div className="text-center w-8">
                          <div className="text-white font-black text-base leading-none">{player.goals || 0}</div>
                          <div className="text-white/25 text-[8px] uppercase tracking-widest mt-0.5">GLS</div>
                        </div>
                        <div className="text-center w-8">
                          <div className="text-white font-black text-base leading-none">{player.assists || 0}</div>
                          <div className="text-white/25 text-[8px] uppercase tracking-widest mt-0.5">AST</div>
                        </div>
                        <div className="text-center w-16">
                          <div className="text-white/60 text-xs font-semibold">{wins}W {draws}D {losses}L</div>
                          <div className="text-white/25 text-[8px] uppercase tracking-widest mt-0.5">Record</div>
                        </div>
                        <div className="text-center w-10">
                          <div className={cn("font-black text-sm leading-none",
                            wr >= 60 ? "text-emerald-400" : wr >= 40 ? "text-yellow-400" : "text-white/40"
                          )}>{wr}%</div>
                          <div className="text-white/25 text-[8px] uppercase tracking-widest mt-0.5">WR</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:bg-white/10 hover:border-white/25 disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const n = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
                return (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={cn(
                      "w-9 h-9 rounded-xl text-sm font-bold border transition-all",
                      n === page
                        ? "bg-[hsl(189,100%,52%)] text-black border-[hsl(189,100%,52%)] shadow-[0_0_14px_hsl(189_100%_52%/0.45)]"
                        : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:border-white/25"
                    )}
                  >{n}</button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:bg-white/10 hover:border-white/25 disabled:opacity-30 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

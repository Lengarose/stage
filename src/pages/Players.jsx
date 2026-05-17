import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { Link } from "react-router-dom";
import { Shield, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const PLATFORMS = ["All Platforms", "PlayStation", "Xbox", "PC"];
const POSITIONS = ["All Positions", "GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST", "CF"];
const PAGE_SIZE = 15;

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
        stageClient.entities.Player.list(null, 500),
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
    const matchPosition = position === "All Positions" || p.position === position || p.secondary_position === position;
    return matchSearch && matchPlatform && matchPosition;
  }).sort((a, b) => (a.gamertag || "").localeCompare(b.gamertag || ""));

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
          <div className="hidden sm:grid grid-cols-[3rem_1fr_auto] gap-4 px-5 mb-2 items-center">
            <span className="text-white/25 text-[9px] uppercase tracking-widest">Avatar</span>
            <span className="text-white/25 text-[9px] uppercase tracking-widest">Player</span>
            <span className="text-white/25 text-[9px] uppercase tracking-widest text-right">Profile</span>
          </div>

          <div className="space-y-2">
            {paginated.map((player, i) => {
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

                    {/* Dark overlay for readability — min 50% opacity on the right where stats sit */}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/15 to-black/90" />
                    {/* Subtle left accent line */}
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[hsl(189,100%,52%)]/0 group-hover:bg-[hsl(189,100%,52%)]/80 transition-all duration-300 rounded-l-2xl" />
                    {/* Border */}
                    <div className="absolute inset-0 rounded-2xl border border-white/8 group-hover:border-[hsl(189,100%,52%)]/35 transition-colors duration-300" />
                    {/* Glow on hover */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ boxShadow: "inset 0 0 40px hsl(189 100% 52% / 0.05)" }} />

                    {/* Content */}
                    <div className="relative z-10 flex items-center gap-4 px-5 py-4">
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
                          <span className="font-heading font-black text-base text-white uppercase tracking-wide group-hover:text-[hsl(189,100%,52%)] transition-colors">
                            {player.gamertag}
                          </span>
                          {(player.position || player.secondary_position) && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-[hsl(189,100%,52%)]/15 text-[hsl(189,100%,52%)] border border-[hsl(189,100%,52%)]/25 uppercase tracking-wider shrink-0">
                              {[player.position, player.secondary_position].filter(Boolean).join(" / ")}
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

                      <div className="hidden sm:block shrink-0 text-xs font-bold uppercase tracking-wider text-white/35 group-hover:text-[hsl(189,100%,52%)]/80 transition-colors">
                        View Profile
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

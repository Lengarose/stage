import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { Link } from "react-router-dom";
import { Shield, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { asObjectArray, parseJsonArray } from "@/lib/safeData";
import { filterPublicPlayerProfiles } from "@/lib/playerDirectory";
import { getCountryDisplayName } from "@/lib/countryDisplay";

const PLATFORMS = ["All Platforms", "PlayStation", "Xbox", "PC"];
const POSITIONS = ["All Positions", "GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST", "CF"];
const PAGE_SIZE = 15;

export default function Players({ tournamentId } = {}) {
  const { t } = useTranslation();
  const [players, setPlayers]   = useState([]);
  const [clubs,   setClubs]     = useState({});
  const [loading, setLoading]   = useState(true);
  const [search,  setSearch]    = useState("");
  const [platform, setPlatform] = useState("All Platforms");
  const [position, setPosition] = useState("All Positions");
  const [page,    setPage]      = useState(1);

  useEffect(() => {
    async function load() {
      try {
        // Kick off the (tournament-independent) club fetch in parallel with player resolution.
        const clubsPromise = stageClient.entities.Club.list().catch(() => []);
        let data;
        if (tournamentId) {
          const tournament = await stageClient.entities.Tournament.get(tournamentId).catch(() => null);
          const registeredIds = tournament?.registered_players || [];
          const parsed = parseJsonArray(registeredIds);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const all = asObjectArray(await stageClient.entities.Player.list(null, 500).catch(() => []));
            data = all.filter(p => p?.id && parsed.includes(p.id));
          } else {
            data = [];
          }
        } else {
          data = await stageClient.entities.Player.list(null, 500).catch(() => []);
        }
        const clubData = asObjectArray(await clubsPromise);
        // Hide president-only OAuth stubs; only show users who finished PlayerSetup.
        setPlayers(filterPublicPlayerProfiles(asObjectArray(data)));
        const m = {};
        clubData.forEach(c => { if (c?.id) m[c.id] = c; });
        setClubs(m);
      } catch {
        setPlayers([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tournamentId]);

  const filtered = asObjectArray(players).filter(p => {
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
          {t("competitionFlow.playersTitle")}
        </h1>
        <p className="text-muted-foreground text-sm mt-3">
          {loading ? t("competitionFlow.loading") : t("competitionFlow.registeredPlayersCount", { count: filtered.length })}
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
            placeholder={t("competitionFlow.searchPlayers")}
            className={cn(inputCls, "pl-10 w-full")}
          />
        </div>
        <select value={platform} onChange={e => { setPlatform(e.target.value); setPage(1); }} className={selectCls}>
          {PLATFORMS.map(p => <option key={p} value={p}>{p === "All Platforms" ? t("competitionFlow.allPlatforms") : p}</option>)}
        </select>
        <select value={position} onChange={e => { setPosition(e.target.value); setPage(1); }} className={selectCls}>
          {POSITIONS.map(p => <option key={p} value={p}>{p === "All Positions" ? t("competitionFlow.allPositions") : p}</option>)}
        </select>
      </div>

      {/* ── List ── */}
      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-9 h-9 border-4 border-[hsl(189,100%,52%)]/20 border-t-[hsl(189,100%,52%)] rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-white/30 text-sm">{t("competitionFlow.noPlayersFound")}</div>
      ) : (
        <>
          {/* Column labels */}
          <div className="hidden sm:grid grid-cols-[3rem_1fr_auto] gap-4 px-5 mb-2 items-center">
            <span className="text-white/25 text-[9px] uppercase tracking-widest">{t("competitionFlow.avatar")}</span>
            <span className="text-white/25 text-[9px] uppercase tracking-widest">{t("competitionFlow.player")}</span>
            <span className="text-white/25 text-[9px] uppercase tracking-widest text-right">{t("competitionFlow.profile")}</span>
          </div>

          <div className="space-y-2">
            {paginated.map((player) => {
              const club    = player.club_id ? clubs[player.club_id] : null;

              return (
                <Link key={player.id} to={`/players/${player.id}`} className="block group">
                  <div
                    className="relative overflow-hidden"
                    style={{ minHeight: "80px", clipPath: "polygon(2% 0, 100% 0, 98% 100%, 0 100%)" }}
                  >

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
                    <div className="absolute bottom-0 left-0 top-0 w-[4px] bg-[hsl(189,100%,52%)]/0 transition-all duration-300 group-hover:bg-[hsl(189,100%,52%)]/80" />
                    {/* Border */}
                    <div className="absolute inset-0 border border-white/8 transition-colors duration-300 group-hover:border-[hsl(189,100%,52%)]/35" />
                    {/* Glow on hover */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ boxShadow: "inset 0 0 40px hsl(189 100% 52% / 0.05)" }} />

                    {/* Content */}
                    <div className="relative z-10 flex items-center gap-4 px-7 py-4 sm:px-8">
                      {/* Avatar */}
                      <div
                        className="h-11 w-11 shrink-0 overflow-hidden border-2 border-white/15 bg-black/40 transition-colors group-hover:border-white/30"
                        style={{ clipPath: "polygon(14% 0, 100% 0, 86% 100%, 0 100%)" }}
                      >
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
                            <span
                              className="shrink-0 border border-[hsl(189,100%,52%)]/25 bg-[hsl(189,100%,52%)]/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[hsl(189,100%,52%)]"
                              style={{ clipPath: "polygon(12% 0, 100% 0, 88% 100%, 0 100%)" }}
                            >
                              {[player.position, player.secondary_position].filter(Boolean).join(" / ")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-white/35 mt-0.5 flex-wrap">
                          {(player.country || player.country_code) && <span>{getCountryDisplayName(player.country_code, player.country)}</span>}
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
                        {t("competitionFlow.viewProfile")}
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
                className="flex h-9 w-9 items-center justify-center border border-white/10 bg-white/5 text-white/50 transition-all hover:border-white/25 hover:bg-white/10 disabled:opacity-30"
                style={{ clipPath: "polygon(18% 0, 100% 0, 82% 100%, 0 100%)" }}
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
                      "h-9 w-9 border text-sm font-bold transition-all",
                      n === page
                        ? "bg-[hsl(189,100%,52%)] text-black border-[hsl(189,100%,52%)] shadow-[0_0_14px_hsl(189_100%_52%/0.45)]"
                        : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:border-white/25"
                    )}
                    style={{ clipPath: "polygon(18% 0, 100% 0, 82% 100%, 0 100%)" }}
                  >{n}</button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex h-9 w-9 items-center justify-center border border-white/10 bg-white/5 text-white/50 transition-all hover:border-white/25 hover:bg-white/10 disabled:opacity-30"
                style={{ clipPath: "polygon(18% 0, 100% 0, 82% 100%, 0 100%)" }}
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

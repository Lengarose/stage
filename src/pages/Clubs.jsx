import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { Shield, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import ClubCard from "../components/ClubCard";

const PAGE_SIZE = 15;
const PLATFORMS = ["All Platforms", "PlayStation", "Xbox", "PC"];
const REGIONS   = ["All Regions", "Europe", "North America", "South America", "Asia", "Oceania", "Middle East"];

export default function Clubs() {
  const [clubs,    setClubs]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [platform, setPlatform] = useState("All Platforms");
  const [region,   setRegion]   = useState("All Regions");
  const [page,     setPage]     = useState(1);

  useEffect(() => {
    async function load() {
      const data = await stageClient.entities.Club.list(null, 500);
      setClubs(data);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = clubs.filter(c => {
    const name = (c.name || "").toLowerCase();
    const tag  = (c.tag  || "").toLowerCase();
    const matchSearch   = !search   || name.includes(search.toLowerCase()) || tag.includes(search.toLowerCase());
    const matchPlatform = platform === "All Platforms" || c.platform === platform;
    const matchRegion   = region   === "All Regions"   || c.region   === region;
    return matchSearch && matchPlatform && matchRegion;
  }).sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const inputCls  = "bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[hsl(189,100%,52%)]/50 focus:bg-white/8 transition-all";
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
          CLUBS
        </h1>
        <p className="text-muted-foreground text-sm mt-3">
          {loading ? "Loading…" : `${filtered.length} club${filtered.length !== 1 ? "s" : ""} registered`}
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
            placeholder="Search clubs…"
            className={cn(inputCls, "pl-10 w-full")}
          />
        </div>
        <select value={platform} onChange={e => { setPlatform(e.target.value); setPage(1); }} className={selectCls}>
          {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={region} onChange={e => { setRegion(e.target.value); setPage(1); }} className={selectCls}>
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* ── List ── */}
      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-9 h-9 border-4 border-[hsl(189,100%,52%)]/20 border-t-[hsl(189,100%,52%)] rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-white/30 text-sm flex flex-col items-center gap-4">
          <Shield className="w-12 h-12 text-white/10" />
          <span>No clubs found.</span>
        </div>
      ) : (
        <>
          {/* Column labels */}
          <div className="hidden sm:grid grid-cols-[3rem_1fr_auto] gap-4 px-5 mb-2 items-center">
            <span className="text-white/25 text-[9px] uppercase tracking-widest">Logo</span>
            <span className="text-white/25 text-[9px] uppercase tracking-widest">Club</span>
            <span className="text-white/25 text-[9px] uppercase tracking-widest text-right">Profile</span>
          </div>

          <div className="space-y-2">
            {paginated.map((club, i) => (
              <ClubCard
                key={`${club.id}-${i}`}
                club={club}
              />
            ))}
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

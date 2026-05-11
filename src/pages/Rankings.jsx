import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { Globe, MapPin, Clock, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const FORM_COLOR = { W: "bg-emerald-400", D: "bg-yellow-400", L: "bg-red-500" };

function rankBadge(rank) {
  if (rank === 1) return { cls: "bg-yellow-400 text-black shadow-[0_0_16px_rgba(234,179,8,0.7)] font-black", pts: "text-yellow-300", ptsGlow: "0 0 18px rgba(253,224,71,0.7)" };
  if (rank === 2) return { cls: "bg-slate-300 text-black shadow-[0_0_10px_rgba(203,213,225,0.5)] font-black", pts: "text-slate-300", ptsGlow: "0 0 10px rgba(226,232,240,0.4)" };
  if (rank === 3) return { cls: "bg-amber-600 text-white shadow-[0_0_10px_rgba(217,119,6,0.5)] font-black",  pts: "text-amber-500", ptsGlow: "0 0 8px rgba(245,158,11,0.3)"  };
  return { cls: "bg-white/8 text-white/50 font-semibold", pts: "text-[hsl(189,100%,52%)]", ptsGlow: "" };
}

function ClubRow({ club, rank, showRegion }) {
  const rb      = rankBadge(rank);
  const total   = (club.wins || 0) + (club.losses || 0) + (club.draws || 0);
  const winRate = total > 0 ? Math.round(((club.wins || 0) / total) * 100) : 0;
  const form    = Array.isArray(club.form) ? club.form.slice(-5) : [];

  return (
    <Link to={`/clubs/${club.id}`} className="block group">
      <div className="relative rounded-2xl overflow-hidden" style={{ minHeight: "76px" }}>

        {/* Banner background */}
        {club.banner_url ? (
          <div
            className="absolute inset-0 scale-105 group-hover:scale-110 transition-transform duration-700"
            style={{
              backgroundImage:    `url(${club.banner_url})`,
              backgroundSize:     `${club.banner_zoom || 150}%`,
              backgroundPosition: club.banner_position || "50% 50%",
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 to-slate-800" />
        )}

        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/15 to-black/90" />
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[hsl(189,100%,52%)]/0 group-hover:bg-[hsl(189,100%,52%)]/80 transition-all duration-300 rounded-l-2xl" />
        <div className="absolute inset-0 rounded-2xl border border-white/8 group-hover:border-[hsl(189,100%,52%)]/35 transition-colors duration-300" />

        <div className="relative z-10 flex items-center gap-4 px-5 py-4">

          {/* Rank badge */}
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs shrink-0", rb.cls)}>
            {rank}
          </div>

          {/* Logo */}
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/15 shrink-0 bg-black/40 flex items-center justify-center group-hover:border-white/30 transition-colors">
            {club.logo_url ? (
              <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover rounded-full" />
            ) : (
              <Users className="w-4 h-4 text-white/30" />
            )}
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-heading font-black text-base text-white uppercase tracking-wide group-hover:text-[hsl(189,100%,52%)] transition-colors truncate">
                {club.name}
              </span>
              {club.tag && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-[hsl(189,100%,52%)]/15 text-[hsl(189,100%,52%)] border border-[hsl(189,100%,52%)]/25 uppercase tracking-wider shrink-0 font-mono">
                  [{club.tag}]
                </span>
              )}
            </div>
            {showRegion && club.region && (
              <p className="text-[11px] text-white/35 mt-0.5">{club.region}</p>
            )}
          </div>

          {/* Record + form */}
          <div className="hidden md:flex items-center gap-6 shrink-0">
            <div className="text-center">
              <div className="text-white/60 text-xs font-semibold">{club.wins || 0}W {club.draws || 0}D {club.losses || 0}L</div>
              <div className="text-white/25 text-[8px] uppercase tracking-widest mt-0.5">Record</div>
            </div>
            <div className="text-center w-10">
              <div className={cn("font-black text-sm leading-none",
                winRate >= 60 ? "text-emerald-400" : winRate >= 40 ? "text-yellow-400" : "text-white/40"
              )}>{winRate}%</div>
              <div className="text-white/25 text-[8px] uppercase tracking-widest mt-0.5">WR</div>
            </div>
            {form.length > 0 && (
              <div className="flex items-center gap-1">
                {form.map((r, fi) => (
                  <span key={fi} className={cn("w-2 h-2 rounded-full inline-block", FORM_COLOR[r] || "bg-white/20")} />
                ))}
              </div>
            )}
          </div>

          {/* Points */}
          <div className="text-right shrink-0 min-w-[3rem]">
            <div className={cn("font-heading font-black text-xl leading-none", rb.pts)}
              style={{ textShadow: rb.ptsGlow }}>
              {club.ranking_points || 0}
            </div>
            <div className="text-white/25 text-[8px] uppercase tracking-widest mt-0.5">pts</div>
          </div>

        </div>
      </div>
    </Link>
  );
}

export default function Rankings() {
  const [clubs,   setClubs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState("global");

  useEffect(() => {
    stageClient.entities.Club.list("-ranking_points", 200)
      .then(setClubs)
      .catch(() => setClubs([]))
      .finally(() => setLoading(false));
  }, []);

  const globalClubs = [...clubs].sort((a, b) => (b.ranking_points || 0) - (a.ranking_points || 0));
  const regions     = [...new Set(clubs.map(c => c.region).filter(Boolean))].sort();

  const tabs = [
    { value: "global",   label: "Global",   icon: Globe  },
    { value: "regional", label: "Regional", icon: MapPin },
  ];

  return (
    <div className="min-h-screen p-6 lg:p-10 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="mb-10">
        <p className="text-[hsl(189,100%,52%)]/80 text-[10px] uppercase tracking-[0.35em] font-bold mb-1">STAGE</p>
        <h1
          className="font-heading font-black uppercase leading-none text-foreground"
          style={{ fontSize: "clamp(2rem, 5vw, 3.25rem)", letterSpacing: "-0.02em" }}
        >
          RANKINGS
        </h1>
        <p className="text-muted-foreground text-sm mt-3">
          {loading ? "Loading…" : `${clubs.length} club${clubs.length !== 1 ? "s" : ""} · Global & Regional`}
        </p>
      </div>

      {/* ── Under construction notice ── */}
      <div className="flex items-start gap-3 bg-[hsl(189,100%,52%)]/5 border border-[hsl(189,100%,52%)]/20 rounded-xl px-4 py-3 mb-8 text-sm">
        <Clock className="w-4 h-4 text-[hsl(189,100%,52%)] shrink-0 mt-0.5" />
        <p className="text-white/50">
          <span className="text-white font-semibold">Rankings are being rebuilt.</span>{" "}
          The STAGE Ranking System is under construction — ranking points will update once the new formula goes live.
        </p>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-0 border-b border-white/10 mb-8">
        {tabs.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={cn(
              "flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-widest font-bold border-b-2 transition-all",
              tab === value
                ? "border-[hsl(189,100%,52%)] text-[hsl(189,100%,52%)]"
                : "border-transparent text-white/35 hover:text-white/60"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-9 h-9 border-4 border-[hsl(189,100%,52%)]/20 border-t-[hsl(189,100%,52%)] rounded-full animate-spin" />
        </div>
      ) : tab === "global" ? (
        globalClubs.length === 0 ? (
          <EmptyState icon={Globe} message="No clubs yet." />
        ) : (
          <div className="space-y-2">
            {globalClubs.map((club, i) => (
              <ClubRow key={club.id} club={club} rank={i + 1} showRegion />
            ))}
          </div>
        )
      ) : (
        regions.length === 0 ? (
          <EmptyState icon={MapPin} message="No clubs yet." />
        ) : (
          <div className="space-y-10">
            {regions.map(region => {
              const regionClubs = clubs
                .filter(c => c.region === region)
                .sort((a, b) => (b.ranking_points || 0) - (a.ranking_points || 0));
              return (
                <div key={region}>
                  <div className="flex items-center gap-2 mb-4">
                    <MapPin className="w-3.5 h-3.5 text-[hsl(189,100%,52%)]" />
                    <h2 className="text-xs font-black uppercase tracking-widest text-white">{region}</h2>
                    <span className="text-[11px] text-white/30">— {regionClubs.length} club{regionClubs.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="space-y-2">
                    {regionClubs.map((club, i) => (
                      <ClubRow key={club.id} club={club} rank={i + 1} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, message }) {
  return (
    <div className="text-center py-24 text-white/30 text-sm flex flex-col items-center gap-4">
      <Icon className="w-12 h-12 text-white/10" />
      <span>{message}</span>
    </div>
  );
}

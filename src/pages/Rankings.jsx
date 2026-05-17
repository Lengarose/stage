import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import { cn } from "@/lib/utils";
import {
  Activity,
  BadgeCheck,
  Crosshair,
  Globe,
  MapPin,
  Medal,
  Shield,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";

const POSITIONS = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"];

function rankBadge(rank) {
  if (rank === 1) return "bg-yellow-300 text-black shadow-[0_0_22px_rgba(250,204,21,0.45)]";
  if (rank === 2) return "bg-slate-200 text-slate-950";
  if (rank === 3) return "bg-amber-600 text-white";
  return "bg-white/8 text-white/60";
}

function formatNumber(value) {
  return Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(Number(value) || 0);
}

function scopeLabel(scope, selected) {
  if (scope === "regional") return selected.region || "All Regions";
  if (scope === "country") return selected.country || "All Countries";
  return "Global";
}

function ClubRow({ club, rank }) {
  const winRate = club.matches_ranked ? Math.round((club.wins / club.matches_ranked) * 100) : 0;
  return (
    <Link to={`/clubs/${club.id}`} className="block group">
      <div className="relative min-h-[88px] overflow-hidden rounded-xl border border-white/10 bg-[#07111f]">
        {club.banner_url ? (
          <div
            className="absolute inset-0 scale-105 opacity-70 transition-transform duration-700 group-hover:scale-110"
            style={{
              backgroundImage: `url(${club.banner_url})`,
              backgroundSize: `${club.banner_zoom || 150}%`,
              backgroundPosition: club.banner_position || "50% 50%",
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,20,36,1),rgba(14,35,56,0.72),rgba(8,20,36,1))]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-black/90" />
        <div className="relative flex items-center gap-4 px-4 py-4 sm:px-5">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-black", rankBadge(rank))}>{rank}</div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-black/50">
            {club.logo_url ? <img src={club.logo_url} alt={club.name} className="h-full w-full object-cover" /> : <Shield className="h-5 w-5 text-white/35" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-heading text-lg font-black uppercase text-white">{club.name}</h3>
              {club.tag ? <span className="rounded border border-cyan-300/25 bg-cyan-300/10 px-2 py-0.5 font-mono text-[10px] font-black uppercase text-cyan-200">[{club.tag}]</span> : null}
            </div>
            <p className="mt-1 text-xs text-white/45">{club.region || "Global"}{club.country_code ? ` · ${club.country_code}` : ""}</p>
          </div>
          <div className="hidden items-center gap-6 sm:flex">
            <Metric label="Record" value={`${club.wins || 0}W ${club.draws || 0}D ${club.losses || 0}L`} />
            <Metric label="WR" value={`${winRate}%`} tone={winRate >= 60 ? "good" : winRate >= 40 ? "warn" : "muted"} />
            <Metric label="Titles" value={club.competition_wins || 0} />
          </div>
          <div className="min-w-[64px] text-right">
            <div className="font-heading text-2xl font-black text-cyan-300">{formatNumber(club.ranking_points)}</div>
            <div className="text-[10px] uppercase text-white/35">PTS</div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function PlayerRow({ player, rank }) {
  return (
    <Link to={`/players/${player.id}`} className="block group">
      <div className="grid gap-3 rounded-xl border border-white/10 bg-[#07111f] px-4 py-4 transition-colors group-hover:border-cyan-300/35 md:grid-cols-[auto_auto_1fr_auto] md:items-center">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg text-sm font-black", rankBadge(rank))}>{rank}</div>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5">
            {player.avatar_url ? <img src={player.avatar_url} alt={player.gamertag} className="h-full w-full object-cover" /> : <Users className="h-5 w-5 text-white/35" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-heading text-lg font-black uppercase text-white">{player.gamertag}</h3>
              {player.is_verified ? <BadgeCheck className="h-4 w-4 text-cyan-300" /> : null}
            </div>
            <p className="text-xs text-white/45">{player.position}{player.club_name ? ` · ${player.club_name}` : ""}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Metric label="GP" value={player.ranking_matches || 0} />
          <Metric label="WR" value={`${formatNumber(player.ranking_win_rate)}%`} />
          <Metric label="G" value={player.ranking_goals || 0} />
          <Metric label="A" value={player.ranking_assists || 0} />
          <Metric label="CS" value={player.ranking_clean_sheets || 0} />
          <Metric label="AVG" value={formatNumber(player.ranking_avg_rating)} />
        </div>
        <div className="text-left md:text-right">
          <div className="font-heading text-2xl font-black text-cyan-300">{formatNumber(player.ranking_points)}</div>
          <div className="text-[10px] uppercase text-white/35">PTS</div>
        </div>
      </div>
    </Link>
  );
}

function Metric({ label, value, tone = "default" }) {
  return (
    <div className="min-w-[52px]">
      <div className={cn(
        "text-sm font-black",
        tone === "good" ? "text-emerald-300" : tone === "warn" ? "text-yellow-300" : tone === "muted" ? "text-white/45" : "text-white"
      )}>{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-white/30">{label}</div>
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-white/10 py-16 text-center text-white/40">
      <Trophy className="h-10 w-10 text-white/15" />
      <p>{label}</p>
    </div>
  );
}

export default function Rankings() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("clubs");
  const [scope, setScope] = useState("global");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [position, setPosition] = useState("ST");

  useEffect(() => {
    stageClient.http.get("/rankings/summary")
      .then(setSummary)
      .catch(() => setSummary({ clubs: [], players: [], positions: [], meta: {} }))
      .finally(() => setLoading(false));
  }, []);

  const clubs = summary?.clubs || [];
  const players = summary?.players || [];
  const regions = useMemo(() => [...new Set([...clubs, ...players].map((r) => r.region).filter(Boolean))].sort(), [clubs, players]);
  const countries = useMemo(() => [...new Set([...clubs, ...players].map((r) => r.country_code).filter(Boolean))].sort(), [clubs, players]);

  const filteredClubs = useMemo(() => clubs.filter((club) => {
    if (scope === "regional" && region && club.region !== region) return false;
    if (scope === "country" && country && club.country_code !== country) return false;
    return true;
  }), [clubs, scope, region, country]);

  const filteredPlayers = useMemo(() => players.filter((player) => {
    if (view === "positions" && position && player.position !== position) return false;
    if (scope === "regional" && region && player.region !== region) return false;
    if (scope === "country" && country && player.country_code !== country) return false;
    return true;
  }), [players, view, position, scope, region, country]);

  return (
    <div className="min-h-screen px-5 py-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">STAGE</p>
          <h1 className="font-heading text-5xl font-black uppercase leading-none text-white sm:text-6xl">Rankings</h1>
          <p className="mt-4 max-w-3xl text-sm text-white/50">
            Official rankings based on STAGE competitions, leagues, and tournaments. Arrange Game results are excluded.
          </p>
        </header>

        <div className="mb-6 grid gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4 md:grid-cols-4">
          <Stat icon={Trophy} label="Official Fixtures" value={summary?.meta?.official_fixtures_count || 0} />
          <Stat icon={ShieldCheck} label="Ranked Clubs" value={clubs.length} />
          <Stat icon={Users} label="Ranked Players" value={players.length} />
          <Stat icon={Activity} label="Scope" value={scopeLabel(scope, { region, country })} />
        </div>

        <div className="mb-6 flex flex-wrap items-end gap-3 border-b border-white/10 pb-4">
          <Segment value={view} onChange={setView} items={[
            { value: "clubs", label: "Clubs", icon: Shield },
            { value: "players", label: "Players", icon: Users },
            { value: "positions", label: "Best By Position", icon: Crosshair },
          ]} />
          <Segment value={scope} onChange={setScope} items={[
            { value: "global", label: "Global", icon: Globe },
            { value: "regional", label: "Regional", icon: MapPin },
            { value: "country", label: "Country", icon: Medal },
          ]} />
          {scope === "regional" ? (
            <Select value={region} onChange={setRegion} options={regions} placeholder="All Regions" />
          ) : null}
          {scope === "country" ? (
            <Select value={country} onChange={setCountry} options={countries} placeholder="All Countries" />
          ) : null}
          {view === "positions" ? (
            <Select value={position} onChange={setPosition} options={POSITIONS} placeholder="Position" />
          ) : null}
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />
          </div>
        ) : view === "clubs" ? (
          filteredClubs.length ? (
            <div className="space-y-3">
              {filteredClubs.map((club, index) => <ClubRow key={club.id} club={club} rank={index + 1} />)}
            </div>
          ) : <EmptyState label="No clubs have official ranking data yet." />
        ) : (
          filteredPlayers.length ? (
            <div className="space-y-3">
              {filteredPlayers.map((player, index) => <PlayerRow key={player.id} player={player} rank={index + 1} />)}
            </div>
          ) : <EmptyState label="No players have official ranking data yet." />
        )}
      </div>
    </div>
  );
}

function Segment({ value, onChange, items }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map(({ value: itemValue, label, icon: Icon }) => (
        <button
          key={itemValue}
          type="button"
          onClick={() => onChange(itemValue)}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-black uppercase tracking-widest transition-colors",
            value === itemValue ? "border-cyan-300 text-cyan-300" : "border-transparent text-white/35 hover:text-white/70"
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

function Select({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 rounded-lg border border-white/10 bg-[#07111f] px-3 text-sm text-white outline-none focus:border-cyan-300/60"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-5 w-5 text-cyan-300" />
      <div>
        <div className="font-heading text-xl font-black text-white">{value}</div>
        <div className="text-[10px] uppercase tracking-widest text-white/35">{label}</div>
      </div>
    </div>
  );
}

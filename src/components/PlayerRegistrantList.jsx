import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import { User } from "lucide-react";

export default function PlayerRegistrantList({ playerIds }) {
  const [players, setPlayers] = useState([]);
  const cardClip = { clipPath: "polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%)" };
  const smallClip = { clipPath: "polygon(7px 0, 100% 0, calc(100% - 7px) 100%, 0 100%)" };

  useEffect(() => {
    if (!playerIds?.length) return;
    Promise.all(playerIds.map(id => stageClient.entities.Player.get(id).catch(() => null))).then(results => {
      setPlayers(results.filter(Boolean));
    });
  }, [playerIds?.join(",")]);

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {players.map((p, i) => (
        <Link key={p.id} to={`/players/${p.id}`} className="block group">
          <div className="relative flex min-h-[86px] items-center gap-4 overflow-hidden border border-cyan-200/12 bg-[#07121f]/90 p-4 transition-all hover:border-cyan-200/35 hover:bg-cyan-300/[0.045]" style={cardClip}>
            <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-slate-200/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="flex h-8 w-9 shrink-0 items-center justify-center border border-cyan-200/15 bg-white/[0.04] text-sm font-black text-muted-foreground" style={smallClip}>{i + 1}</div>
            <div className="w-11 h-11 bg-primary/10 flex items-center justify-center overflow-hidden shrink-0 border border-cyan-200/15" style={smallClip}>
              {p.avatar_url
                ? <img src={p.avatar_url} alt={p.gamertag} className="w-full h-full object-cover" style={{ objectPosition: p.avatar_position || "center" }} />
                : <User className="w-5 h-5 text-primary" />}
            </div>
            <div className="min-w-0">
              <p className="truncate font-heading text-sm font-black uppercase tracking-wide leading-relaxed text-foreground">{p.gamertag}</p>
              <p className="truncate text-xs text-muted-foreground">{p.position} · {p.platform}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

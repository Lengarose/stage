import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import { User } from "lucide-react";

export default function PlayerRegistrantList({ playerIds }) {
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    if (!playerIds?.length) return;
    Promise.all(playerIds.map(id => stageClient.entities.Player.filter({ id }, null, 1).then(r => r[0]))).then(results => {
      setPlayers(results.filter(Boolean));
    });
  }, [playerIds?.join(",")]);

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {players.map((p, i) => (
        <Link key={p.id} to={`/players/${p.id}`} className="block group">
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary/30 transition-all">
            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center font-bold text-sm text-muted-foreground">{i + 1}</div>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
              {p.avatar_url
                ? <img src={p.avatar_url} alt={p.gamertag} className="w-full h-full object-cover" style={{ objectPosition: p.avatar_position || "center" }} />
                : <User className="w-5 h-5 text-primary" />}
            </div>
            <div>
              <p className="leading-relaxed font-bold text-foreground">{p.gamertag}</p>
              <p className="text-xs text-muted-foreground">{p.position} · {p.platform}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
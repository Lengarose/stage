import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { cn } from "@/lib/utils";

const SEATS = Array.from({ length: 16 }, (_, i) => i + 1);

export default function DressingRoom({ clubId, currentPlayerEmail, isAdmin }) {
  const [players, setPlayers] = useState([]);
  const [myPlayer, setMyPlayer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await stageClient.entities.Player.filter({ club_id: clubId });
      setPlayers(data);
      const me = data.find(p => p.email === currentPlayerEmail);
      setMyPlayer(me || null);
      setLoading(false);
    }
    load();

    const unsub = stageClient.entities.Player.subscribe((event) => {
      if (event.type === "update") {
        setPlayers(prev => prev.map(p => p.id === event.id ? event.data : p));
        if (event.data.email === currentPlayerEmail) setMyPlayer(event.data);
      }
    });
    return unsub;
  }, [clubId, currentPlayerEmail]);

  async function fillSeatsRandomly() {
    const takenSeats = new Set(players.filter(p => p.dressing_room_seat).map(p => p.dressing_room_seat));
    const available = SEATS.filter(s => !takenSeats.has(s)).sort(() => Math.random() - 0.5);
    const unready = players.filter(p => !p.dressing_room_seat);
    await Promise.all(unready.slice(0, available.length).map((p, i) =>
      stageClient.entities.Player.update(p.id, { dressing_room_seat: available[i], is_ready: true })
    ));
  }

  async function takeSeat(seatNum) {
    if (!myPlayer) return;
    const newSeat = myPlayer.dressing_room_seat === seatNum ? null : seatNum;
    const newReady = newSeat !== null;
    await stageClient.entities.Player.update(myPlayer.id, {
      dressing_room_seat: newSeat,
      is_ready: newReady,
    });
  }

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  const seatMap = {};
  players.forEach(p => {
    if (p.dressing_room_seat) seatMap[p.dressing_room_seat] = p;
  });

  const readyCount = players.filter(p => p.is_ready && p.dressing_room_seat).length;

  return (
    <div className="space-y-4">
      {/* Ready count banner */}
      <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
        <div>
          <p className="leading-relaxed font-bold text-foreground text-lg">
            <span className="text-primary text-2xl">{readyCount}</span> / {players.length} ready
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Click a locker to take your seat & signal you're ready</p>
        </div>
        <div className="flex items-center gap-2">
          {myPlayer?.is_ready && (
            <span className="text-xs px-3 py-1.5 rounded-full bg-success/15 text-success font-medium border border-success/20">
              ✓ You're in
            </span>
          )}
          {isAdmin && (
            <button onClick={fillSeatsRandomly}
              className="text-xs px-3 py-1.5 rounded-full bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 transition-colors font-medium">
              🎲 Fill Randomly
            </button>
          )}
        </div>
      </div>

      {/* Dressing room grid */}
      <div className="bg-card border border-border rounded-2xl p-6 relative overflow-hidden">
        {/* Room ambiance */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/3 to-transparent pointer-events-none" />
        
        {/* Bench top row */}
        <div className="relative">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground text-center mb-3">— Lockers —</p>
          <div className="grid grid-cols-8 gap-2 mb-6">
            {SEATS.slice(0, 8).map(seat => (
              <SeatButton
                key={seat}
                seat={seat}
                player={seatMap[seat]}
                isMe={myPlayer?.dressing_room_seat === seat}
                onClick={() => takeSeat(seat)}
                myPlayer={myPlayer}
              />
            ))}
          </div>
          <div className="grid grid-cols-8 gap-2">
            {SEATS.slice(8, 16).map(seat => (
              <SeatButton
                key={seat}
                seat={seat}
                player={seatMap[seat]}
                isMe={myPlayer?.dressing_room_seat === seat}
                onClick={() => takeSeat(seat)}
                myPlayer={myPlayer}
              />
            ))}
          </div>
        </div>

        {/* Pitch indicator */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Pitch →</span>
          <div className="h-px flex-1 bg-border" />
        </div>
      </div>

      {/* Player list */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {players.map(p => (
          <div key={p.id} className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm",
            p.is_ready && p.dressing_room_seat
              ? "border-success/30 bg-success/5"
              : "border-border bg-card"
          )}>
            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
              {p.avatar_url
                ? <img src={p.avatar_url} className="w-full h-full object-cover" />
                : <span className="text-[10px] leading-relaxed font-bold text-primary">{p.position}</span>
              }
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{p.gamertag}</p>
              <p className={cn("text-[10px]", p.is_ready && p.dressing_room_seat ? "text-success" : "text-muted-foreground")}>
                {p.is_ready && p.dressing_room_seat ? `Seat ${p.dressing_room_seat} ✓` : "Not ready"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeatButton({ seat, player, isMe, onClick, myPlayer }) {
  const occupied = !!player;
  const canClick = !occupied || isMe;

  return (
    <button
      onClick={canClick ? onClick : undefined}
      title={player ? player.gamertag : `Seat ${seat}`}
      className={cn(
        "aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] font-medium transition-all border",
        isMe
          ? "bg-primary/20 border-primary text-primary glow-primary scale-105"
          : occupied
          ? "bg-success/10 border-success/30 text-success cursor-default"
          : "bg-secondary/50 border-border text-muted-foreground hover:border-primary/40 hover:bg-primary/5 cursor-pointer",
        !canClick && "opacity-60"
      )}
    >
      {occupied ? (
        <div className="flex flex-col items-center gap-0.5">
          {player.avatar_url
            ? <img src={player.avatar_url} className="w-5 h-5 rounded-full object-cover" />
            : <span className="leading-relaxed font-bold text-[8px]">{player.position}</span>
          }
          <span className="truncate w-full text-center px-0.5" style={{ fontSize: "7px" }}>
            {player.gamertag.slice(0, 5)}
          </span>
        </div>
      ) : (
        <span className="text-[9px] text-muted-foreground/50">{seat}</span>
      )}
    </button>
  );
}
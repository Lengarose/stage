import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function GameDayDressingRoom({ game, myClub, myPlayer, user }) {
  const [clubPlayers, setClubPlayers] = useState([]);
  const [seatedPlayerIds, setSeatedPlayerIds] = useState([]);
  const [dressingRoomId, setDressingRoomId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const matchStarted = game.status === "in_progress" || game.status === "completed";
  const myPlayerId = myPlayer?.id;
  const iAmSeated = seatedPlayerIds.includes(myPlayerId);

  useEffect(() => {
    async function load() {
      if (!myClub) { setLoading(false); return; }

      const [players, dressing] = await Promise.all([
        base44.entities.Player.filter({ club_id: myClub.id }),
        base44.entities.DressingRoom.filter({ match_id: game.id, club_id: myClub.id }),
      ]);

      setClubPlayers(players || []);

      if (dressing.length > 0) {
        setSeatedPlayerIds(dressing[0].seated_players || []);
        setDressingRoomId(dressing[0].id);
      }
      setLoading(false);
    }
    load();
  }, [game.id, myClub]);

  // Subscribe to real-time dressing room updates
  useEffect(() => {
    const unsub = base44.entities.DressingRoom.subscribe((event) => {
      if (event.data?.match_id === game.id && event.data?.club_id === myClub?.id) {
        setSeatedPlayerIds(event.data.seated_players || []);
        if (event.data.id) setDressingRoomId(event.data.id);
      }
    });
    return () => unsub();
  }, [game.id, myClub]);

  async function takeMySeat() {
    if (!myPlayerId || saving || matchStarted) return;
    setSaving(true);

    const newSeated = iAmSeated
      ? seatedPlayerIds.filter(id => id !== myPlayerId)
      : [...seatedPlayerIds, myPlayerId];

    setSeatedPlayerIds(newSeated);

    if (dressingRoomId) {
      await base44.entities.DressingRoom.update(dressingRoomId, { seated_players: newSeated });
    } else {
      const created = await base44.entities.DressingRoom.create({
        match_id: game.id,
        club_id: myClub.id,
        seated_players: newSeated,
      });
      setDressingRoomId(created.id);
    }
    setSaving(false);
  }

  if (loading) return <div className="text-xs text-muted-foreground p-2">Loading dressing room...</div>;

  if (!myClub) return <div className="text-xs text-muted-foreground p-2">No club data available.</div>;

  const seatedCount = seatedPlayerIds.length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <p className="text-xs font-semibold text-foreground">Dressing Room</p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
          {seatedCount}/{clubPlayers.length} seated
        </span>
      </div>

      {/* Match started lock */}
      {matchStarted && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/60 border border-border">
          <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <p className="text-[11px] text-muted-foreground">
            Dressing room is locked — match has started.
          </p>
        </div>
      )}

      {/* Rule reminder */}
      {!matchStarted && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20">
          <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
          <p className="text-[11px] text-warning">
            Each player must take their own seat. Only seated players receive ratings & stats.
          </p>
        </div>
      )}

      {/* My seat button */}
      {myPlayer && !matchStarted && (
        <Button
          onClick={takeMySeat}
          disabled={saving}
          variant={iAmSeated ? "outline" : "default"}
          className={cn("w-full gap-2", iAmSeated && "border-success text-success hover:text-success")}
        >
          {iAmSeated ? (
            <><CheckCircle2 className="w-4 h-4" /> Leave My Seat</>
          ) : (
            <><Users className="w-4 h-4" /> Take My Seat ({myPlayer.gamertag})</>
          )}
        </Button>
      )}

      {/* Player grid (read-only display) */}
      <div className="grid grid-cols-2 gap-2">
        {clubPlayers.map(player => {
          const isSeated = seatedPlayerIds.includes(player.id);
          const isMe = player.id === myPlayerId;
          return (
            <div
              key={player.id}
              className={cn(
                "p-2 rounded-lg border transition-all",
                isSeated
                  ? "bg-primary/15 border-primary/40"
                  : "bg-secondary/40 border-border opacity-50"
              )}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {player.gamertag}
                    {isMe && <span className="text-primary ml-1 text-[10px]">(You)</span>}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{player.position}</p>
                </div>
                <div className={cn(
                  "w-3 h-3 rounded-full mt-0.5 shrink-0",
                  isSeated ? "bg-success" : "bg-border"
                )} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
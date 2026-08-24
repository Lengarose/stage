import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { Users, AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function getAvailabilityFixtureIds(game) {
  return [
    game?.id,
    game?.source_fixture_id,
    game?.fixture_id,
    game?.related_fixture_id,
  ]
    .filter(Boolean)
    .map(String)
    .filter((id, index, ids) => ids.indexOf(id) === index);
}

export default function GameDayDressingRoom({ game, myClub, myPlayer, user, onSeatChange }) {
  const [clubPlayers, setClubPlayers] = useState([]);
  const [availablePlayerIds, setAvailablePlayerIds] = useState(new Set());
  const [seatedPlayerIds, setSeatedPlayerIds] = useState([]);
  const [dressingRoomId, setDressingRoomId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const matchStarted = game.status === "in_progress" || game.status === "completed";
  const myPlayerId = myPlayer?.id;
  const iAmSeated = seatedPlayerIds.includes(myPlayerId);
  const iAmAvailable = !!myPlayerId && availablePlayerIds.has(myPlayerId);

  function parseIds(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  useEffect(() => {
    async function load() {
      if (!myClub) { setLoading(false); return; }

      const availabilityFixtureIds = getAvailabilityFixtureIds(game);
      const [players, dressing, availabilityChunks] = await Promise.all([
        stageClient.entities.Player.filter({ club_id: myClub.id }),
        stageClient.entities.DressingRoom.filter({ match_id: game.id, club_id: myClub.id }),
        Promise.all(availabilityFixtureIds.map((fixtureId) =>
          stageClient.entities.ClubFixtureAvailability
            .filter({ club_id: myClub.id, fixture_id: fixtureId }, "-updated_date", 200)
            .catch(() => [])
        )),
      ]);
      const availabilityRows = availabilityChunks.flat();

      const availableIds = new Set((availabilityRows || [])
        .filter((row) => row.status === "available")
        .map((row) => row.player_id));
      setAvailablePlayerIds(availableIds);
      setClubPlayers((players || []).filter((player) => availableIds.has(player.id)));

      if (dressing.length > 0) {
        setSeatedPlayerIds(parseIds(dressing[0].seated_players).filter((id) => availableIds.has(id)));
        setDressingRoomId(dressing[0].id);
      }
      setLoading(false);
    }
    load();
  }, [game, myClub]);

  // Subscribe to real-time dressing room updates
  useEffect(() => {
    const unsub = stageClient.entities.DressingRoom.subscribe((event) => {
      if (String(event.data?.match_id) === String(game.id) && String(event.data?.club_id) === String(myClub?.id)) {
        setSeatedPlayerIds(parseIds(event.data.seated_players).filter((id) => availablePlayerIds.has(id)));
        if (event.data.id) setDressingRoomId(event.data.id);
      }
    }, { match_id: game.id });
    return () => unsub();
  }, [game.id, myClub, availablePlayerIds]);

  async function takeMySeat() {
    if (!myPlayerId || saving || matchStarted) return;
    if (!iAmAvailable) {
      setError("Mark yourself available for this fixture before taking a dressing-room seat.");
      return;
    }
    setSaving(true);
    setError(null);

    const newSeated = iAmSeated
      ? seatedPlayerIds.filter(id => id !== myPlayerId)
      : [...seatedPlayerIds, myPlayerId];
    const previousSeated = seatedPlayerIds;

    setSeatedPlayerIds(newSeated);

    try {
      if (dressingRoomId) {
        await stageClient.entities.DressingRoom.update(dressingRoomId, { seated_players: newSeated });
      } else {
        const created = await stageClient.entities.DressingRoom.create({
          match_id: game.id,
          club_id: myClub.id,
          seated_players: newSeated,
        });
        setDressingRoomId(created.id);
      }
      onSeatChange?.({ clubId: myClub.id, seatedPlayers: newSeated });
    } catch (err) {
      setSeatedPlayerIds(previousSeated);
      setError(err?.message || "Could not update your dressing-room seat.");
    } finally {
      setSaving(false);
    }
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
            Mark yourself available for this fixture first. Only available seated players receive ratings and stats.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
          {error}
        </div>
      )}

      {/* My seat button */}
      {myPlayer && !matchStarted && (
        <Button
          onClick={takeMySeat}
          disabled={saving || !iAmAvailable}
          variant={iAmSeated ? "outline" : "default"}
          className={cn("w-full gap-2", iAmSeated && "border-success text-success hover:text-success")}
        >
          {iAmSeated ? (
            <><CheckCircle2 className="w-4 h-4" /> Leave My Seat</>
          ) : !iAmAvailable ? (
            <><Lock className="w-4 h-4" /> Mark Available First</>
          ) : (
            <><Users className="w-4 h-4" /> Take My Seat ({myPlayer.gamertag})</>
          )}
        </Button>
      )}

      {/* Player grid (read-only display) */}
      <div className="grid grid-cols-2 gap-2">
        {clubPlayers.length === 0 && (
          <div className="col-span-2 rounded-lg border border-dashed border-border bg-secondary/20 p-3 text-center text-[11px] text-muted-foreground">
            No players have marked themselves available yet.
          </div>
        )}
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

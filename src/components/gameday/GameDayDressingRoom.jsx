import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { Users, AlertTriangle, CheckCircle2, Lock } from "lucide-react";
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

function getInitials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase() || "?";
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

  if (loading) return <div className="p-6 text-center text-xs uppercase tracking-widest text-white/45">Loading dressing room...</div>;

  if (!myClub) return <div className="p-6 text-center text-xs uppercase tracking-widest text-white/45">No club data available.</div>;

  const seatedCount = seatedPlayerIds.length;

  return (
    <div className="relative overflow-hidden border border-[#eef3fb]/26 bg-[#141a24] p-4 shadow-[inset_0_0_90px_rgba(0,0,0,0.46),0_0_34px_-24px_rgba(238,243,251,0.72)] [clip-path:polygon(18px_0,100%_0,calc(100%_-_18px)_100%,0_100%)] sm:p-5">
      <div className="pointer-events-none absolute inset-0 opacity-95">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(37,43,54,0.88),rgba(10,13,19,0.9)),radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.20),transparent_22%),radial-gradient(circle_at_74%_8%,rgba(216,222,232,0.26),transparent_26%)]" />
        <div className="absolute inset-x-0 top-0 h-36 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.08)_0_1px,transparent_1px_88px)]" />
        <div className="absolute left-6 right-6 top-14 h-24 bg-[linear-gradient(90deg,rgba(255,255,255,0.05),rgba(255,255,255,0.12),rgba(255,255,255,0.05))] blur-2xl" />
        <div className="absolute bottom-0 left-8 right-8 h-24 rounded-t-[40%] bg-[linear-gradient(90deg,rgba(255,255,255,0.08),rgba(216,222,232,0.18),rgba(142,238,255,0.08))] blur-xl" />
        <div className="absolute bottom-10 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.04)_0_38px,rgba(0,0,0,0.18)_38px_76px)]" />
      </div>

      <div className="relative space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-[#f8fbff]/40 bg-black/45 text-[#f8fbff] [clip-path:polygon(9px_0,100%_0,calc(100%_-_9px)_100%,0_100%)]">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="font-heading text-sm font-black uppercase tracking-[0.22em] text-white">Locker Room</p>
              <p className="mt-1 max-w-xl text-xs text-white/65">
                Only players who confirmed availability can take a seat before kickoff.
              </p>
            </div>
          </div>
          <span className="w-fit border border-white/20 bg-white/10 px-3 py-1.5 font-heading text-[10px] font-black uppercase tracking-[0.16em] text-white/85 [clip-path:polygon(8px_0,100%_0,calc(100%_-_8px)_100%,0_100%)]">
            {seatedCount}/{clubPlayers.length} seated
          </span>
        </div>

      {/* Match started lock */}
      {matchStarted && (
        <div className="flex items-center gap-2 border border-white/10 bg-black/50 px-3 py-2">
          <Lock className="h-3.5 w-3.5 shrink-0 text-white/45" />
          <p className="text-[11px] text-white/55">
            Dressing room is locked — match has started.
          </p>
        </div>
      )}

      {/* Rule reminder */}
      {!matchStarted && (
        <div className="flex items-center gap-2 border border-[#f8fbff]/25 bg-[#d8dee8]/10 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#f8fbff]" />
          <p className="text-[11px] text-[#edf3fb]">
            Mark yourself available for this fixture first. Only available seated players receive ratings and stats.
          </p>
        </div>
      )}

      {error && (
        <div className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
          {error}
        </div>
      )}

      {/* My seat button */}
      {myPlayer && !matchStarted && (
        <button
          type="button"
          onClick={takeMySeat}
          disabled={saving || !iAmAvailable}
          className={cn(
            "flex min-h-12 w-full items-center justify-center gap-2 border px-4 font-heading text-xs font-black uppercase tracking-[0.18em] transition-all [clip-path:polygon(14px_0,100%_0,calc(100%_-_14px)_100%,0_100%)]",
            iAmSeated
              ? "border-[#8eeeff]/50 bg-[#8eeeff]/10 text-[#baf7ff] hover:bg-[#8eeeff]/15"
              : iAmAvailable
                ? "border-[#f8fbff]/55 bg-gradient-to-r from-[#ffffff] via-[#f8fbff] to-[#aeb8c6] text-[#111827] hover:brightness-110"
                : "cursor-not-allowed border-white/10 bg-white/5 text-white/35"
          )}
        >
          {iAmSeated ? (
            <><CheckCircle2 className="h-4 w-4" /> Leave My Seat</>
          ) : !iAmAvailable ? (
            <><Lock className="h-4 w-4" /> Mark Available First</>
          ) : (
            <><Users className="h-4 w-4" /> Take My Seat ({myPlayer.gamertag})</>
          )}
        </button>
      )}

      {/* Player grid (read-only display) */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
        {clubPlayers.length === 0 && (
        <div className="col-span-full border border-dashed border-white/18 bg-white/[0.04] p-5 text-center text-[11px] uppercase tracking-widest text-white/55">
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
                "group relative min-h-[116px] overflow-hidden border p-3 transition-all [clip-path:polygon(12px_0,100%_0,calc(100%_-_12px)_100%,0_100%)]",
                isSeated
                  ? "border-[#f8fbff]/55 bg-[#d8dee8]/14 shadow-[0_0_24px_-14px_rgba(238,243,251,0.9)]"
                  : "border-white/12 bg-black/32 opacity-65"
              )}
            >
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),transparent_42%),radial-gradient(circle_at_18%_8%,rgba(255,255,255,0.10),transparent_28%),repeating-linear-gradient(90deg,transparent_0_42px,rgba(255,255,255,0.035)_42px_43px)]" />
              <div className="relative flex h-full flex-col justify-between gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-heading text-[12px] font-black uppercase tracking-[0.06em] text-white">
                    {player.gamertag}
                    {isMe && <span className="ml-1 text-[9px] text-[#00e5ff]">(You)</span>}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/45">{player.position || "Player"}</p>
                  </div>
                  <div className={cn(
                    "h-3 w-3 shrink-0 rounded-full border",
                    isSeated ? "border-[#8eeeff] bg-[#8eeeff] shadow-[0_0_12px_rgba(142,238,255,0.85)]" : "border-white/20 bg-white/10"
                  )} />
                </div>
                <div className="flex items-end justify-between gap-3">
                  <div className="h-12 w-12 overflow-hidden border border-white/15 bg-black/45 [clip-path:polygon(8px_0,100%_0,calc(100%_-_8px)_100%,0_100%)]">
                    {player.avatar_url ? (
                      <img src={player.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-heading text-sm font-black text-white/55">
                        {getInitials(player.gamertag)}
                      </div>
                    )}
                  </div>
                  <span className={cn(
                    "font-heading text-[10px] font-black uppercase tracking-[0.18em]",
                    isSeated ? "text-[#dbe4ef]" : "text-white/40"
                  )}>
                    {isSeated ? "Seat taken" : "Open seat"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

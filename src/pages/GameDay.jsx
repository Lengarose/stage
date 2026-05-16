import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Zap, X } from "lucide-react";
import GameDayCard from "@/components/gameday/GameDayCard";
import GameDayDetail from "@/components/gameday/GameDayDetail";

export default function GameDay() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);
  const [myClub, setMyClub] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [follows, setFollows] = useState([]);
  const [tournamentMap, setTournamentMap] = useState({});

  useEffect(() => {
    let userEmail = null;

    async function load() {
      const isAuthed = await stageClient.auth.isAuthenticated();
      if (!isAuthed) {
        setLoading(false);
        return;
      }

      const u = await stageClient.auth.me();
      setUser(u);
      userEmail = u.email;

      // Get player & club
      const [players, followData] = await Promise.all([
        stageClient.entities.Player.filter({ email: u.email }),
        stageClient.entities.Follow.filter({ follower_email: u.email }),
      ]);

      let club = null;
      if (players.length > 0) {
        const player = players[0];
        setMyPlayer(player);

        if (player.club_id) {
          const clubs = await stageClient.entities.Club.filter({ id: player.club_id });
          club = clubs[0] || null;
        }
      }

      // Club owners / away-side managers may not have player.club_id — still need myClub for Game Day tabs.
      if (!club && u.id) {
        const owned = await stageClient.entities.Club.filter({ user_id: u.id });
        club = owned[0] || null;
      }
      if (!club && u.email) {
        const byEmail = await stageClient.entities.Club.filter({ owner_email: u.email });
        club = byEmail[0] || null;
      }
      if (club) setMyClub(club);

      setFollows(followData || []);
      await loadGames(u.email, players[0]?.id, club?.id || players[0]?.club_id, followData);
      setLoading(false);
    }

    load();

    // Real-time subscription — keep live/active matches in the list
    const unsubMatch = stageClient.entities.Match.subscribe((event) => {
      if (!userEmail) return;
      setGames(prev => {
        if (event.type === "delete") {
          return prev.filter(m => m.id !== event.id);
        }
        const data = event.data;
        if (!data) return prev;

        // Drop forfeited matches entirely
        if (data.status === "forfeit") return prev.filter(m => m.id !== data.id);

        // Drop completed matches older than 24h
        if (data.status === "completed") {
          const updatedAt = data.updated_date ? new Date(data.updated_date) : null;
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          if (!updatedAt || updatedAt < oneDayAgo) {
            return prev.filter(m => m.id !== data.id);
          }
        }

        // Update existing or add new (for in_progress matches that just became live)
        const exists = prev.some(m => m.id === data.id);
        if (exists) {
          return prev.map(m => m.id === data.id ? data : m);
        }
        return [data, ...prev];
      });
    });

    return () => unsubMatch();
  }, []);

  async function loadGames(email, playerId, clubId, followData) {
    const followedClubIds = followData
      .filter(f => f.target_type === "club")
      .map(f => f.target_id);
    const followedPlayerIds = followData
      .filter(f => f.target_type === "player")
      .map(f => f.target_id);

    // Fetch all scheduled/in_progress matches then filter in JS
    // Fetch from multiple angles to cover both club and player matches
    const fetchPromises = [];

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Fetch my own matches (home + away) without status filter, then filter in JS
    // This avoids N×status queries and stays within rate limits
    if (clubId) {
      fetchPromises.push(
        stageClient.entities.Match.filter({ home_club_id: clubId }, "-scheduled_date", 50),
        stageClient.entities.Match.filter({ away_club_id: clubId }, "-scheduled_date", 50),
      );
    }
    if (playerId) {
      fetchPromises.push(
        stageClient.entities.Match.filter({ home_player_id: playerId }, "-scheduled_date", 50),
        stageClient.entities.Match.filter({ away_player_id: playerId }, "-scheduled_date", 50),
      );
    }

    // Followed clubs/players — only scheduled + live (fewer queries)
    for (const fcId of followedClubIds.slice(0, 3)) {
      fetchPromises.push(
        stageClient.entities.Match.filter({ home_club_id: fcId, status: "scheduled" }, "-scheduled_date", 5),
        stageClient.entities.Match.filter({ away_club_id: fcId, status: "scheduled" }, "-scheduled_date", 5),
        stageClient.entities.Match.filter({ home_club_id: fcId, status: "in_progress" }, "-scheduled_date", 5),
        stageClient.entities.Match.filter({ away_club_id: fcId, status: "in_progress" }, "-scheduled_date", 5),
      );
    }
    for (const fpId of followedPlayerIds.slice(0, 3)) {
      fetchPromises.push(
        stageClient.entities.Match.filter({ home_player_id: fpId, status: "scheduled" }, "-scheduled_date", 5),
        stageClient.entities.Match.filter({ away_player_id: fpId, status: "scheduled" }, "-scheduled_date", 5),
        stageClient.entities.Match.filter({ home_player_id: fpId, status: "in_progress" }, "-scheduled_date", 5),
        stageClient.entities.Match.filter({ away_player_id: fpId, status: "in_progress" }, "-scheduled_date", 5),
      );
    }

    const arrays = await Promise.all(fetchPromises);
    const matchMap = new Map();
    arrays.flat().forEach(m => matchMap.set(m.id, m));

    // Keep active matches + completed ones updated within last 24h; drop forfeit
    const relevantGames = Array.from(matchMap.values()).filter(m => {
      if (m.status === "forfeit") return false;
      if (m.status === "completed") {
        const updatedAt = m.updated_date ? new Date(m.updated_date) : null;
        return updatedAt && updatedAt.toISOString() > oneDayAgo;
      }
      return true;
    });

    setGames(relevantGames);

    // Build tournament lookup for competition labels — fetch all at once, not one per ID
    const tIds = [...new Set(
      relevantGames.map(m => m.tournament_id).filter(tid => tid && tid !== "ranked")
    )];
    if (tIds.length > 0) {
      const allTournaments = await stageClient.entities.Tournament.list("-created_date", 200);
      const tMap = {};
      allTournaments.forEach(t => { if (tIds.includes(t.id)) tMap[t.id] = t; });
      setTournamentMap(tMap);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-3 md:p-6">
      {/* Title */}
      <div className="mb-5 md:mb-8">
        <h1
          className="text-4xl md:text-5xl lg:text-6xl font-heading font-black text-foreground mb-1"
          style={{ transform: "skewX(-8deg)", letterSpacing: "-0.02em" }}
        >
          GAME DAY
        </h1>
        <p className="text-muted-foreground text-xs md:text-sm">
          {games.length} active or scheduled match{games.length !== 1 ? "es" : ""}
        </p>
      </div>

      {/* ── Desktop layout ── */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {games.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <Zap className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No scheduled games today</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Follow clubs and players to see their matches</p>
            </div>
          ) : (
            games.map(game => (
              <GameDayCard
                key={game.id}
                game={game}
                selected={selectedGame?.id === game.id}
                onClick={() => setSelectedGame(game)}
                myClub={myClub}
                myPlayer={myPlayer}
                tournament={tournamentMap[game.tournament_id]}
              />
            ))
          )}
        </div>
        <div className="lg:col-span-1">
          {selectedGame ? (
            <GameDayDetail
              game={selectedGame}
              myClub={myClub}
              myPlayer={myPlayer}
              user={user}
              onGameUpdate={(updated) => {
                setSelectedGame(updated);
                setGames(prev => prev.map(g => g.id === updated.id ? updated : g));
              }}
            />
          ) : (
            <div className="bg-card border border-border rounded-xl p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
              <Zap className="w-10 h-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">Select a game to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile / Tablet layout ── */}
      <div className="lg:hidden space-y-3">
        {games.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <Zap className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No scheduled games today</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Follow clubs and players to see their matches</p>
          </div>
        ) : (
          games.map(game => (
            <GameDayCard
              key={game.id}
              game={game}
              selected={false}
              onClick={() => setSelectedGame(game)}
              myClub={myClub}
              myPlayer={myPlayer}
              tournament={tournamentMap[game.tournament_id]}
            />
          ))
        )}
      </div>

      {/* ── Mobile slide-up detail panel ── */}
      {selectedGame && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedGame(null)}
          />
          {/* Panel */}
          <div className="relative bg-background rounded-t-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
            {/* Handle + header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border shrink-0">
              <div className="absolute left-1/2 -translate-x-1/2 top-2 w-10 h-1 rounded-full bg-border" />
              <p className="text-sm font-semibold text-foreground">Match Details</p>
              <button
              onClick={() => setSelectedGame(null)}
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
              <X className="w-4 h-4" />
              </button>
            </div>
            {/* Scrollable detail */}
            <div className="overflow-y-auto flex-1 p-3">
              <GameDayDetail
                game={selectedGame}
                myClub={myClub}
                myPlayer={myPlayer}
                user={user}
                onGameUpdate={(updated) => {
                  setSelectedGame(updated);
                  setGames(prev => prev.map(g => g.id === updated.id ? updated : g));
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
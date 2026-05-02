import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FollowedClubRow from "@/components/followback/FollowedClubRow";
import FollowedPlayerRow from "@/components/followback/FollowedPlayerRow";
import { Shield, UsersRound } from "lucide-react";

export default function FollowBack() {
  const [myPlayer, setMyPlayer] = useState(null);
  const [follows, setFollows] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const user = await base44.auth.me();
      if (!user) return;

      const [playerRes, followRes, scheduledRes, liveRes] = await Promise.all([
        base44.entities.Player.filter({ email: user.email }),
        base44.entities.Follow.filter({ follower_email: user.email }),
        base44.entities.Match.filter({ status: "scheduled" }, "-scheduled_date", 200),
        base44.entities.Match.filter({ status: "in_progress" }, "-scheduled_date", 50),
      ]);

      const player = playerRes[0];
      setMyPlayer(player);
      setFollows(followRes);
      setMatches([...liveRes, ...scheduledRes]);

      const clubFollows = followRes.filter(f => f.target_type === "club");
      const playerFollows = followRes.filter(f => f.target_type === "player");

      const [clubResults, playerResults] = await Promise.all([
        clubFollows.length > 0
          ? Promise.all(clubFollows.map(f => base44.entities.Club.filter({ id: f.target_id }).then(r => r[0])))
          : Promise.resolve([]),
        playerFollows.length > 0
          ? Promise.all(playerFollows.map(f => base44.entities.Player.filter({ id: f.target_id }).then(r => r[0])))
          : Promise.resolve([]),
      ]);

      setClubs(clubResults.filter(Boolean));
      setPlayers(playerResults.filter(Boolean));
      setLoading(false);
    }
    load();
  }, []);

  const today = new Date().toDateString();

  function getMatchForClub(clubId) {
    const liveMatch = matches.find(
      m => (m.home_club_id === clubId || m.away_club_id === clubId) && m.status === "in_progress"
    );
    if (liveMatch) return { match: liveMatch, isLive: true };

    const todayMatch = matches.find(m => {
      if (!m.scheduled_date) return false;
      return (
        (m.home_club_id === clubId || m.away_club_id === clubId) &&
        new Date(m.scheduled_date).toDateString() === today
      );
    });
    if (todayMatch) return { match: todayMatch, isLive: false };

    const upcoming = matches
      .filter(m => m.home_club_id === clubId || m.away_club_id === clubId)
      .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))[0];
    return upcoming ? { match: upcoming, isLive: false } : null;
  }

  function getMatchForPlayer(playerId) {
    const playerObj = players.find(p => p.id === playerId);
    if (!playerObj) return null;
    const clubId = playerObj.club_id;
    if (!clubId) return null;
    return getMatchForClub(clubId);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-heading uppercase tracking-widest text-foreground mb-6">Follow Back</h1>

      <Tabs defaultValue="clubs">
        <TabsList className="mb-6 bg-secondary border border-border">
          <TabsTrigger value="clubs" className="gap-2 uppercase tracking-wider text-xs">
            <Shield className="w-3.5 h-3.5" /> Clubs
          </TabsTrigger>
          <TabsTrigger value="players" className="gap-2 uppercase tracking-wider text-xs">
            <UsersRound className="w-3.5 h-3.5" /> Players
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clubs">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-secondary rounded-lg animate-pulse" />)}
            </div>
          ) : clubs.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-12">You're not following any clubs yet.</p>
          ) : (
            <div className="space-y-2">
              {clubs.map(club => (
                <FollowedClubRow key={club.id} club={club} matchData={getMatchForClub(club.id)} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="players">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-secondary rounded-lg animate-pulse" />)}
            </div>
          ) : players.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-12">You're not following any players yet.</p>
          ) : (
            <div className="space-y-2">
              {players.map(player => (
                <FollowedPlayerRow
                  key={player.id}
                  player={player}
                  matchData={getMatchForPlayer(player.id)}
                  allClubs={clubs}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
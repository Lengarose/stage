import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { searchClub } from "@/lib/eafcClient";
import { Search as SearchIcon, User, Shield, Swords, UserPlus, Trophy, Users, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Search() {
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [eafcClubs, setEafcClubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [platform, setPlatform] = useState("common-gen5");
  const [user, setUser] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);

  useEffect(() => {
    async function loadUser() {
      const u = await base44.auth.me();
      setUser(u);
      const pl = await base44.entities.Player.filter({ email: u.email });
      if (pl.length > 0) setMyPlayer(pl[0]);
    }
    loadUser();
  }, []);

  async function doSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    const q = query.toLowerCase();

    const [allPlayers, allClubs, eafcRes] = await Promise.all([
      base44.entities.Player.list("-overall_rating", 200),
      base44.entities.Club.list("-wins", 200),
      searchClub(query.trim(), platform).catch(() => null),
    ]);

    setPlayers(allPlayers.filter(p => p.gamertag?.toLowerCase().includes(q)));
    setClubs(allClubs.filter(c => c.name?.toLowerCase().includes(q) || c.tag?.toLowerCase().includes(q)));
    setEafcClubs(Array.isArray(eafcRes) ? eafcRes : []);
    setLoading(false);
  }

  async function sendChallenge(opponentClubId, opponentClubName) {
    if (!myPlayer?.club_id) return alert("You need to be in a club to challenge.");
    const myClub = await base44.entities.Club.filter({ id: myPlayer.club_id });
    const liveMatch = await base44.entities.LiveMatch.create({
      home_club_id: myPlayer.club_id,
      home_club_name: myClub[0]?.name || "Unknown",
      away_club_id: opponentClubId,
      away_club_name: opponentClubName,
      type: "friendly",
      home_score: 0,
      away_score: 0,
      status: "waiting",
      home_confirmed: false,
      away_confirmed: false,
      player_or_clubs: "clubs",
    });
    // Notify opponent club captains
    const opponentPlayers = await base44.entities.Player.filter({ club_id: opponentClubId });
    const captains = opponentPlayers.filter(p => p.club_roles?.some(r => ["president","captain"].includes(r)) || ["captain","vice-captain"].includes(p.role));
    const targets = captains.length > 0 ? captains : opponentPlayers;
    for (const p of targets) {
      await base44.entities.Notification.create({
        recipient_email: p.email,
        type: "invite",
        title: `⚔️ Challenge from ${myClub[0]?.name || "A club"}`,
        body: `${myClub[0]?.name || "A club"} has challenged ${opponentClubName} to a friendly match!`,
        link: `/live/${liveMatch.id}`,
        read: false,
      });
    }
    alert(`Challenge sent to ${opponentClubName}! A live match room has been created.`);
  }

  async function challengePlayer(player) {
    if (!myPlayer) return alert("You need a player profile to challenge.");
    if (player.email === myPlayer.email) return;
    const liveMatch = await base44.entities.LiveMatch.create({
      home_player_id: myPlayer.id,
      home_player_name: myPlayer.gamertag,
      away_player_id: player.id,
      away_player_name: player.gamertag,
      type: "friendly",
      home_score: 0,
      away_score: 0,
      status: "waiting",
      home_confirmed: false,
      away_confirmed: false,
      player_or_clubs: "player",
    });
    await base44.entities.Notification.create({
      recipient_email: player.email,
      type: "invite",
      title: `⚔️ Challenge from ${myPlayer.gamertag}`,
      body: `${myPlayer.gamertag} has challenged you to a Player vs Player match!`,
      link: `/live/${liveMatch.id}`,
      read: false,
    });
    alert(`Challenge sent to ${player.gamertag}! They'll see it in Live Matches.`);
  }

  async function inviteToClub(playerEmail, playerGamertag) {
    if (!myPlayer?.club_id) return;
    await base44.entities.Notification.create({
      recipient_email: playerEmail,
      type: "invite",
      title: `Club Invite from ${myPlayer.gamertag}`,
      body: `You've been invited to join a club!`,
      link: `/clubs/${myPlayer.club_id}`,
      related_id: myPlayer.club_id,
      read: false,
    });
    alert(`Invite sent to ${playerGamertag}!`);
  }

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="leading-relaxed text-3xl font-bold text-foreground">SEARCH</h1>
        <p className="text-sm text-muted-foreground">Find players and clubs</p>
      </div>

      {/* Platform selector + Search Bar */}
      <div className="flex gap-3">
        <select
          value={platform}
          onChange={e => setPlatform(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 shrink-0">
          <option value="common-gen5">PS5 / XSX</option>
          <option value="common-gen4">PS4 / XB1</option>
          <option value="nx">Switch</option>
        </select>
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && doSearch()}
            placeholder="Search players or clubs..."
            className="pl-10 bg-card border-border"
          />
        </div>
        <Button onClick={doSearch} className="bg-primary text-primary-foreground leading-relaxed shrink-0" disabled={loading}>
          {loading ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : "Search"}
        </Button>
      </div>

      {!searched ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <SearchIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Search for players or clubs by name</p>
        </div>
      ) : (
        <Tabs defaultValue="players" className="w-full">
          <TabsList className="bg-secondary border border-border mb-6">
            <TabsTrigger value="players" className="leading-relaxed">
              <User className="w-3.5 h-3.5 mr-1.5" /> Players ({players.length})
            </TabsTrigger>
            <TabsTrigger value="clubs" className="leading-relaxed">
              <Shield className="w-3.5 h-3.5 mr-1.5" /> My Clubs ({clubs.length})
            </TabsTrigger>
            <TabsTrigger value="eafc" className="leading-relaxed">
              <Trophy className="w-3.5 h-3.5 mr-1.5" /> EA FC ({eafcClubs.length})
            </TabsTrigger>
          </TabsList>

          {/* Players */}
          <TabsContent value="players">
            {players.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <User className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No players found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {players.map(p => (
                  <Link key={p.id} to={`/players/${p.id}`} className="block bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary/30 transition-all">
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center overflow-hidden shrink-0">
                      {p.avatar_url
                        ? <img src={p.avatar_url} alt={p.gamertag} className="w-full h-full object-cover" />
                        : <span className="leading-relaxed font-bold text-primary">{p.position}</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="leading-relaxed font-bold text-foreground">{p.gamertag}</p>
                      <p className="text-xs text-muted-foreground">{p.position} · {p.platform} · {p.matches_played || 0} matches</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-2">
                        <p className="leading-relaxed font-bold text-lg text-primary">{p.overall_rating}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">OVR</p>
                      </div>
                      {myPlayer && p.email !== user?.email && myPlayer.club_id && (
                        <>
                          <Button size="sm" onClick={e => { e.preventDefault(); inviteToClub(p.email, p.gamertag); }}
                            className="bg-primary/10 text-primary hover:bg-primary/20 border-0 text-xs">
                            <UserPlus className="w-3.5 h-3.5 mr-1" /> Invite
                          </Button>
                          {p.club_id && (
                            <Button size="sm" onClick={e => { e.preventDefault(); challengePlayer(p); }}
                              className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-0 text-xs">
                              <Swords className="w-3.5 h-3.5 mr-1" /> Challenge
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Clubs */}
          <TabsContent value="clubs">
            {clubs.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No clubs found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {clubs.map(c => (
                  <div key={c.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
                      {c.logo_url ? <img src={c.logo_url} alt={c.name} className="w-full h-full object-cover" /> : <Shield className="w-6 h-6 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="leading-relaxed font-bold text-foreground">{c.name} <span className="text-xs text-primary font-mono">[{c.tag}]</span></p>
                      <p className="text-xs text-muted-foreground">{c.platform} · {c.region} · {c.wins || 0}W {c.losses || 0}L</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {myPlayer && myPlayer.club_id !== c.id && (
                        <Button size="sm" onClick={() => sendChallenge(c.id, c.name)}
                          className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-0 text-xs">
                          <Swords className="w-3.5 h-3.5 mr-1" /> Challenge
                        </Button>
                      )}
                      <Link to={`/clubs/${c.id}`}>
                        <Button size="sm" variant="outline" className="border-border text-xs">View</Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

            {/* EA FC Clubs */}
            <TabsContent value="eafc">
              {eafcClubs.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-8 text-center">
                  <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No EA FC clubs found.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {eafcClubs.map((c, i) => (
                    <div key={c.clubId || i} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Trophy className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="leading-relaxed font-bold text-foreground">{c.name} {c.clubInfo?.clubAbbr && <span className="text-xs text-primary font-mono">[{c.clubInfo.clubAbbr}]</span>}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> {c.memberCount || 0} members</span>
                          <span className="text-xs text-muted-foreground">Div {c.divisionOffset || "?"}</span>
                          {c.seasons?.[0] && <span className="text-xs text-success">W{c.seasons[0].wins || 0} D{c.seasons[0].draws || 0} L{c.seasons[0].losses || 0}</span>}
                        </div>
                      </div>
                      <Link to={`/eafc?clubId=${c.clubId}&platform=${platform}&name=${encodeURIComponent(c.name || "")}`}>
                        <Button size="sm" className="bg-primary/10 text-primary hover:bg-primary/20 border-0 text-xs gap-1">
                          <ExternalLink className="w-3.5 h-3.5" /> View
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
          )}
          </div>
  );
}
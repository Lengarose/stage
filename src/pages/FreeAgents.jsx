import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { Link } from "react-router-dom";
import { User, Shield, Star, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const POSITIONS = ["All", "GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST", "CF"];
const PLATFORMS = ["All", "PlayStation", "Xbox", "PC"];

export default function FreeAgents() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("All");
  const [position, setPosition] = useState("All");
  const [myClub, setMyClub] = useState(null);
  const [user, setUser] = useState(null);
  const [invitedIds, setInvitedIds] = useState([]);

  useEffect(() => {
    async function load() {
      const u = await stageClient.auth.me();
      setUser(u);
      const [allPlayers, myPlayer, allClubs] = await Promise.all([
        stageClient.entities.Player.filter({ status: "free_agent" }),
        stageClient.entities.Player.filter({ email: u.email }),
        stageClient.entities.Club.list(null, 500),
      ]);
      const ownerEmails = new Set(allClubs.map(c => c.owner_email).filter(Boolean));
      // Only show players with no club AND who don't own a club
      const trueAgents = allPlayers.filter(p => !p.club_id && !ownerEmails.has(p.email));
      setPlayers(trueAgents);
      if (myPlayer[0]?.club_id) {
        const clubs = await stageClient.entities.Club.filter({ id: myPlayer[0].club_id });
        if (clubs[0]) setMyClub(clubs[0]);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function invite(player) {
    if (!myClub) return;
    await stageClient.entities.Notification.create({
      recipient_email: player.email,
      type: "invite",
      title: `${myClub.name} wants you!`,
      body: `You've been invited to join ${myClub.name} [${myClub.tag}]. Check your join requests.`,
      link: `/clubs/${myClub.id}`,
      related_id: myClub.id,
      read: false,
    });
    setInvitedIds(prev => [...prev, player.id]);
  }

  const filtered = players.filter(p => {
    if (search && !p.gamertag?.toLowerCase().includes(search.toLowerCase())) return false;
    if (platform !== "All" && p.platform !== platform) return false;
    if (position !== "All" && p.position !== position) return false;
    return true;
  });

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="leading-relaxed text-3xl font-bold text-foreground">Free Agent Board</h1>
        <p className="text-muted-foreground text-sm mt-1">Players looking for a club</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search gamertag..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-secondary border-border w-48"
        />
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger className="bg-secondary border-border w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={position} onValueChange={setPosition}>
          <SelectTrigger className="bg-secondary border-border w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <User className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No free agents found.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map(player => (
            <div key={player.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary/30 transition-all">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-secondary shrink-0">
                {player.avatar_url
                  ? <img src={player.avatar_url} alt={player.gamertag} className="w-full h-full object-cover" style={{ objectPosition: player.avatar_position || "50% 50%" }} />
                  : <div className="w-full h-full flex items-center justify-center"><User className="w-5 h-5 text-muted-foreground" /></div>}
              </div>
              <div className="flex-1 min-w-0">
                <Link to={`/players/${player.id}`} className="leading-relaxed font-bold text-foreground hover:text-primary transition-colors truncate block">
                  {player.gamertag}
                </Link>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-primary leading-relaxed font-bold">{player.position}</span>
                  <span className="text-xs text-muted-foreground">{player.platform}</span>
                  {player.overall_rating && (
                    <span className="flex items-center gap-0.5 text-xs text-warning leading-relaxed font-bold">
                      <Star className="w-3 h-3" />{player.overall_rating}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>⚽ {player.goals || 0}</span>
                  <span>🎯 {player.assists || 0}</span>
                  <span>🏅 {player.matches_played || 0}mp</span>
                </div>
              </div>
              {myClub && player.email !== user?.email && (
                <Button size="sm" variant="outline" onClick={() => !invitedIds.includes(player.id) && invite(player)}
                  className="border-primary/30 text-primary hover:bg-primary/10 shrink-0 text-xs gap-1">
                  <Send className="w-3 h-3" /> Invite
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
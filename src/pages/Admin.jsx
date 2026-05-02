import { useState, useEffect } from "react";
import TransferWindowPanel from "@/components/admin/TransferWindowPanel";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Shield, Swords, AlertTriangle, Users, Trophy, Check, X,
  ArrowLeft, Gavel, Flag, Ban, RefreshCw, Coins, Plus, Trash2,
  Newspaper, Upload, Building2, LogIn, Search, TrendingUp
} from "lucide-react";
import { COUNTRIES } from "../lib/countries";

// Real leagues per country (up to 3 tiers)
const COUNTRY_LEAGUES = {
  "AR": [
    { name: "Liga Profesional de Fútbol", teams: 28 },
    { name: "Primera Nacional", teams: 38 },
    { name: "Primera B Metropolitana", teams: 20 },
  ],
  "AU": [
    { name: "A-League Men", teams: 12 },
    { name: "NPL Australia", teams: 20 },
  ],
  "AT": [
    { name: "Admiral Bundesliga", teams: 12 },
    { name: "2. Liga", teams: 16 },
  ],
  "BE": [
    { name: "Jupiler Pro League", teams: 16 },
    { name: "Challenger Pro League", teams: 8 },
  ],
  "BR": [
    { name: "Brasileirão Série A", teams: 20 },
    { name: "Brasileirão Série B", teams: 20 },
    { name: "Brasileirão Série C", teams: 20 },
  ],
  "CA": [
    { name: "Canadian Premier League", teams: 8 },
    { name: "League1 Ontario", teams: 16 },
  ],
  "CL": [
    { name: "Primera División de Chile", teams: 16 },
    { name: "Primera B", teams: 16 },
  ],
  "CN": [
    { name: "Chinese Super League", teams: 16 },
    { name: "China League One", teams: 16 },
    { name: "China League Two", teams: 20 },
  ],
  "CO": [
    { name: "Categoría Primera A", teams: 20 },
    { name: "Categoría Primera B", teams: 16 },
  ],
  "HR": [
    { name: "Hrvatska nogometna liga (HNL)", teams: 10 },
    { name: "Prva NL", teams: 12 },
  ],
  "CZ": [
    { name: "Fortuna Liga", teams: 16 },
    { name: "Fortuna:Národní liga", teams: 16 },
  ],
  "DK": [
    { name: "Superliga", teams: 14 },
    { name: "1st Division", teams: 14 },
  ],
  "EG": [
    { name: "Egyptian Premier League", teams: 18 },
    { name: "Egyptian Second Division", teams: 20 },
  ],
  "FR": [
    { name: "Ligue 1", teams: 18 },
    { name: "Ligue 2", teams: 20 },
    { name: "National", teams: 18 },
  ],
  "DE": [
    { name: "Bundesliga", teams: 18 },
    { name: "2. Bundesliga", teams: 18 },
    { name: "3. Liga", teams: 20 },
  ],
  "GR": [
    { name: "Super League 1", teams: 16 },
    { name: "Super League 2", teams: 16 },
  ],
  "IE": [
    { name: "League of Ireland Premier Division", teams: 10 },
    { name: "League of Ireland First Division", teams: 10 },
  ],
  "IT": [
    { name: "Serie A", teams: 20 },
    { name: "Serie B", teams: 20 },
    { name: "Serie C", teams: 20 },
  ],
  "JP": [
    { name: "J1 League", teams: 20 },
    { name: "J2 League", teams: 22 },
    { name: "J3 League", teams: 20 },
  ],
  "MA": [
    { name: "Botola Pro D1", teams: 16 },
    { name: "Botola Pro D2", teams: 16 },
  ],
  "MX": [
    { name: "Liga MX", teams: 18 },
    { name: "Liga de Expansión MX", teams: 16 },
  ],
  "NL": [
    { name: "Eredivisie", teams: 18 },
    { name: "Eerste Divisie (Keuken Kampioen Divisie)", teams: 20 },
  ],
  "NG": [
    { name: "Nigeria Premier Football League", teams: 20 },
    { name: "Nigeria National League", teams: 20 },
  ],
  "NO": [
    { name: "Eliteserien", teams: 16 },
    { name: "1. divisjon", teams: 16 },
  ],
  "PL": [
    { name: "PKO BP Ekstraklasa", teams: 18 },
    { name: "1. Liga", teams: 18 },
    { name: "2. Liga", teams: 18 },
  ],
  "PT": [
    { name: "Primeira Liga", teams: 18 },
    { name: "Liga Portugal 2", teams: 18 },
    { name: "Liga 3", teams: 20 },
  ],
  "RU": [
    { name: "Russian Premier League", teams: 16 },
    { name: "Russian First League", teams: 20 },
    { name: "Russian Second League", teams: 20 },
  ],
  "SA": [
    { name: "Saudi Pro League", teams: 18 },
    { name: "Saudi First Division League", teams: 20 },
  ],
  "RS": [
    { name: "Serbian SuperLiga", teams: 16 },
    { name: "Serbian First League", teams: 16 },
  ],
  "ZA": [
    { name: "DStv Premiership", teams: 16 },
    { name: "Motsepe Foundation Championship", teams: 16 },
  ],
  "KR": [
    { name: "K League 1", teams: 12 },
    { name: "K League 2", teams: 13 },
  ],
  "ES": [
    { name: "La Liga", teams: 20 },
    { name: "La Liga 2", teams: 22 },
    { name: "Primera RFEF", teams: 20 },
  ],
  "SE": [
    { name: "Allsvenskan", teams: 16 },
    { name: "Superettan", teams: 16 },
    { name: "Division 1", teams: 16 },
  ],
  "CH": [
    { name: "Swiss Super League", teams: 12 },
    { name: "Swiss Challenge League", teams: 16 },
  ],
  "TR": [
    { name: "Süper Lig", teams: 19 },
    { name: "TFF First League", teams: 19 },
    { name: "TFF Second League", teams: 18 },
  ],
  "UA": [
    { name: "Ukrainian Premier League", teams: 16 },
    { name: "Ukrainian First League", teams: 16 },
  ],
  "AE": [
    { name: "UAE Pro League", teams: 14 },
    { name: "UAE First Division", teams: 12 },
  ],
  "GB": [
    { name: "Premier League", teams: 20 },
    { name: "EFL Championship", teams: 24 },
    { name: "EFL League One", teams: 24 },
  ],
  "US": [
    { name: "Major League Soccer (MLS)", teams: 29 },
    { name: "USL Championship", teams: 24 },
    { name: "USL League One", teams: 20 },
  ],
};

export default function Admin() {
  const [allowed, setAllowed] = useState(null);
  const [disputes, setDisputes] = useState([]);
  const [forfeits, setForfeits] = useState([]);
  const [players, setPlayers] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [clubSearch, setClubSearch] = useState("");
  const [tournamentSearch, setTournamentSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [resolveDialog, setResolveDialog] = useState(null);
  const [selectedWinner, setSelectedWinner] = useState("");
  const [creditsDialog, setCreditsDialog] = useState(null);
  const [creditsAmount, setCreditsAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  function takeControl(club) {
    localStorage.setItem('admin_takeover_club_id', club.id);
    navigate(`/clubs/${club.id}`);
  }

  // Tournament creation
  const [createTournamentOpen, setCreateTournamentOpen] = useState(false);
  const [tournamentForm, setTournamentForm] = useState({
    name: "", type: "knockout", participant_type: "club", platform: "PlayStation",
    region: "Global", country_code: "", max_teams: 8, start_date: "", description: "", prize_description: "",
    entry_credits: 50, win_credits: 200, custom_rules: "",
    prize_winner_stc: "", prize_runner_up_stc: "", prize_semi_final_stc: "", prize_participation_stc: "",
  });
  const [rulesFile, setRulesFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerColor, setBannerColor] = useState("#1e2a3a");
  const [adminTrophyFile, setAdminTrophyFile] = useState(null);
  const BANNER_COLORS = ["#1e2a3a","#1a3a1a","#3a1a0a","#3a1a1a","#2a1a3a","#1a253a","#2a2a2a","#2a2a0a","#0a2a2a","#3a0a2a"];

  // News creation
  const [newsForm, setNewsForm] = useState({ title: "", body: "", type: "app_update", image_url: "" });
  const [newsImageFile, setNewsImageFile] = useState(null);
  const [uploadingNews, setUploadingNews] = useState(false);

  const [adminProfile, setAdminProfile] = useState(null);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      if (u?.role !== "admin") { setAllowed(false); return; }
      setAllowed(true);
      setAdminProfile(u);
      await loadAll();
    });
  }, []);

  async function loadAll() {
    setLoading(true);
    const [disputedMatches, allPlayers, allTournaments, allClubs] = await Promise.all([
      base44.entities.Match.filter({ status: "disputed" }, "-updated_date", 50),
      base44.entities.Player.list("-created_date", 100),
      base44.entities.Tournament.list("-created_date", 200),
      base44.entities.Club.list("-created_date", 100),
    ]);
    const forfeitMatches = await base44.entities.Match.filter({ forfeit_status: "pending" }, "-updated_date", 50);
    setDisputes(disputedMatches.map(m => ({ ...m, _source: "tournament" })));
    setForfeits(forfeitMatches);
    setPlayers(allPlayers);
    setClubs(allClubs);
    setTournaments(allTournaments);
    setLoading(false);
  }

  async function resolveDispute() {
    if (!resolveDialog || !selectedWinner) return;
    setSaving(true);
    const m = resolveDialog.match;
    const isHome = selectedWinner === m.home_club_id || selectedWinner === m.home_club_name;
    const winnerId = isHome ? m.home_club_id : m.away_club_id;
    const winnerName = isHome ? m.home_club_name : m.away_club_name;
    await base44.entities.Match.update(m.id, { status: "completed", winner_club_id: winnerId, winner_club_name: winnerName, admin_notes: `Resolved by admin. Winner: ${winnerName}` });
    setResolveDialog(null); setSelectedWinner(""); setSaving(false);
    await loadAll();
  }

  async function resolveForfeit(matchId, approve) {
    const m = forfeits.find(f => f.id === matchId);
    if (!m) return;
    if (approve) {
      const winnerId = m.forfeit_claimed_by;
      const winnerName = winnerId === m.home_club_id ? m.home_club_name : m.away_club_name;
      await base44.entities.Match.update(matchId, { status: "forfeit", forfeit_status: "approved", winner_club_id: winnerId, winner_club_name: winnerName });
    } else {
      await base44.entities.Match.update(matchId, { forfeit_status: "rejected" });
    }
    setForfeits(prev => prev.filter(f => f.id !== matchId));
  }

  async function kickFromClub(playerId) {
    await base44.entities.Player.update(playerId, { club_id: null, role: "member", club_roles: ["member"], status: "free_agent" });
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, club_id: null, role: "member", club_roles: ["member"], status: "free_agent" } : p));
  }

  async function deleteClub(clubId) {
    if (!confirm("Are you sure you want to delete this club? This cannot be undone.")) return;
    await base44.entities.Club.delete(clubId);
    setClubs(prev => prev.filter(c => c.id !== clubId));
  }

  async function cancelTournament(tournamentId) {
    await base44.entities.Tournament.update(tournamentId, { status: "cancelled" });
    setTournaments(prev => prev.filter(t => t.id !== tournamentId));
  }

  async function createTournament() {
    setSaving(true);
    const user = adminProfile;
    let rules_file_url = "";
    let banner_url = "";
    if (rulesFile) {
      const res = await base44.integrations.Core.UploadFile({ file: rulesFile });
      rules_file_url = res.file_url;
    }
    if (bannerFile) {
      const res = await base44.integrations.Core.UploadFile({ file: bannerFile });
      banner_url = res.file_url;
    }
    let trophy_url = "";
    if (adminTrophyFile) {
      const res = await base44.integrations.Core.UploadFile({ file: adminTrophyFile });
      trophy_url = res.file_url;
    }
    await base44.entities.Tournament.create({
      ...tournamentForm,
      max_teams: Number(tournamentForm.max_teams),
      entry_credits: Number(tournamentForm.entry_credits),
      win_credits: Number(tournamentForm.win_credits),
      prize_winner_stc: Number(tournamentForm.prize_winner_stc) || 0,
      prize_runner_up_stc: Number(tournamentForm.prize_runner_up_stc) || 0,
      prize_semi_final_stc: Number(tournamentForm.prize_semi_final_stc) || 0,
      prize_participation_stc: Number(tournamentForm.prize_participation_stc) || 0,
      start_date: new Date(tournamentForm.start_date).toISOString(),
      organizer_email: user.email,
      creator_email: user.email,
      status: "registration",
      current_round: 1,
      registered_clubs: [],
      registered_players: [],
      rules_file_url,
      banner_url: banner_url || "",
      banner_color: !banner_url ? bannerColor : "",
      trophy_url,
    });
    setCreateTournamentOpen(false);
    setTournamentForm({ name: "", type: "knockout", participant_type: "club", platform: "PlayStation", region: "Global", country_code: "", max_teams: 8, start_date: "", description: "", prize_description: "", entry_credits: 50, win_credits: 200, custom_rules: "", prize_winner_stc: "", prize_runner_up_stc: "", prize_semi_final_stc: "", prize_participation_stc: "" });
    setRulesFile(null); setBannerFile(null); setBannerColor("#1e2a3a"); setAdminTrophyFile(null);
    setSaving(false);
    await loadAll();
  }

  async function postNews() {
    setUploadingNews(true);
    let image_url = newsForm.image_url;
    if (newsImageFile) {
      const res = await base44.integrations.Core.UploadFile({ file: newsImageFile });
      image_url = res.file_url;
    }
    await base44.entities.NewsItem.create({
      title: newsForm.title,
      body: newsForm.body,
      type: newsForm.type,
      image_url,
      published_at: new Date().toISOString(),
      is_featured: false,
    });
    setNewsForm({ title: "", body: "", type: "app_update", image_url: "" });
    setNewsImageFile(null);
    setUploadingNews(false);
    alert("News posted successfully!");
  }

  async function seedPressQuestions() {
    setSaving(true);
    const existing = await base44.entities.PressQuestion.list(null, 1);
    if (existing.length > 0) { alert("Press questions already seeded!"); setSaving(false); return; }
    const questions = [
      { question: "How do you rate your team's performance today?", answer_a: "Outstanding — we gave 100%", answer_b: "Decent, but we can improve", answer_c: "Disappointing overall", answer_d: "The result doesn't reflect the game", category: "performance" },
      { question: "What was the key moment of the match?", answer_a: "Our first goal changed everything", answer_b: "A great defensive block in the second half", answer_c: "The red card shifted the momentum", answer_d: "The penalty decision was crucial", category: "match" },
      { question: "How do you assess your opponent?", answer_a: "Very tough and well-organized", answer_b: "We expected more from them", answer_c: "They surprised us with their tactics", answer_d: "Respect to them — fair game", category: "opponent" },
      { question: "What's the message to your fans?", answer_a: "We play for you — thank you!", answer_b: "We'll work harder next time", answer_c: "Keep believing in us", answer_d: "Your support makes the difference", category: "fans" },
      { question: "How are you preparing for the next match?", answer_a: "Full focus on recovery and analysis", answer_b: "We'll fix the tactical issues we saw today", answer_c: "Confidence is high after this result", answer_d: "One game at a time — that's our motto", category: "preparation" },
      { question: "How would you describe the atmosphere in the dressing room?", answer_a: "Buzzing — everyone is pumped!", answer_b: "Calm and focused", answer_c: "Disappointed but determined", answer_d: "United — we face it together", category: "team" },
    ];
    await base44.entities.PressQuestion.bulkCreate(questions);
    alert("Press questions seeded successfully!");
    setSaving(false);
  }

  async function grantCredits() {
    if (!creditsDialog) return;
    setSaving(true);
    await base44.entities.Player.update(creditsDialog.id, { credits: (creditsDialog.credits || 0) + Number(creditsAmount) });
    setCreditsDialog(null); setCreditsAmount(0); setSaving(false);
    await loadAll();
  }

  const [clubStcDialog, setClubStcDialog] = useState(null);
  const [clubStcAmount, setClubStcAmount] = useState("");
  const [clubWageBudget, setClubWageBudget] = useState("");
  const [clubTransferBudget, setClubTransferBudget] = useState("");

  async function saveClubFinance() {
    if (!clubStcDialog) return;
    setSaving(true);
    const updates = {};
    if (clubStcAmount !== "") updates.stc = (clubStcDialog.stc || 0) + Number(clubStcAmount);
    if (clubWageBudget !== "") updates.wage_budget_stc = Number(clubWageBudget);
    if (clubTransferBudget !== "") updates.transfer_budget_stc = Number(clubTransferBudget);
    await base44.entities.Club.update(clubStcDialog.id, updates);
    setClubStcDialog(null); setClubStcAmount(""); setClubWageBudget(""); setClubTransferBudget(""); setSaving(false);
    await loadAll();
  }

  async function reseedLifestyle() {
    setSaving(true);
    await base44.functions.invoke("seedLifestyleItems", { force: true });
    setSaving(false);
    alert("Lifestyle items reseeded with correct pricing!");
  }

  if (allowed === null) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  if (!allowed) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
      <Shield className="w-12 h-12 text-destructive" />
      <p className="text-muted-foreground">Admin access required.</p>
      <Link to="/"><Button variant="outline">Go Home</Button></Link>
    </div>
  );

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground font-heading">ADMIN PANEL</h1>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll} className="ml-auto border-border gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <AdminStat icon={AlertTriangle} label="Disputes" value={disputes.length} color="text-destructive" />
        <AdminStat icon={Flag} label="Forfeit Requests" value={forfeits.length} color="text-warning" />
        <AdminStat icon={Users} label="Total Players" value={players.length} color="text-primary" />
        <AdminStat icon={Trophy} label="Tournaments" value={tournaments.filter(t => t.status !== "archived" && t.status !== "cancelled").length} color="text-success" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <Tabs defaultValue="disputes">
          <TabsList className="bg-secondary border border-border mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="disputes" className="gap-2">
              Disputes {disputes.length > 0 && <span className="px-1.5 py-0.5 rounded-full bg-destructive/20 text-destructive text-[10px]">{disputes.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="forfeits" className="gap-2">
              Forfeits {forfeits.length > 0 && <span className="px-1.5 py-0.5 rounded-full bg-warning/20 text-warning text-[10px]">{forfeits.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="players">Players</TabsTrigger>
            <TabsTrigger value="clubs">Clubs</TabsTrigger>
            <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
            <TabsTrigger value="news">Post News</TabsTrigger>
            <TabsTrigger value="transfers">Transfer Window</TabsTrigger>
          </TabsList>

          {/* Disputes */}
          <TabsContent value="disputes">
            {disputes.length === 0 ? (
              <EmptyState icon={AlertTriangle} text="No disputed matches." />
            ) : (
              <div className="space-y-3">
                {disputes.map(m => (
                  <div key={m.id} className="bg-card border border-destructive/20 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">DISPUTED</span>
                        <span className="text-xs text-muted-foreground">{m._source === "live" ? "Live Match" : "Tournament Match"}</span>
                      </div>
                      <p className="font-bold text-foreground">{m.home_club_name} vs {m.away_club_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Home submitted: {m.home_submitted_score || "?"} · Away submitted: {m.away_submitted_score || "?"}</p>
                    </div>
                    <Button onClick={() => { setResolveDialog({ match: m, type: m._source }); setSelectedWinner(""); }} className="bg-primary text-primary-foreground shrink-0 gap-2" size="sm">
                      <Gavel className="w-4 h-4" /> Resolve
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Forfeits */}
          <TabsContent value="forfeits">
            {forfeits.length === 0 ? (
              <EmptyState icon={Flag} text="No pending forfeit requests." />
            ) : (
              <div className="space-y-3">
                {forfeits.map(m => {
                  const claimerName = m.forfeit_claimed_by === m.home_club_id ? m.home_club_name : m.away_club_name;
                  return (
                    <div key={m.id} className="bg-card border border-warning/20 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1">
                        <p className="font-bold text-foreground">{m.home_club_name} vs {m.away_club_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Claimed by: <strong className="text-foreground">{claimerName}</strong></p>
                        {m.forfeit_proof_url && <a href={m.forfeit_proof_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline mt-1 block">View Proof</a>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" onClick={() => resolveForfeit(m.id, true)} className="bg-success/20 text-success hover:bg-success/30 border-0 gap-1"><Check className="w-4 h-4" /> Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => resolveForfeit(m.id, false)} className="border-destructive/30 text-destructive hover:bg-destructive/10 gap-1"><X className="w-4 h-4" /> Reject</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Players */}
          <TabsContent value="players">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={playerSearch} onChange={e => setPlayerSearch(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                placeholder="Search by gamertag..." />
            </div>
            <div className="space-y-2">
              {players.filter(p => p.gamertag?.toLowerCase().includes(playerSearch.toLowerCase())).map(p => (
                <div key={p.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 overflow-hidden">
                    {p.avatar_url ? <img src={p.avatar_url} alt={p.gamertag} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-primary">{(p.gamertag || "?")[0].toUpperCase()}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{p.gamertag}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.email} · {p.platform} · {p.position}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                    <Coins className="w-3.5 h-3.5 text-warning" />
                    <span>{(p.credits || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => { setCreditsDialog(p); setCreditsAmount(0); }} className="border-warning/30 text-warning hover:bg-warning/10 gap-1 text-xs"><Coins className="w-3.5 h-3.5" /> Credits</Button>

                    {p.club_id && <Button size="sm" variant="outline" onClick={() => kickFromClub(p.id)} className="border-destructive/30 text-destructive hover:bg-destructive/10 gap-1 text-xs"><Ban className="w-3.5 h-3.5" /> Kick</Button>}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Clubs */}
          <TabsContent value="clubs">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={clubSearch} onChange={e => setClubSearch(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                placeholder="Search by club name..." />
            </div>
            {clubs.length === 0 ? (
              <EmptyState icon={Building2} text="No clubs found." />
            ) : (
              <div className="space-y-2">
                {clubs.filter(c => c.name?.toLowerCase().includes(clubSearch.toLowerCase())).map(c => (
                  <div key={c.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 overflow-hidden">
                      {c.logo_url ? <img src={c.logo_url} alt={c.name} className="w-full h-full object-cover" /> : <Shield className="w-4 h-4 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{c.name} <span className="text-muted-foreground text-xs">[{c.tag}]</span></p>
                      <p className="text-xs text-muted-foreground truncate">{c.platform} · {c.region} · Owner: {c.owner_email}</p>
                    </div>
                    <div className="flex gap-2 shrink-0 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => takeControl(c)} className="border-warning/30 text-warning hover:bg-warning/10 gap-1 text-xs"><LogIn className="w-3.5 h-3.5" /> Take Control</Button>
                      <Button size="sm" variant="outline" onClick={() => { setClubStcDialog(c); setClubStcAmount(""); setClubWageBudget(c.wage_budget_stc || ""); setClubTransferBudget(c.transfer_budget_stc || ""); }} className="border-success/30 text-success hover:bg-success/10 gap-1 text-xs"><Coins className="w-3.5 h-3.5" /> Finance</Button>
                      <Link to={`/clubs/${c.id}`}><Button size="sm" variant="outline" className="border-border text-xs">View</Button></Link>
                      <Button size="sm" variant="outline" onClick={() => deleteClub(c.id)} className="border-destructive/30 text-destructive hover:bg-destructive/10 gap-1 text-xs"><Trash2 className="w-3.5 h-3.5" /> Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tournaments */}
          <TabsContent value="tournaments">
            <div className="mb-3 flex gap-3 flex-wrap">
              <Button onClick={() => setCreateTournamentOpen(true)} className="bg-primary text-primary-foreground gap-2 text-sm">
                <Plus className="w-4 h-4" /> Create Tournament
              </Button>
              <Button variant="outline" size="sm" onClick={seedPressQuestions} disabled={saving} className="border-primary/30 text-primary hover:bg-primary/10 text-xs gap-2">
                🎤 Seed Press Questions
              </Button>
              <Button variant="outline" size="sm" onClick={reseedLifestyle} disabled={saving} className="border-success/30 text-success hover:bg-success/10 text-xs gap-2">
                💰 Reseed Lifestyle Prices
              </Button>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={tournamentSearch} onChange={e => setTournamentSearch(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                placeholder="Search by tournament name..." />
            </div>
            {tournaments.length === 0 ? (
              <EmptyState icon={Trophy} text="No active tournaments." />
            ) : (
              <div className="space-y-3">
                {tournaments.filter(t => t.name?.toLowerCase().includes(tournamentSearch.toLowerCase()) && t.status !== "archived" && t.status !== "cancelled").map(t => (
                  <div key={t.id} className="bg-card border border-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <p className="font-bold text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t.type} · {t.platform} · Round {t.current_round}/{t.total_rounds || "?"} · {(t.registered_clubs || []).length} clubs
                      </p>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full border mt-1 inline-block",
                        t.status === "registration" ? "bg-primary/10 text-primary border-primary/20" :
                        t.status === "in_progress" ? "bg-success/10 text-success border-success/20" :
                        t.status === "completed" ? "bg-muted text-muted-foreground border-border" :
                        "bg-destructive/10 text-destructive border-destructive/20"
                      )}>{t.status}</span>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Link to={`/tournaments/${t.id}`}><Button size="sm" variant="outline" className="border-border text-muted-foreground text-xs">View</Button></Link>
                      <Button size="sm" variant="outline" onClick={() => cancelTournament(t.id)} className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs gap-1"><X className="w-3.5 h-3.5" /> Cancel</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Post News */}
          <TabsContent value="news">
            <div className="bg-card border border-border rounded-xl p-6 max-w-2xl space-y-4">
              <h3 className="font-bold text-foreground flex items-center gap-2"><Newspaper className="w-4 h-4 text-primary" /> Post News Update</h3>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Category</label>
                <Select value={newsForm.type} onValueChange={v => setNewsForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="app_update">App Update</SelectItem>
                    <SelectItem value="announcement">Announcement</SelectItem>
                    <SelectItem value="tournament">Tournament</SelectItem>
                    <SelectItem value="achievement">Achievement</SelectItem>
                    <SelectItem value="ranking">Rankings</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Title</label>
                <input value={newsForm.title} onChange={e => setNewsForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                  placeholder="News headline..." />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Body</label>
                <Textarea value={newsForm.body} onChange={e => setNewsForm(f => ({ ...f, body: e.target.value }))}
                  className="bg-secondary border-border min-h-[80px]" placeholder="News body text..." />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Image (optional)</label>
                <input type="file" accept="image/*" onChange={e => setNewsImageFile(e.target.files[0])} className="text-xs text-muted-foreground" />
                {newsImageFile && <p className="text-xs text-primary mt-1">Selected: {newsImageFile.name}</p>}
              </div>
              <Button onClick={postNews} disabled={!newsForm.title || uploadingNews} className="bg-primary text-primary-foreground gap-2">
                <Upload className="w-4 h-4" /> {uploadingNews ? "Posting..." : "Post News"}
              </Button>
            </div>
          </TabsContent>


          {/* Transfer Window */}
          <TabsContent value="transfers">
            <div className="max-w-2xl">
              <h3 className="font-bold text-foreground text-lg mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" /> Transfer Window Management
              </h3>
              <TransferWindowPanel />
            </div>
          </TabsContent>

        </Tabs>
      )}

      {/* Create Tournament Dialog */}
      <Dialog open={createTournamentOpen} onOpenChange={setCreateTournamentOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="leading-relaxed text-xl flex items-center gap-2"><Trophy className="w-5 h-5 text-primary" /> Create Tournament</DialogTitle></DialogHeader>
          <div className="space-y-5 mt-2">

            {/* Tournament For */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Tournament For</label>
              <div className="grid grid-cols-2 gap-3">
                {[{v:"club",icon:"🏟️",label:"Club Tournament",sub:"Clubs register & compete"},{v:"player",icon:"👤",label:"Player Tournament",sub:"Individual players register"}].map(opt => (
                  <button key={opt.v} onClick={() => setTournamentForm(f => ({ ...f, participant_type: opt.v }))}
                    className={cn("rounded-xl border p-3 text-left transition-all",
                      tournamentForm.participant_type === opt.v ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 bg-secondary"
                    )}>
                    <p className={cn("font-bold text-sm", tournamentForm.participant_type === opt.v ? "text-primary" : "text-foreground")}>{opt.icon} {opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Name</label>
              <input value={tournamentForm.name} onChange={e => setTournamentForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder="Tournament name..." />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Description</label>
              <Textarea value={tournamentForm.description} onChange={e => setTournamentForm(f => ({ ...f, description: e.target.value }))}
                className="bg-secondary border-border" placeholder="Tournament details..." />
            </div>

            {/* Type + Max Teams */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Type</label>
                <Select value={tournamentForm.type} onValueChange={v => {
                  const updates = { type: v };
                  if (v === 'swiss_ucl') updates.max_teams = 36;
                  setTournamentForm(f => ({ ...f, ...updates }));
                }}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="knockout">Knockout</SelectItem>
                    <SelectItem value="league">League</SelectItem>
                    <SelectItem value="group_stage">Group Stage</SelectItem>
                    <SelectItem value="double_elimination">Double Elimination</SelectItem>
                    <SelectItem value="swiss_ucl">⭐ Swiss System: UCL Version</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Max Teams</label>
                <Select value={String(tournamentForm.max_teams)} onValueChange={v => setTournamentForm(f => ({ ...f, max_teams: Number(v) }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[4, 8, 16, 20, 32, 36, 64].map(n => <SelectItem key={n} value={String(n)}>{n} Teams</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Platform + Start Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Platform</label>
                <Select value={tournamentForm.platform} onValueChange={v => setTournamentForm(f => ({ ...f, platform: v }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PlayStation">PlayStation</SelectItem>
                    <SelectItem value="Xbox">Xbox</SelectItem>
                    <SelectItem value="PC">PC</SelectItem>
                    <SelectItem value="Cross-Platform">Cross-Platform</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Start Date</label>
                <input type="datetime-local" value={tournamentForm.start_date} onChange={e => setTournamentForm(f => ({ ...f, start_date: e.target.value }))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" />
              </div>
            </div>

            {/* Entry + Win Credits */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Entry Credits</label>
                <input type="number" min="0" value={tournamentForm.entry_credits} onChange={e => setTournamentForm(f => ({ ...f, entry_credits: e.target.value }))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Win Credits</label>
                <input type="number" min="0" value={tournamentForm.win_credits} onChange={e => setTournamentForm(f => ({ ...f, win_credits: e.target.value }))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" />
                <p className="text-[10px] text-muted-foreground mt-1">4× entry credits recommended</p>
              </div>
            </div>

            {/* Region */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Region</label>
              <Select value={tournamentForm.region} onValueChange={v => setTournamentForm(f => ({ ...f, region: v }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Europe","North America","South America","Asia","Oceania","Africa","Middle East","Global"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Country Restriction */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Country Restriction <span className="text-muted-foreground normal-case font-normal">(optional)</span></label>
              <Select value={tournamentForm.country_code || "none"} onValueChange={v => setTournamentForm(f => ({ ...f, country_code: v === "none" ? "" : v }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="All countries" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">🌍 All countries (open)</SelectItem>
                  {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {tournamentForm.country_code && <p className="text-xs text-warning mt-1">⚠️ Only clubs from this country can register.</p>}
            </div>

            {/* League / Competition Picker */}
            {tournamentForm.country_code && COUNTRY_LEAGUES[tournamentForm.country_code] && (
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                  🏆 League / Competition <span className="normal-case font-normal">(optional — auto-fills name & teams)</span>
                </label>
                <div className="space-y-2">
                  {COUNTRY_LEAGUES[tournamentForm.country_code].map((league, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setTournamentForm(f => ({
                        ...f,
                        name: league.name,
                        max_teams: [4, 8, 16, 20, 32, 36, 64].includes(league.teams) ? league.teams : 20,
                      }))}
                      className={cn(
                        "w-full rounded-xl border px-4 py-3 text-left transition-all",
                        tournamentForm.name === league.name
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-secondary hover:border-primary/40 text-foreground"
                      )}
                    >
                      <span className="font-semibold text-sm">{league.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">({league.teams} teams → sets Max Teams to {[4, 8, 16, 20, 32, 36, 64].includes(league.teams) ? league.teams : 20})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Rules */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">📋 Custom Rules (optional)</label>
              <Textarea value={tournamentForm.custom_rules} onChange={e => setTournamentForm(f => ({ ...f, custom_rules: e.target.value }))}
                className="bg-secondary border-border min-h-[80px]" placeholder="Enter your tournament-specific rules here..." />
              <p className="text-xs text-muted-foreground mt-2 mb-1">Or upload a rules document (PDF or image):</p>
              <label className="flex flex-col items-center justify-center border border-dashed border-border rounded-xl p-4 cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">{rulesFile ? rulesFile.name : "Drop or click to upload rules file (PDF / image)"}</span>
                <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => setRulesFile(e.target.files[0])} />
              </label>
            </div>

            {/* Prize */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Prize Description (optional)</label>
              <input value={tournamentForm.prize_description} onChange={e => setTournamentForm(f => ({ ...f, prize_description: e.target.value }))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder="e.g. Bragging rights + custom badge" />
            </div>

            {/* Prize Pool STC */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground uppercase tracking-wider block">🏆 Prize Pool (STC) — paid automatically on completion</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "prize_winner_stc",        label: "🥇 Winner",       placeholder: "5000000" },
                  { key: "prize_runner_up_stc",      label: "🥈 Runner-Up",    placeholder: "2000000" },
                  { key: "prize_semi_final_stc",     label: "🥉 Semi-Final",   placeholder: "500000"  },
                  { key: "prize_participation_stc",  label: "🎖️ Participation", placeholder: "100000" },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">{f.label}</label>
                    <input type="number" min="0" value={tournamentForm[f.key] || ""}
                      onChange={e => setTournamentForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                      placeholder={f.placeholder} />
                  </div>
                ))}
              </div>
            </div>

            {/* Tournament Banner */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Tournament Banner</label>
              <label className="flex flex-col items-center justify-center border border-dashed border-border rounded-xl p-5 cursor-pointer hover:border-primary/50 transition-colors mb-3">
                <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">{bannerFile ? bannerFile.name : "Upload custom banner"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => setBannerFile(e.target.files[0])} />
              </label>
              {!bannerFile && (
                <>
                  <p className="text-xs text-muted-foreground mb-2">Or pick a color banner:</p>
                  <div className="flex flex-wrap gap-2">
                    {BANNER_COLORS.map(color => (
                      <button key={color} onClick={() => setBannerColor(color)}
                        style={{ background: color }}
                        className={cn("w-9 h-9 rounded-lg border-2 transition-all",
                          bannerColor === color ? "border-primary scale-110" : "border-transparent hover:border-primary/50"
                        )}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Trophy Upload */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">🏆 Tournament Trophy (PNG only)</label>
              {adminTrophyFile ? (
                <div className="flex items-center gap-3 bg-warning/10 border border-warning/20 rounded-xl p-3">
                  <img src={URL.createObjectURL(adminTrophyFile)} alt="trophy" className="w-12 h-12 object-contain" />
                  <span className="text-xs text-warning flex-1 truncate">{adminTrophyFile.name}</span>
                  <button onClick={() => setAdminTrophyFile(null)} className="text-muted-foreground hover:text-destructive">✕</button>
                </div>
              ) : (
                <label className="w-full h-20 rounded-xl border-2 border-dashed border-warning/30 hover:border-warning/60 flex flex-col items-center justify-center gap-1 text-warning/60 hover:text-warning transition-colors cursor-pointer">
                  <Trophy className="w-6 h-6" />
                  <span className="text-xs">Upload trophy image (PNG only)</span>
                  <input type="file" accept="image/png" className="hidden" onChange={e => e.target.files[0] && setAdminTrophyFile(e.target.files[0])} />
                </label>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">This trophy will be awarded to the winner's cabinet.</p>
            </div>

            <Button onClick={createTournament} disabled={!tournamentForm.name || !tournamentForm.start_date || saving}
              className="w-full bg-primary text-primary-foreground gap-2 py-3">
              <Trophy className="w-4 h-4" /> {saving ? "Creating..." : "Create Tournament"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resolve Dispute Dialog */}
      <Dialog open={!!resolveDialog} onOpenChange={() => { setResolveDialog(null); setSelectedWinner(""); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="leading-relaxed text-xl flex items-center gap-2"><Gavel className="w-5 h-5 text-primary" /> Resolve Dispute</DialogTitle></DialogHeader>
          {resolveDialog && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground"><strong className="text-foreground">{resolveDialog.match.home_club_name}</strong> vs <strong className="text-foreground">{resolveDialog.match.away_club_name}</strong></p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-secondary rounded-lg p-3 text-center">
                  <p className="text-muted-foreground text-xs mb-1">Home submitted</p>
                  <p className="font-bold text-foreground">{resolveDialog.match.home_submitted_score || "Not submitted"}</p>
                </div>
                <div className="bg-secondary rounded-lg p-3 text-center">
                  <p className="text-muted-foreground text-xs mb-1">Away submitted</p>
                  <p className="font-bold text-foreground">{resolveDialog.match.away_submitted_score || "Not submitted"}</p>
                </div>
              </div>
              {(resolveDialog.match.proof_url || resolveDialog.match.forfeit_proof_url) && (
                <a href={resolveDialog.match.proof_url || resolveDialog.match.forfeit_proof_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">📎 View Submitted Proof</a>
              )}
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Award Win To</label>
                <Select value={selectedWinner} onValueChange={setSelectedWinner}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select winner..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={resolveDialog.match.home_club_id}>{resolveDialog.match.home_club_name} (Home)</SelectItem>
                    <SelectItem value={resolveDialog.match.away_club_id}>{resolveDialog.match.away_club_name} (Away)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={resolveDispute} disabled={!selectedWinner || saving} className="w-full bg-primary text-primary-foreground leading-relaxed gap-2">
                <Gavel className="w-4 h-4" /> {saving ? "Saving..." : "Confirm Resolution"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Club Finance Dialog */}
      <Dialog open={!!clubStcDialog} onOpenChange={() => setClubStcDialog(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="leading-relaxed text-xl flex items-center gap-2"><Coins className="w-5 h-5 text-success" /> Club Finance — {clubStcDialog?.name}</DialogTitle></DialogHeader>
          {clubStcDialog && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-secondary rounded-lg p-2">
                  <p className="text-muted-foreground">Balance</p>
                  <p className="font-bold text-success">{((clubStcDialog.stc||0)/1_000_000).toFixed(2)}M</p>
                </div>
                <div className="bg-secondary rounded-lg p-2">
                  <p className="text-muted-foreground">Wage Budget</p>
                  <p className="font-bold text-warning">{((clubStcDialog.wage_budget_stc||0)/1_000_000).toFixed(2)}M</p>
                </div>
                <div className="bg-secondary rounded-lg p-2">
                  <p className="text-muted-foreground">Transfer Budget</p>
                  <p className="font-bold text-primary">{((clubStcDialog.transfer_budget_stc||0)/1_000_000).toFixed(2)}M</p>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Add STC Balance (e.g. 5000000 = 5M)</label>
                <input type="number" value={clubStcAmount} onChange={e => setClubStcAmount(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder="e.g. 10000000" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Set Weekly Wage Budget (STC)</label>
                <input type="number" value={clubWageBudget} onChange={e => setClubWageBudget(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder="e.g. 2000000" />
                <p className="text-[10px] text-muted-foreground mt-1">Recommended: 1M–5M/wk for a standard club</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Set Transfer Budget (STC)</label>
                <input type="number" value={clubTransferBudget} onChange={e => setClubTransferBudget(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder="e.g. 20000000" />
                <p className="text-[10px] text-muted-foreground mt-1">Recommended: 5M–50M for a standard club</p>
              </div>
              <Button onClick={saveClubFinance} disabled={saving || (clubStcAmount === "" && clubWageBudget === "" && clubTransferBudget === "")} className="w-full bg-success/20 text-success hover:bg-success/30 border border-success/40">
                {saving ? "Saving..." : "Save Club Finance"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Grant Credits Dialog */}
      <Dialog open={!!creditsDialog} onOpenChange={() => setCreditsDialog(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="leading-relaxed text-xl flex items-center gap-2"><Coins className="w-5 h-5 text-warning" /> Grant Credits</DialogTitle></DialogHeader>
          {creditsDialog && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">Player: <strong className="text-foreground">{creditsDialog.gamertag}</strong></p>
              <p className="text-sm text-muted-foreground">Current balance: <strong className="text-warning">{(creditsDialog.credits || 0).toLocaleString()} credits</strong></p>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Amount to Add</label>
                <input type="number" value={creditsAmount} onChange={e => setCreditsAmount(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder="e.g. 500" />
              </div>
              <Button onClick={grantCredits} disabled={!creditsAmount || saving} className="w-full bg-warning/20 text-warning hover:bg-warning/30 border border-warning/40 leading-relaxed">
                {saving ? "Saving..." : `Add ${Number(creditsAmount).toLocaleString()} Credits`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminStat({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 text-center">
      <Icon className={cn("w-5 h-5 mx-auto mb-1.5", color)} />
      <p className={cn("font-bold text-2xl", color)}>{value}</p>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="bg-card border border-border rounded-xl p-10 text-center">
      <Icon className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
      <p className="text-muted-foreground text-sm">{text}</p>
    </div>
  );
}
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { stageClient } from "@/api/stageClient";
import { Shield, Search, Plus, ArrowRight, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { COUNTRIES, COUNTRY_REGIONS } from "@/lib/countries";

const REGIONS = ["Europe", "North America", "South America", "Asia", "Oceania", "Africa", "Middle East"];

export default function ClubOnboardingModal({ open, player, onComplete }) {
  const [step, setStep] = useState("choose"); // choose | create | join
  const [creating, setCreating] = useState(false);
  const [requesting, setRequesting] = useState(null);
  const [requested, setRequested] = useState(new Set());
  const [clubs, setClubs] = useState([]);
  const [search, setSearch] = useState("");
  const [loadingClubs, setLoadingClubs] = useState(false);

  const [form, setForm] = useState({
    name: "", tag: "", platform: player?.platform || "PlayStation",
    region: "Europe", country_code: "", description: "",
  });

  useEffect(() => {
    if (step === "join") loadClubs();
  }, [step]);

  async function loadClubs(q = "") {
    setLoadingClubs(true);
    const all = await stageClient.entities.Club.list("-rating", 100);
    const filtered = q
      ? all.filter(c => c.name?.toLowerCase().includes(q.toLowerCase()) || c.tag?.toLowerCase().includes(q.toLowerCase()))
      : all;
    setClubs(filtered.filter(c => c.status !== "disbanded"));
    setLoadingClubs(false);
  }

  async function handleCreate() {
    if (!form.name || !form.tag || !form.country_code) return;
    setCreating(true);
    try {
      const u = await stageClient.auth.me();
      const club = await stageClient.entities.Club.create({
        user_id: u?.id,
        owner_email: u?.email,
        name: form.name,
        tag: form.tag.toUpperCase(),
        platform: form.platform,
        region: form.region,
        country_code: form.country_code,
        description: form.description || "",
        logo_url: null,
        wins: 0, losses: 0, draws: 0, goals_scored: 0, goals_conceded: 0,
        rating: 1500, peak_rating: 1500, matches_ranked: 0, is_provisional: 1,
        trophies: 0, credits: 0, stc: 30000000,
        wage_budget_stc: 5000000, transfer_budget_stc: 10000000,
        stadium_level: 0, stadium_capacity: 5000,
        tier: "Silver", win_streak: 0, loss_streak: 0, status: "active",
      });
      if (!club?.id) throw new Error("Server returned no club ID");
      if (player?.id) {
        await stageClient.entities.Player.update(player.id, {
          club_id: club.id,
          club_roles: ["president", "captain"],
          role: "captain",
        });
      }
      onComplete?.(club);
    } catch (err) {
      console.error("Club creation failed:", err);
      alert("Failed to create club: " + (err?.message || err));
    } finally {
      setCreating(false);
    }
  }

  async function handleJoinRequest(club) {
    if (!player) return;
    setRequesting(club.id);
    await stageClient.entities.JoinRequest.create({
      player_id: player.id,
      player_email: player.email,
      player_gamertag: player.gamertag,
      club_id: club.id,
      club_name: club.name,
      message: "I'd like to join your club!",
      status: "pending",
    });
    // Notify club owner
    if (club.owner_email) {
      await stageClient.entities.Notification.create({
        recipient_email: club.owner_email,
        type: "join_request",
        title: `${player.gamertag} wants to join ${club.name}`,
        body: "Check your Profile → Join Requests to respond.",
        link: "/profile",
        read: false,
      });
    }
    setRequested(prev => new Set([...prev, club.id]));
    setRequesting(null);
  }

  const filteredClubs = search
    ? clubs.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()) || c.tag?.toLowerCase().includes(search.toLowerCase()))
    : clubs;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Shield className="w-5 h-5 text-primary" />
            {step === "choose" && "Join or Create a Club"}
            {step === "create" && "Create Your Club"}
            {step === "join" && "Find a Club to Join"}
          </DialogTitle>
        </DialogHeader>

        {/* CHOOSE */}
        {step === "choose" && (
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">Welcome to STAGE, <strong className="text-foreground">{player?.gamertag}</strong>! Do you want to create your own club or join an existing one?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setStep("create")}
                className="bg-primary/10 border border-primary/30 hover:border-primary/60 rounded-2xl p-5 text-left transition-all group"
              >
                <Plus className="w-8 h-8 text-primary mb-3" />
                <p className="font-bold text-foreground text-base">Create Club</p>
                <p className="text-xs text-muted-foreground mt-1">Start your own club and become the president</p>
              </button>
              <button
                onClick={() => setStep("join")}
                className="bg-secondary border border-border hover:border-primary/40 rounded-2xl p-5 text-left transition-all group"
              >
                <Search className="w-8 h-8 text-muted-foreground group-hover:text-primary mb-3 transition-colors" />
                <p className="font-bold text-foreground text-base">Join Club</p>
                <p className="text-xs text-muted-foreground mt-1">Browse clubs and send a join request</p>
              </button>
            </div>
            <Button variant="ghost" onClick={() => onComplete?.(null)} className="w-full text-muted-foreground text-sm">
              Skip for now
            </Button>
          </div>
        )}

        {/* CREATE */}
        {step === "create" && (
          <div className="space-y-4 mt-2">
            <button onClick={() => setStep("choose")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              ← Back
            </button>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Club Name *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="FC Example" className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Tag (max 5 chars) *</label>
              <Input value={form.tag} maxLength={5} onChange={e => setForm(f => ({ ...f, tag: e.target.value.toUpperCase() }))} placeholder="FCE" className="bg-secondary border-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Platform</label>
                <Select value={form.platform} onValueChange={v => setForm(f => ({ ...f, platform: v }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PlayStation">PlayStation</SelectItem>
                    <SelectItem value="Xbox">Xbox</SelectItem>
                    <SelectItem value="PC">PC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Region</label>
                <Select value={form.region} onValueChange={v => setForm(f => ({ ...f, region: v, country_code: "" }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Country *</label>
              <Select value={form.country_code} onValueChange={v => setForm(f => ({ ...f, country_code: v }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES
                    .filter(c => !form.region || (COUNTRY_REGIONS[form.region] || []).includes(c.code))
                    .map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Club Description</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Tell players about your club..." className="bg-secondary border-border resize-none h-20" />
            </div>
            <Button
              onClick={handleCreate}
              disabled={creating || !form.name || !form.tag || !form.country_code}
              className="w-full bg-primary text-primary-foreground"
            >
              {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : <><Shield className="w-4 h-4 mr-2" /> Create Club</>}
            </Button>
          </div>
        )}

        {/* JOIN */}
        {step === "join" && (
          <div className="space-y-4 mt-2">
            <button onClick={() => setStep("choose")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              ← Back
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by club name or tag..."
                className="pl-9 bg-secondary border-border"
              />
            </div>
            {loadingClubs && <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {filteredClubs.length === 0 && !loadingClubs && (
                <p className="text-sm text-muted-foreground text-center py-6">No clubs found.</p>
              )}
              {filteredClubs.map(c => {
                const isRequested = requested.has(c.id);
                return (
                  <div key={c.id} className="bg-secondary border border-border rounded-xl p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
                      {c.logo_url ? <img src={c.logo_url} alt={c.name} className="w-full h-full object-cover" /> : <Shield className="w-5 h-5 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground text-sm truncate">{c.name} <span className="text-primary font-mono text-xs">[{c.tag}]</span></p>
                      <p className="text-xs text-muted-foreground">{c.platform} · {c.region} · Rating {c.rating || 1000}</p>
                    </div>
                    <Button
                      size="sm"
                      disabled={isRequested || requesting === c.id}
                      onClick={() => handleJoinRequest(c)}
                      className={cn("shrink-0 text-xs", isRequested ? "bg-success/20 text-success border border-success/30" : "bg-primary/10 text-primary hover:bg-primary/20 border-0")}
                    >
                      {requesting === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : isRequested ? <><Check className="w-3 h-3 mr-1" /> Sent</> : <>Request <ArrowRight className="w-3 h-3 ml-1" /></>}
                    </Button>
                  </div>
                );
              })}
            </div>
            {requested.size > 0 && (
              <Button onClick={() => onComplete?.(null)} className="w-full bg-primary text-primary-foreground">
                Done — {requested.size} request{requested.size > 1 ? "s" : ""} sent
              </Button>
            )}
            <Button variant="ghost" onClick={() => onComplete?.(null)} className="w-full text-muted-foreground text-sm">
              Skip for now
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
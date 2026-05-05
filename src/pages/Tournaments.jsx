import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from '@/hooks/useTranslation';
import { stageClient } from "@/api/stageClient";
import { Trophy, Plus, Calendar, Users, Crown, Upload, X, BookOpen } from "lucide-react";
import { COUNTRIES } from "../lib/countries";
import ImagePositionEditor from "../components/ImagePositionEditor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TournamentCountdown from "../components/TournamentCountdown";
import { cn } from "@/lib/utils";

export default function Tournaments() {
  const { t } = useTranslation();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rulesType, setRulesType] = useState("knockout");
  const [canCreate, setCanCreate] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [myPlayer, setMyPlayer] = useState(null);
  const [tournamentLimit, setTournamentLimit] = useState(0);
  const [myActiveCount, setMyActiveCount] = useState(0);
  const [form, setForm] = useState({
    name: "", description: "", type: "knockout", platform: "PlayStation",
    region: "Global", country_code: "", max_teams: "8", prize_description: "", start_date: "", entry_credits: "50",
    entry_fee_stc: "0",
    banner_url: "", banner_color: "#1a2a4a", banner_position: "50% 50%",
    participant_type: "club", custom_rules: "", rules_file_url: "",
  });
  const [uploadingRules, setUploadingRules] = useState(false);
  const rulesFileRef = useRef(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [posEditorOpen, setPosEditorOpen] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const bannerInputRef = useRef(null);
  const [trophyFile, setTrophyFile] = useState(null);
  const trophyInputRef = useRef(null);

  const NEUTRAL_COLORS = [
    "#1a2a4a", "#0d2d1a", "#2d1a0d", "#2d0d1a", "#1a0d2d",
    "#0d1a2d", "#1a1a1a", "#2d2200", "#002d2d", "#1a001a",
  ];

  useEffect(() => {
    async function load() {
      const isAuthed = await stageClient.auth.isAuthenticated();
      if (!isAuthed) { setLoading(false); return; }
      const [data, user] = await Promise.all([
        stageClient.entities.Tournament.list("-created_date", 100),
        stageClient.auth.me(),
      ]);
      setTournaments(data);
      if (user.role === "admin") {
        setCanCreate(true);
        setIsVerified(true);
      } else {
        const players = await stageClient.entities.Player.filter({ email: user.email });
        const player = players[0];
        setMyPlayer(player);
        const tier = player?.subscription || "rookie";
        const allowed = ["pro", "elite"].includes(tier);
        const limit = tier === "elite" ? 6 : tier === "pro" ? 3 : 0;
        const activeCount = data.filter(t =>
          t.organizer_email === user.email &&
          ["registration", "in_progress"].includes(t.status)
        ).length;
        setTournamentLimit(limit);
        setMyActiveCount(activeCount);
        setCanCreate(allowed && activeCount < limit);
        setIsVerified(allowed && !!player?.is_verified);
        if (allowed && player?.is_verified) {
          setForm(f => ({ ...f, entry_credits: "75" }));
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleBannerFile(file) {
    if (!file) return;
    setBannerFile(file);
    const url = URL.createObjectURL(file);
    setBannerPreview(url);
    setPosEditorOpen(true);
  }

  async function handleBannerPositionSave(imageUrl, position) {
    setPosEditorOpen(false);
    setForm(f => ({ ...f, banner_position: position }));
    setUploadingBanner(true);
    const { file_url } = await stageClient.integrations.Core.UploadFile({ file: bannerFile });
    setForm(f => ({ ...f, banner_url: file_url }));
    setBannerPreview(file_url);
    setUploadingBanner(false);
  }

  async function createTournament() {
    const user = await stageClient.auth.me();
    if (user.role !== "admin") {
      const tier = myPlayer?.subscription || "rookie";
      if (!["pro", "elite"].includes(tier)) {
        alert("Only Pro and Elite members can create tournaments.");
        return;
      }
      const limit = tier === "elite" ? 6 : 3;
      const activeCount = tournaments.filter(t =>
        t.organizer_email === user.email &&
        ["registration", "in_progress"].includes(t.status)
      ).length;
      if (activeCount >= limit) {
        alert(`You have reached your limit of ${limit} active tournaments.`);
        return;
      }
    }
    let trophy_url = "";
    if (trophyFile) {
      const res = await stageClient.integrations.Core.UploadFile({ file: trophyFile });
      trophy_url = res.file_url;
    }
    let tournamentName = form.name;
    if (user.role === "admin") {
      tournamentName = `By STAGE · ${form.name}`;
    }
    await stageClient.entities.Tournament.create({
      ...form,
      name: tournamentName,
      max_teams: parseInt(form.max_teams),
      entry_credits: parseInt(form.entry_credits) || 50,
      entry_fee_stc: parseInt(form.entry_fee_stc) || 0,
      organizer_email: user.email,
      creator_email: user.email,
      creator_id: myPlayer?.id || null,
      creator_gamertag: myPlayer?.gamertag || null,
      registered_clubs: [],
      status: "registration",
      banner_url: form.banner_url || "",
      banner_color: form.banner_color,
      banner_position: form.banner_position,
      trophy_url,
    });
    const updated = await stageClient.entities.Tournament.list("-created_date", 100);
    setTournaments(updated);
    setDialogOpen(false);
    setForm({ name: "", description: "", type: "knockout", platform: "PlayStation", region: "Global", country_code: "", max_teams: "8", prize_description: "", start_date: "", entry_credits: "50", entry_fee_stc: "0", banner_url: "", banner_color: "#1a2a4a", banner_position: "50% 50%", participant_type: "club", custom_rules: "", rules_file_url: "" });
    setBannerPreview(null);
    setBannerFile(null);
    setTrophyFile(null);
  }

  const now = new Date();
  const stageTournaments = tournaments.filter(t => !t.creator_gamertag);
  const communityTournaments = tournaments.filter(t => !!t.creator_gamertag);
  const open = communityTournaments.filter(t =>
    t.status === "registration" ||
    (t.status === "in_progress" && t.start_date && new Date(t.start_date) > now)
  );
  const inProgress = communityTournaments.filter(t =>
    t.status === "in_progress" && (!t.start_date || new Date(t.start_date) <= now)
  );
  const completed = communityTournaments.filter(t => t.status === "completed");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-primary shrink-0" />
            <div>
              <h1
                className="font-heading font-black text-5xl md:text-6xl text-foreground uppercase"
                style={{ transform: "skewX(-8deg)", letterSpacing: "-0.02em", transformOrigin: "left center" }}
              >
                {t("tournaments.title")}
              </h1>
              <p className="text-xs text-muted-foreground mt-1">{t("tournaments.subtitle")}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" className="border-border gap-2 h-9" onClick={() => setRulesOpen(true)}>
              <BookOpen className="w-4 h-4" /> <span className="hidden sm:inline">Rules</span>
            </Button>

            {canCreate ? (
              <>
                {tournamentLimit > 0 && (
                  <span className="text-xs text-muted-foreground px-2 py-1 rounded-lg border border-border bg-secondary">
                    {myActiveCount}/{tournamentLimit} slots
                  </span>
                )}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-primary text-primary-foreground gap-2 h-9">
                      <Plus className="w-4 h-4" /> {t("tournaments.createBtn")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-xl">{t("tournaments.createBtn")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Tournament For</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { value: "club", label: "🏟️ Club Tournament", desc: "Clubs register & compete" },
                            { value: "player", label: "👤 Player Tournament", desc: "Individual players register" },
                          ].map(opt => (
                            <button key={opt.value} type="button"
                              onClick={() => setForm(f => ({ ...f, participant_type: opt.value }))}
                              className={cn(
                                "text-left px-3 py-2.5 rounded-xl border transition-all",
                                form.participant_type === opt.value
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-secondary text-muted-foreground hover:border-primary/40"
                              )}>
                              <p className="text-sm font-bold">{opt.label}</p>
                              <p className="text-[10px] mt-0.5 opacity-70">{opt.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Name</label>
                        <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-secondary border-border" placeholder="Tournament name" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Description</label>
                        <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-secondary border-border" placeholder="Tournament details..." />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Type</label>
                          <Select value={form.type} onValueChange={v => {
                            const updates = { type: v };
                            if (v === 'swiss_ucl') { updates.max_teams = '36'; }
                            setForm(f => ({ ...f, ...updates }));
                          }}>
                            <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="knockout">Knockout</SelectItem>
                              <SelectItem value="league">League</SelectItem>
                              <SelectItem value="group_stage">Group Stage</SelectItem>
                              <SelectItem value="double_elimination">Double Elimination</SelectItem>
                              <SelectItem value="swiss_ucl">⭐ Swiss UCL</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Max Teams</label>
                          <Select value={form.max_teams} onValueChange={v => setForm(f => ({ ...f, max_teams: v }))}>
                            <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {["4","8","16","20","32","36","64"].map(n => <SelectItem key={n} value={n}>{n} Teams</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
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
                              <SelectItem value="Cross-Platform">Cross-Platform</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Start Date</label>
                          <Input type="datetime-local" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="bg-secondary border-border" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                            Entry Credits {isVerified && <span className="ml-1 text-warning">★ Verified</span>}
                          </label>
                          <Input type="number" min="50" value={form.entry_credits} onChange={e => setForm(f => ({ ...f, entry_credits: Math.max(50, parseInt(e.target.value) || 50).toString() }))} className="bg-secondary border-border" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Entry Fee (STC)</label>
                          <Input type="number" min="0" max="1000000" value={form.entry_fee_stc} onChange={e => setForm(f => ({ ...f, entry_fee_stc: Math.max(0, Math.min(1000000, parseInt(e.target.value) || 0)).toString() }))} className="bg-secondary border-border" placeholder="0 = no STC fee" />
                        </div>
                        </div>

                        {parseInt(form.entry_fee_stc) > 0 && (
                        <div className="bg-success/10 border border-success/20 rounded-xl p-4 space-y-2">
                          <p className="text-xs font-bold text-success uppercase tracking-wider">💰 Prize Pool Preview</p>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Entry Fee per Team:</span>
                              <span className="font-bold text-foreground">{parseInt(form.entry_fee_stc).toLocaleString()} STC</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Max Teams:</span>
                              <span className="font-bold text-foreground">{form.max_teams}</span>
                            </div>
                            <div className="h-px bg-success/20 my-1" />
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Total Pool (full):</span>
                              <span className="font-bold text-success">{(parseInt(form.entry_fee_stc) * parseInt(form.max_teams)).toLocaleString()} STC</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground ml-2">→ 1st Place (80%):</span>
                              <span className="font-bold text-warning">{Math.floor((parseInt(form.entry_fee_stc) * parseInt(form.max_teams) * 0.8)).toLocaleString()} STC</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground ml-2">→ 2nd Place (20%):</span>
                              <span className="font-bold text-accent">{Math.floor((parseInt(form.entry_fee_stc) * parseInt(form.max_teams) * 0.2)).toLocaleString()} STC</span>
                            </div>
                          </div>
                        </div>
                        )}

                        <div>
                        <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Region</label>
                        <Select value={form.region} onValueChange={v => setForm(f => ({ ...f, region: v }))}>
                          <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Global">🌍 Global</SelectItem>
                            <SelectItem value="Europe">🇪🇺 Europe</SelectItem>
                            <SelectItem value="North America">🌎 North America</SelectItem>
                            <SelectItem value="South America">🌎 South America</SelectItem>
                            <SelectItem value="Asia">🌏 Asia</SelectItem>
                            <SelectItem value="Middle East">🕌 Middle East</SelectItem>
                            <SelectItem value="Africa">🌍 Africa</SelectItem>
                            <SelectItem value="Oceania">🌏 Oceania</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Country Restriction <span className="font-normal normal-case text-muted-foreground">(optional)</span></label>
                        <Select value={form.country_code || "none"} onValueChange={v => setForm(f => ({ ...f, country_code: v === "none" ? "" : v }))}>
                          <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="All countries" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">🌍 All countries</SelectItem>
                            {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">📜 Custom Rules <span className="font-normal normal-case">(optional)</span></label>
                        <Textarea value={form.custom_rules} onChange={e => setForm(f => ({ ...f, custom_rules: e.target.value }))} className="bg-secondary border-border text-sm min-h-[80px]" placeholder="Enter tournament-specific rules..." />
                        {form.rules_file_url ? (
                          <div className="flex items-center gap-2 bg-secondary/60 border border-border rounded-lg px-3 py-2 mt-2">
                            <span className="text-xs text-success flex-1 truncate">✓ Rules file uploaded</span>
                            <a href={form.rules_file_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">View</a>
                            <button onClick={() => setForm(f => ({ ...f, rules_file_url: "" }))} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <>
                            <button onClick={() => rulesFileRef.current?.click()} disabled={uploadingRules}
                              className="w-full h-14 rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors text-xs mt-2">
                              {uploadingRules ? <><div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Uploading...</> : <><Upload className="w-4 h-4" /> Upload rules (PDF / image)</>}
                            </button>
                            <input ref={rulesFileRef} type="file" accept="image/*,.pdf" className="hidden"
                              onChange={async e => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setUploadingRules(true);
                                const { file_url } = await stageClient.integrations.Core.UploadFile({ file });
                                setForm(f => ({ ...f, rules_file_url: file_url }));
                                setUploadingRules(false);
                                e.target.value = "";
                              }} />
                          </>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Prize <span className="font-normal normal-case">(optional)</span></label>
                        <Input value={form.prize_description} onChange={e => setForm(f => ({ ...f, prize_description: e.target.value }))} className="bg-secondary border-border" placeholder="e.g. Bragging rights + custom badge" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Tournament Banner</label>
                        {bannerPreview || form.banner_url ? (
                          <div className="relative rounded-xl overflow-hidden mb-2" style={{ height: 100 }}>
                            <div className="w-full h-full" style={{ backgroundImage: `url(${bannerPreview || form.banner_url})`, backgroundSize: "cover", backgroundPosition: form.banner_position }} />
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
                            <button onClick={() => { setBannerPreview(null); setBannerFile(null); setForm(f => ({ ...f, banner_url: "", banner_position: "50% 50%" })); }}
                              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80">
                              <X className="w-3.5 h-3.5" />
                            </button>
                            {uploadingBanner && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /></div>}
                          </div>
                        ) : (
                          <>
                            <button onClick={() => bannerInputRef.current?.click()}
                              className="w-full h-20 rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-2">
                              <Upload className="w-4 h-4" />
                              <span className="text-xs">Upload banner</span>
                            </button>
                            <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && handleBannerFile(e.target.files[0])} />
                            <div className="flex flex-wrap gap-2">
                              {NEUTRAL_COLORS.map(color => (
                                <button key={color} onClick={() => setForm(f => ({ ...f, banner_color: color, banner_url: "" }))}
                                  className="w-7 h-7 rounded-lg border-2 transition-all"
                                  style={{ background: color, borderColor: form.banner_color === color && !form.banner_url ? "white" : "transparent" }}
                                />
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">🏆 Trophy Image <span className="font-normal normal-case">(PNG only)</span></label>
                        {trophyFile ? (
                          <div className="flex items-center gap-3 bg-warning/10 border border-warning/20 rounded-xl p-3">
                            <img src={URL.createObjectURL(trophyFile)} alt="trophy" className="w-10 h-10 object-contain shrink-0" />
                            <span className="text-xs text-warning flex-1 truncate">{trophyFile.name}</span>
                            <button onClick={() => setTrophyFile(null)} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <button onClick={() => trophyInputRef.current?.click()}
                            className="w-full h-16 rounded-xl border-2 border-dashed border-warning/30 hover:border-warning/60 flex items-center justify-center gap-2 text-warning/60 hover:text-warning transition-colors">
                            <Trophy className="w-5 h-5" />
                            <span className="text-xs">Upload trophy (PNG)</span>
                          </button>
                        )}
                        <input ref={trophyInputRef} type="file" accept="image/png" className="hidden" onChange={e => e.target.files[0] && setTrophyFile(e.target.files[0])} />
                      </div>
                      <Button onClick={createTournament} className="w-full bg-primary text-primary-foreground gap-2">
                        <Trophy className="w-4 h-4" /> {t("tournaments.createBtn")}
                      </Button>
                      {posEditorOpen && bannerPreview && (
                        <ImagePositionEditor
                          open={posEditorOpen}
                          onClose={() => setPosEditorOpen(false)}
                          imageUrl={bannerPreview}
                          aspect="banner"
                          onConfirm={handleBannerPositionSave}
                        />
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            ) : (
              <div className="text-xs text-muted-foreground px-3 py-2 rounded-lg border border-border bg-secondary">
                {tournamentLimit > 0
                  ? `🔒 ${myActiveCount}/${tournamentLimit} — wait for one to finish`
                  : `🔒 ${t("tournaments.proRequired")}`
                }
              </div>
            )}

            <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
              <DialogContent className="bg-card border-border max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-xl flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" /> Tournament Rules
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <Select value={rulesType} onValueChange={setRulesType}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="knockout">Knockout</SelectItem>
                      <SelectItem value="league">League</SelectItem>
                      <SelectItem value="group_stage">Group Stage</SelectItem>
                      <SelectItem value="double_elimination">Double Elimination</SelectItem>
                      <SelectItem value="swiss_ucl">⭐ Swiss UCL</SelectItem>
                    </SelectContent>
                  </Select>
                  <TournamentRules type={rulesType} />
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* By STAGE Section */}
        {stageTournaments.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="font-heading text-xl font-bold text-foreground uppercase tracking-tight">By STAGE</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20 font-medium">Official</span>
            </div>
            <StageTabs tournaments={stageTournaments} now={now} />
            <div className="mt-6 border-t border-border" />
          </div>
        )}

        <Tabs defaultValue="open" className="w-full">
          <TabsList className="w-full rounded-none border-b border-border bg-transparent h-auto p-0 gap-0 mb-6">
            {[
              { value: "open", label: `${t("tournaments.tabOpen")} (${open.length})` },
              { value: "in_progress", label: `${t("tournaments.tabInProgress")} (${inProgress.length})` },
              { value: "completed", label: `${t("tournaments.tabCompleted")} (${completed.length})` },
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={cn(
                  "flex-1 rounded-none border-b-2 border-transparent pb-3 pt-3 text-[10px] sm:text-xs uppercase tracking-widest font-bold text-muted-foreground transition-colors",
                  "data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent"
                )}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {[
            { key: "open", data: open },
            { key: "in_progress", data: inProgress },
            { key: "completed", data: completed },
          ].map(({ key, data }) => (
            <TabsContent key={key} value={key}>
              {data.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-12 text-center">
                  <Trophy className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">No {key.replace("_", " ")} tournaments</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.map(tournament => (
                    <TournamentCard key={tournament.id} tournament={tournament} />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}

const RULES = {
  knockout: { title: "🏆 Knockout", rules: ["Single elimination — lose once and you're out.", "Available for both clubs and individual players.", "Each round, winners advance to the next stage.", "Number of rounds = log₂(teams). E.g. 8 teams = 3 rounds.", "Finals is the last remaining match between 2 participants.", "No second chances — every match counts."] },
  league: { title: "📋 League", rules: ["Every team/player plays against every other participant TWICE.", "Win = 3 pts · Draw = 1 pt · Loss = 0 pts.", "Final standings: points → goal difference → goals scored.", "The participant with the most points at the end wins."] },
  group_stage: { title: "🔵 Group Stage", rules: ["Participants divided into groups of equal size.", "Within each group, participants play each other once.", "Top participants from each group advance to knockout.", "Tie-breakers: points → goal difference → goals scored."] },
  double_elimination: { title: "⚔️ Double Elimination", rules: ["Two brackets: Winners and Losers.", "Lose in Winners bracket → drop to Losers bracket.", "Lose in Losers bracket → eliminated.", "Winners champion vs Losers champion in Grand Final."] },
  swiss_ucl: { title: "⭐ Swiss UCL", rules: ["36 teams in a league phase (8 matchdays each).", "Top 8 → direct Round of 16.", "Teams ranked #9–24 → Playoff round.", "Teams ranked #25–36 → Eliminated.", "R16 onwards: 2-leg ties. Final: single match."] },
};

function TournamentRules({ type }) {
  const data = RULES[type] || RULES.knockout;
  return (
    <div className="bg-secondary/50 rounded-xl p-4 space-y-3">
      <h3 className="font-heading text-lg font-bold text-foreground">{data.title}</h3>
      <ul className="space-y-2">
        {data.rules.map((rule, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="text-primary font-bold shrink-0 mt-0.5">{i + 1}.</span>
            <span>{rule}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StageTabs({ tournaments, now }) {
  const stageOpen = tournaments.filter(t => t.status === "registration" || (t.status === "in_progress" && t.start_date && new Date(t.start_date) > now));
  const stageInProgress = tournaments.filter(t => t.status === "in_progress" && (!t.start_date || new Date(t.start_date) <= now));
  const stageCompleted = tournaments.filter(t => t.status === "completed");

  return (
    <Tabs defaultValue="stage_open" className="w-full">
      <TabsList className="bg-secondary border border-border mb-4">
        <TabsTrigger value="stage_open" className="text-xs">Open ({stageOpen.length})</TabsTrigger>
        <TabsTrigger value="stage_in_progress" className="text-xs">Live ({stageInProgress.length})</TabsTrigger>
        <TabsTrigger value="stage_completed" className="text-xs">Done ({stageCompleted.length})</TabsTrigger>
      </TabsList>
      {[
        { key: "stage_open", data: stageOpen },
        { key: "stage_in_progress", data: stageInProgress },
        { key: "stage_completed", data: stageCompleted },
      ].map(({ key, data }) => (
        <TabsContent key={key} value={key}>
          {data.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <Trophy className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No {key.replace("stage_", "").replace("_", " ")} tournaments</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {data.map(t => <TournamentCard key={t.id} tournament={t} compact />)}
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function TournamentCard({ tournament, compact = false }) {
  const isFull = (tournament.registered_clubs?.length || 0) >= tournament.max_teams;
  const typeColor = {
    knockout: "border-destructive/30 hover:border-destructive/50",
    league: "border-primary/30 hover:border-primary/50",
    group_stage: "border-warning/30 hover:border-warning/50",
    double_elimination: "border-accent/30 hover:border-accent/50",
  }[tournament.type] || "border-primary/30 hover:border-primary/50";

  const registered = tournament.registered_clubs?.length || 0;
  const fillPct = Math.round((registered / (tournament.max_teams || 1)) * 100);
  const statusColors = {
    registration: "bg-success text-black",
    in_progress: "bg-primary text-primary-foreground",
    completed: "bg-muted text-muted-foreground"
  };

  const bannerBg = tournament.banner_url
    ? { backgroundImage: `url(${tournament.banner_url})`, backgroundSize: "cover", backgroundPosition: tournament.banner_position || "50% 50%" }
    : { background: tournament.banner_color || "#1a2a4a" };

  if (compact) {
    return (
      <Link to={`/tournaments/${tournament.id}`} className="block group">
        <div className={cn("relative bg-card border rounded-xl overflow-hidden transition-all duration-300 h-full hover:shadow-lg hover:-translate-y-0.5", typeColor)}>
          <div className="h-14 w-full relative" style={bannerBg}>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/70" />
            {isFull ? (
              <div className="absolute top-1 right-1 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-destructive/80 text-white">FULL</div>
            ) : tournament.status && (
              <div className={cn("absolute top-1 right-1 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full", statusColors[tournament.status])}>
                {tournament.status === "registration" ? "OPEN" : tournament.status.replace("_", " ")}
              </div>
            )}
          </div>
          <div className="p-2.5">
            <h3 className="font-heading text-sm font-bold text-foreground leading-tight mb-1 group-hover:text-primary transition-colors line-clamp-1">{tournament.name}</h3>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{registered}/{tournament.max_teams}</span>
              <span>{tournament.start_date ? new Date(tournament.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "TBD"}</span>
            </div>
            <div className="h-0.5 rounded-full bg-secondary overflow-hidden mb-2">
              <div className="h-full rounded-full" style={{ width: `${fillPct}%`, background: "hsl(var(--primary)/0.7)" }} />
            </div>
            <div className="flex items-center justify-between bg-secondary/60 rounded-lg px-2 py-1">
              <div className="text-center">
                <div className="text-[8px] uppercase text-muted-foreground">Entry</div>
                <div className="text-xs font-bold text-foreground">{tournament.entry_credits ?? 50}<span className="text-[8px] text-muted-foreground">cr</span></div>
              </div>
              <div className="w-px h-4 bg-border" />
              <div className="text-center">
                <div className="text-[8px] uppercase text-muted-foreground">Win</div>
                <div className="text-xs font-bold text-warning">{(tournament.entry_credits ?? 50) * 4}<span className="text-[8px] text-muted-foreground">cr</span></div>
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/tournaments/${tournament.id}`} className="block group">
      <div className={cn("relative bg-card border rounded-2xl overflow-hidden transition-all duration-300 h-full hover:shadow-xl hover:-translate-y-0.5", typeColor)}>
        <div className="h-28 sm:h-32 w-full relative" style={bannerBg}>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/40 backdrop-blur-sm" style={{ color: "hsl(var(--primary))" }}>
            <Trophy className="w-3 h-3" />
            {tournament.type?.replace(/_/g, " ")}
          </div>
          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-black/50 backdrop-blur-sm text-white/80">
            {tournament.participant_type === "player" ? "👤 Players" : "🏟️ Clubs"}
          </div>
          {isFull ? (
            <div className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-destructive/80 text-white">FULL</div>
          ) : tournament.status && (
            <div className={cn("absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full", statusColors[tournament.status])}>
              {tournament.status === "registration" ? "OPEN" : tournament.status.replace("_", " ")}
            </div>
          )}
        </div>
        <div className="p-4 sm:p-5">
          <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground leading-tight mb-1 group-hover:text-primary transition-colors">{tournament.name}</h3>
          {tournament.creator_gamertag && (
            <p className="text-[10px] text-muted-foreground mb-2 italic">By {tournament.creator_gamertag}</p>
          )}
          {tournament.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">{tournament.description}</p>
          )}
          <div className="space-y-1.5 mb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{registered} / {tournament.max_teams} teams</div>
              <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{tournament.start_date ? new Date(tournament.start_date).toLocaleDateString() : "TBD"}</div>
            </div>
            <div className="h-1 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${fillPct}%`, background: "hsl(var(--primary)/0.7)" }} />
            </div>
            <div className="text-[10px] text-muted-foreground">{tournament.platform}</div>
          </div>
          <div className="flex items-center justify-between bg-secondary/60 rounded-xl px-3 py-2">
            <div className="text-center">
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-0.5">Entry</div>
              <div className="text-sm font-bold text-foreground">{tournament.entry_credits ?? 50} <span className="text-[10px] font-normal text-muted-foreground">cr</span></div>
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="text-center">
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-0.5">Win</div>
              <div className="text-2xl font-bold text-warning">{(tournament.entry_credits ?? 50) * 4} <span className="text-[10px] font-normal text-muted-foreground">cr</span></div>
            </div>
          </div>
          {tournament.prize_description && (
            <div className="flex items-center gap-2 bg-warning/5 border border-warning/20 rounded-xl px-3 py-2 mt-2">
              <Crown className="w-3.5 h-3.5 text-warning shrink-0" />
              <span className="text-xs text-warning font-semibold leading-snug">{tournament.prize_description}</span>
            </div>
          )}
          {tournament.start_date && new Date(tournament.start_date) > new Date() && (
            <TournamentCountdown startDate={tournament.start_date} />
          )}
        </div>
      </div>
    </Link>
  );
}
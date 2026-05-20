import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Trophy, Plus, Calendar, Users, Crown, Upload, X, ChevronLeft, ChevronRight, BookOpen, ChevronDown, ChevronRight as Next } from "lucide-react";
import BannerPreviewEditor from "../components/BannerPreviewEditor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TrophyCarousel from "../components/tournament/TrophyCarousel";
import TournamentCountdown from "../components/TournamentCountdown";
import { cn } from "@/lib/utils";
import { stageClient } from "@/api/stageClient";
import { swalAlert } from "@/lib/swal";

const TYPE_LABEL = {
  knockout: "KNOCKOUT", league: "LEAGUE", group_stage: "GROUP STAGE",
  double_elimination: "DBL ELIM", swiss: "SWISS", swiss_ucl: "UCL",
};
const TYPE_COLOR = {
  knockout: "text-red-400 border-red-400/30",
  league: "text-blue-400 border-blue-400/30",
  group_stage: "text-yellow-400 border-yellow-400/30",
  double_elimination: "text-purple-400 border-purple-400/30",
  swiss: "text-green-400 border-green-400/30",
  swiss_ucl: "text-yellow-300 border-yellow-300/30",
};

export default function Tournaments() {
  const [tournaments, setTournaments] = useState([]);
  const [trophyItems, setTrophyItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [trophyPickerOpen, setTrophyPickerOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rulesType, setRulesType] = useState("knockout");
  const [canCreate, setCanCreate] = useState(false);
  const [myPlayer, setMyPlayer] = useState(null);
  const [tournamentLimit, setTournamentLimit] = useState(0);
  const [myActiveCount, setMyActiveCount] = useState(0);

  const [entryType, setEntryType] = useState("free"); // "free" | "stc"
  const [form, setForm] = useState({
    name: "", description: "", type: "knockout", platform: "PlayStation",
    region: "Global", country_code: "", max_teams: "8", prize_description: "",
    start_date: "", entry_fee_stc: "500",
    banner_url: "", banner_color: "#0d1830", banner_position: "50% 50%",
    participant_type: "club", custom_rules: "", rules_file_url: "",
    trophy_item_id: "",
  });

  const [bannerPreview, setBannerPreview] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerEditorOpen, setBannerEditorOpen] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingRules, setUploadingRules] = useState(false);
  const [creating, setCreating] = useState(false);
  const bannerInputRef = useRef(null);
  const rulesFileRef = useRef(null);

  const BANNER_COLORS = ["#0d1830","#0d2010","#1c0d08","#200d0d","#120d20","#0a1420","#181818","#1a1800","#001a1a","#180018"];

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const isAuthed = await stageClient.auth.isAuthenticated();
      if (!isAuthed) { setLoading(false); return; }
      const [data, user, items] = await Promise.all([
        stageClient.entities.Tournament.list("-created_date", 100),
        stageClient.auth.me(),
        stageClient.entities.TrophyItem.list("sort_order", 50).catch(() => []),
      ]);
      setTournaments(data);
      const adminUser = user.role === "admin";
      setTrophyItems(adminUser ? items : items.filter(t => !t.admin_only));
      if (adminUser) {
        setCanCreate(true);
      } else {
        const players = await stageClient.entities.Player.filter({ email: user.email });
        const player = players[0];
        setMyPlayer(player);
        const tier = player?.subscription || "rookie";
        const allowed = ["pro", "elite"].includes(tier);
        const limit = tier === "elite" ? 6 : tier === "pro" ? 3 : 0;
        const active = data.filter(t =>
          t.organizer_email === user.email && ["registration", "in_progress"].includes(t.status)
        ).length;
        setTournamentLimit(limit);
        setMyActiveCount(active);
        setCanCreate(allowed && active < limit);
      }
    } catch (err) {
      console.error("[Tournaments] load error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleBannerFile(file) {
    if (!file) return;
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
    setBannerEditorOpen(true);
  }

  async function handleBannerConfirm(url, position) {
    setBannerEditorOpen(false);
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
      if (!["pro", "elite"].includes(tier)) { await swalAlert("Pro/Elite required to create tournaments."); return; }
      const limit = tier === "elite" ? 6 : 3;
      const active = tournaments.filter(t => t.organizer_email === user.email && ["registration", "in_progress"].includes(t.status)).length;
      if (active >= limit) { await swalAlert(`Limit of ${limit} active tournaments reached.`); return; }
    }
    setCreating(true);
    try {
      const feeSTC = entryType === "stc" ? Math.max(0, parseInt(form.entry_fee_stc) || 0) : 0;
      const selectedTrophy = trophyItems.find(t => t.id === form.trophy_item_id);
      await stageClient.entities.Tournament.create({
        ...form,
        name: user.role === "admin" ? `By STAGE · ${form.name}` : form.name,
        max_teams: parseInt(form.max_teams),
        entry_credits: 0,
        entry_fee_stc: feeSTC,
        organizer_email: user.email,
        creator_email: user.email,
        creator_id: myPlayer?.id || null,
        creator_gamertag: user.role === "admin" ? null : (myPlayer?.gamertag || null),
        registered_clubs: [],
        status: "registration",
        trophy_item_id: form.trophy_item_id || null,
        trophy_url: selectedTrophy?.image_url || "",
      });
      setDialogOpen(false);
      resetForm();
      load();
    } catch (err) {
      console.error("createTournament error:", err);
      await swalAlert("Failed to create tournament: " + (err?.message || "Unknown error"));
    } finally {
      setCreating(false);
    }
  }

  function resetForm() {
    setForm({ name: "", description: "", type: "knockout", platform: "PlayStation", region: "Global", country_code: "", max_teams: "8", prize_description: "", start_date: "", entry_fee_stc: "500", banner_url: "", banner_color: "#0d1830", banner_position: "50% 50%", participant_type: "club", custom_rules: "", rules_file_url: "", trophy_item_id: "" });
    setBannerPreview(null);
    setBannerFile(null);
    setEntryType("free");
    setModalStep(1);
    setTrophyPickerOpen(false);
  }

  const now = new Date();
  const stageTournaments = tournaments.filter(t => !t.creator_gamertag);
  const communityTournaments = tournaments.filter(t => !!t.creator_gamertag);
  const open = communityTournaments.filter(t => t.status === "registration" || (t.status === "in_progress" && t.start_date && new Date(t.start_date) > now));
  const live = communityTournaments.filter(t => t.status === "in_progress" && (!t.start_date || new Date(t.start_date) <= now));
  const done = communityTournaments.filter(t => t.status === "completed");

  // Showcase: all tournaments that have a trophy image
  const trophyShowcase = [...stageTournaments, ...communityTournaments]
    .filter(t => t.trophy_url || t.trophy_item_id)
    .filter(t => t.status !== "completed")
    .slice(0, 12);

  const feeSTC = entryType === "stc" ? (parseInt(form.entry_fee_stc) || 0) : 0;
  const prizePool = feeSTC * parseInt(form.max_teams || 8);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-primary shrink-0" />
            <div>
              <h1
                className="font-heading font-black text-5xl md:text-6xl text-foreground uppercase"
                style={{ transform: "skewX(-8deg)", letterSpacing: "-0.02em", transformOrigin: "left center" }}
              >
                TOURNAMENTS
              </h1>
              <p className="text-xs text-muted-foreground mt-1">Compete, win, and claim your trophy</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" className="border-border h-9 gap-2 rounded text-xs" onClick={() => setRulesOpen(true)}>
              <BookOpen className="w-3.5 h-3.5" /> Rules
            </Button>
            {canCreate ? (
              <>
                {tournamentLimit > 0 && (
                  <span className="text-xs text-muted-foreground px-2 py-1 border border-border bg-card rounded">
                    {myActiveCount}/{tournamentLimit}
                  </span>
                )}
                <Button onClick={() => setDialogOpen(true)} className="bg-primary text-primary-foreground h-9 gap-2 rounded text-xs">
                  <Plus className="w-3.5 h-3.5" /> Create Tournament
                </Button>
              </>
            ) : (
              <div className="text-xs text-muted-foreground px-3 py-1.5 border border-border bg-card rounded">
                {tournamentLimit > 0 ? `${myActiveCount}/${tournamentLimit} — wait for slot` : "Pro/Elite required"}
              </div>
            )}
          </div>
        </div>

        {/* ── Trophy Showcase ─────────────────────────────────── */}
        {trophyShowcase.length > 0 && (
          <TrophyShowcase tournaments={trophyShowcase} trophyItems={trophyItems} />
        )}

        {/* ── By STAGE ────────────────────────────────────────── */}
        {stageTournaments.length > 0 && (
          <section>
            <SectionHeader label="By STAGE" badge="Official" badgeColor="text-warning border-warning/30 bg-warning/5" />
            <TournamentGrid tournaments={stageTournaments} trophyItems={trophyItems} now={now} />
          </section>
        )}

        {/* ── Community ───────────────────────────────────────── */}
        <section>
          <SectionHeader label="Community" />
          <Tabs defaultValue="open" className="w-full">
            <TabsList className="bg-transparent border-b border-border w-full rounded-none h-auto p-0 gap-0 justify-start mb-6">
              {[
                { value: "open", label: "Open", count: open.length },
                { value: "live", label: "Live", count: live.length },
                { value: "done", label: "Done", count: done.length },
              ].map(tab => (
                <TabsTrigger key={tab.value} value={tab.value}
                  className="rounded-none border-b-2 border-transparent px-5 pb-3 pt-1 text-xs uppercase tracking-widest font-bold text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent">
                  {tab.label}
                  <span className="ml-1.5 text-[10px] opacity-50">({tab.count})</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {[
              { key: "open", data: open },
              { key: "live", data: live },
              { key: "done", data: done },
            ].map(({ key, data }) => (
              <TabsContent key={key} value={key}>
                {data.length === 0 ? (
                  <div className="border border-border rounded bg-card p-12 text-center">
                    <Trophy className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No {key} tournaments</p>
                  </div>
                ) : (
                  <TournamentGrid tournaments={data} trophyItems={trophyItems} now={now} />
                )}
              </TabsContent>
            ))}
          </Tabs>
        </section>

      </div>

      {/* ── Create Tournament Dialog ─────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="bg-card border-border max-w-2xl p-0 gap-0 flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
            <DialogTitle className="font-heading text-lg uppercase tracking-tight flex items-center gap-2 m-0">
              <Trophy className="w-4 h-4 text-primary" /> Create Tournament
            </DialogTitle>
            <button type="button" onClick={() => { resetForm(); setDialogOpen(false); }}
              className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step tabs */}
          <div className="flex border-b border-border shrink-0 px-6">
            {[
              { n: 1, label: "Setup" },
              { n: 2, label: "Rules & Entry" },
              { n: 3, label: "Look & Feel" },
            ].map(({ n, label }) => (
              <button key={n} type="button" onClick={() => setModalStep(n)}
                className={cn(
                  "pb-3 pt-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors -mb-px",
                  modalStep === n
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}>
                <span className={cn(
                  "inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] mr-1.5 font-black",
                  modalStep === n ? "bg-primary text-black" : "bg-secondary text-muted-foreground"
                )}>{n}</span>
                {label}
              </button>
            ))}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

            {/* ── Step 1: Setup ── */}
            {modalStep === 1 && (
              <>
                <div>
                  <label className="label-xs">Tournament For</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { v: "club", label: "🏟️ Club", sub: "Clubs register & compete" },
                      { v: "player", label: "👤 Player", sub: "Individual players register" },
                    ].map(opt => (
                      <button key={opt.v} type="button"
                        onClick={() => setForm(f => ({ ...f, participant_type: opt.v }))}
                        className={cn("text-left px-3 py-2.5 rounded border transition-all",
                          form.participant_type === opt.v ? "border-primary bg-primary/10" : "border-border bg-secondary hover:border-primary/40"
                        )}>
                        <p className={cn("text-sm font-bold", form.participant_type === opt.v ? "text-primary" : "text-foreground")}>{opt.label}</p>
                        <p className="text-[10px] mt-0.5 text-muted-foreground">{opt.sub}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label-xs">Name <span className="text-destructive">*</span></label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="bg-secondary border-border" placeholder="Tournament name" />
                </div>

                <div>
                  <label className="label-xs">Description <span className="font-normal lowercase text-muted-foreground">(optional)</span></label>
                  <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="bg-secondary border-border" rows={2} placeholder="What makes this special..." />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-xs">Format</label>
                    <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v, max_teams: v === "swiss_ucl" ? "36" : f.max_teams }))}>
                      <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="knockout">Knockout</SelectItem>
                        <SelectItem value="league">League</SelectItem>
                        <SelectItem value="group_stage">Group Stage</SelectItem>
                        <SelectItem value="double_elimination">Double Elim.</SelectItem>
                        <SelectItem value="swiss_ucl">⭐ Swiss UCL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="label-xs">Max Teams</label>
                    <Select value={form.max_teams} onValueChange={v => setForm(f => ({ ...f, max_teams: v }))}>
                      <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["4","8","16","20","32","36","64"].map(n => <SelectItem key={n} value={n}>{n} teams</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-xs">Platform</label>
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
                    <label className="label-xs">Start Date <span className="text-destructive">*</span></label>
                    <Input type="datetime-local" value={form.start_date}
                      onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                      className="bg-secondary border-border" />
                  </div>
                </div>

                <div>
                  <label className="label-xs">Region</label>
                  <Select value={form.region} onValueChange={v => setForm(f => ({ ...f, region: v }))}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[["Global","🌍"],["Europe","🇪🇺"],["North America","🌎"]].map(([v,e]) => (
                        <SelectItem key={v} value={v}>{e} {v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* ── Step 2: Rules & Entry ── */}
            {modalStep === 2 && (
              <>
                <div>
                  <label className="label-xs">Entry Fee</label>
                  <div className="flex gap-2 mb-3">
                    {[["free","Free"], ["stc","STC Fee"]].map(([v, label]) => (
                      <button key={v} type="button" onClick={() => setEntryType(v)}
                        className={cn("flex-1 py-2 rounded border text-sm font-bold transition-all",
                          entryType === v ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground hover:border-primary/40"
                        )}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {entryType === "stc" && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Input type="number" min="100" max="1000000"
                          value={form.entry_fee_stc}
                          onChange={e => setForm(f => ({ ...f, entry_fee_stc: e.target.value }))}
                          className="bg-secondary border-border" placeholder="STC per entry" />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">STC / entry</span>
                      </div>
                      {feeSTC > 0 && (
                        <div className="border border-warning/20 bg-warning/5 rounded p-3 text-sm space-y-1.5">
                          <p className="text-[10px] font-bold text-warning uppercase tracking-widest">Winner Takes All</p>
                          <div className="flex justify-between"><span className="text-muted-foreground text-xs">Entry fee</span><span className="font-bold text-xs">{feeSTC.toLocaleString()} STC</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground text-xs">Max teams</span><span className="font-bold text-xs">{form.max_teams}</span></div>
                          <div className="h-px bg-warning/20" />
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1"><Crown className="w-3 h-3 text-yellow-400" /><span className="text-xs text-yellow-400 font-bold">1st Place</span></div>
                            <span className="font-black text-warning">{prizePool.toLocaleString()} STC</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="label-xs">Prize Description <span className="font-normal lowercase text-muted-foreground">(optional)</span></label>
                  <Input value={form.prize_description} onChange={e => setForm(f => ({ ...f, prize_description: e.target.value }))}
                    className="bg-secondary border-border" placeholder="e.g. Custom badge + bragging rights" />
                </div>

                <div>
                  <label className="label-xs">Custom Rules <span className="font-normal lowercase text-muted-foreground">(optional)</span></label>
                  <Textarea value={form.custom_rules} onChange={e => setForm(f => ({ ...f, custom_rules: e.target.value }))}
                    className="bg-secondary border-border" rows={3} placeholder="Specific rules for this tournament..." />
                  <div className="mt-2">
                    {form.rules_file_url ? (
                      <div className="flex items-center gap-2 bg-secondary/60 border border-border rounded px-3 py-2">
                        <span className="text-xs text-success flex-1">✓ Rules file attached</span>
                        <a href={form.rules_file_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">View</a>
                        <button type="button" onClick={() => setForm(f => ({ ...f, rules_file_url: "" }))} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <>
                        <button type="button" onClick={() => rulesFileRef.current?.click()} disabled={uploadingRules}
                          className="w-full h-9 rounded border border-dashed border-border hover:border-primary/40 text-muted-foreground text-xs flex items-center justify-center gap-2 transition-colors">
                          {uploadingRules ? <><div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Uploading...</> : <><Upload className="w-3.5 h-3.5" /> Attach rules file (PDF/image)</>}
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
                </div>
              </>
            )}

            {/* ── Step 3: Look & Feel ── */}
            {modalStep === 3 && (
              <>
                {/* Trophy */}
                <div>
                  <label className="label-xs">Trophy <span className="font-normal lowercase text-muted-foreground">(optional — awarded to winner)</span></label>
                  {(() => {
                    const available = trophyItems.filter(t => !t.admin_only);
                    const selected = available.find(t => t.id === form.trophy_item_id);
                    return (
                      <div className="space-y-2">
                        <button type="button" onClick={() => setTrophyPickerOpen(o => !o)}
                          className={cn(
                            "w-full flex items-center gap-3 rounded border px-3 py-2.5 text-sm transition-colors",
                            trophyPickerOpen ? "border-primary bg-primary/5" : "border-border bg-secondary hover:border-primary/40"
                          )}>
                          {selected ? (
                            <>
                              {selected.image_url
                                ? <img src={selected.image_url} alt={selected.name} className="w-8 h-8 object-contain shrink-0" />
                                : <Trophy className="w-6 h-6 text-warning/40 shrink-0" />}
                              <span className="flex-1 text-left font-medium text-foreground text-sm">{selected.name}</span>
                              <button type="button" onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, trophy_item_id: "" })); }}
                                className="text-muted-foreground hover:text-destructive shrink-0"><X className="w-3.5 h-3.5" /></button>
                            </>
                          ) : (
                            <>
                              <Trophy className="w-5 h-5 text-muted-foreground/30 shrink-0" />
                              <span className="flex-1 text-left text-muted-foreground">Select a trophy…</span>
                              <ChevronDown className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform", trophyPickerOpen && "rotate-180")} />
                            </>
                          )}
                        </button>
                        {trophyPickerOpen && (
                          available.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded">No trophies available — admin adds them via Admin → Trophies</p>
                          ) : (
                            <div className="border border-border rounded overflow-hidden">
                              <div className="grid grid-cols-4 gap-0 divide-x divide-y divide-border max-h-52 overflow-y-auto">
                                {available.map(t => (
                                  <button key={t.id} type="button"
                                    onClick={() => { setForm(f => ({ ...f, trophy_item_id: t.id })); setTrophyPickerOpen(false); }}
                                    className={cn(
                                      "flex flex-col items-center gap-1 p-3 text-center transition-colors hover:bg-primary/5",
                                      form.trophy_item_id === t.id && "bg-warning/10"
                                    )}>
                                    {t.image_url
                                      ? <img src={t.image_url} alt={t.name} className="w-10 h-10 object-contain drop-shadow" />
                                      : <Trophy className="w-8 h-8 text-warning/20" />}
                                    <span className="text-[9px] text-muted-foreground leading-tight line-clamp-2 w-full">{t.name}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Banner */}
                <div>
                  <label className="label-xs">Banner</label>
                  {(bannerPreview || form.banner_url) ? (
                    <div className="relative rounded overflow-hidden" style={{ height: 90 }}>
                      <div className="w-full h-full"
                        style={{ backgroundImage: `url(${bannerPreview || form.banner_url})`, backgroundSize: "cover", backgroundPosition: form.banner_position }} />
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
                      <button type="button"
                        onClick={() => { setBannerPreview(null); setBannerFile(null); setForm(f => ({ ...f, banner_url: "", banner_position: "50% 50%" })); }}
                        className="absolute top-2 right-2 w-6 h-6 rounded bg-black/60 flex items-center justify-center text-white hover:bg-black/80">
                        <X className="w-3.5 h-3.5" />
                      </button>
                      {uploadingBanner && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /></div>}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button type="button" onClick={() => bannerInputRef.current?.click()}
                        className="w-full h-14 rounded border border-dashed border-border hover:border-primary/40 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground text-xs transition-colors">
                        <Upload className="w-3.5 h-3.5" /> Upload banner image
                      </button>
                      <input ref={bannerInputRef} type="file" accept="image/*" className="hidden"
                        onChange={e => e.target.files[0] && handleBannerFile(e.target.files[0])} />
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <p className="w-full text-[10px] text-muted-foreground">Or pick a colour:</p>
                        {BANNER_COLORS.map(c => (
                          <button key={c} type="button"
                            onClick={() => setForm(f => ({ ...f, banner_color: c, banner_url: "" }))}
                            className="w-7 h-7 rounded border-2 transition-all"
                            style={{ background: c, borderColor: form.banner_color === c && !form.banner_url ? "white" : "transparent" }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 border-t border-border px-6 py-4 flex items-center justify-between gap-3">
            <button type="button"
              onClick={() => setModalStep(s => Math.max(1, s - 1))}
              disabled={modalStep === 1}
              className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center gap-1 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
            <div className="flex items-center gap-1.5">
              {[1,2,3].map(n => (
                <div key={n} className={cn("h-1.5 rounded-full transition-all", modalStep === n ? "w-5 bg-primary" : "w-1.5 bg-border")} />
              ))}
            </div>
            {modalStep < 3 ? (
              <button type="button"
                onClick={() => setModalStep(s => Math.min(3, s + 1))}
                disabled={modalStep === 1 && !form.name}
                className="text-xs font-bold text-primary hover:text-primary/80 disabled:opacity-30 flex items-center gap-1 transition-colors">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <Button onClick={createTournament} disabled={creating || !form.name || !form.start_date}
                className="bg-primary text-primary-foreground gap-2 h-9 text-xs font-bold rounded">
                <Trophy className="w-3.5 h-3.5" />
                {creating ? "Creating…" : "Create Tournament"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Rules Dialog ──────────────────────────────── */}
      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className="bg-card border-border max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> Tournament Rules</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Select value={rulesType} onValueChange={setRulesType}>
              <SelectTrigger className="bg-secondary border-border rounded"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="knockout">Knockout</SelectItem>
                <SelectItem value="league">League</SelectItem>
                <SelectItem value="group_stage">Group Stage</SelectItem>
                <SelectItem value="double_elimination">Double Elimination</SelectItem>
                <SelectItem value="swiss_ucl">Swiss UCL</SelectItem>
              </SelectContent>
            </Select>
            <TournamentRules type={rulesType} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Banner editor */}
      {bannerEditorOpen && bannerPreview && (
        <BannerPreviewEditor
          open={bannerEditorOpen}
          onClose={() => setBannerEditorOpen(false)}
          imageUrl={bannerPreview}
          onConfirm={handleBannerConfirm}
        />
      )}
    </div>
  );
}

/* ─── Trophy Showcase Strip ─────────────────────────────────────── */
function TrophyShowcase({ tournaments, trophyItems }) {
  const scrollRef = useRef(null);
  function scroll(dir) { scrollRef.current?.scrollBy({ left: dir * 200, behavior: "smooth" }); }

  return (
    <div className="border border-border rounded bg-card/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-widest font-bold text-warning flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5" /> Trophies At Stake
        </span>
        <div className="flex gap-1">
          <button onClick={() => scroll(-1)} className="w-6 h-6 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft className="w-3.5 h-3.5" /></button>
          <button onClick={() => scroll(1)} className="w-6 h-6 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"><ChevronRight className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {tournaments.map(t => {
          const trophyUrl = t.trophy_url || trophyItems.find(i => i.id === t.trophy_item_id)?.image_url;
          if (!trophyUrl) return null;
          return (
            <Link key={t.id} to={`/tournaments/${t.id}`} className="flex-shrink-0 flex flex-col items-center gap-2 group">
              <div className="w-16 h-16 flex items-center justify-center rounded bg-secondary/50 border border-border group-hover:border-warning/40 transition-colors p-1">
                <img src={trophyUrl} alt={t.name} className="w-full h-full object-contain drop-shadow-xl" />
              </div>
              <p className="text-[9px] text-muted-foreground text-center w-16 truncate group-hover:text-foreground transition-colors">{t.name}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Section Header ────────────────────────────────────────────── */
function SectionHeader({ label, badge, badgeColor }) {
  return (
    <div className="flex items-center gap-2 mb-4 border-l-2 border-primary pl-3">
      <span className="font-heading font-black text-sm uppercase tracking-widest text-foreground">{label}</span>
      {badge && (
        <span className={cn("text-[10px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider", badgeColor)}>{badge}</span>
      )}
    </div>
  );
}

/* ─── Tournament Grid ───────────────────────────────────────────── */
function TournamentGrid({ tournaments, trophyItems, now }) {
  if (!tournaments.length) return (
    <div className="border border-border rounded bg-card p-10 text-center">
      <Trophy className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">No tournaments</p>
    </div>
  );
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {tournaments.map(t => <TournamentCard key={t.id} tournament={t} trophyItems={trophyItems} now={now} />)}
    </div>
  );
}

/* ─── Tournament Card ───────────────────────────────────────────── */
function TournamentCard({ tournament: t, trophyItems }) {
  const registered = t.registered_clubs?.length || 0;
  const fillPct = Math.round((registered / Math.max(t.max_teams, 1)) * 100);
  const isFull = registered >= t.max_teams;

  const bannerBg = t.banner_url
    ? { backgroundImage: `url(${t.banner_url})`, backgroundSize: "cover", backgroundPosition: t.banner_position || "50% 50%" }
    : { background: t.banner_color || "#0d1830" };

  const statusBadge = {
    registration: { label: "OPEN", cls: "bg-success text-black" },
    in_progress:  { label: "LIVE", cls: "bg-primary text-primary-foreground" },
    completed:    { label: "DONE", cls: "bg-muted text-muted-foreground" },
  }[t.status] || { label: t.status, cls: "bg-muted text-muted-foreground" };

  const typeColor = TYPE_COLOR[t.type] || "text-primary border-primary/30";
  const typeLbl = TYPE_LABEL[t.type] || t.type?.toUpperCase();

  const trophyUrl = t.trophy_url || trophyItems?.find(i => i.id === t.trophy_item_id)?.image_url;
  const hasFee = (t.entry_fee_stc || 0) > 0;
  const pool = (t.entry_fee_stc || 0) * (t.max_teams || 8);

  return (
    <Link to={`/tournaments/${t.id}`} className="block group">
      <div className="bg-card border border-border rounded overflow-hidden hover:border-primary/40 transition-all hover:-translate-y-0.5 duration-200 h-full flex flex-col">

        {/* Banner */}
        <div className="h-24 relative flex-shrink-0" style={bannerBg}>
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/70" />

          {/* Type badge */}
          <div className={cn("absolute top-2 left-2 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm border bg-black/50 backdrop-blur-sm", typeColor)}>
            {typeLbl}
          </div>

          {/* Status badge */}
          {isFull ? (
            <div className="absolute top-2 right-2 text-[9px] font-bold uppercase px-2 py-0.5 rounded-sm bg-destructive/80 text-white">FULL</div>
          ) : (
            <div className={cn("absolute top-2 right-2 text-[9px] font-bold uppercase px-2 py-0.5 rounded-sm", statusBadge.cls)}>{statusBadge.label}</div>
          )}

          {/* Trophy image */}
          {trophyUrl && (
            <div className="absolute bottom-2 right-2 w-10 h-10">
              <img src={trophyUrl} alt="trophy" className="w-full h-full object-contain drop-shadow-xl" />
            </div>
          )}

          {/* Participant type */}
          <div className="absolute bottom-2 left-2 text-[9px] text-white/70 font-medium">
            {t.participant_type === "player" ? "👤 Players" : "🏟️ Clubs"}
          </div>
        </div>

        {/* Body */}
        <div className="p-3 flex flex-col gap-2 flex-1">
          <div>
            <h3 className="font-heading font-black text-base text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-1 uppercase">
              {t.name}
            </h3>
            {t.creator_gamertag && (
              <p className="text-[10px] text-muted-foreground">By {t.creator_gamertag}</p>
            )}
          </div>

          {/* Fill bar */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{registered}/{t.max_teams}</span>
              {t.start_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(t.start_date).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</span>}
            </div>
            <div className="h-0.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${fillPct}%` }} />
            </div>
          </div>

          {/* Entry / Prize */}
          <div className="flex items-center gap-2 mt-auto pt-1">
            {hasFee ? (
              <>
                <div className="flex-1 bg-secondary/60 rounded px-2 py-1.5 text-center">
                  <div className="text-[8px] uppercase tracking-widest text-muted-foreground">Entry</div>
                  <div className="text-xs font-black text-foreground">{(t.entry_fee_stc || 0).toLocaleString()} <span className="font-normal text-muted-foreground text-[9px]">STC</span></div>
                </div>
                <div className="flex-1 bg-warning/5 border border-warning/20 rounded px-2 py-1.5 text-center">
                  <div className="text-[8px] uppercase tracking-widest text-warning flex items-center justify-center gap-0.5"><Crown className="w-2.5 h-2.5" /> Prize</div>
                  <div className="text-sm font-black text-warning">{pool.toLocaleString()} <span className="font-normal text-warning/60 text-[9px]">STC</span></div>
                </div>
              </>
            ) : (
              <div className="flex-1 bg-success/5 border border-success/20 rounded px-2 py-1.5 text-center">
                <div className="text-[8px] uppercase tracking-widest text-success">Entry</div>
                <div className="text-sm font-black text-success">FREE</div>
              </div>
            )}
          </div>

          {t.prize_description && (
            <div className="flex items-center gap-1.5 bg-warning/5 border border-warning/10 rounded px-2 py-1.5 mt-1">
              <Crown className="w-3 h-3 text-warning shrink-0" />
              <span className="text-[10px] text-warning font-medium leading-snug truncate">{t.prize_description}</span>
            </div>
          )}

          {t.start_date && new Date(t.start_date) > new Date() && t.status === "registration" && (
            <TournamentCountdown startDate={t.start_date} />
          )}
        </div>
      </div>
    </Link>
  );
}

/* ─── Tournament Rules ──────────────────────────────────────────── */
const RULES = {
  knockout: { title: "Knockout", rules: ["Single elimination — lose once and you're out.", "Each round, winners advance to the next stage.", "Number of rounds = log₂(teams). 8 teams = 3 rounds.", "Finals is the last remaining match between 2 participants."] },
  league: { title: "League", rules: ["Every team plays against every other participant TWICE.", "Win = 3 pts · Draw = 1 pt · Loss = 0 pts.", "Final standings: points → goal difference → goals scored."] },
  group_stage: { title: "Group Stage", rules: ["Participants split into groups.", "Within each group, everyone plays each other once.", "Top participants advance to knockout.", "Tie-breakers: points → GD → goals scored."] },
  double_elimination: { title: "Double Elimination", rules: ["Two brackets: Winners and Losers.", "Lose in Winners → drop to Losers.", "Lose in Losers → eliminated.", "Winners champion vs Losers champion in Grand Final."] },
  swiss_ucl: { title: "Swiss UCL", rules: ["36 teams in league phase (8 matchdays).", "Top 8 → direct Round of 16.", "#9–24 → Playoff round.", "#25–36 → eliminated.", "R16 onwards: 2-leg ties. Final: single match."] },
};

function TournamentRules({ type }) {
  const d = RULES[type] || RULES.knockout;
  return (
    <div className="bg-secondary/50 rounded p-4">
      <h3 className="font-bold text-foreground mb-2">{d.title}</h3>
      <ul className="space-y-1.5">
        {d.rules.map((r, i) => (
          <li key={i} className="flex gap-2 text-sm text-muted-foreground">
            <span className="text-primary font-bold shrink-0">{i + 1}.</span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

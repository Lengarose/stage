import { useState, useEffect, useRef, useId } from "react";
import { Link } from "react-router-dom";
import { Trophy, Plus, Calendar, Users, Crown, Upload, X, ChevronLeft, ChevronRight, BookOpen, ChevronDown } from "lucide-react";
import BannerPreviewEditor from "../components/BannerPreviewEditor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TournamentCountdown from "../components/TournamentCountdown";
import { cn } from "@/lib/utils";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import { swalAlert } from "@/lib/swal";
import { isWallClockFuture, toMysqlDateTime } from "@/lib/momentDate";
import { hasStagePlus } from "@/lib/subscriptionUtils";
import { COUNTRIES, COUNTRY_REGIONS } from "@/lib/countries";
import {
  TOURNAMENT_CREDIT_COST,
  applyTournamentFormat,
  calculateTournamentPrizeBreakdown,
  getTournamentFormatRule,
  getTournamentMaxTeamOptions,
  normalizeTournamentMaxTeams,
} from "@/lib/tournamentRules";
import { useTranslation } from "@/hooks/useTranslation";

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

const tournamentDialogFieldClass = "h-12 rounded-none border-cyan-300/18 bg-white/[0.08] text-white placeholder:text-white/35 focus-visible:ring-cyan-300/30";
const tournamentDialogSelectClass = "h-12 rounded-none border-cyan-300/18 bg-white/[0.08] text-white focus:ring-cyan-300/30";
const tournamentDialogClip = { clipPath: "polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)" };
const TOURNAMENT_REGION_OPTIONS = ["Global", "Europe", "North America", "South America", "Asia", "Oceania", "Africa", "Middle East"];

function cleanCountryName(name) {
  return String(name || "").replace(/^\p{Regional_Indicator}{2}\s*/u, "").trim();
}

export default function Tournaments() {
  const { t } = useTranslation();
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

  const [form, setForm] = useState({
    name: "", description: "", type: "knockout", platform: "PlayStation",
    region: "Global", country_code: "", max_teams: "8",
    start_date: "", entry_fee_stc: "1000",
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
  const bannerInputId = useId();
  const rulesFileId = useId();

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
      setTournaments((data || []).filter(t => !["cancelled", "archived"].includes(String(t.status || "").toLowerCase())));
      const adminUser = user.role === "admin";
      setTrophyItems(adminUser ? items : items.filter(t => !t.admin_only));
      if (adminUser) {
        setCanCreate(true);
      } else {
        const { player } = await resolveMyPlayerAndClub();
        setMyPlayer(player);
        setCanCreate(hasStagePlus(player));
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
      if (!hasStagePlus(myPlayer)) { await swalAlert(t("competitionFlow.stagePlusRequired")); return; }
    }
    setCreating(true);
    try {
      const maxTeams = normalizeTournamentMaxTeams(form.type, form.max_teams);
      const prizes = calculateTournamentPrizeBreakdown(form.entry_fee_stc, maxTeams);
      const selectedTrophy = trophyItems.find(t => t.id === form.trophy_item_id);
      await stageClient.entities.Tournament.create({
        ...form,
        name: user.role === "admin" ? `By STAGE · ${form.name}` : form.name,
        max_teams: maxTeams,
        entry_credits: TOURNAMENT_CREDIT_COST,
        entry_fee_stc: prizes.entryFee,
        prize_pool_stc: prizes.pool,
        prize_winner_stc: prizes.winner,
        prize_runner_up_stc: prizes.runnerUp,
        prize_semi_final_stc: prizes.thirdPlace,
        prize_participation_stc: 0,
        prize_description: "",
        organizer_email: user.email,
        creator_email: user.email,
        creator_id: myPlayer?.id || null,
        creator_gamertag: user.role === "admin" ? null : (myPlayer?.gamertag || null),
        start_date: toMysqlDateTime(form.start_date),
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
    setForm({ name: "", description: "", type: "knockout", platform: "PlayStation", region: "Global", country_code: "", max_teams: "8", start_date: "", entry_fee_stc: "1000", banner_url: "", banner_color: "#0d1830", banner_position: "50% 50%", participant_type: "club", custom_rules: "", rules_file_url: "", trophy_item_id: "" });
    setBannerPreview(null);
    setBannerFile(null);
    setModalStep(1);
    setTrophyPickerOpen(false);
  }

  const now = new Date();
  const stageTournaments = tournaments.filter(t => !t.creator_gamertag);
  const communityTournaments = tournaments.filter(t => !!t.creator_gamertag);
  const open = communityTournaments.filter(t => t.status === "registration" || (t.status === "in_progress" && isWallClockFuture(t.start_date, now)));
  const live = communityTournaments.filter(t => t.status === "in_progress" && (!t.start_date || !isWallClockFuture(t.start_date, now)));
  const done = communityTournaments.filter(t => t.status === "completed");

  // Showcase: all tournaments that have a trophy image
  const trophyShowcase = [...stageTournaments, ...communityTournaments]
    .filter(t => t.trophy_url || t.trophy_item_id)
    .filter(t => t.status !== "completed")
    .slice(0, 12);

  const formatRule = getTournamentFormatRule(form.type);
  const maxTeamOptions = getTournamentMaxTeamOptions(form.type);
  const prizeBreakdown = calculateTournamentPrizeBreakdown(form.entry_fee_stc, form.max_teams);
  const countryOptions = form.region === "Global"
    ? []
    : COUNTRIES.filter(country => (COUNTRY_REGIONS[form.region] || []).includes(country.code));

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
                {t("competitionFlow.tournamentsTitle")}
              </h1>
              <p className="text-xs text-muted-foreground mt-1">{t("competitionFlow.tournamentsSubtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              className="h-10 rounded-none border border-cyan-200/25 bg-black/24 px-7 font-heading text-xs font-black uppercase tracking-[0.12em] text-cyan-50/95 shadow-[0_0_24px_-16px_rgba(0,229,255,0.9)] backdrop-blur-md transition-all hover:border-cyan-200/55 hover:bg-cyan-300/10 hover:text-white hover:shadow-[0_0_24px_-10px_rgba(0,229,255,0.9)] focus-visible:ring-2 focus-visible:ring-cyan-300/50"
              style={{ clipPath: "polygon(8% 0, 100% 0, 92% 100%, 0 100%)" }}
              onClick={() => setRulesOpen(true)}
            >
              <BookOpen className="w-3.5 h-3.5 text-cyan-200/90" /> {t("competitionFlow.rules")}
            </Button>
            {canCreate ? (
              <Button
                onClick={() => setDialogOpen(true)}
                className="h-10 rounded-none border border-cyan-200/25 bg-black/24 px-7 font-heading text-xs font-black uppercase tracking-[0.12em] text-cyan-50/95 shadow-[0_0_24px_-16px_rgba(0,229,255,0.9)] backdrop-blur-md transition-all hover:border-cyan-200/55 hover:bg-cyan-300/10 hover:text-white hover:shadow-[0_0_24px_-10px_rgba(0,229,255,0.9)] focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                style={{ clipPath: "polygon(8% 0, 100% 0, 92% 100%, 0 100%)" }}
              >
                <Plus className="w-3.5 h-3.5 text-cyan-200/90" /> {t("competitionFlow.createTournament")}
              </Button>
            ) : (
              <div className="text-xs text-muted-foreground px-3 py-1.5 border border-border bg-card rounded">
                {t("competitionFlow.stagePlusRequired")}
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
            <SectionHeader label={t("competitionFlow.byStage")} badge={t("competitionFlow.official")} badgeColor="text-warning border-warning/30 bg-warning/5" />
            <TournamentGrid tournaments={stageTournaments} trophyItems={trophyItems} now={now} />
          </section>
        )}

        {/* ── Community ───────────────────────────────────────── */}
        <section>
          <SectionHeader label={t("competitionFlow.community")} />
          <Tabs defaultValue="open" className="w-full">
            <TabsList className="bg-transparent border-b border-border w-full rounded-none h-auto p-0 gap-0 justify-start mb-6">
              {[
                { value: "open", label: t("competitionFlow.open"), count: open.length },
                { value: "live", label: t("competitionFlow.live"), count: live.length },
                { value: "done", label: t("competitionFlow.done"), count: done.length },
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
                    <p className="text-sm text-muted-foreground">{t("competitionFlow.noTabTournaments", { status: key })}</p>
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
        <DialogContent hideCloseButton className="flex max-h-[82vh] max-w-2xl flex-col overflow-hidden border-cyan-300/18 bg-[#0a1724] p-0 text-white shadow-[0_0_56px_rgba(34,211,238,0.14)] sm:max-w-2xl">
          {/* Header */}
          <div className="relative flex shrink-0 items-center justify-between overflow-hidden border-b border-cyan-300/14 px-5 pb-4 pt-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,0.16),transparent_42%),linear-gradient(90deg,rgba(34,211,238,0.08),rgba(255,255,255,0.035),transparent)]" />
            <div className="relative flex items-center gap-4">
              <div className="grid h-12 w-11 shrink-0 place-items-center bg-cyan-300/12 ring-1 ring-cyan-300/25"
                style={{ clipPath: "polygon(14% 0, 100% 0, 86% 100%, 0 100%)" }}>
                <Trophy className="w-5 h-5 text-cyan-200" />
              </div>
              <div>
                <p className="font-heading text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/55">Tournament builder</p>
                <DialogTitle className="mt-1 font-heading text-xl font-black uppercase leading-none tracking-wide text-white">
                  {t("competitionFlow.createTournament")}
                </DialogTitle>
              </div>
            </div>
            <button type="button" onClick={() => { resetForm(); setDialogOpen(false); }}
              className="relative grid h-10 w-10 place-items-center text-cyan-100/60 transition-colors hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step tabs */}
          <div className="flex shrink-0 gap-7 overflow-x-auto border-b border-cyan-300/12 bg-white/[0.035] px-5 pt-3">
            {[
              { n: 1, label: t("competitionFlow.setup") },
              { n: 2, label: "Entry Fee" },
              { n: 3, label: "Display" },
            ].map(({ n, label }) => (
              <button key={n} type="button" onClick={() => setModalStep(n)}
                className={cn(
                  "relative inline-flex shrink-0 items-center gap-2 pb-3 font-heading text-[11px] font-black uppercase tracking-[0.16em] transition-colors",
                  modalStep === n
                    ? "text-cyan-100"
                    : "text-white/42 hover:text-white/75"
                )}>
                <span className={cn(
                  "inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black",
                  modalStep === n ? "bg-cyan-300 text-black" : "bg-white/10 text-white/45"
                )}>{n}</span>
                {label}
                {modalStep === n && (
                  <span className="absolute bottom-0 left-0 h-[2px] w-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.7)]" />
                )}
              </button>
            ))}
          </div>

          {/* Scrollable content */}
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_0%_20%,rgba(34,211,238,0.07),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] px-5 py-5">

            {/* ── Step 1: Setup ── */}
            {modalStep === 1 && (
              <>
                <div>
                  <label className="label-xs">{t("commonPages.trnTournamentFor")}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { v: "club", label: t("nav.club"), sub: t("commonPages.trnClubsCompete") },
                      { v: "player", label: t("commonPages.storePlayer"), sub: t("commonPages.trnPlayersRegister") },
                    ].map(opt => (
                      <button key={opt.v} type="button"
                        onClick={() => setForm(f => ({ ...f, participant_type: opt.v }))}
                        className={cn("min-h-[84px] px-5 py-4 text-left transition-all",
                          form.participant_type === opt.v
                            ? "bg-cyan-300/[0.11] text-white ring-1 ring-cyan-300/45"
                            : "bg-white/[0.045] text-white/70 ring-1 ring-white/12 hover:bg-cyan-300/[0.06] hover:ring-cyan-300/25"
                        )}
                        style={tournamentDialogClip}>
                        <p className={cn("font-heading text-lg font-black uppercase tracking-wide", form.participant_type === opt.v ? "text-cyan-100" : "text-white/85")}>{opt.label}</p>
                        <p className="mt-1 text-xs text-white/45">{opt.sub}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label-xs">{t("commonPages.title")} <span className="text-destructive">*</span></label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className={tournamentDialogFieldClass} placeholder={t("commonPages.trnNamePlaceholder")} />
                </div>

                <div>
                  <label className="label-xs">{t("commonPages.trnDescription")} <span className="font-normal lowercase text-muted-foreground">({t("commonPages.trnOptional")})</span></label>
                  <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className={cn(tournamentDialogFieldClass, "min-h-[96px] py-3")} rows={2} placeholder={t("commonPages.trnDescPlaceholder")} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-xs">{t("commonPages.trnFormat")}</label>
                    <Select value={form.type} onValueChange={v => setForm(f => applyTournamentFormat(f, v))}>
                      <SelectTrigger className={tournamentDialogSelectClass}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="knockout">{t("commonPages.cdKnockout")}</SelectItem>
                        <SelectItem value="league">{t("commonPages.homeLeagues")}</SelectItem>
                        <SelectItem value="group_stage">{t("commonPages.cdGroupStage")}</SelectItem>
                        <SelectItem value="swiss_ucl">Swiss UCL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="label-xs">{t("commonPages.trnMaxTeams")}</label>
                    <Select value={form.max_teams} onValueChange={v => setForm(f => ({ ...f, max_teams: v }))}>
                      <SelectTrigger className={tournamentDialogSelectClass}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {maxTeamOptions.map(n => <SelectItem key={n} value={String(n)}>{t("commonPages.trnNTeams", { count: n })}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground mt-1">{formatRule.hint}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-xs">{t("commonPages.platform")}</label>
                    <Select value={form.platform} onValueChange={v => setForm(f => ({ ...f, platform: v }))}>
                      <SelectTrigger className={tournamentDialogSelectClass}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PlayStation">PlayStation</SelectItem>
                        <SelectItem value="Xbox">Xbox</SelectItem>
                        <SelectItem value="PC">PC</SelectItem>
                        <SelectItem value="Cross-Platform">{t("commonPages.trnCrossPlatform")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="label-xs">{t("commonPages.trnStartDate")} <span className="text-destructive">*</span></label>
                    <Input type="datetime-local" value={form.start_date}
                      onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                      className={tournamentDialogFieldClass} />
                  </div>
                </div>

                <div>
                  <label className="label-xs">{t("commonPages.profRegion")}</label>
                  <Select value={form.region} onValueChange={v => setForm(f => ({ ...f, region: v, country_code: "" }))}>
                    <SelectTrigger className={tournamentDialogSelectClass}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TOURNAMENT_REGION_OPTIONS.map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {form.region !== "Global" && (
                  <div>
                    <label className="label-xs">{t("competitionFlow.country")}</label>
                    <Select value={form.country_code || "all"} onValueChange={v => setForm(f => ({ ...f, country_code: v === "all" ? "" : v }))}>
                      <SelectTrigger className={tournamentDialogSelectClass}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("competitionFlow.allCountries")}</SelectItem>
                        {countryOptions.map(country => (
                          <SelectItem key={country.code} value={country.code}>{cleanCountryName(country.name)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-[10px] text-white/42">Leave empty to allow every club in this region.</p>
                  </div>
                )}
              </>
            )}

            {/* ── Step 2: Rules & Entry ── */}
            {modalStep === 2 && (
              <>
                <div>
                  <label className="label-xs">{t("commonPages.trnEntryFee")}</label>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Input type="number" min="0" max="1000000"
                        value={form.entry_fee_stc}
                        onChange={e => setForm(f => ({ ...f, entry_fee_stc: e.target.value }))}
                        className={tournamentDialogFieldClass} placeholder={t("commonPages.trnStcPerEntry")} />
                      <span className="whitespace-nowrap text-xs text-white/45">{t("commonPages.trnStcEntry")}</span>
                    </div>
                    <div className="space-y-2 bg-cyan-300/[0.075] p-4 text-sm ring-1 ring-cyan-300/18" style={tournamentDialogClip}>
                      <div className="flex justify-between"><span className="text-xs text-white/45">{t("commonPages.trnCreateCost")}</span><span className="text-xs font-bold text-white/85">{t("commonPages.storeCreditsAmount", { amount: TOURNAMENT_CREDIT_COST })}</span></div>
                      <div className="flex justify-between"><span className="text-xs text-white/45">{t("commonPages.trnEntryCost")}</span><span className="text-xs font-bold text-white/85">{TOURNAMENT_CREDIT_COST} {t("commonPages.storeCreditsWord")} + {prizeBreakdown.entryFee.toLocaleString()} STC</span></div>
                      <div className="flex justify-between"><span className="text-xs text-white/45">{t("commonPages.trnMaxTeams")}</span><span className="text-xs font-bold text-white/85">{form.max_teams}</span></div>
                      <div className="h-px bg-cyan-300/15" />
                      <div className="flex justify-between"><span className="text-xs font-bold text-cyan-100/70">{t("commonPages.trnWinner")}</span><span className="font-black text-cyan-100">{prizeBreakdown.winner.toLocaleString()} STC</span></div>
                      <div className="flex justify-between"><span className="text-xs font-bold text-white/45">{t("commonPages.trnRunnerUp")}</span><span className="font-bold text-white/85">{prizeBreakdown.runnerUp.toLocaleString()} STC</span></div>
                      <div className="flex justify-between"><span className="text-xs font-bold text-white/45">{t("commonPages.trnThirdPlace")}</span><span className="font-bold text-white/85">{prizeBreakdown.thirdPlace.toLocaleString()} STC</span></div>
                      <div className="h-px bg-cyan-300/15" />
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1"><Crown className="w-3 h-3 text-cyan-200" /><span className="text-xs font-bold text-cyan-100/80">{t("commonPages.trnPrizePool")}</span></div>
                        <span className="font-black text-cyan-100">{prizeBreakdown.pool.toLocaleString()} STC</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="label-xs">{t("commonPages.trnCustomRules")} <span className="font-normal lowercase text-muted-foreground">({t("commonPages.trnOptional")})</span></label>
                  <Textarea value={form.custom_rules} onChange={e => setForm(f => ({ ...f, custom_rules: e.target.value }))}
                    className={cn(tournamentDialogFieldClass, "min-h-[120px] py-3")} rows={3} placeholder={t("commonPages.trnRulesPlaceholder")} />
                  <div className="mt-2">
                    {form.rules_file_url ? (
                      <div className="flex items-center gap-2 bg-white/[0.045] px-3 py-2 ring-1 ring-cyan-300/15" style={tournamentDialogClip}>
                        <span className="text-xs text-success flex-1">{t("commonPages.trnRulesAttached")}</span>
                        <a href={form.rules_file_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">{t("commonPages.view")}</a>
                        <button type="button" onClick={() => setForm(f => ({ ...f, rules_file_url: "" }))} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <>
                        <label htmlFor={uploadingRules ? undefined : rulesFileId}
                          className="flex h-10 w-full cursor-pointer touch-manipulation items-center justify-center gap-2 border border-dashed border-cyan-300/20 bg-black/20 text-xs text-white/45 transition-colors hover:border-cyan-300/40 hover:text-white/80"
                          style={tournamentDialogClip}>
                          {uploadingRules ? <><div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Uploading...</> : <><Upload className="w-3.5 h-3.5" /> Attach rules file (PDF/image)</>}
                        </label>
                        <input id={rulesFileId} ref={rulesFileRef} type="file" accept="image/*,.pdf" className="sr-only" disabled={uploadingRules}
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
                  <label className="label-xs">{t("commonPages.trnTrophy")} <span className="font-normal lowercase text-muted-foreground">({t("commonPages.trnTrophyHint")})</span></label>
                  {(() => {
                    const available = trophyItems.filter(t => !t.admin_only);
                    const selected = available.find(t => t.id === form.trophy_item_id);
                    return (
                      <div className="space-y-2">
                        <button type="button" onClick={() => setTrophyPickerOpen(o => !o)}
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors",
                          trophyPickerOpen ? "bg-cyan-300/[0.11] ring-1 ring-cyan-300/35" : "bg-white/[0.045] ring-1 ring-white/12 hover:bg-cyan-300/[0.06] hover:ring-cyan-300/25"
                          )}
                          style={tournamentDialogClip}>
                          {selected ? (
                            <>
                              {selected.image_url
                                ? <img src={selected.image_url} alt={selected.name} className="w-8 h-8 object-contain shrink-0" />
                                : <Trophy className="w-6 h-6 text-warning/40 shrink-0" />}
                              <span className="flex-1 text-left text-sm font-medium text-white">{selected.name}</span>
                              <button type="button" onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, trophy_item_id: "" })); }}
                                className="text-muted-foreground hover:text-destructive shrink-0"><X className="w-3.5 h-3.5" /></button>
                            </>
                          ) : (
                            <>
                              <Trophy className="w-5 h-5 text-muted-foreground/30 shrink-0" />
                              <span className="flex-1 text-left text-white/45">Select a trophy…</span>
                              <ChevronDown className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform", trophyPickerOpen && "rotate-180")} />
                            </>
                          )}
                        </button>
                        {trophyPickerOpen && (
                          available.length === 0 ? (
                            <p className="border border-dashed border-cyan-300/20 py-4 text-center text-xs text-white/45" style={tournamentDialogClip}>No trophies available — admin adds them via Admin → Trophies</p>
                          ) : (
                            <div className="overflow-hidden border border-cyan-300/15 bg-black/20">
                              <div className="grid max-h-52 grid-cols-4 gap-0 divide-x divide-y divide-cyan-300/10 overflow-y-auto">
                                {available.map(t => (
                                  <button key={t.id} type="button"
                                    onClick={() => { setForm(f => ({ ...f, trophy_item_id: t.id })); setTrophyPickerOpen(false); }}
                                    className={cn(
                                      "flex flex-col items-center gap-1 p-3 text-center transition-colors hover:bg-cyan-300/[0.06]",
                                      form.trophy_item_id === t.id && "bg-cyan-300/[0.08]"
                                    )}>
                                    {t.image_url
                                      ? <img src={t.image_url} alt={t.name} className="w-10 h-10 object-contain drop-shadow" />
                                      : <Trophy className="w-8 h-8 text-warning/20" />}
                                    <span className="line-clamp-2 w-full text-[9px] leading-tight text-white/45">{t.name}</span>
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
                  <label className="label-xs">{t("commonPages.trnBanner")}</label>
                  {(bannerPreview || form.banner_url) ? (
                    <div className="relative overflow-hidden border border-cyan-300/15" style={{ height: 90, ...tournamentDialogClip }}>
                      <div className="w-full h-full"
                        style={{ backgroundImage: `url(${bannerPreview || form.banner_url})`, backgroundSize: "cover", backgroundPosition: form.banner_position }} />
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
                      <button type="button"
                        onClick={() => { setBannerPreview(null); setBannerFile(null); setForm(f => ({ ...f, banner_url: "", banner_position: "50% 50%" })); }}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center bg-black/60 text-white hover:bg-black/80"
                        style={{ clipPath: "polygon(16% 0, 100% 0, 84% 100%, 0 100%)" }}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                      {uploadingBanner && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /></div>}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label htmlFor={bannerInputId}
                        className="flex h-14 w-full cursor-pointer touch-manipulation items-center justify-center gap-2 border border-dashed border-cyan-300/20 bg-black/20 text-xs text-white/45 transition-colors hover:border-cyan-300/40 hover:text-white/80"
                        style={tournamentDialogClip}>
                        <Upload className="w-3.5 h-3.5" /> Upload banner image
                      </label>
                      <input id={bannerInputId} ref={bannerInputRef} type="file" accept="image/*" className="sr-only"
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
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-cyan-300/12 bg-white/[0.04] px-5 py-3">
            <button type="button"
              onClick={() => setModalStep(s => Math.max(1, s - 1))}
              disabled={modalStep === 1}
              className="flex items-center gap-1 text-xs font-bold uppercase tracking-[0.12em] text-white/45 transition-colors hover:text-white disabled:opacity-30">
              <ChevronLeft className="w-3.5 h-3.5" /> {t("competitionFlow.back")}
            </button>
            <div className="flex items-center gap-1.5">
              {[1,2,3].map(n => (
                <div key={n} className={cn("h-1.5 transition-all", modalStep === n ? "w-6 bg-cyan-300" : "w-2 bg-white/15")} style={{ clipPath: "polygon(20% 0, 100% 0, 80% 100%, 0 100%)" }} />
              ))}
            </div>
            {modalStep < 3 ? (
              <button type="button"
                onClick={() => setModalStep(s => Math.min(3, s + 1))}
                disabled={modalStep === 1 && !form.name}
                className="flex items-center gap-1 text-xs font-black uppercase tracking-[0.12em] text-cyan-200 transition-colors hover:text-cyan-100 disabled:opacity-30">
                {t("competitionFlow.next")} <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <Button onClick={createTournament} disabled={creating || !form.name || !form.start_date}
                className="h-10 rounded-none border border-cyan-200/25 bg-cyan-300/90 px-7 font-heading text-xs font-black uppercase tracking-[0.12em] text-black shadow-[0_0_24px_-14px_rgba(0,229,255,0.9)] hover:bg-cyan-200 disabled:opacity-45"
                style={{ clipPath: "polygon(8% 0, 100% 0, 92% 100%, 0 100%)" }}>
                <Trophy className="w-3.5 h-3.5" />
                {creating ? t("competitionFlow.creating") : t("competitionFlow.createTournament")}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Rules Dialog ──────────────────────────────── */}
      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className="bg-card border-border max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> {t("competitionFlow.rules")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Select value={rulesType} onValueChange={setRulesType}>
              <SelectTrigger className="bg-secondary border-border rounded"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="knockout">{t("commonPages.cdKnockout")}</SelectItem>
                <SelectItem value="league">{t("commonPages.homeLeagues")}</SelectItem>
                <SelectItem value="group_stage">{t("commonPages.cdGroupStage")}</SelectItem>
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
  const { t } = useTranslation();
  const scrollRef = useRef(null);
  function scroll(dir) { scrollRef.current?.scrollBy({ left: dir * 200, behavior: "smooth" }); }

  return (
    <div className="border border-border rounded bg-card/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-widest font-bold text-warning flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5" /> {t("competitionFlow.trophiesAtStake")}
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
  const { t } = useTranslation();
  if (!tournaments.length) return (
    <div className="border border-border rounded bg-card p-10 text-center">
      <Trophy className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">{t("competitionFlow.noTournaments")}</p>
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
  const { t: translate } = useTranslation();
  const registered = t.registered_clubs?.length || 0;
  const fillPct = Math.round((registered / Math.max(t.max_teams, 1)) * 100);
  const isFull = registered >= t.max_teams;

  const bannerBg = t.banner_url
    ? { backgroundImage: `url(${t.banner_url})`, backgroundSize: "cover", backgroundPosition: t.banner_position || "50% 50%" }
    : { background: t.banner_color || "#0d1830" };

  const statusBadge = {
    registration: { label: translate("competitionFlow.open"), cls: "bg-success text-black" },
    in_progress:  { label: translate("competitionFlow.live"), cls: "bg-primary text-primary-foreground" },
    completed:    { label: translate("competitionFlow.done"), cls: "bg-muted text-muted-foreground" },
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
            <div className="absolute top-2 right-2 text-[9px] font-bold uppercase px-2 py-0.5 rounded-sm bg-destructive/80 text-white">{translate("competitionFlow.full")}</div>
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
            {t.participant_type === "player" ? `👤 ${translate("competitionFlow.players")}` : `🏟️ ${translate("competitionFlow.clubs")}`}
          </div>
        </div>

        {/* Body */}
        <div className="p-3 flex flex-col gap-2 flex-1">
          <div>
            <h3 className="font-heading font-black text-base text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-1 uppercase">
              {t.name}
            </h3>
            {t.creator_gamertag && (
              <p className="text-[10px] text-muted-foreground">{translate("competitionFlow.by", { name: t.creator_gamertag })}</p>
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
                  <div className="text-[8px] uppercase tracking-widest text-muted-foreground">{translate("competitionFlow.entry")}</div>
                  <div className="text-xs font-black text-foreground">{(t.entry_fee_stc || 0).toLocaleString()} <span className="font-normal text-muted-foreground text-[9px]">STC</span></div>
                </div>
                <div className="flex-1 bg-warning/5 border border-warning/20 rounded px-2 py-1.5 text-center">
                  <div className="text-[8px] uppercase tracking-widest text-warning flex items-center justify-center gap-0.5"><Crown className="w-2.5 h-2.5" /> {translate("competitionFlow.prize")}</div>
                  <div className="text-sm font-black text-warning">{pool.toLocaleString()} <span className="font-normal text-warning/60 text-[9px]">STC</span></div>
                </div>
              </>
            ) : (
              <div className="flex-1 bg-success/5 border border-success/20 rounded px-2 py-1.5 text-center">
                <div className="text-[8px] uppercase tracking-widest text-success">{translate("competitionFlow.entry")}</div>
                <div className="text-sm font-black text-success">{translate("competitionFlow.free")}</div>
              </div>
            )}
          </div>

          {t.start_date && isWallClockFuture(t.start_date) && t.status === "registration" && (
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

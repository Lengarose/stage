import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { stageClient } from "@/api/stageClient";
import { Shield, Search, Plus, ArrowRight, Loader2, Check, Crown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { swalAlert } from "@/lib/swal";
import { COUNTRIES, COUNTRY_REGIONS } from "@/lib/countries";
import PresidentContractDialog from "@/components/contracts/PresidentContractDialog";
import PresidentSetup, {
  buildInitialPresidentProfile,
  toPresidentApiPayload,
} from "@/components/onboarding/PresidentSetup";
import { STAGE_PLUS_MONTHLY_CREDITS, TOURNAMENT_ENTRY_CREDITS } from "@/lib/subscriptionUtils";
import { useTranslation } from "@/hooks/useTranslation";

const REGIONS = ["Europe", "North America", "South America", "Asia", "Oceania", "Africa", "Middle East"];

export default function ClubOnboardingModal({ open, player, onComplete }) {
  const { t } = useTranslation();
  const [step, setStep] = useState("choose"); // choose | president | club_profile | join
  const [creating, setCreating] = useState(false);
  const [requestingIds, setRequestingIds] = useState(new Set());
  const [requested, setRequested] = useState(new Set());
  const [clubs, setClubs] = useState([]);
  const [search, setSearch] = useState("");
  const [loadingClubs, setLoadingClubs] = useState(false);
  const [presidentContractPrompt, setPresidentContractPrompt] = useState(null);
  const [presidentProfile, setPresidentProfile] = useState(() => buildInitialPresidentProfile(player));

  const [form, setForm] = useState({
    name: "", tag: "", platform: player?.platform || "PlayStation",
    region: "Europe", country_code: "", description: "",
  });

  useEffect(() => {
    if (step === "join") loadClubs();
  }, [step]);

  async function loadClubs(q = "") {
    setLoadingClubs(true);
    const [all, existingRequests] = await Promise.all([
      stageClient.entities.Club.list("-rating", 200),
      player?.id
        ? stageClient.entities.JoinRequest.filter({ player_id: player.id }, "-created_date", 200).catch(() => [])
        : Promise.resolve([]),
    ]);

    const existingRequestedIds = new Set(
      (existingRequests || [])
        .filter((r) => !["rejected", "cancelled", "withdrawn"].includes(String(r.status || "").toLowerCase()))
        .map((r) => r.club_id)
        .filter(Boolean)
    );
    setRequested(existingRequestedIds);

    const filtered = q
      ? all.filter(c => c.name?.toLowerCase().includes(q.toLowerCase()) || c.tag?.toLowerCase().includes(q.toLowerCase()))
      : all;

    const dedupedBySignature = new Map();
    for (const club of filtered.filter(c => c.status !== "disbanded")) {
      const signature = [
        String(club.name || "").trim().toLowerCase(),
        String(club.tag || "").trim().toLowerCase(),
        String(club.platform || "").trim().toLowerCase(),
        String(club.region || "").trim().toLowerCase(),
      ].join("::");
      const existing = dedupedBySignature.get(signature);
      if (!existing || Number(club.rating || 0) > Number(existing.rating || 0)) {
        dedupedBySignature.set(signature, club);
      }
    }

    setClubs(Array.from(dedupedBySignature.values()));
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
        creator_player_id: player?.id,
        president: toPresidentApiPayload(presidentProfile),
      });
      if (!club?.id) throw new Error("Server returned no club ID");
      setPresidentContractPrompt({ club, player, contractId: club.owner_contract_id });
    } catch (err) {
      console.error("Club creation failed:", err);
      await swalAlert("Failed to create club: " + (err?.message || err));
    } finally {
      setCreating(false);
    }
  }

  async function handleJoinRequest(club) {
    if (!player) return;
    if (requested.has(club.id)) return;
    if (requestingIds.has(club.id)) return;

    setRequestingIds((prev) => new Set(prev).add(club.id));
    try {
      await stageClient.entities.JoinRequest.create({
        player_id: player.id,
        player_email: player.email,
        player_gamertag: player.gamertag,
        club_id: club.id,
        club_name: club.name,
        message: t("commonPages.comJoinMessage"),
        status: "pending",
      });
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
    } finally {
      setRequestingIds((prev) => {
        const next = new Set(prev);
        next.delete(club.id);
        return next;
      });
    }
  }

  const filteredClubs = search
    ? clubs.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()) || c.tag?.toLowerCase().includes(search.toLowerCase()))
    : clubs;

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onComplete?.(null);
      }}
    >
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Shield className="w-5 h-5 text-primary" />
            {step === "choose" && t("commonPages.comJoinOrCreate")}
            {step === "president" && "Create President Profile"}
            {step === "club_profile" && "Create Club Profile"}
            {step === "join" && t("commonPages.comFindClub")}
          </DialogTitle>
        </DialogHeader>

        {step === "choose" && (
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">{t("commonPages.comWelcome", { name: player?.gamertag })}</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStep("president")}
                className="bg-primary/10 border border-primary/30 hover:border-primary/60 rounded-2xl p-5 text-left transition-all group"
              >
                <Plus className="w-8 h-8 text-primary mb-3" />
                <p className="font-bold text-foreground text-base">{t("commonPages.comCreateClub")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("commonPages.comCreateClubDesc")}</p>
              </button>
              <button
                type="button"
                onClick={() => setStep("join")}
                className="bg-secondary border border-border hover:border-primary/40 rounded-2xl p-5 text-left transition-all group"
              >
                <Search className="w-8 h-8 text-muted-foreground group-hover:text-primary mb-3 transition-colors" />
                <p className="font-bold text-foreground text-base">{t("commonPages.comJoinClub")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("commonPages.comJoinClubDesc")}</p>
              </button>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                  <Crown className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    {t("commonPages.comStagePlusTitle")}
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("commonPages.comStagePlusDesc", { credits: TOURNAMENT_ENTRY_CREDITS, monthlyCredits: STAGE_PLUS_MONTHLY_CREDITS })}
                  </p>
                </div>
              </div>
            </div>
            <Button variant="ghost" onClick={() => onComplete?.(null)} className="w-full text-muted-foreground text-sm">
              {t("commonPages.comSkipForNow")}
            </Button>
          </div>
        )}

        {step === "president" && (
          <div className="space-y-3 mt-2">
            <button type="button" onClick={() => setStep("choose")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              {t("commonPages.comBack")}
            </button>
            <div className="rounded-xl border border-border bg-[#0d2461]/95 p-3">
              <PresidentSetup
                initialProfile={presidentProfile}
                player={player}
                onContinue={(profile) => {
                  setPresidentProfile(profile);
                  setStep("club_profile");
                }}
              />
            </div>
          </div>
        )}

        {step === "club_profile" && (
          <div className="space-y-4 mt-2">
            <button type="button" onClick={() => setStep("president")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              {t("commonPages.comBack")}
            </button>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.comClubName")}</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="FC Example" className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.comTagMax5")}</label>
              <Input value={form.tag} maxLength={5} onChange={e => setForm(f => ({ ...f, tag: e.target.value.toUpperCase() }))} placeholder="FCE" className="bg-secondary border-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.comPlatform")}</label>
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
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.comRegion")}</label>
                <Select value={form.region} onValueChange={v => setForm(f => ({ ...f, region: v, country_code: "" }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.comCountry")}</label>
              <Select value={form.country_code} onValueChange={v => setForm(f => ({ ...f, country_code: v }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder={t("commonPages.comSelectCountry")} /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES
                    .filter(c => !form.region || (COUNTRY_REGIONS[form.region] || []).includes(c.code))
                    .map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.comClubDesc")}</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={t("commonPages.comClubDescPlaceholder")} className="bg-secondary border-border resize-none h-20" />
            </div>
            <Button
              onClick={handleCreate}
              disabled={creating || !form.name || !form.tag || !form.country_code}
              className="w-full bg-primary text-primary-foreground"
            >
              {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("commonPages.comCreating")}</> : <><Shield className="w-4 h-4 mr-2" /> {t("commonPages.comCreateClub")}</>}
            </Button>
          </div>
        )}

        {step === "join" && (
          <div className="space-y-4 mt-2">
            <button type="button" onClick={() => setStep("choose")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              {t("commonPages.comBack")}
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t("commonPages.comSearchPlaceholder")}
                className="pl-9 bg-secondary border-border"
              />
            </div>
            {loadingClubs && <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {filteredClubs.length === 0 && !loadingClubs && (
                <p className="text-sm text-muted-foreground text-center py-6">{t("commonPages.comNoClubsFound")}</p>
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
                      <p className="text-xs text-muted-foreground">{c.platform} · {c.region} · {t("commonPages.comRating", { rating: c.rating || 1000 })}</p>
                    </div>
                    <Button
                      size="sm"
                      disabled={isRequested || requestingIds.has(c.id)}
                      onClick={() => handleJoinRequest(c)}
                      className={cn("shrink-0 text-xs", isRequested ? "bg-success/20 text-success border border-success/30" : "bg-primary/10 text-primary hover:bg-primary/20 border-0")}
                    >
                      {requestingIds.has(c.id) ? <Loader2 className="w-3 h-3 animate-spin" /> : isRequested ? <><Check className="w-3 h-3 mr-1" /> {t("commonPages.comSent")}</> : <>{t("commonPages.comRequest")} <ArrowRight className="w-3 h-3 ml-1" /></>}
                    </Button>
                  </div>
                );
              })}
            </div>
            {requested.size > 0 && (
              <Button onClick={() => onComplete?.(null)} className="w-full bg-primary text-primary-foreground">
                {t("commonPages.comDone", { count: requested.size, plural: requested.size > 1 ? "s" : "" })}
              </Button>
            )}
            <Button variant="ghost" onClick={() => onComplete?.(null)} className="w-full text-muted-foreground text-sm">
              {t("commonPages.comSkipForNow")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
    <PresidentContractDialog
      open={!!presidentContractPrompt}
      club={presidentContractPrompt?.club}
      player={presidentContractPrompt?.player}
      contractId={presidentContractPrompt?.contractId}
      onSigned={() => {
        const club = presidentContractPrompt?.club;
        setPresidentContractPrompt(null);
        onComplete?.(club);
      }}
      onClose={() => setPresidentContractPrompt(null)}
    />
    </>
  );
}

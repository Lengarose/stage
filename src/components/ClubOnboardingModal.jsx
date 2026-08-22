import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { stageClient } from "@/api/stageClient";
import { Shield, Plus, Loader2, Crown, Sparkles } from "lucide-react";
import { swalAlert } from "@/lib/swal";
import { COUNTRIES, getRegionForCountryCode } from "@/lib/countries";
import { STAGE_PLUS_MONTHLY_CREDITS, TOURNAMENT_ENTRY_CREDITS } from "@/lib/subscriptionUtils";
import { useTranslation } from "@/hooks/useTranslation";

const REGIONS = ["Europe", "North America", "South America", "Asia", "Oceania", "Africa", "Middle East"];

export default function ClubOnboardingModal({ open, player, onComplete }) {
  const { t } = useTranslation();
  const [step, setStep] = useState("choose"); // choose | club_profile
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    name: "", tag: "", platform: player?.platform || "PlayStation",
    region: "Europe", country_code: "", description: "",
  });

  async function handleCreate() {
    if (!form.name || !form.tag || !form.country_code) return;
    setCreating(true);
    try {
      if (!player?.id) throw new Error("Create your Player profile before founding a club.");
      const u = await stageClient.auth.me();
      const founderState = await stageClient.clubs.createFounder({
        player_id: player.id,
        idempotency_key: `${u?.id || u?.email || "user"}:${player.id}:${form.name.trim().toLowerCase()}`,
        club: {
          owner_email: u?.email,
          name: form.name,
          tag: form.tag.toUpperCase(),
          platform: form.platform,
          region: form.region,
          country_code: form.country_code,
          description: form.description || "",
          logo_url: null,
          trophies: [],
        },
      });
      const club = founderState?.club;
      if (!club?.id) throw new Error("Server returned no club ID");
      onComplete?.(club, founderState);
    } catch (err) {
      console.error("Club creation failed:", err);
      await swalAlert("Failed to create club: " + (err?.message || err));
    } finally {
      setCreating(false);
    }
  }

  return (
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
            {step === "club_profile" && "Create Club Profile"}
          </DialogTitle>
        </DialogHeader>

        {step === "choose" && (
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">{t("commonPages.comWelcome", { name: player?.gamertag })}</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStep("club_profile")}
                className="bg-primary/10 border border-primary/30 hover:border-primary/60 rounded-2xl p-5 text-left transition-all group"
              >
                <Plus className="w-8 h-8 text-primary mb-3" />
                <p className="font-bold text-foreground text-base">{t("commonPages.comCreateClub")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("commonPages.comCreateClubDesc")}</p>
              </button>
              <button
                type="button"
                onClick={() => onComplete?.(null)}
                className="bg-secondary border border-border hover:border-primary/40 rounded-2xl p-5 text-left transition-all group"
              >
                <Shield className="w-8 h-8 text-muted-foreground group-hover:text-primary mb-3 transition-colors" />
                <p className="font-bold text-foreground text-base">Free agent</p>
                <p className="text-xs text-muted-foreground mt-1">Wait for a club to offer you a contract.</p>
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

        {step === "club_profile" && (
          <div className="space-y-4 mt-2">
            <button type="button" onClick={() => setStep("choose")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
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
                <Select value={form.region} onValueChange={v => setForm(f => ({ ...f, region: v }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.comCountry")}</label>
              <Select
                value={form.country_code}
                onValueChange={(code) => setForm((f) => ({
                  ...f,
                  country_code: code,
                  region: getRegionForCountryCode(code) || f.region,
                }))}
              >
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder={t("commonPages.comSelectCountry")} /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
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
      </DialogContent>
    </Dialog>
  );
}

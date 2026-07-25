// @ts-nocheck — admin UI uses project shadcn primitives without full prop inference.
import { useEffect, useMemo, useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ShoppingBag, Crown, Coins, RefreshCw, Save, ShieldCheck } from "lucide-react";
import {
  COMMUNITY_TOURNAMENT_LIMIT,
  STAGE_PLUS_MONTHLY_CREDITS,
  STAGE_PLUS_PRICE,
  TOURNAMENT_ENTRY_CREDITS,
} from "@/lib/subscriptionUtils";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/useTranslation";

const DEFAULT_FORM = {
  id: null,
  name: "STAGE Plus",
  stage_plus_monthly_price: STAGE_PLUS_PRICE.monthly,
  stage_plus_yearly_price: STAGE_PLUS_PRICE.yearly,
  monthly_credits: STAGE_PLUS_MONTHLY_CREDITS,
  starter_credits: TOURNAMENT_ENTRY_CREDITS,
  tournament_entry_credits: TOURNAMENT_ENTRY_CREDITS,
  community_tournament_limit: COMMUNITY_TOURNAMENT_LIMIT,
  headline: "One membership for serious competitors",
  description: "STAGE Plus unlocks official competitions, tournament creation, ranked play, and a monthly credit refresh.",
  badge_image_url: "/uploads/stage-plus-badge.png",
  perks: [
    "Enter official STAGE competitions and regional leagues",
    "Create community tournaments",
    "300 credits refreshed every month",
    "Ranked player and club competition access",
    "Advanced player and club discovery",
  ],
  is_active: 1,
};

export default function StoreTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const perksText = useMemo(() => (Array.isArray(form.perks) ? form.perks.join("\n") : String(form.perks || "")), [form.perks]);

  useEffect(() => {
    void loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const rows = await stageClient.entities.StoreConfig.filter({ is_active: 1, with_defaults: 1 }, "-updated_date", 1).catch(() => []);
      setForm({ ...DEFAULT_FORM, ...(rows?.[0] || {}) });
    } finally {
      setLoading(false);
    }
  }

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function buildPayload() {
    return {
      name: form.name || "STAGE Plus",
      stage_plus_monthly_price: Number(form.stage_plus_monthly_price) || STAGE_PLUS_PRICE.monthly,
      stage_plus_yearly_price: Number(form.stage_plus_yearly_price) || STAGE_PLUS_PRICE.yearly,
      monthly_credits: Number(form.monthly_credits) || STAGE_PLUS_MONTHLY_CREDITS,
      starter_credits: Number(form.starter_credits) || TOURNAMENT_ENTRY_CREDITS,
      tournament_entry_credits: Number(form.tournament_entry_credits) || TOURNAMENT_ENTRY_CREDITS,
      community_tournament_limit: Number(form.community_tournament_limit) || COMMUNITY_TOURNAMENT_LIMIT,
      headline: form.headline || DEFAULT_FORM.headline,
      description: form.description || DEFAULT_FORM.description,
      badge_image_url: form.badge_image_url || DEFAULT_FORM.badge_image_url,
      perks: perksText.split("\n").map((p) => p.trim()).filter(Boolean),
      is_active: 1,
      reason: t("admin.store.updatedFromAdmin"),
    };
  }

  async function saveConfig() {
    setSaving(true);
    try {
      const payload = buildPayload();
      const saved = form.id
        ? await stageClient.entities.StoreConfig.update(form.id, payload)
        : await stageClient.entities.StoreConfig.create(payload);
      setForm({ ...DEFAULT_FORM, ...saved });
      toast({ title: t("admin.store.storeUpdated"), description: t("admin.store.settingsLive") });
    } catch (err) {
      toast({ title: t("admin.store.saveFailed"), description: err?.message || t("admin.store.couldNotUpdate"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-5 h-5 text-primary" />
            <div>
              <h2 className="font-heading text-xl uppercase text-foreground">{t("admin.store.storeSettings")}</h2>
              <p className="text-xs text-muted-foreground">{t("admin.store.storeSettingsDesc")}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={loadConfig} className="gap-1.5 border-border">
              <RefreshCw className="w-4 h-4" /> {t("admin.analytics.reload")}
            </Button>
            <Button type="button" onClick={saveConfig} disabled={saving} className="gap-1.5 bg-primary text-primary-foreground">
              <Save className="w-4 h-4" /> {saving ? t("admin.actions.savingDots") : t("admin.store.saveStore")}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_0.8fr] gap-5">
        <div className="bg-card border border-border rounded p-4 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("admin.store.planName")}</label>
            <Input value={form.name || ""} onChange={(e) => setField("name", e.target.value)} className="bg-secondary border-border" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("admin.store.monthlyPrice")}</label>
              <Input type="number" step="0.01" value={form.stage_plus_monthly_price} onChange={(e) => setField("stage_plus_monthly_price", e.target.value)} className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("admin.store.yearlyPrice")}</label>
              <Input type="number" step="0.01" value={form.stage_plus_yearly_price} onChange={(e) => setField("stage_plus_yearly_price", e.target.value)} className="bg-secondary border-border" />
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("admin.store.monthlyCredits")}</label>
              <Input type="number" value={form.monthly_credits} onChange={(e) => setField("monthly_credits", e.target.value)} className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("admin.store.starterCredits")}</label>
              <Input type="number" value={form.starter_credits} onChange={(e) => setField("starter_credits", e.target.value)} className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("admin.store.entryCredits")}</label>
              <Input type="number" value={form.tournament_entry_credits} onChange={(e) => setField("tournament_entry_credits", e.target.value)} className="bg-secondary border-border" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("admin.store.tournamentLimit")}</label>
            <Input type="number" value={form.community_tournament_limit} onChange={(e) => setField("community_tournament_limit", e.target.value)} className="bg-secondary border-border" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("admin.store.headline")}</label>
            <Input value={form.headline || ""} onChange={(e) => setField("headline", e.target.value)} className="bg-secondary border-border" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("admin.editors.description")}</label>
            <Textarea value={form.description || ""} onChange={(e) => setField("description", e.target.value)} className="bg-secondary border-border min-h-24" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("admin.store.badgeImageUrl")}</label>
            <Input value={form.badge_image_url || ""} onChange={(e) => setField("badge_image_url", e.target.value)} className="bg-secondary border-border" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("admin.store.perksLabel")}</label>
            <Textarea value={perksText} onChange={(e) => setField("perks", e.target.value.split("\n"))} className="bg-secondary border-border min-h-36" />
          </div>
        </div>

        <div className="bg-card border border-primary/20 rounded p-5 h-fit space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
              {form.badge_image_url ? (
                <img src={form.badge_image_url} alt={t("admin.store.badge")} className="w-full h-full object-cover rounded-xl" />
              ) : (
                <Crown className="w-6 h-6 text-primary" />
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("admin.store.storePreview")}</p>
              <h3 className="text-2xl font-bold text-foreground">{form.name || t("admin.store.stagePlus")}</h3>
            </div>
          </div>
          <div>
            <p className="font-bold text-primary">{t("admin.store.perMonth", { price: Number(form.stage_plus_monthly_price || 0).toFixed(2) })}</p>
            <p className="text-xs text-muted-foreground">{t("admin.store.perYear", { price: Number(form.stage_plus_yearly_price || 0).toFixed(2) })}</p>
          </div>
          <p className="text-sm text-muted-foreground">{form.description}</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded border border-border bg-secondary/70 p-3">
              <Coins className="w-4 h-4 text-warning mb-2" />
              <p className="font-black text-warning">{form.monthly_credits}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("admin.store.monthly")}</p>
            </div>
            <div className="rounded border border-border bg-secondary/70 p-3">
              <ShieldCheck className="w-4 h-4 text-success mb-2" />
              <p className="font-black text-success">{form.starter_credits}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("admin.store.starter")}</p>
            </div>
            <div className="rounded border border-border bg-secondary/70 p-3">
              <Crown className="w-4 h-4 text-primary mb-2" />
              <p className="font-black text-primary">{form.community_tournament_limit}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("admin.store.events")}</p>
            </div>
          </div>
          <ul className="space-y-2">
            {perksText.split("\n").filter(Boolean).slice(0, 6).map((perk) => (
              <li key={perk} className="flex items-center gap-2 text-sm text-foreground">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                {perk}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground border-t border-border pt-3">
            {t("admin.store.stripeNote")}
          </p>
        </div>
      </div>
    </div>
  );
}

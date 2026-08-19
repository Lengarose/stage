// @ts-nocheck — admin UI uses project shadcn primitives without full prop inference.
import { useEffect, useMemo, useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ShoppingBag, Crown, Coins, RefreshCw, Save, ShieldCheck, Package, Image as ImageIcon, Upload, Trash2, Power } from "lucide-react";
import {
  CREDIT_PACKS,
  STAGE_PLUS_MONTHLY_CREDITS,
  STAGE_PLUS_PRICE,
  TOURNAMENT_ENTRY_CREDITS,
} from "@/lib/subscriptionUtils";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

const DEFAULT_FORM = {
  id: null,
  name: "STAGE Plus",
  stage_plus_monthly_price: STAGE_PLUS_PRICE.monthly,
  stage_plus_yearly_price: STAGE_PLUS_PRICE.yearly,
  monthly_credits: STAGE_PLUS_MONTHLY_CREDITS,
  starter_credits: TOURNAMENT_ENTRY_CREDITS,
  tournament_entry_credits: TOURNAMENT_ENTRY_CREDITS,
  community_tournament_limit: 0,
  headline: "One membership for serious competitors",
  description: "STAGE Plus unlocks official competitions, community tournament creation, full rankings, full stats, and a monthly credit refresh.",
  badge_image_url: "/uploads/stage-plus-badge.png",
  perks: [
    "150 credits refreshed every month",
    "Enter official STAGE competitions and regional leagues",
    "Create community tournaments",
    "Ranked player and club tournament access",
    "Full rankings and position rankings",
    "Full player and club stats",
    "Advanced recruitment and search filters",
    "Custom player card backgrounds",
    "Upload your own player card background",
    "Choose exclusive STAGE Plus card background designs",
    "Custom Club Profile stats tile backgrounds",
    "Upload your own club stats tile background",
    "Custom Career tab tile backgrounds",
    "Upload your own career tile background",
  ],
  is_active: 1,
};

function normalizeAdminStoreForm(row = {}) {
  const rawDescription = String(row.description || "").trim();
  const legacyDescription = !rawDescription
    || /ranked play/i.test(rawDescription)
    || (/monthly credit refresh/i.test(rawDescription) && !/full rankings/i.test(rawDescription));
  const rawPerks = Array.isArray(row.perks) ? row.perks : [];
  const hasLegacyPerks = rawPerks.some((perk) => /300 credits|advanced player and club discovery|active events|premium/i.test(String(perk)));
  return {
    ...DEFAULT_FORM,
    ...row,
    stage_plus_monthly_price: STAGE_PLUS_PRICE.monthly,
    stage_plus_yearly_price: STAGE_PLUS_PRICE.yearly,
    monthly_credits: STAGE_PLUS_MONTHLY_CREDITS,
    starter_credits: TOURNAMENT_ENTRY_CREDITS,
    tournament_entry_credits: TOURNAMENT_ENTRY_CREDITS,
    community_tournament_limit: 0,
    description: legacyDescription ? DEFAULT_FORM.description : rawDescription,
    perks: rawPerks.length && !hasLegacyPerks ? rawPerks : DEFAULT_FORM.perks,
  };
}

export default function StoreTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [backgrounds, setBackgrounds] = useState([]);
  const [backgroundForm, setBackgroundForm] = useState({ name: "", image_url: "", description: "", sort_order: 0 });
  const [backgroundFile, setBackgroundFile] = useState(null);
  const [backgroundBusy, setBackgroundBusy] = useState(null);
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
      const bgRows = await stageClient.entities.PlayerCardBackground.filter({ include_inactive: 1 }, "sort_order", 200).catch(() => []);
      setForm(normalizeAdminStoreForm(rows?.[0]));
      setBackgrounds(bgRows || []);
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
      community_tournament_limit: 0,
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
      setForm(normalizeAdminStoreForm(saved));
      toast({ title: t("admin.store.storeUpdated"), description: t("admin.store.settingsLive") });
    } catch (err) {
      toast({ title: t("admin.store.saveFailed"), description: err?.message || t("admin.store.couldNotUpdate"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function saveBackground() {
    const name = backgroundForm.name.trim();
    setBackgroundBusy("create");
    try {
      let imageUrl = backgroundForm.image_url.trim();
      if (backgroundFile) {
        const uploaded = await stageClient.integrations.Core.UploadFile({ file: backgroundFile });
        imageUrl = uploaded.file_url;
      }
      if (!name || !imageUrl) throw new Error("Name and image are required.");
      await stageClient.entities.PlayerCardBackground.create({
        name,
        image_url: imageUrl,
        description: backgroundForm.description.trim(),
        sort_order: Number(backgroundForm.sort_order) || 0,
        is_active: 1,
        reason: "Admin added STAGE Plus player card background",
      });
      setBackgroundForm({ name: "", image_url: "", description: "", sort_order: 0 });
      setBackgroundFile(null);
      const bgRows = await stageClient.entities.PlayerCardBackground.filter({ include_inactive: 1 }, "sort_order", 200).catch(() => []);
      setBackgrounds(bgRows || []);
      toast({ title: "Background added", description: "The STAGE Plus player card design is available." });
    } catch (err) {
      toast({ title: "Could not save background", description: err?.message || "Upload failed.", variant: "destructive" });
    } finally {
      setBackgroundBusy(null);
    }
  }

  async function updateBackground(row, patch) {
    setBackgroundBusy(row.id);
    try {
      const updated = await stageClient.entities.PlayerCardBackground.update(row.id, {
        ...row,
        ...patch,
        reason: "Admin updated STAGE Plus player card background",
      });
      setBackgrounds((prev) => prev.map((item) => item.id === row.id ? updated : item));
    } catch (err) {
      toast({ title: "Could not update background", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setBackgroundBusy(null);
    }
  }

  async function deleteBackground(row) {
    if (!window.confirm(`Remove "${row.name}" from the official card background catalog?`)) return;
    setBackgroundBusy(row.id);
    try {
      await stageClient.entities.PlayerCardBackground.delete(row.id);
      setBackgrounds((prev) => prev.filter((item) => item.id !== row.id));
    } catch (err) {
      toast({ title: "Could not delete background", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setBackgroundBusy(null);
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
          <div className="grid grid-cols-2 gap-2">
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

      <div className="bg-card border border-border rounded p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-warning" />
          <h3 className="font-heading text-sm uppercase tracking-wider text-foreground">{t("admin.store.creditPacks")}</h3>
        </div>
        <p className="text-xs text-muted-foreground">{t("admin.store.creditPacksDesc")}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CREDIT_PACKS.map((pack) => (
            <div key={pack.id} className="rounded border border-border bg-secondary/60 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{pack.label}</p>
              <p className="font-black text-warning text-lg">{pack.credits}</p>
              <p className="text-xs text-foreground font-semibold">€{pack.price_eur.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">{pack.purpose}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-primary/20 rounded p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary" />
            <div>
              <h3 className="font-heading text-sm uppercase tracking-wider text-foreground">STAGE Plus player card backgrounds</h3>
              <p className="text-xs text-muted-foreground">Manage official preset designs that Plus players can choose.</p>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={loadConfig} className="gap-1.5 border-border">
            <RefreshCw className="w-4 h-4" /> Reload
          </Button>
        </div>

        <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-4">
          <div className="rounded border border-border bg-secondary/40 p-3 space-y-3">
            <Input
              value={backgroundForm.name}
              onChange={(e) => setBackgroundForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Background name"
              className="bg-card border-border"
            />
            <Input
              value={backgroundForm.image_url}
              onChange={(e) => setBackgroundForm((prev) => ({ ...prev, image_url: e.target.value }))}
              placeholder="Image URL, or upload below"
              className="bg-card border-border"
            />
            <Input
              value={backgroundForm.description}
              onChange={(e) => setBackgroundForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Short description"
              className="bg-card border-border"
            />
            <Input
              type="number"
              value={backgroundForm.sort_order}
              onChange={(e) => setBackgroundForm((prev) => ({ ...prev, sort_order: e.target.value }))}
              placeholder="Sort order"
              className="bg-card border-border"
            />
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded border border-dashed border-primary/30 bg-primary/5 px-3 py-3 text-xs font-semibold text-primary">
              <Upload className="w-4 h-4" />
              {backgroundFile ? backgroundFile.name : "Upload background image"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => setBackgroundFile(e.target.files?.[0] || null)}
              />
            </label>
            <Button type="button" onClick={saveBackground} disabled={backgroundBusy === "create"} className="w-full gap-1.5">
              {backgroundBusy === "create" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Add background
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {backgrounds.length ? backgrounds.map((row) => (
              <div key={row.id} className="overflow-hidden rounded border border-border bg-secondary/40">
                <div className="aspect-[16/9] bg-background">
                  <img src={row.image_url} alt={row.name} className="h-full w-full object-cover" />
                </div>
                <div className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">{row.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.description || "Official STAGE Plus design"}</p>
                    </div>
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase", Number(row.is_active) ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                      {Number(row.is_active) ? "Active" : "Off"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={backgroundBusy === row.id}
                      onClick={() => updateBackground(row, { is_active: Number(row.is_active) ? 0 : 1 })}
                      className="h-8 flex-1 gap-1 border-border text-xs"
                    >
                      <Power className="w-3.5 h-3.5" />
                      {Number(row.is_active) ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={backgroundBusy === row.id}
                      onClick={() => deleteBackground(row)}
                      className="h-8 gap-1 border-destructive/30 text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )) : (
              <div className="rounded border border-dashed border-border p-8 text-center text-sm text-muted-foreground sm:col-span-2">
                No official player card backgrounds yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

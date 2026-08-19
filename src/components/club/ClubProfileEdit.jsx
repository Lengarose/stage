import { useState } from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProfileEditShell from "@/components/profile/ProfileEditShell";
import { COUNTRIES } from "@/lib/countries";
import { useTranslation } from "@/hooks/useTranslation";
import { stageClient } from "@/api/stageClient";
import { asObject } from "@/lib/safeData";

const REGIONS = ["Europe", "North America", "South America", "Asia", "Oceania", "Middle East"];

export default function ClubProfileEdit({
  club,
  onBack,
  onSaved,
  onDelete = null,
  canDelete = false,
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => ({
    name: club?.name || "",
    tag: club?.tag || "",
    platform: club?.platform || "PlayStation",
    region: club?.region || "Europe",
    country_code: club?.country_code || "",
    description: club?.description || "",
    logo_url: club?.logo_url || "",
    logo_position: club?.logo_position || "50% 50%",
    logo_zoom: club?.logo_zoom || 150,
    banner_url: club?.banner_url || "",
    banner_position: club?.banner_position || "50% 50%",
    banner_zoom: club?.banner_zoom || 150,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function persistLogo({ url, position, zoom }) {
    const patch = {
      logo_url: url,
      logo_position: position,
      logo_zoom: zoom,
    };
    setForm((prev) => ({ ...prev, ...patch }));
    try {
      const updated = asObject(await stageClient.entities.Club.update(club.id, patch));
      onSaved?.(updated || { ...club, ...patch });
    } catch (err) {
      console.error("Failed to save club logo:", err);
      setError(err?.data?.error || err?.message || t("commonPages.obErrSave"));
    }
  }

  async function persistBanner(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
    try {
      const updated = asObject(await stageClient.entities.Club.update(club.id, patch));
      onSaved?.(updated || { ...club, ...patch });
    } catch (err) {
      console.error("Failed to save club banner:", err);
      setError(err?.data?.error || err?.message || t("commonPages.obErrSave"));
    }
  }

  async function saveInfo() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        tag: form.tag.trim().toUpperCase(),
        platform: form.platform,
        region: form.region,
        country_code: form.country_code || null,
        description: form.description || "",
      };
      const updated = asObject(await stageClient.entities.Club.update(club.id, payload));
      onSaved?.(updated || { ...club, ...payload, ...form });
      onBack?.();
    } catch (err) {
      console.error("Failed to save club profile:", err);
      setError(err?.data?.error || err?.message || t("commonPages.obErrSave"));
    } finally {
      setSaving(false);
    }
  }

  const canSave = Boolean(form.name?.trim() && form.tag?.trim());

  return (
    <ProfileEditShell
      title={t("commonPages.profEditProfile")}
      infoTitle={t("commonPages.profClubInfo")}
      onBack={onBack}
      photoUrl={form.logo_url}
      photoPosition={form.logo_position}
      photoZoom={form.logo_zoom}
      photoShape="circle"
      photoPreviewClub={form}
      bannerUrl={form.banner_url}
      bannerPosition={form.banner_position}
      bannerZoom={form.banner_zoom}
      bannerPreview={{
        name: form.name,
        subtitle: `${form.platform} · ${form.region}`,
        avatarUrl: form.logo_url,
        type: "club",
      }}
      onPhotoChange={persistLogo}
      onBannerChange={persistBanner}
      footer={(
        <>
          {error ? (
            <p className="text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </p>
          ) : null}
          <Button
            type="button"
            onClick={saveInfo}
            disabled={saving || !canSave}
            className="bg-primary text-primary-foreground"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {saving ? t("commonPages.profSaving") : t("commonPages.profSaveChanges")}
          </Button>
          {canDelete && onDelete ? (
            <Button
              type="button"
              variant="ghost"
              onClick={onDelete}
              className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive border border-destructive/20"
            >
              <Trash2 className="w-4 h-4 mr-2" /> {t("commonPages.cdDeleteClub")}
            </Button>
          ) : null}
        </>
      )}
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.profClubName")}</label>
          <Input value={form.name} onChange={(e) => update("name", e.target.value)} className="bg-secondary border-border" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.profTag")}</label>
          <Input value={form.tag} maxLength={5} onChange={(e) => update("tag", e.target.value.toUpperCase())} className="bg-secondary border-border" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.platform")}</label>
          <Select value={form.platform} onValueChange={(v) => update("platform", v)}>
            <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PlayStation">PlayStation</SelectItem>
              <SelectItem value="Xbox">Xbox</SelectItem>
              <SelectItem value="PC">PC</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.profRegion")}</label>
          <Select value={form.region} onValueChange={(v) => update("region", v)}>
            <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              {REGIONS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.country")}</label>
          <Select value={form.country_code || ""} onValueChange={(v) => update("country_code", v)}>
            <SelectTrigger className="bg-secondary border-border">
              <SelectValue placeholder={t("commonPages.profSelectCountryShort")} />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.profClubDesc")}</label>
        <Textarea
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          className="bg-secondary border-border resize-none"
          rows={3}
          placeholder={t("commonPages.profClubDescPlaceholder")}
        />
      </div>
    </ProfileEditShell>
  );
}

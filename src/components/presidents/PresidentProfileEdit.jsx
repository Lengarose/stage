import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProfileEditShell from "@/components/profile/ProfileEditShell";
import {
  buildProfileFromPresident,
  toPresidentApiPayload,
} from "@/components/onboarding/PresidentSetup";
import { COUNTRIES } from "@/lib/countries";
import { useTranslation } from "@/hooks/useTranslation";
import { stageClient } from "@/api/stageClient";
import { asObject } from "@/lib/safeData";

const SUCCESS_LEVELS = [
  ["less_successful", "presSuccessLess"],
  ["successful", "presSuccessSuccessful"],
  ["more_successful", "presSuccessMore"],
  ["most_successful", "presSuccessMost"],
  ["boss", "presSuccessBoss"],
];

export default function PresidentProfileEdit({
  president,
  onBack,
  onSaved,
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => buildProfileFromPresident(president));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function persistPhoto({ url, position, zoom }) {
    const patch = {
      avatar_url: url,
      avatar_position: position,
      avatar_zoom: zoom,
    };
    setForm((prev) => ({ ...prev, ...patch }));
    try {
      const updated = asObject(await stageClient.entities.President.update(president.id, patch));
      onSaved?.(updated || { ...president, ...patch });
    } catch (err) {
      console.error("Failed to save president photo:", err);
      setError(err?.data?.error || err?.message || t("commonPages.obErrSave"));
    }
  }

  async function persistBanner(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
    try {
      const updated = asObject(await stageClient.entities.President.update(president.id, patch));
      onSaved?.(updated || { ...president, ...patch });
    } catch (err) {
      console.error("Failed to save president banner:", err);
      setError(err?.data?.error || err?.message || t("commonPages.obErrSave"));
    }
  }

  async function saveInfo() {
    setSaving(true);
    setError(null);
    try {
      const payload = toPresidentApiPayload(form);
      const updated = asObject(await stageClient.entities.President.update(president.id, payload));
      onSaved?.(updated || { ...president, ...payload });
      onBack?.();
    } catch (err) {
      console.error("Failed to save president profile:", err);
      setError(err?.data?.error || err?.message || t("commonPages.obErrSave"));
    } finally {
      setSaving(false);
    }
  }

  const canSave = Boolean(form.display_name?.trim() && form.role_title?.trim());

  return (
    <ProfileEditShell
      title={t("commonPages.profEditProfile")}
      infoTitle={t("commonPages.presInfoTitle")}
      onBack={onBack}
      photoUrl={form.avatar_url}
      photoPosition={form.avatar_position}
      photoZoom={form.avatar_zoom}
      bannerUrl={form.banner_url}
      bannerPosition={form.banner_position}
      bannerZoom={form.banner_zoom}
      bannerPreview={{
        name: form.display_name,
        subtitle: t("commonPages.presProfileMenu"),
        avatarUrl: form.avatar_url,
        type: "player",
      }}
      onPhotoChange={persistPhoto}
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
        </>
      )}
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.presName")}</label>
          <Input value={form.display_name} onChange={(e) => update("display_name", e.target.value)} className="bg-secondary border-border" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.presRoleTitle")}</label>
          <Input value={form.role_title} onChange={(e) => update("role_title", e.target.value)} className="bg-secondary border-border" placeholder={t("commonPages.presRoleTitlePlaceholder")} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.presSuccessLevel")}</label>
          <Select value={form.success_level} onValueChange={(v) => update("success_level", v)}>
            <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SUCCESS_LEVELS.map(([value, key]) => (
                <SelectItem key={value} value={value}>{t(`commonPages.${key}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.country")}</label>
          <Select
            value={form.country || COUNTRIES.find((c) => c.code === form.country_code)?.name || ""}
            onValueChange={(name) => {
              const found = COUNTRIES.find((c) => c.name === name);
              setForm((prev) => ({
                ...prev,
                country: name,
                country_code: found?.code || "",
              }));
            }}
          >
            <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder={t("commonPages.obSelectCountry")} /></SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.presStarted")}</label>
          <Input type="date" value={form.started_at} onChange={(e) => update("started_at", e.target.value)} className="bg-secondary border-border" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.presManagementStyle")}</label>
          <Input value={form.management_style} onChange={(e) => update("management_style", e.target.value)} className="bg-secondary border-border" placeholder={t("commonPages.presManagementStylePlaceholder")} />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.presSocialLink")}</label>
          <Input value={form.social_link} onChange={(e) => update("social_link", e.target.value)} className="bg-secondary border-border" placeholder="https://..." />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.presQuote")}</label>
        <Input value={form.quote} onChange={(e) => update("quote", e.target.value)} className="bg-secondary border-border" placeholder={t("commonPages.presQuotePlaceholder")} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.presBio")}</label>
        <Textarea value={form.bio} onChange={(e) => update("bio", e.target.value)} className="bg-secondary border-border resize-none" rows={3} placeholder={t("commonPages.presBioPlaceholder")} />
      </div>
    </ProfileEditShell>
  );
}

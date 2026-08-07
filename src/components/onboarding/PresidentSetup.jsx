import { useState, useRef, useId } from "react";
import { stageClient } from "@/api/stageClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Camera } from "lucide-react";
import ImagePositionEditor from "@/components/ImagePositionEditor";
import { GamerPlayerPhotoFrame } from "@/components/profile/gamer/GamerProfileUI";
import { COUNTRIES } from "@/lib/countries";
import { prepareImageForUpload } from "@/lib/imageUpload";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

const inputCls = "w-full bg-white/10 border border-white/20 text-white placeholder-white/35 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/55 focus:bg-white/15 transition-all";
const labelCls = "text-[10px] text-white/45 uppercase tracking-widest mb-1 block";
const selectCls = "bg-white/10 border-white/20 text-white text-sm rounded-xl h-10 focus:ring-0 focus:border-white/40";

const PRESIDENT_SUCCESS_LEVELS = [
  ["less_successful", "presSuccessLess"],
  ["successful", "presSuccessSuccessful"],
  ["more_successful", "presSuccessMore"],
  ["most_successful", "presSuccessMost"],
  ["boss", "presSuccessBoss"],
];

function socialLinkFromValue(value) {
  if (!value) return "";
  if (typeof value === "string") {
    try {
      return socialLinkFromValue(JSON.parse(value));
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) {
    const first = value.find((item) => item?.url || typeof item === "string");
    return typeof first === "string" ? first : (first?.url || "");
  }
  if (typeof value === "object") {
    return value.primary || value.url || Object.values(value).find((v) => typeof v === "string") || "";
  }
  return "";
}

export function buildInitialPresidentProfile(player) {
  const countryName = player?.country || "";
  const countryCode = player?.country_code || COUNTRIES.find((c) => c.name === countryName)?.code || "";
  return {
    display_name: player?.gamertag || "",
    role_title: "President",
    // Deliberately NOT prefilled from player.avatar_url: the president is a distinct
    // public identity from the player, even for the same real person, and copying the
    // player's photo by default made the two profiles look merged. The user must
    // explicitly upload a president photo in this step.
    avatar_url: "",
    avatar_position: "50% 50%",
    avatar_zoom: 150,
    banner_url: "",
    banner_position: "50% 50%",
    banner_zoom: 150,
    bio: "",
    success_level: "successful",
    country_code: countryCode,
    country: countryName,
    quote: "",
    management_style: "",
    started_at: "",
    social_link: "",
  };
}

/** Hydrate the onboarding/edit form from a persisted President entity row. */
export function buildProfileFromPresident(president) {
  if (!president) return buildInitialPresidentProfile(null);
  const countryCode = president.country_code || "";
  const countryName = COUNTRIES.find((c) => c.code === countryCode)?.name || "";
  const started = president.started_at ? String(president.started_at).slice(0, 10) : "";
  return {
    display_name: president.display_name || "",
    role_title: president.role_title || "President",
    avatar_url: president.avatar_url || "",
    avatar_position: president.avatar_position || "50% 50%",
    avatar_zoom: Number(president.avatar_zoom) || 150,
    banner_url: president.banner_url || "",
    banner_position: president.banner_position || "50% 50%",
    banner_zoom: Number(president.banner_zoom) || 150,
    bio: president.bio || "",
    success_level: president.success_level || "successful",
    country_code: countryCode,
    country: countryName,
    quote: president.quote || "",
    management_style: president.management_style || "",
    started_at: started,
    social_link: socialLinkFromValue(president.social_links),
  };
}

export function toPresidentApiPayload(profile) {
  const social = String(profile.social_link || "").trim();
  const countryCode = profile.country_code
    || COUNTRIES.find((c) => c.name === profile.country)?.code
    || "";
  return {
    display_name: profile.display_name?.trim() || null,
    role_title: profile.role_title?.trim() || null,
    avatar_url: profile.avatar_url || null,
    avatar_position: profile.avatar_position || "50% 50%",
    avatar_zoom: Number(profile.avatar_zoom) || 150,
    banner_url: profile.banner_url || null,
    banner_position: profile.banner_position || "50% 50%",
    banner_zoom: Number(profile.banner_zoom) || 150,
    bio: profile.bio?.trim() || null,
    success_level: profile.success_level || "successful",
    country_code: countryCode || null,
    quote: profile.quote?.trim() || null,
    management_style: profile.management_style?.trim() || null,
    started_at: profile.started_at ? `${profile.started_at}T00:00:00Z` : null,
    social_links: social ? { primary: social } : null,
  };
}

/**
 * President onboarding step — same photo upload + position/zoom UX as PlayerSetup.
 * Collects profile fields and calls onContinue(profile); parent persists with the club.
 */
export default function PresidentSetup({
  initialProfile = null,
  player = null,
  onContinue,
  continueLabel = null,
  mode = "create",
  saving = false,
}) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState(() => initialProfile || buildInitialPresidentProfile(player));
  const [pendingAvatar, setPendingAvatar] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const avatarInputRef = useRef(/** @type {HTMLInputElement|null} */ (null));
  const avatarInputId = useId();
  const isEdit = mode === "edit";
  const submitLabel = continueLabel
    || (isEdit ? t("commonPages.presSave") : t("commonPages.presContinueClub"));

  function update(field, value) {
    setProfile((prev) => ({ ...prev, [field]: value }));
  }

  async function uploadAvatar(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError(null);
    if (!file.type?.startsWith("image/")) {
      setError(t("commonPages.obErrImage"));
      e.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(t("commonPages.obErrAvatarSize"));
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const uploadFile = await prepareImageForUpload(file, { fallbackName: "president-avatar.jpg" });
      const { file_url } = await stageClient.integrations.Core.UploadFile({ file: uploadFile });
      if (!file_url) throw new Error(t("commonPages.obErrUpload"));
      setPendingAvatar(file_url);
    } catch (err) {
      console.error("Failed to upload president avatar:", err);
      setError(err?.data?.error || err?.message || t("commonPages.obErrUpload"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const previewPlayer = {
    position: "CM",
    overall_rating: 0,
    shirt_number: 1,
  };
  const canContinue = Boolean(profile.display_name?.trim() && profile.role_title?.trim());

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-black uppercase tracking-wide text-white mb-1">
          {isEdit ? t("commonPages.presEditTitle") : t("commonPages.presCreateTitle")}
        </h2>
        <p className="text-white/40 text-xs">
          {isEdit ? t("commonPages.presEditDesc") : t("commonPages.presCreateDesc")}
        </p>
      </div>

      {/* Same rectangle photo UX as PlayerSetup */}
      <div className="flex gap-4 items-start">
        <div className="relative group shrink-0">
          <GamerPlayerPhotoFrame
            player={previewPlayer}
            imageUrl={profile.avatar_url || null}
            imagePosition={profile.avatar_position || "50% 50%"}
            imageZoom={Number(profile.avatar_zoom) || 150}
            className="w-24 sm:w-28 rounded-xl shadow-[0_0_24px_-10px_rgba(0,229,255,0.65)] pointer-events-none"
          />
          <label
            htmlFor={avatarInputId}
            className={cn(
              "absolute inset-0 z-10 rounded-xl bg-black/55 flex items-center justify-center cursor-pointer transition-opacity touch-manipulation",
              uploading && "pointer-events-none opacity-60",
              profile.avatar_url
                ? "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                : "opacity-100"
            )}
            title={t("commonPages.profUploadPhoto")}
          >
            <span className="p-2.5 rounded-lg bg-white/15 active:bg-white/25 transition-colors">
              {uploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
            </span>
          </label>
          <input
            id={avatarInputId}
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={uploading}
            onChange={uploadAvatar}
          />
        </div>

        <div className="flex-1 space-y-3 pt-0.5 min-w-0">
          <div>
            <label className={labelCls}>{t("commonPages.presName")}</label>
            <input
              value={profile.display_name}
              onChange={(e) => update("display_name", e.target.value)}
              placeholder="Florentino Perez"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{t("commonPages.presRoleTitle")}</label>
            <input
              value={profile.role_title}
              onChange={(e) => update("role_title", e.target.value)}
              placeholder={t("commonPages.presRoleTitlePlaceholder")}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{t("commonPages.obCountry")}</label>
            <Select
              value={profile.country || COUNTRIES.find((c) => c.code === profile.country_code)?.name || ""}
              onValueChange={(name) => {
                const found = COUNTRIES.find((c) => c.name === name);
                setProfile((prev) => ({
                  ...prev,
                  country: name,
                  country_code: found?.code || "",
                }));
              }}
            >
              <SelectTrigger className={`bg-white/10 text-white text-sm rounded-xl h-10 focus:ring-0 ${!profile.country && !profile.country_code ? "border-red-400/40" : "border-white/20"} focus:border-white/40`}>
                <SelectValue placeholder={t("commonPages.obSelectCountry")} />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t("commonPages.presSuccessLevel")}</label>
            <Select value={profile.success_level} onValueChange={(value) => update("success_level", value)}>
              <SelectTrigger className={selectCls}><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRESIDENT_SUCCESS_LEVELS.map(([value, labelKey]) => (
                  <SelectItem key={value} value={value}>{t(`commonPages.${labelKey}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className={labelCls}>{t("commonPages.presStarted")}</label>
            <input
              type="date"
              value={profile.started_at}
              onChange={(e) => update("started_at", e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t("commonPages.presManagementStyle")}</label>
            <input
              value={profile.management_style}
              onChange={(e) => update("management_style", e.target.value)}
              placeholder={t("commonPages.presManagementStylePlaceholder")}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{t("commonPages.presSocialLink")}</label>
            <input
              value={profile.social_link}
              onChange={(e) => update("social_link", e.target.value)}
              placeholder="https://..."
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>{t("commonPages.presQuote")}</label>
          <input
            value={profile.quote}
            onChange={(e) => update("quote", e.target.value)}
            placeholder={t("commonPages.presQuotePlaceholder")}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>{t("commonPages.presBio")}</label>
          <textarea
            value={profile.bio}
            onChange={(e) => update("bio", e.target.value)}
            rows={3}
            placeholder={t("commonPages.presBioPlaceholder")}
            className={`${inputCls} resize-none`}
          />
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => onContinue?.(profile)}
        disabled={!canContinue || saving || uploading}
        className="w-full bg-white text-[#0d2461] font-black uppercase tracking-widest py-3 rounded-xl text-sm hover:bg-gray-100 disabled:opacity-40 transition-all shadow-lg inline-flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {submitLabel}
      </button>

      <ImagePositionEditor
        open={!!pendingAvatar}
        onClose={() => setPendingAvatar(null)}
        imageUrl={pendingAvatar}
        aspect="card"
        initialPosition={profile.avatar_position}
        initialZoom={profile.avatar_zoom}
        previewPlayer={previewPlayer}
        onConfirm={(url, position, zoom) => {
          setProfile((prev) => ({
            ...prev,
            avatar_url: url,
            avatar_position: position,
            avatar_zoom: zoom || 150,
          }));
          setPendingAvatar(null);
        }}
      />
    </div>
  );
}

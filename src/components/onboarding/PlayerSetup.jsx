import { useState, useRef } from "react";
import { stageClient } from "@/api/stageClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Camera } from "lucide-react";
import ImagePositionEditor from "@/components/ImagePositionEditor";
import { GamerPlayerPhotoFrame } from "@/components/profile/gamer/GamerProfileUI";
import { COUNTRIES } from "@/lib/countries";
import { prepareImageForUpload } from "@/lib/imageUpload";
import { useTranslation } from "@/hooks/useTranslation";

const POSITIONS = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST", "CF"];

const inputCls = "w-full bg-white/10 border border-white/20 text-white placeholder-white/35 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/55 focus:bg-white/15 transition-all";
const labelCls = "text-[10px] text-white/45 uppercase tracking-widest mb-1 block";

export default function PlayerSetup({ onComplete, user, initialPlayer = null }) {
  const { t } = useTranslation();
  const [gamertag, setGamertag] = useState(initialPlayer?.gamertag || "");
  const [position, setPosition] = useState(initialPlayer?.position || "ST");
  const [secondaryPosition, setSecondaryPosition] = useState(initialPlayer?.secondary_position || "none");
  const [country, setCountry] = useState(initialPlayer?.country || "");
  const [avatarUrl, setAvatarUrl] = useState(initialPlayer?.avatar_url || null);
  const [avatarPosition, setAvatarPosition] = useState(initialPlayer?.avatar_position || "50% 50%");
  const [avatarZoom, setAvatarZoom] = useState(Number(initialPlayer?.avatar_zoom) || 150);
  const [pendingAvatar, setPendingAvatar] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const avatarInputRef = useRef(/** @type {HTMLInputElement|null} */ (null));

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
      const uploadFile = await prepareImageForUpload(file, { fallbackName: "player-avatar.jpg" });
      const { file_url } = await stageClient.integrations.Core.UploadFile({ file: uploadFile });
      if (!file_url) throw new Error(t("commonPages.obErrUpload"));
      setPendingAvatar(file_url);
    } catch (err) {
      console.error("Failed to upload avatar:", err);
      setError(err?.data?.error || err?.message || t("commonPages.obErrUpload"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleSave() {
    if (!gamertag || !country) return;
    setSaving(true);
    setError(null);
    try {
      const foundCountry = COUNTRIES.find(c => c.name === country);
      const payload = {
        user_id: user.id,
        gamertag,
        email: user.email,
        position,
        secondary_position: secondaryPosition === "none" ? null : secondaryPosition,
        country,
        country_code: foundCountry?.code || "",
        avatar_url: avatarUrl || undefined,
        avatar_position: avatarPosition,
        avatar_zoom: avatarZoom,
        platform: "PlayStation",
        credits: 50,
        stc: 50000,
      };

      let existing = [];
      if (user.player_id) {
        const p = await stageClient.entities.Player.get(user.player_id).catch(() => null);
        existing = p ? [p] : [];
      } else {
        existing = await stageClient.entities.Player.filter({ email: user.email }, null, 1).catch(() => []);
      }

      const isBenignSaveError = (e) => {
        const msg = String(e?.message || '');
        const dataMsg = String(e?.data?.message || '');
        const full = `${msg} ${dataMsg}`.toLowerCase();
        return (
          full.includes('socketemit is not defined') ||
          full.includes('er_dup_entry')
        );
      };

      let savedPlayer = null;
      if (existing?.length) {
        try {
          savedPlayer = await stageClient.entities.Player.update(existing[0].id, payload);
        } catch (e) {
          if (!isBenignSaveError(e)) throw e;
        }
      } else {
        try {
          savedPlayer = await stageClient.entities.Player.create(payload);
        } catch (e) {
          if (!isBenignSaveError(e)) throw e;
        }
      }

      setSaving(false);
      onComplete?.(savedPlayer || {
        ...payload,
        id: existing?.[0]?.id || null,
      });
    } catch (err) {
      console.error("Failed to save player:", err);
      setError(err?.data?.error || err?.data?.message || err?.message || t("commonPages.obErrSave"));
      setSaving(false);
    }
  }

  const previewPlayer = {
    position,
    overall_rating: initialPlayer?.overall_rating ?? 0,
    shirt_number: initialPlayer?.shirt_number ?? 6,
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-black uppercase tracking-wide text-white mb-1">{t("commonPages.obCreateProfile")}</h2>
        <p className="text-white/40 text-xs">{t("commonPages.obTellWorld")}</p>
      </div>

      {/* Player card (same rectangle as profile) */}
      <div className="flex gap-4 items-start">
        <div className="relative group shrink-0">
          <GamerPlayerPhotoFrame
            player={previewPlayer}
            imageUrl={avatarUrl}
            imagePosition={avatarPosition}
            imageZoom={avatarZoom}
            className="w-24 sm:w-28 rounded-xl shadow-[0_0_24px_-10px_rgba(0,229,255,0.65)]"
          />
          <div className={`absolute inset-0 rounded-xl bg-black/55 transition-opacity flex items-center justify-center ${avatarUrl ? "opacity-0 group-hover:opacity-100" : "opacity-100"}`}>
            <button type="button" onClick={() => { if (avatarInputRef.current) avatarInputRef.current.click(); }} className="p-2 rounded-lg bg-white/15 hover:bg-white/25 transition-colors" title="Upload">
              {uploading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Camera className="w-4 h-4 text-white" />}
            </button>
          </div>
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
        </div>

        <div className="flex-1 space-y-3 pt-0.5 min-w-0">
          <div>
            <label className={labelCls}>{t("commonPages.obGamertag")}</label>
            <input
              value={gamertag}
              onChange={e => setGamertag(e.target.value)}
              placeholder={t("commonPages.obGamertagPlaceholder")}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{t("commonPages.obMainPosition")}</label>
            <Select value={position} onValueChange={value => {
              setPosition(value);
              if (secondaryPosition === value) setSecondaryPosition("none");
            }}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white text-sm rounded-xl h-10 focus:ring-0 focus:border-white/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className={labelCls}>{t("commonPages.obSecondPosition")}</label>
            <Select value={secondaryPosition} onValueChange={setSecondaryPosition}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white text-sm rounded-xl h-10 focus:ring-0 focus:border-white/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("commonPages.obNone")}</SelectItem>
                {POSITIONS.filter(p => p !== position).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className={labelCls}>{t("commonPages.obCountry")}</label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className={`bg-white/10 text-white text-sm rounded-xl h-10 focus:ring-0 ${!country ? "border-red-400/40" : "border-white/20"} focus:border-white/40`}>
                <SelectValue placeholder={t("commonPages.obSelectCountry")} />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(c => <SelectItem key={c.code} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !gamertag || !country}
        className="w-full bg-white text-[#0d2461] font-black uppercase tracking-widest py-3 rounded-xl text-sm hover:bg-gray-100 disabled:opacity-40 transition-all shadow-lg"
      >
        {saving ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> {t("commonPages.obSaving")}
          </span>
        ) : t("commonPages.obContinueClub")}
      </button>

      <ImagePositionEditor
        open={!!pendingAvatar}
        onClose={() => setPendingAvatar(null)}
        imageUrl={pendingAvatar}
        aspect="card"
        initialPosition={avatarPosition}
        initialZoom={avatarZoom}
        previewPlayer={previewPlayer}
        onConfirm={(url, position, zoom) => {
          setAvatarUrl(url);
          setAvatarPosition(position);
          setAvatarZoom(zoom || 150);
          setPendingAvatar(null);
        }}
      />
    </div>
  );
}

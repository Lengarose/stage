import { useState, useRef, useId, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Camera, ChevronLeft } from "lucide-react";
import { COUNTRIES, getRegionForCountryCode } from "@/lib/countries";
import ImagePositionEditor from "@/components/ImagePositionEditor";
import { GamerClubPhotoFrame } from "@/components/profile/gamer/GamerClubCard";
import { prepareImageForUpload } from "@/lib/imageUpload";
import { isPersistableMediaUrl } from "@/lib/mediaUrls";
import { FOUNDER_PLAYER_WEEKLY_SALARY_MAX } from "@/lib/founderPlayerTerms";
import { formatSTC } from "@/lib/playerValue";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

const REGIONS = ["Europe", "North America", "South America", "Asia", "Oceania", "Africa", "Middle East"];

const inputCls = "w-full bg-white/10 border border-white/20 text-white placeholder-white/35 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/55 focus:bg-white/15 transition-all";
const labelCls = "text-[10px] text-white/45 uppercase tracking-widest mb-1 block";
const selectCls = "bg-white/10 border-white/20 text-white text-sm rounded-xl h-10 focus:ring-0 focus:border-white/40";

export default function ClubSetup({ onSkip, onComplete, onPhaseChange, player, user, playerContract = null, required = false }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(required ? "club_profile" : "choice");
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [platform, setPlatform] = useState(player?.platform || "PlayStation");
  const [region, setRegion] = useState("Europe");
  const [country, setCountry] = useState("");
  const [logoUrl, setLogoUrl] = useState(null);
  const [pendingLogo, setPendingLogo] = useState(null);
  const [logoPosition, setLogoPosition] = useState("50% 50%");
  const [logoZoom, setLogoZoom] = useState(150);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const logoInputRef = useRef();
  const logoInputId = useId();
  const previewClub = {
    name: name || t("commonPages.obClubNamePlaceholder"),
    tag: (tag || "CLB").toUpperCase(),
    platform,
    logo_url: logoUrl,
    logo_position: logoPosition,
    logo_zoom: logoZoom,
    win_rate: 50,
  };

  useEffect(() => {
    if (!required) return;
    onPhaseChange?.("club");
  }, [onPhaseChange, required]);

  async function uploadLogo(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError(null);
    if (!file.type?.startsWith("image/")) {
      setError(t("commonPages.obErrImage"));
      e.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(t("commonPages.obErrLogoSize"));
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const uploadFile = await prepareImageForUpload(file, { fallbackName: "club-logo.jpg" });
      const { file_url } = await stageClient.integrations.Core.UploadFile({ file: uploadFile });
      if (!isPersistableMediaUrl(file_url)) throw new Error(t("commonPages.obErrLogoUpload"));
      setPendingLogo(file_url);
    } catch (err) {
      console.error("Failed to upload club logo:", err);
      setError(err?.data?.error || err?.message || t("commonPages.obErrLogoUpload"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleCreate() {
    if (!name || !tag || !country) return;
    setSaving(true);
    setError(null);
    try {
      if (!player?.id) throw new Error("Create your Player profile before founding a club.");
      const founderWeeklySalary = Number(playerContract?.weekly_salary_stc || 0);
      if (founderWeeklySalary > FOUNDER_PLAYER_WEEKLY_SALARY_MAX) {
        throw new Error(t("commonPages.founderWageRequired", {
          max: formatSTC(FOUNDER_PLAYER_WEEKLY_SALARY_MAX),
        }));
      }
      const founderState = await stageClient.clubs.createFounder({
        player_id: player.id,
        idempotency_key: `${user?.id || user?.email || "user"}:${player.id}:${name.trim().toLowerCase()}`,
        club: {
          name,
          tag: tag.toUpperCase(),
          platform,
          region,
          country_code: country,
          owner_email: user?.email,
          logo_url: logoUrl || null,
          logo_position: logoPosition,
          logo_zoom: logoZoom,
          description: "",
          trophies: [],
        },
        playerContract: playerContract || undefined,
      });
      const club = founderState?.club;

      if (!club?.id) throw new Error("Server returned no club ID");

      setSaving(false);
      onComplete(club, founderState);
    } catch (err) {
      console.error("Failed to create club:", err);
      setError(err?.data?.error || err?.data?.message || err?.message || JSON.stringify(err) || "Unknown error — check console");
      setSaving(false);
    }
  }

  if (step === "choice") {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-black uppercase tracking-wide text-white mb-1">
            {required ? t("commonPages.obCreateYourClub") : t("commonPages.obClubSetupTitle")}
          </h2>
          <p className="text-white/40 text-xs">
            {required ? t("commonPages.obNeedClubContinue") : t("commonPages.obCreateOrJoinLater")}
          </p>
        </div>

        <div className={required ? "" : "grid grid-cols-2 gap-3"}>
          <button
            type="button"
            onClick={() => setStep("club_profile")}
            className="w-full bg-white/10 border border-white/20 hover:border-blue-400/60 hover:bg-blue-500/10 rounded-xl p-5 text-left transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 mb-3 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-blue-400">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <p className="font-black uppercase text-white text-sm tracking-wide">{t("commonPages.obCreateClub")}</p>
            <p className="text-white/35 text-xs mt-1">
              {required ? t("commonPages.obFoundClub") : t("commonPages.obStartJourney")}
            </p>
          </button>

          {!required && (
            <button
              type="button"
              onClick={onSkip}
              className="bg-white/5 border border-white/10 hover:border-white/25 rounded-xl p-5 text-left transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-white/10 mb-3 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-white/40">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
              <p className="font-black uppercase text-white/70 text-sm tracking-wide">{t("commonPages.obSkip")}</p>
              <p className="text-white/30 text-xs mt-1">{t("commonPages.obDoItLater")}</p>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!required && (
        <button
          type="button"
          onClick={() => setStep("choice")}
          className="flex items-center gap-1 text-white/40 hover:text-white text-xs uppercase tracking-widest transition-colors mb-1"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> {t("commonPages.obBack")}
        </button>
      )}

      <div>
        <h2 className="text-xl font-black uppercase tracking-wide text-white mb-1">Create Club Profile</h2>
        <p className="text-white/40 text-xs">{t("commonPages.obBuildEmpire")}</p>
      </div>

      <div className="flex gap-4 items-start">
        <div className="relative group shrink-0">
          <GamerClubPhotoFrame
            club={previewClub}
            imageUrl={logoUrl}
            imagePosition={logoPosition}
            imageZoom={logoZoom}
            winRate={50}
            className="w-24 sm:w-28 rounded-xl shadow-[0_0_24px_-10px_rgba(255,184,0,0.65)] pointer-events-none"
          />
          <label
            htmlFor={logoInputId}
            className={cn(
              "absolute inset-0 z-10 rounded-xl bg-black/55 flex items-center justify-center cursor-pointer transition-opacity touch-manipulation",
              uploading && "pointer-events-none opacity-60",
              logoUrl
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
            id={logoInputId}
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={uploading}
            onChange={uploadLogo}
          />
        </div>

        <div className="flex-1 space-y-2.5 min-w-0">
          <div>
            <label className={labelCls}>{t("commonPages.obClubName")}</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={t("commonPages.obClubNamePlaceholder")} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t("commonPages.obTagMax5")}</label>
            <input
              value={tag}
              maxLength={5}
              onChange={e => setTag(e.target.value.toUpperCase())}
              placeholder={t("commonPages.obTagPlaceholder")}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{t("commonPages.obPlatform")}</label>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className={selectCls}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PlayStation">PlayStation</SelectItem>
              <SelectItem value="Xbox">Xbox</SelectItem>
              <SelectItem value="PC">PC</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className={labelCls}>{t("commonPages.obRegion")}</label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className={selectCls}><SelectValue /></SelectTrigger>
            <SelectContent>
              {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className={labelCls}>{t("commonPages.obCountry")}</label>
        <Select
          value={country}
          onValueChange={(code) => {
            setCountry(code);
            const nextRegion = getRegionForCountryCode(code);
            if (nextRegion) setRegion(nextRegion);
          }}
        >
          <SelectTrigger className={`${selectCls} ${!country ? "border-red-400/40" : ""}`}>
            <SelectValue placeholder={t("commonPages.obSelectCountry")} />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map(c => (
              <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-1">
        {!required && (
          <button
            type="button"
            onClick={() => setStep("choice")}
            className="flex-1 bg-white/10 border border-white/20 text-white/70 hover:text-white hover:border-white/35 font-bold uppercase tracking-widest text-xs py-3 rounded-xl transition-all"
          >
            {t("commonPages.obSkip")}
          </button>
        )}
        <button
          type="button"
          onClick={handleCreate}
          disabled={saving || !name || !tag || !country}
          className={`${required ? "w-full" : "flex-1"} bg-white text-[#0d2461] font-black uppercase tracking-widest text-xs py-3 rounded-xl hover:bg-gray-100 disabled:opacity-40 transition-all shadow-lg`}
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> {t("commonPages.obCreating")}
            </span>
          ) : t("commonPages.obCreateClub")}
        </button>
      </div>

      <ImagePositionEditor
        open={!!pendingLogo}
        onClose={() => setPendingLogo(null)}
        imageUrl={pendingLogo}
        aspect="card"
        initialPosition={logoPosition}
        initialZoom={logoZoom}
        previewClub={previewClub}
        onConfirm={(url, position, zoom) => {
          setLogoUrl(url);
          setLogoPosition(position);
          setLogoZoom(zoom || 150);
          setPendingLogo(null);
        }}
      />
    </div>
  );
}

import { useState, useRef, useId, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Camera, ChevronLeft } from "lucide-react";
import { COUNTRIES, COUNTRY_REGIONS } from "@/lib/countries";
import ImagePositionEditor from "@/components/ImagePositionEditor";
import { GamerClubPhotoFrame } from "@/components/profile/gamer/GamerClubCard";
import PresidentContractDialog from "@/components/contracts/PresidentContractDialog";
import PresidentSetup, {
  buildInitialPresidentProfile,
  toPresidentApiPayload,
} from "@/components/onboarding/PresidentSetup";
import { prepareImageForUpload } from "@/lib/imageUpload";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

const REGIONS = ["Europe", "North America", "South America", "Asia", "Oceania", "Africa", "Middle East"];

const inputCls = "w-full bg-white/10 border border-white/20 text-white placeholder-white/35 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/55 focus:bg-white/15 transition-all";
const labelCls = "text-[10px] text-white/45 uppercase tracking-widest mb-1 block";
const selectCls = "bg-white/10 border-white/20 text-white text-sm rounded-xl h-10 focus:ring-0 focus:border-white/40";

export default function ClubSetup({ onSkip, onComplete, onPhaseChange, player, user, required = false }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(required ? "president" : "choice");
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [platform, setPlatform] = useState(player?.platform || "PlayStation");
  const [region, setRegion] = useState("Europe");
  const [country, setCountry] = useState("");
  const [logoUrl, setLogoUrl] = useState(null);
  const [pendingLogo, setPendingLogo] = useState(null);
  const [logoPosition, setLogoPosition] = useState("50% 50%");
  const [logoZoom, setLogoZoom] = useState(150);
  const [presidentProfile, setPresidentProfile] = useState(() => buildInitialPresidentProfile(player));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [presidentContractPrompt, setPresidentContractPrompt] = useState(null);
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
    onPhaseChange?.(step === "club_profile" ? "club" : "president");
  }, [onPhaseChange, required, step]);

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
      if (!file_url) throw new Error(t("commonPages.obErrLogoUpload"));
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
      const club = await stageClient.entities.Club.create({
        user_id: user?.id,
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
        wins: 0,
        losses: 0,
        draws: 0,
        goals_scored: 0,
        goals_conceded: 0,
        rating: 1500,
        peak_rating: 1500,
        matches_ranked: 0,
        is_provisional: 1,
        trophies: 0,
        credits: 0,
        stc: 30000000,
        wage_budget_stc: 5000000,
        transfer_budget_stc: 10000000,
        stadium_level: 0,
        stadium_capacity: 5000,
        tier: "Silver",
        win_streak: 0,
        loss_streak: 0,
        status: "active",
        creator_player_id: player?.id,
        president: toPresidentApiPayload(presidentProfile),
      });

      if (!club?.id) throw new Error("Server returned no club ID");

      setSaving(false);
      setPresidentContractPrompt({ club, player, contractId: club.owner_contract_id });
    } catch (err) {
      console.error("Failed to create club:", err);
      setError(err?.message || JSON.stringify(err) || "Unknown error — check console");
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
            onClick={() => setStep("president")}
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

  if (step === "president") {
    return (
      <PresidentSetup
        initialProfile={presidentProfile}
        player={player}
        onContinue={(profile) => {
          setPresidentProfile(profile);
          setStep("club_profile");
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PresidentContractDialog
        open={!!presidentContractPrompt}
        club={presidentContractPrompt?.club}
        player={presidentContractPrompt?.player}
        contractId={presidentContractPrompt?.contractId}
        onSigned={() => {
          const club = presidentContractPrompt?.club;
          setPresidentContractPrompt(null);
          onComplete(club);
        }}
        onClose={() => setPresidentContractPrompt(null)}
      />
      <button
        type="button"
        onClick={() => setStep("president")}
        className="flex items-center gap-1 text-white/40 hover:text-white text-xs uppercase tracking-widest transition-colors mb-1"
      >
        <ChevronLeft className="w-3.5 h-3.5" /> {t("commonPages.obBack")}
      </button>

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
          <Select value={region} onValueChange={r => { setRegion(r); setCountry(""); }}>
            <SelectTrigger className={selectCls}><SelectValue /></SelectTrigger>
            <SelectContent>
              {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className={labelCls}>{t("commonPages.obCountry")}</label>
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className={`${selectCls} ${!country ? "border-red-400/40" : ""}`}>
            <SelectValue placeholder={t("commonPages.obSelectCountry")} />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.filter(c => !region || (COUNTRY_REGIONS[region] || []).includes(c.code)).map(c => (
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

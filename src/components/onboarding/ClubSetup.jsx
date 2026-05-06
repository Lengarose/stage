import { useState, useRef } from "react";
import { stageClient } from "@/api/stageClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Camera, ChevronLeft } from "lucide-react";
import { COUNTRIES, COUNTRY_REGIONS } from "@/lib/countries";
import ImagePositionEditor from "@/components/ImagePositionEditor";

const REGIONS = ["Europe", "North America", "South America", "Asia", "Oceania", "Africa", "Middle East"];

const inputCls = "w-full bg-white/10 border border-white/20 text-white placeholder-white/35 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/55 focus:bg-white/15 transition-all";
const labelCls = "text-[10px] text-white/45 uppercase tracking-widest mb-1 block";
const selectCls = "bg-white/10 border-white/20 text-white text-sm rounded-xl h-10 focus:ring-0 focus:border-white/40";

export default function ClubSetup({ onSkip, onComplete, player, user, required = false }) {
  const [step, setStep] = useState("choice");
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

  async function uploadLogo(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await stageClient.integrations.Core.UploadFile({ file });
    setPendingLogo(file_url);
    setUploading(false);
    e.target.value = "";
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
      });

      if (!club?.id) throw new Error("Server returned no club ID");

      if (player?.id) {
        await stageClient.entities.Player.update(player.id, {
          club_id: club.id,
          club_roles: ["president", "captain"],
          role: "captain",
        });
      }

      setSaving(false);
      onComplete(club);
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
            {required ? "Create Your Club" : "Club Setup"}
          </h2>
          <p className="text-white/40 text-xs">
            {required ? "You need a club to continue as an owner" : "Create a club now or join one later"}
          </p>
        </div>

        <div className={required ? "" : "grid grid-cols-2 gap-3"}>
          <button
            onClick={() => setStep("create")}
            className="w-full bg-white/10 border border-white/20 hover:border-blue-400/60 hover:bg-blue-500/10 rounded-xl p-5 text-left transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 mb-3 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-blue-400">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <p className="font-black uppercase text-white text-sm tracking-wide">Create Club</p>
            <p className="text-white/35 text-xs mt-1">
              {required ? "Found your club and start managing" : "Start your journey now"}
            </p>
          </button>

          {!required && (
            <button
              onClick={onSkip}
              className="bg-white/5 border border-white/10 hover:border-white/25 rounded-xl p-5 text-left transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-white/10 mb-3 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-white/40">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
              <p className="font-black uppercase text-white/70 text-sm tracking-wide">Skip</p>
              <p className="text-white/30 text-xs mt-1">Do it later</p>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => setStep("choice")}
        className="flex items-center gap-1 text-white/40 hover:text-white text-xs uppercase tracking-widest transition-colors mb-1"
      >
        <ChevronLeft className="w-3.5 h-3.5" /> Back
      </button>

      <div>
        <h2 className="text-xl font-black uppercase tracking-wide text-white mb-1">Create Your Club</h2>
        <p className="text-white/40 text-xs">Build your football empire</p>
      </div>

      {/* Logo + name/tag */}
      <div className="flex gap-4 items-start">
        <div className="relative group shrink-0">
          <div
            className="w-16 h-16 rounded-xl bg-white/10 border-2 border-white/20 flex items-center justify-center overflow-hidden"
            style={logoUrl ? {
              backgroundImage: `url(${logoUrl})`,
              backgroundSize: `${logoZoom}%`,
              backgroundPosition: logoPosition,
              backgroundRepeat: "no-repeat",
            } : {}}
          >
            {!logoUrl && <Camera className="w-5 h-5 text-white/30" />}
          </div>
          <div className="absolute inset-0 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button onClick={() => logoInputRef.current?.click()} className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors">
              {uploading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Camera className="w-4 h-4 text-white" />}
            </button>
          </div>
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={uploadLogo} />
        </div>

        <div className="flex-1 space-y-2.5">
          <div>
            <label className={labelCls}>Club Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. FC Dynasty" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Tag (max 5 chars) *</label>
            <input
              value={tag}
              maxLength={5}
              onChange={e => setTag(e.target.value.toUpperCase())}
              placeholder="e.g. DYN"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* Platform + Region */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Platform</label>
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
          <label className={labelCls}>Region</label>
          <Select value={region} onValueChange={r => { setRegion(r); setCountry(""); }}>
            <SelectTrigger className={selectCls}><SelectValue /></SelectTrigger>
            <SelectContent>
              {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Country *</label>
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className={`${selectCls} ${!country ? "border-red-400/40" : ""}`}>
            <SelectValue placeholder="Select country" />
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

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        {!required && (
          <button
            onClick={() => setStep("choice")}
            className="flex-1 bg-white/10 border border-white/20 text-white/70 hover:text-white hover:border-white/35 font-bold uppercase tracking-widest text-xs py-3 rounded-xl transition-all"
          >
            Skip
          </button>
        )}
        <button
          onClick={handleCreate}
          disabled={saving || !name || !tag || !country}
          className={`${required ? "w-full" : "flex-1"} bg-white text-[#0d2461] font-black uppercase tracking-widest text-xs py-3 rounded-xl hover:bg-gray-100 disabled:opacity-40 transition-all shadow-lg`}
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Creating…
            </span>
          ) : "Create Club"}
        </button>
      </div>

      <ImagePositionEditor
        open={!!pendingLogo}
        onClose={() => setPendingLogo(null)}
        imageUrl={pendingLogo}
        aspect="avatar"
        initialPosition={logoPosition}
        initialZoom={logoZoom}
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

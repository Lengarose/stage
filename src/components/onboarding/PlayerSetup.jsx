import { useState, useRef } from "react";
import { stageClient } from "@/api/stageClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Camera } from "lucide-react";
import ImagePositionEditor from "@/components/ImagePositionEditor";
import { COUNTRIES } from "@/lib/countries";

const POSITIONS = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST", "CF"];

const inputCls = "w-full bg-white/10 border border-white/20 text-white placeholder-white/35 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/55 focus:bg-white/15 transition-all";
const labelCls = "text-[10px] text-white/45 uppercase tracking-widest mb-1 block";

export default function PlayerSetup({ onComplete, user }) {
  const [gamertag, setGamertag] = useState("");
  const [position, setPosition] = useState("ST");
  const [secondaryPosition, setSecondaryPosition] = useState("none");
  const [country, setCountry] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarPosition, setAvatarPosition] = useState("50% 50%");
  const [avatarZoom, setAvatarZoom] = useState(150);
  const [pendingAvatar, setPendingAvatar] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const avatarInputRef = useRef(/** @type {HTMLInputElement|null} */ (null));

  async function uploadAvatar(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await stageClient.integrations.Core.UploadFile({ file });
    setPendingAvatar(file_url);
    setUploading(false);
    e.target.value = "";
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

      const existing = await stageClient.entities.Player.filter({ email: user.email }, null, 1).catch(() => []);

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
      setError(err?.data?.error || err?.data?.message || err?.message || "Could not save profile.");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-black uppercase tracking-wide text-white mb-1">Create Your Profile</h2>
        <p className="text-white/40 text-xs">Tell the world about your player</p>
      </div>

      {/* Avatar */}
      <div className="flex gap-4 items-start">
        <div className="relative group shrink-0">
          <div className="w-20 h-20 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center overflow-hidden">
            {avatarUrl ? (
              <div className="w-full h-full" style={{ backgroundImage: `url(${avatarUrl})`, backgroundSize: `${avatarZoom}%`, backgroundPosition: avatarPosition, backgroundRepeat: "no-repeat" }} />
            ) : (
              <Camera className="w-7 h-7 text-white/30" />
            )}
          </div>
          <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button onClick={() => { if (avatarInputRef.current) avatarInputRef.current.click(); }} className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors" title="Upload">
              {uploading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Camera className="w-4 h-4 text-white" />}
            </button>
          </div>
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
        </div>

        <div className="flex-1 space-y-3 pt-1">
          <div>
            <label className={labelCls}>Gamertag *</label>
            <input
              value={gamertag}
              onChange={e => setGamertag(e.target.value)}
              placeholder="Your in-game name"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Main Position *</label>
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
            <label className={labelCls}>Second Position</label>
            <Select value={secondaryPosition} onValueChange={setSecondaryPosition}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white text-sm rounded-xl h-10 focus:ring-0 focus:border-white/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {POSITIONS.filter(p => p !== position).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className={labelCls}>Country *</label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className={`bg-white/10 text-white text-sm rounded-xl h-10 focus:ring-0 ${!country ? "border-red-400/40" : "border-white/20"} focus:border-white/40`}>
                <SelectValue placeholder="Select country" />
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
        onClick={handleSave}
        disabled={saving || !gamertag || !country}
        className="w-full bg-white text-[#0d2461] font-black uppercase tracking-widest py-3 rounded-xl text-sm hover:bg-gray-100 disabled:opacity-40 transition-all shadow-lg"
      >
        {saving ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Saving…
          </span>
        ) : "Continue to Club Setup →"}
      </button>

      <ImagePositionEditor
        open={!!pendingAvatar}
        onClose={() => setPendingAvatar(null)}
        imageUrl={pendingAvatar}
        aspect="avatar"
        initialPosition={avatarPosition}
        initialZoom={avatarZoom}
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

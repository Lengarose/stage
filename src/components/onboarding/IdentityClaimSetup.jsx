import { useEffect, useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BadgeCheck, Loader2, Send } from "lucide-react";
import ImageUploadField from "@/components/admin/shared/ImageUploadField";
import { useTranslation } from "@/hooks/useTranslation";

const inputCls = "w-full bg-white/10 border border-white/20 text-white placeholder-white/35 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/55 focus:bg-white/15 transition-all";
const labelCls = "text-[10px] text-white/45 uppercase tracking-widest mb-1 block";

export default function IdentityClaimSetup({ player, onComplete }) {
  const { t } = useTranslation();
  const [claim, setClaim] = useState(null);
  const [platform, setPlatform] = useState(player?.platform || "PlayStation");
  const [platformHandle, setPlatformHandle] = useState(player?.gamertag || "");
  const [eaId, setEaId] = useState("");
  const [overallRating, setOverallRating] = useState(
    Number(player?.overall_rating) > 0 ? Number(player.overall_rating) : 70
  );
  const [discordHandle, setDiscordHandle] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function clampOvr(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 70;
    return Math.min(99, Math.max(1, Math.round(n)));
  }

  async function persistPlayerDetails() {
    if (!player?.id) return;
    await stageClient.entities.Player.update(player.id, {
      platform,
      overall_rating: clampOvr(overallRating),
    }).catch(() => {});
  }

  useEffect(() => {
    let disposed = false;
    async function load() {
      if (!player?.id) {
        setLoading(false);
        return;
      }
      const rows = await stageClient.identityClaims
        .list({ player_id: player.id }, "-created_date", 10)
        .catch(() => []);
      if (!disposed) {
        setClaim(rows[0] || null);
        setLoading(false);
      }
    }
    load();
    return () => { disposed = true; };
  }, [player?.id]);

  async function submitClaim() {
    if (!player?.id || !platformHandle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await persistPlayerDetails();
      const created = await stageClient.identityClaims.submit({
        player_id: player.id,
        platform,
        platform_handle: platformHandle.trim(),
        ea_id: eaId.trim() || null,
        discord_handle: discordHandle.trim() || null,
        proof_url: proofUrl.trim() || null,
        notes: notes.trim() || null,
      });
      setClaim(created);
      onComplete?.(created);
    } catch (err) {
      setError(err?.data?.error || err?.message || t("commonPages.obErrClaim"));
    } finally {
      setSaving(false);
    }
  }

  async function skipForNow() {
    setSaving(true);
    setError(null);
    try {
      await persistPlayerDetails();
      onComplete?.(null);
    } catch (err) {
      setError(err?.data?.error || err?.message || t("commonPages.obErrSave"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 text-white/60 animate-spin" />
      </div>
    );
  }

  if (Number(player?.is_verified) === 1 || claim?.status === "pending" || claim?.status === "approved") {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-300 shrink-0">
            <BadgeCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-wide text-white mb-1">
              {Number(player?.is_verified) === 1 || claim?.status === "approved"
                ? t("commonPages.obIdentityVerified")
                : t("commonPages.obClaimSubmitted")}
            </h2>
            <p className="text-white/40 text-xs leading-relaxed">
              {Number(player?.is_verified) === 1 || claim?.status === "approved"
                ? t("commonPages.obIdentityLinked")
                : t("commonPages.obClaimPending")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onComplete?.(claim)}
          className="w-full bg-white text-[#0d2461] font-black uppercase tracking-widest py-3 rounded-xl text-sm hover:bg-gray-100 transition-all shadow-lg"
        >
          {t("commonPages.obContinueClub")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-300 shrink-0">
          <BadgeCheck className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-black uppercase tracking-wide text-white mb-1">{t("commonPages.obClaimIdentity")}</h2>
          <p className="text-white/40 text-xs leading-relaxed">{t("commonPages.obClaimIdentityDesc")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{t("commonPages.obPlatform")} *</label>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="bg-white/10 border-white/20 text-white text-sm rounded-xl h-10 focus:ring-0 focus:border-white/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PlayStation">PlayStation</SelectItem>
              <SelectItem value="Xbox">Xbox</SelectItem>
              <SelectItem value="PC">PC</SelectItem>
              <SelectItem value="EA">EA</SelectItem>
              <SelectItem value="Discord">Discord</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className={labelCls}>{t("commonPages.obPlatformHandle")}</label>
          <input value={platformHandle} onChange={e => setPlatformHandle(e.target.value)} className={inputCls} placeholder={t("commonPages.obPlatformHandlePlaceholder")} />
        </div>
        <div>
          <label className={labelCls}>{t("commonPages.obEaId")}</label>
          <input value={eaId} onChange={e => setEaId(e.target.value)} className={inputCls} placeholder={t("commonPages.obOptional")} />
        </div>
        <div>
          <label className={labelCls}>{t("commonPages.obOvr")} *</label>
          <input
            type="number"
            min={1}
            max={99}
            value={overallRating}
            onChange={(e) => setOverallRating(e.target.value)}
            onBlur={() => setOverallRating(clampOvr(overallRating))}
            className={inputCls}
            placeholder="70"
          />
          <p className="text-white/30 text-[10px] mt-1">{t("commonPages.obOvrHint")}</p>
        </div>
        <div>
          <label className={labelCls}>{t("commonPages.obDiscord")}</label>
          <input value={discordHandle} onChange={e => setDiscordHandle(e.target.value)} className={inputCls} placeholder={t("commonPages.obOptional")} />
        </div>
          </div>
          <div>
            <label className={labelCls}>{t("commonPages.obNotes")}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className={`${inputCls} min-h-24 resize-none`} placeholder={t("commonPages.obNotesPlaceholder")} />
          </div>
        </div>

        <div className="space-y-2">
          <ImageUploadField
            variant="glass"
            label={t("commonPages.obProofLabel")}
            value={proofUrl}
            onChange={setProofUrl}
            placeholder={t("commonPages.obProofPlaceholder")}
            preview="landscape"
          />
          <p className="text-white/30 text-[10px] leading-relaxed">
            {t("commonPages.obProofHint")}
          </p>
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      </div>

      <div className="space-y-2 pt-3 border-t border-white/10">
        <button
          type="button"
          onClick={submitClaim}
          disabled={saving || !platformHandle.trim()}
          className="w-full bg-white text-[#0d2461] font-black uppercase tracking-widest py-3 rounded-xl text-sm hover:bg-gray-100 disabled:opacity-40 transition-all shadow-lg"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> {t("commonPages.obSubmitting")}
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Send className="w-4 h-4" /> {t("commonPages.obSubmitClaim")}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={skipForNow}
          disabled={saving}
          className="w-full text-white/35 hover:text-white/65 text-[10px] uppercase tracking-widest transition-colors disabled:opacity-40"
        >
          {t("commonPages.obSkipForNow")}
        </button>
      </div>
    </div>
  );
}

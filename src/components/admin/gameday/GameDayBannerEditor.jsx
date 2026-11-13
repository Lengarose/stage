import { useEffect, useState } from "react";
import PositionedImageUploadField from "@/components/admin/shared/PositionedImageUploadField";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, Check, Plus, Save, Trash2 } from "lucide-react";
import { GAME_DAY_BANNER_DESCRIPTION, getGameDayBannerInterval, getGameDayBannerSlides } from "@/lib/gameDayBanner";

const emptySlide = () => ({ url: "", position: "50% 50%", zoom: 120 });

export default function GameDayBannerEditor() {
  const [record, setRecord] = useState(null);
  const [slides, setSlides] = useState([emptySlide()]);
  const [intervalSeconds, setIntervalSeconds] = useState(6);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadGameDayConfig() {
      try {
        const rows = await stageClient.entities.GameDayConfig.filter({ key: "main" }, "-updated_date", 1);
        if (cancelled) return;
        const row = rows?.[0] || null;
        const existing = getGameDayBannerSlides(row);
        setRecord(row);
        setSlides(existing.length ? existing : [emptySlide()]);
        setIntervalSeconds(getGameDayBannerInterval(row) / 1000);
      } catch (err) {
        if (!cancelled) setLoadError(err?.message || "Could not load GameDay banners. Reload this page to try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadGameDayConfig();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 2200);
    return () => window.clearTimeout(timer);
  }, [saved]);

  async function saveGameDayConfig() {
    setSaving(true);
    setSaved(false);
    try {
      const banners = getGameDayBannerSlides({ banner_slides: slides });
      const first = banners[0];
      const payload = {
        key: "main",
        banner_slides: banners,
        banner_interval_seconds: getGameDayBannerInterval({ banner_interval_seconds: intervalSeconds }) / 1000,
        // Preserve compatibility with clients that still display a single banner.
        banner_url: first?.url || "",
        banner_position: first?.position || "50% 50%",
        banner_zoom: first?.zoom || null,
      };
      const next = record?.id
        ? await stageClient.entities.GameDayConfig.update(record.id, payload)
        : await stageClient.entities.GameDayConfig.create(payload);
      setRecord(next);
      setSaved(true);
    } catch (err) {
      window.alert(err?.message || "Could not save GameDay banners.");
    } finally {
      setSaving(false);
    }
  }

  function updateSlide(index, field, value) {
    setSaved(false);
    setSlides(current => current.map((slide, i) => i === index ? { ...slide, [field]: value } : slide));
  }

  function moveSlide(index, direction) {
    setSaved(false);
    setSlides(current => {
      const next = [...current];
      [next[index], next[index + direction]] = [next[index + direction], next[index]];
      return next;
    });
  }

  return (
    <div className="border border-cyan-400/20 bg-slate-950/80 p-5 shadow-[0_0_34px_-20px_rgba(34,211,238,0.8)]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">GameDay</p>
          <h3 className="font-heading text-lg font-black uppercase text-white">Banner Slideshow</h3>
          <p className="mt-1 max-w-xl text-xs text-slate-400">
            Add and reorder banner photos. Multiple photos rotate automatically; visitors can also select a photo using the dots. The page title and introduction appear over every photo.
          </p>
        </div>
        <Button type="button" size="sm" onClick={saveGameDayConfig} disabled={saving || loading || Boolean(loadError)} className="gap-2 bg-cyan-300 font-heading text-xs font-black uppercase tracking-[0.14em] text-slate-950 hover:bg-cyan-200">
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving" : saved ? "Saved" : "Save"}
        </Button>
      </div>
      {loading ? (
        <div className="py-8 text-center text-xs uppercase tracking-widest text-slate-500">Loading banner editor...</div>
      ) : loadError ? (
        <p role="alert" className="text-sm text-red-300">{loadError}</p>
      ) : (
        <fieldset disabled={saving} className="min-w-0 space-y-5 disabled:opacity-60">
          <label className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
            Seconds per photo
            <input aria-label="Seconds per photo" type="number" min="3" max="30" value={intervalSeconds} onChange={event => { setSaved(false); setIntervalSeconds(event.target.value); }} className="w-20 rounded border border-white/20 bg-slate-900 px-3 py-2 text-white" />
            <span className="text-xs text-slate-400">3–30 seconds; default 6.</span>
          </label>
          {slides.map((slide, index) => (
            <div key={index} className="space-y-3 border border-white/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-white">Photo {index + 1}</h4>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="outline" aria-label={`Move photo ${index + 1} earlier`} disabled={index === 0} onClick={() => moveSlide(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
                  <Button type="button" size="sm" variant="outline" aria-label={`Move photo ${index + 1} later`} disabled={index === slides.length - 1} onClick={() => moveSlide(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
                  <Button type="button" size="sm" variant="outline" aria-label={`Remove photo ${index + 1}`} onClick={() => { setSaved(false); setSlides(current => current.filter((_, i) => i !== index)); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <PositionedImageUploadField
                label={`GameDay banner photo ${index + 1}`}
                value={slide.url}
                onChange={value => updateSlide(index, "url", value)}
                position={slide.position}
                onPositionChange={value => updateSlide(index, "position", value)}
                zoom={slide.zoom}
                onZoomChange={value => updateSlide(index, "zoom", value)}
                preview="hero"
                title="GameDay"
                subtitle={GAME_DAY_BANNER_DESCRIPTION}
              />
            </div>
          ))}
          <Button type="button" variant="outline" onClick={() => { setSaved(false); setSlides(current => [...current, emptySlide()]); }} className="gap-2"><Plus className="h-4 w-4" /> Add photo</Button>
        </fieldset>
      )}
    </div>
  );
}

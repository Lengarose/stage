import { useEffect, useState } from "react";
import HomePageEditor from "@/components/admin/HomePageEditor";
import PositionedImageUploadField from "@/components/admin/shared/PositionedImageUploadField";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Check, Save } from "lucide-react";

export default function HomeTab() {
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState({
    key: "main",
    banner_url: "",
    banner_position: "50% 50%",
    banner_zoom: 120,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadGameDayConfig() {
      const rows = await stageClient.entities.GameDayConfig
        .filter({ key: "main" }, "-updated_date", 1)
        .catch(() => []);
      if (cancelled) return;
      const row = rows?.[0] || null;
      setRecord(row);
      setForm({
        key: "main",
        banner_url: row?.banner_url || "",
        banner_position: row?.banner_position || "50% 50%",
        banner_zoom: row?.banner_zoom || 120,
      });
      setLoading(false);
    }
    loadGameDayConfig();
    return () => { cancelled = true; };
  }, []);

  async function saveGameDayConfig() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        key: "main",
        banner_zoom: Number(form.banner_zoom || 120),
      };
      const next = record?.id
        ? await stageClient.entities.GameDayConfig.update(record.id, payload)
        : await stageClient.entities.GameDayConfig.create(payload);
      setRecord(next);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } catch (err) {
      window.alert(err?.message || "Could not save Game Day banner.");
    } finally {
      setSaving(false);
    }
  }

  function set(field, value) {
    setForm(current => ({ ...current, [field]: value }));
  }

  return (
    <div className="space-y-6">
      <div className="max-w-3xl border border-cyan-400/20 bg-slate-950/80 p-5 shadow-[0_0_34px_-20px_rgba(34,211,238,0.8)]">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Game Day</p>
            <h3 className="font-heading text-lg font-black uppercase text-white">Panoramic Banner</h3>
            <p className="mt-1 max-w-xl text-xs text-slate-400">
              Upload the image used at the top of the Game Day page. Put the text on the image itself if you want a custom matchday title.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={saveGameDayConfig}
            disabled={saving || loading}
            className="gap-2 bg-cyan-300 font-heading text-xs font-black uppercase tracking-[0.14em] text-slate-950 hover:bg-cyan-200"
          >
            {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving" : saved ? "Saved" : "Save"}
          </Button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs uppercase tracking-widest text-slate-500">Loading banner editor...</div>
        ) : (
          <PositionedImageUploadField
            label="Game Day banner image"
            value={form.banner_url}
            onChange={v => set("banner_url", v)}
            position={form.banner_position}
            onPositionChange={v => set("banner_position", v)}
            zoom={form.banner_zoom}
            onZoomChange={v => set("banner_zoom", v)}
            preview="hero"
            title="Game Day"
            subtitle="Panoramic matchday frame"
          />
        )}
      </div>

      <HomePageEditor />
    </div>
  );
}

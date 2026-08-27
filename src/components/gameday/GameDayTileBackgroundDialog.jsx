import { useEffect, useState } from "react";
import { Image as ImageIcon, Loader2, Lock, RotateCcw, Sparkles, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function parseGameDayTileBackgrounds(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function getGameDayTileBackgroundConfig(player, tileKey) {
  const backgrounds = parseGameDayTileBackgrounds(player?.game_day_tile_backgrounds);
  const config = backgrounds?.[tileKey];
  if (!config || typeof config !== "object") return { type: "default", url: "", position: "50% 50%", zoom: 120 };
  return {
    type: config.type || "default",
    background_id: config.background_id || null,
    url: config.url || "",
    position: config.position || "50% 50%",
    zoom: Number(config.zoom) || 120,
  };
}

export function getGameDayTileBackgroundStyle(config) {
  const url = config?.url;
  if (!url) return undefined;
  return {
    backgroundImage: `url(${url})`,
    backgroundPosition: config.position || "50% 50%",
    backgroundSize: `${Number(config.zoom) || 120}%`,
    backgroundRepeat: "no-repeat",
  };
}

export function hasCustomGameDayTileBackground(config) {
  return Boolean(config?.url && config?.type && config.type !== "default");
}

const OVERLAY_BY_VARIANT = {
  panel: {
    custom: "bg-[linear-gradient(180deg,rgba(0,0,0,0.72)_0%,rgba(0,0,0,0.58)_42%,rgba(0,0,0,0.74)_100%)]",
    default: "bg-[radial-gradient(circle_at_12%_8%,rgba(255,255,255,0.16),transparent_22%),radial-gradient(circle_at_80%_4%,rgba(216,222,232,0.24),transparent_24%),linear-gradient(180deg,rgba(24,30,40,0.72),rgba(7,7,11,0.88))]",
  },
  card: {
    custom: "bg-[linear-gradient(180deg,rgba(0,0,0,0.68)_0%,rgba(0,0,0,0.54)_48%,rgba(0,0,0,0.72)_100%)]",
    default: "bg-[radial-gradient(circle_at_15%_5%,rgba(255,255,255,0.20),transparent_20%),radial-gradient(circle_at_80%_0%,rgba(216,222,232,0.28),transparent_26%),linear-gradient(110deg,rgba(25,31,42,0.82),rgba(4,5,9,0.68),rgba(33,39,50,0.82))]",
  },
  arena: {
    custom: "bg-[linear-gradient(180deg,rgba(0,0,0,0.62)_0%,rgba(0,0,0,0.50)_38%,rgba(0,0,0,0.68)_100%)]",
    default: null,
  },
};

/** Text shadow for labels on top of custom tile backgrounds. */
export const gameDayTextOnBg = "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95),0_0_10px_rgba(0,0,0,0.75)]";
export const gameDayMutedOnBg = "text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]";

/** Renders a tile background image + a readable overlay. Custom uploads stay vivid. */
export function GameDayTileBackgroundLayers({ style, variant = "panel" }) {
  if (!style) return null;
  const hasCustom = Boolean(style.backgroundImage);
  const overlay = OVERLAY_BY_VARIANT[variant]?.[hasCustom ? "custom" : "default"];

  return (
    <>
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 bg-no-repeat",
          hasCustom ? "opacity-100" : "bg-cover bg-center opacity-80",
        )}
        style={style}
      />
      {overlay ? (
        <div aria-hidden className={cn("pointer-events-none absolute inset-0", overlay)} />
      ) : null}
    </>
  );
}

export default function GameDayTileBackgroundDialog({
  open,
  onOpenChange,
  player,
  tileKey,
  tileTitle,
  canCustomize,
  onPlayerChanged,
}) {
  const [backgrounds, setBackgrounds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [zoom, setZoom] = useState(120);
  const currentConfig = getGameDayTileBackgroundConfig(player, tileKey);

  useEffect(() => {
    if (!open || !canCustomize) return undefined;
    let cancelled = false;
    setLoading(true);
    stageClient.entities.PlayerCardBackground
      .filter({}, "sort_order", 100)
      .then((rows) => {
        if (!cancelled) setBackgrounds(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setBackgrounds([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, canCustomize]);

  useEffect(() => {
    if (!file) {
      setPreview("");
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    setX(50);
    setY(50);
    setZoom(120);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function saveBackground(payload, busyKey) {
    if (!player?.id || !tileKey) return;
    setSaving(busyKey);
    setError("");
    try {
      const updated = await stageClient.http.patch(`/players/${encodeURIComponent(player.id)}/game-day-tile-background`, {
        ...payload,
        tile_key: tileKey,
      });
      onPlayerChanged?.({ ...player, ...updated });
      setFile(null);
      setPreview("");
      onOpenChange(false);
    } catch (err) {
      setError(err?.message || "Could not update Game Day tile background.");
    } finally {
      setSaving(null);
    }
  }

  async function uploadCustomBackground() {
    if (!file) {
      setError("Choose an image first.");
      return;
    }
    setSaving("custom");
    setError("");
    try {
      const uploaded = await stageClient.integrations.Core.UploadFile({ file });
      await saveBackground({
        type: "custom",
        image_url: uploaded.file_url,
        position: `${x}% ${y}%`,
        zoom,
      }, "custom");
    } catch (err) {
      setSaving(null);
      setError(err?.message || "Could not upload Game Day tile background.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[82vh] max-w-lg overflow-y-auto border-white/10 bg-[#111827] p-4 text-white sm:p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-xs font-black uppercase tracking-[0.18em] text-[#d8dee8]">
            <ImageIcon className="h-3.5 w-3.5" /> {tileTitle || "Game Day"} background
          </DialogTitle>
        </DialogHeader>

        {!canCustomize ? (
          <div className="border border-[#d8dee8]/25 bg-[#d8dee8]/10 p-4 [clip-path:polygon(12px_0,100%_0,calc(100%_-_12px)_100%,0_100%)]">
            <div className="mb-3 flex items-start gap-3">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-[#f8fbff]" />
              <div>
                <p className="font-heading text-base font-black uppercase text-white">STAGE Plus feature</p>
                <p className="mt-1 text-sm text-white/65">
                  STAGE Plus unlocks custom Game Day tile backgrounds, personal uploads, and official visual designs.
                </p>
              </div>
            </div>
            <Link to="/store">
              <Button type="button" className="gap-2 bg-[#d8dee8] font-black text-[#111827] hover:bg-white">
                <Sparkles className="h-4 w-4" /> View STAGE Plus
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {error ? (
              <div className="border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-white/[0.04] p-2.5">
              <div>
                <p className="font-heading text-xs font-black uppercase text-white">{tileTitle || "Game Day tile"}</p>
                <p className="text-xs text-white/45">This background only changes this Game Day panel.</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={Boolean(saving)}
                onClick={() => saveBackground({ type: "default" }, "default")}
                className="h-8 gap-1.5 border-white/15 bg-black/20 text-xs text-white hover:bg-white/10"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Official Stage+ designs</p>
              {loading ? (
                <div className="flex items-center justify-center border border-white/10 py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-[#d8dee8]" />
                </div>
              ) : backgrounds.length ? (
                <div className="grid max-h-52 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                  {backgrounds.map((bg) => {
                    const isActive = currentConfig.type === "official"
                      && String(currentConfig.background_id || "") === String(bg.id);
                    return (
                    <button
                      key={bg.id}
                      type="button"
                      disabled={Boolean(saving)}
                      onClick={() => saveBackground({ type: "official", background_id: bg.id }, bg.id)}
                      className={cn(
                        "overflow-hidden border bg-black/30 text-left transition hover:border-[#d8dee8]/60",
                        isActive ? "border-[#f8fbff] ring-2 ring-[#f8fbff]/70" : "border-white/10",
                      )}
                    >
                      <div className="aspect-[16/9] bg-black">
                        <img src={bg.image_url} alt={bg.name} className="h-full w-full object-cover" />
                      </div>
                      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                        <span className="truncate text-[11px] font-bold text-white">{bg.name}</span>
                        {saving === bg.id ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#d8dee8]" /> : null}
                      </div>
                    </button>
                    );
                  })}
                </div>
              ) : (
                <div className="border border-dashed border-white/10 py-8 text-center text-sm text-white/40">
                  No official backgrounds are available yet.
                </div>
              )}
            </div>

            <div className="border border-white/10 bg-black/20 p-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Upload your own</p>
              <div className="flex flex-col gap-3">
                {preview ? (
                  <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                    <div
                      className="relative h-[116px] overflow-hidden border border-[#d8dee8]/35 bg-black"
                      style={{ clipPath: "polygon(7% 0, 100% 0, 93% 100%, 0 100%)" }}
                    >
                      <div
                        aria-hidden
                        className="absolute inset-0 bg-no-repeat"
                        style={{
                          backgroundImage: `url(${preview})`,
                          backgroundPosition: `${x}% ${y}%`,
                          backgroundSize: `${zoom}%`,
                        }}
                      />
                      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-white/10 via-black/45 to-[#202632]/85" />
                      <div className="relative z-[1] flex h-full flex-col justify-between p-3">
                        <p className="font-heading text-sm font-black uppercase text-white">{tileTitle || "Game Day"}</p>
                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/55">Preview</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <BackgroundSlider label="Zoom" value={zoom} min={100} max={260} onChange={setZoom} />
                      <BackgroundSlider label="Horizontal" value={x} min={0} max={100} onChange={setX} />
                      <BackgroundSlider label="Vertical" value={y} min={0} max={100} onChange={setY} />
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-2 border border-dashed border-[#d8dee8]/35 bg-[#d8dee8]/10 px-3 py-2 text-xs font-bold text-[#dbe4ef]">
                    <Upload className="h-4 w-4" />
                    <span className="truncate">{file ? file.name : "Choose image"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => setFile(event.target.files?.[0] || null)}
                    />
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!file || Boolean(saving)}
                    onClick={uploadCustomBackground}
                    className="h-10 gap-2 bg-[#d8dee8] font-black text-[#111827] hover:bg-white"
                  >
                    {saving === "custom" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BackgroundSlider({ label, value, min, max, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-white/45">
        {label}
        <span>{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={cn("h-1.5 w-full accent-[#d8dee8]")}
      />
    </label>
  );
}

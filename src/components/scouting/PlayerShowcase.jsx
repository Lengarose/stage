import { useEffect, useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Play, Plus, Trash2, Upload, Video } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

const POSITIONS = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST", "CF"];
const MAX_VIDEO_SECONDS = 20;
const ACCEPTED_VIDEO_EXTENSIONS = [".mp4", ".m4v", ".webm", ".mov", ".ogv"];
const ACCEPTED_VIDEO_MIME_TYPES = ["video/mp4", "video/x-m4v", "video/webm", "video/quicktime", "video/ogg"];
const ACCEPTED_VIDEO_INPUT = [...ACCEPTED_VIDEO_MIME_TYPES, ...ACCEPTED_VIDEO_EXTENSIONS].join(",");

/**
 * A player's showcase: the clips they publish so clubs can see how they play.
 *
 * The player owns this. Scouts read it and report on what they saw — they never
 * add footage themselves, which is the whole point of the feature. `canEdit`
 * decides which of those two this render is, and the server enforces the same
 * rule independently.
 */
export default function PlayerShowcase({ player, canEdit = false, onChanged }) {
  const { t } = useTranslation();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [videoDuration, setVideoDuration] = useState(null);
  const [position, setPosition] = useState(player?.showcase_position || "");
  const [error, setError] = useState(null);
  const [watchingVideo, setWatchingVideo] = useState(null);

  const playerId = player?.id;

  useEffect(() => {
    let cancelled = false;
    if (!playerId) { setLoading(false); return undefined; }
    setLoading(true);
    stageClient.entities.PlayerShowcaseVideo
      .filter({ player_id: playerId })
      .then((rows) => { if (!cancelled) setVideos(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (!cancelled) setVideos([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [playerId]);

  useEffect(() => { setPosition(player?.showcase_position || ""); }, [player?.showcase_position]);

  function readVideoDuration(file) {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      const objectUrl = URL.createObjectURL(file);
      const cleanup = () => URL.revokeObjectURL(objectUrl);

      video.preload = "metadata";
      video.onloadedmetadata = () => {
        cleanup();
        resolve(video.duration);
      };
      video.onerror = () => {
        cleanup();
        reject(new Error(t("commonPages.showcaseVideoInvalid")));
      };
      video.src = objectUrl;
    });
  }

  async function selectVideoFile(file) {
    setError(null);
    setVideoFile(null);
    setVideoDuration(null);
    if (!file) return;

    const fileName = String(file.name || "").toLowerCase();
    const extensionAllowed = ACCEPTED_VIDEO_EXTENSIONS.some((ext) => fileName.endsWith(ext));
    const mimeAllowed = ACCEPTED_VIDEO_MIME_TYPES.includes(file.type);
    if (!extensionAllowed && !mimeAllowed) {
      setError(t("commonPages.showcaseVideoTypeError"));
      return;
    }

    try {
      const duration = await readVideoDuration(file);
      if (!Number.isFinite(duration)) {
        setError(t("commonPages.showcaseVideoInvalid"));
        return;
      }
      if (duration > MAX_VIDEO_SECONDS) {
        setError(t("commonPages.showcaseVideoTooLong"));
        return;
      }
      setVideoFile(file);
      setVideoDuration(Math.round(duration * 100) / 100);
    } catch (err) {
      setError(err?.message || t("commonPages.showcaseVideoInvalid"));
    }
  }

  async function addVideo() {
    const cleanTitle = title.trim();
    if (!cleanTitle || !videoFile || !playerId) return;
    setAdding(true);
    setError(null);
    try {
      const upload = await stageClient.integrations.Core.UploadFile({ file: videoFile });
      const uploadedUrl = upload?.file_url || upload?.url;
      if (!uploadedUrl) throw new Error(t("commonPages.showcaseUploadFailed"));

      const created = await stageClient.entities.PlayerShowcaseVideo.create({
        player_id: playerId,
        url: uploadedUrl,
        title: cleanTitle,
        duration_seconds: videoDuration,
        sort_order: videos.length,
      });
      setVideos((prev) => [...prev, created]);
      setTitle("");
      setVideoFile(null);
      setVideoDuration(null);
      onChanged?.();
    } catch (err) {
      setError(err?.message || t("commonPages.showcaseAddFailed"));
    } finally {
      setAdding(false);
    }
  }

  /** Saves on blur: a title is a small correction, not a form to submit. */
  async function saveTitle(video, nextTitle) {
    const next = nextTitle.trim();
    if (!next || next === (video.title || "")) return;
    setError(null);
    try {
      const updated = await stageClient.entities.PlayerShowcaseVideo.update(video.id, {
        title: next,
      });
      setVideos((prev) => prev.map((v) => (v.id === video.id ? updated : v)));
      onChanged?.();
    } catch (err) {
      setError(err?.message || t("commonPages.showcaseSaveFailed"));
    }
  }

  async function removeVideo(video) {
    setError(null);
    try {
      await stageClient.entities.PlayerShowcaseVideo.delete(video.id);
      setVideos((prev) => prev.filter((v) => v.id !== video.id));
      onChanged?.();
    } catch (err) {
      setError(err?.message || t("commonPages.showcaseRemoveFailed"));
    }
  }

  async function savePosition(next) {
    setPosition(next);
    setError(null);
    try {
      await stageClient.http.post("/player-showcase-videos/position", {
        player_id: playerId,
        showcase_position: next,
      });
      onChanged?.();
    } catch (err) {
      setError(err?.message || t("commonPages.showcasePositionFailed"));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const showPosition = canEdit || position;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Video className="w-4 h-4 text-primary" /> {t("commonPages.showcaseTitle")}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {canEdit ? t("commonPages.showcaseOwnerHint") : t("commonPages.showcaseViewerHint")}
          </p>
        </div>

        {showPosition && (
          <div className="min-w-[10rem]">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
              {t("commonPages.showcasePosition")}
            </label>
            {canEdit ? (
              <Select value={position} onValueChange={savePosition}>
                <SelectTrigger><SelectValue placeholder={t("commonPages.showcasePositionPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  {POSITIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <span className="inline-flex items-center rounded-lg border border-border bg-secondary/60 px-2.5 py-1.5 text-sm font-semibold text-foreground">
                {position}
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {videos.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-xl">
          {canEdit ? t("commonPages.showcaseEmptyOwner") : t("commonPages.showcaseEmptyViewer")}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {videos.map((video) => (
            <div key={video.id} className="space-y-1.5">
              <button
                type="button"
                onClick={() => setWatchingVideo(video)}
                className="group relative block aspect-video w-full overflow-hidden rounded-xl border border-border bg-black text-left"
                aria-label={`Watch ${video.title || t("commonPages.showcaseUntitled")}`}
              >
                <video
                  src={video.media_url || video.url}
                  className="absolute inset-0 h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
                  muted
                  playsInline
                  preload="metadata"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/10">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white shadow-lg">
                    <Play className="h-5 w-5 fill-current" />
                  </span>
                </span>
              </button>
              <div className="flex items-start gap-2">
                {canEdit ? (
                  <Input
                    defaultValue={video.title || video.description || ""}
                    onBlur={(e) => saveTitle(video, e.target.value)}
                    placeholder={t("commonPages.showcaseTitlePlaceholder")}
                    maxLength={120}
                    className="h-8 text-xs flex-1 min-w-0"
                  />
                ) : (
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {video.title || video.description || t("commonPages.showcaseUntitled")}
                    </p>
                    {video.description && video.title && (
                      <p className="text-xs text-muted-foreground">{video.description}</p>
                    )}
                  </div>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => removeVideo(video)}
                    title={t("commonPages.showcaseRemove")}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("commonPages.showcaseTitlePlaceholder")}
            maxLength={120}
          />
          <div className="flex gap-2">
            <label className="flex min-h-10 flex-1 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground hover:border-primary/40">
              <Upload className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {videoFile ? videoFile.name : t("commonPages.showcaseVideoFilePlaceholder")}
              </span>
              <input
                type="file"
                accept={ACCEPTED_VIDEO_INPUT}
                className="sr-only"
                onChange={(e) => selectVideoFile(e.target.files?.[0])}
              />
            </label>
            <Button type="button" onClick={addVideo} disabled={!title.trim() || !videoFile || adding} className="gap-1.5 shrink-0">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {t("commonPages.showcaseAdd")}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {videoDuration !== null
              ? t("commonPages.showcaseVideoReady", { seconds: videoDuration.toFixed(1) })
              : t("commonPages.showcaseVideoHint")}
          </p>
        </div>
      )}

      <Dialog open={Boolean(watchingVideo)} onOpenChange={(open) => !open && setWatchingVideo(null)}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden p-0">
          {watchingVideo ? (
            <div className="grid max-h-[92vh] grid-rows-[auto_minmax(0,1fr)]">
              <DialogHeader className="border-b border-border px-4 py-3 text-left">
                <DialogTitle className="truncate text-base">
                  {watchingVideo.title || t("commonPages.showcaseUntitled")}
                </DialogTitle>
              </DialogHeader>
              <div className="min-h-0 bg-black">
                <video
                  src={watchingVideo.media_url || watchingVideo.url}
                  className="h-full max-h-[78vh] min-h-[16rem] w-full bg-black object-contain"
                  controls
                  playsInline
                  autoPlay
                />
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

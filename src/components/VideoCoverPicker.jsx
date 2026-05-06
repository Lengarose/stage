import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { stageClient } from "@/api/stageClient";
import { Loader2 } from "lucide-react";

/**
 * Shows a video with a seek slider so the user can pick a cover frame.
 * Props:
 *   open, onClose
 *   videoUrl – the uploaded video URL
 *   onConfirm(thumbnailUrl) – called with the uploaded cover image URL
 */
export default function VideoCoverPicker({ open, onClose, videoUrl, onConfirm }) {
  const videoRef = useRef();
  const canvasRef = useRef();
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) { setPreview(null); setCurrentTime(0); }
  }, [open]);

  function onMetadata() {
    setDuration(videoRef.current?.duration || 0);
  }

  function onTimeUpdate() {
    setCurrentTime(videoRef.current?.currentTime || 0);
  }

  function handleSeek(e) {
    const t = Number(e.target.value);
    if (videoRef.current) videoRef.current.currentTime = t;
    setCurrentTime(t);
  }

  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    setPreview(canvas.toDataURL("image/jpeg", 0.85));
  }

  async function confirm() {
    if (!preview) return;
    setUploading(true);
    // Convert data URL to blob
    const res = await fetch(preview);
    const blob = await res.blob();
    const file = new File([blob], "cover.jpg", { type: "image/jpeg" });
    const { file_url } = await stageClient.integrations.Core.UploadFile({ file });
    setUploading(false);
    onConfirm(file_url);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="leading-relaxed text-xl">Pick Video Cover</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">Seek to the frame you want as the thumbnail, then capture it.</p>

        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full rounded-xl max-h-56 object-contain bg-black"
          onLoadedMetadata={onMetadata}
          onTimeUpdate={onTimeUpdate}
          crossOrigin="anonymous"
          muted
        />

        <div className="space-y-2">
          <input
            type="range" min={0} max={duration || 1} step={0.05}
            value={currentTime}
            onChange={handleSeek}
            className="w-full accent-primary"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{currentTime.toFixed(1)}s</span>
            <span>{duration.toFixed(1)}s</span>
          </div>
        </div>

        <Button variant="outline" onClick={captureFrame} className="border-border w-full">
          📸 Capture this frame
        </Button>

        {preview && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Cover preview</p>
            <img src={preview} alt="cover preview" className="w-full rounded-xl object-cover max-h-36" />
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />

        <div className="flex gap-3 pt-1">
          <Button variant="outline" onClick={onClose} className="flex-1 border-border">Cancel</Button>
          <Button onClick={confirm} disabled={!preview || uploading} className="flex-1 bg-primary text-primary-foreground leading-relaxed">
            {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Use as Cover"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
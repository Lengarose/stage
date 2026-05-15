import { useState, useEffect, useRef, useCallback } from "react";
import { Play } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { INTRO_VIDEO_URL } from "@/lib/introVideo";

/**
 * Image that shows a play affordance on hover and opens an intro video modal.
 * Hover uses a short delay so the dialog overlay does not instantly dismiss itself.
 */
export default function IntroVideoImage({
  src,
  alt,
  videoUrl = INTRO_VIDEO_URL,
  className,
  imgClassName,
  objectPosition = "center",
}) {
  const [open, setOpen] = useState(false);
  const videoRef = useRef(null);
  const hoverTimerRef = useRef(null);
  const ignoreCloseRef = useRef(false);

  const posterUrl = typeof src === "string" ? src : undefined;

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const openModal = useCallback(() => {
    if (!videoUrl) return;
    clearHoverTimer();
    ignoreCloseRef.current = true;
    setOpen(true);
    window.setTimeout(() => {
      ignoreCloseRef.current = false;
    }, 400);
  }, [clearHoverTimer, videoUrl]);

  const scheduleOpenOnHover = useCallback(() => {
    if (!videoUrl) return;
    if (typeof window !== "undefined") {
      const prefersHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      if (!prefersHover) return;
    }
    clearHoverTimer();
    hoverTimerRef.current = window.setTimeout(openModal, 280);
  }, [clearHoverTimer, openModal, videoUrl]);

  const handleOpenChange = useCallback((next) => {
    if (!next && ignoreCloseRef.current) return;
    setOpen(next);
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (open) {
      el.currentTime = 0;
      el.play().catch(() => {});
    } else {
      el.pause();
      el.currentTime = 0;
    }
  }, [open]);

  useEffect(() => () => clearHoverTimer(), [clearHoverTimer]);

  if (!src) return null;

  return (
    <>
      <button
        type="button"
        className={cn(
          "group relative block w-full overflow-hidden rounded-2xl border-0 bg-transparent p-0 text-left",
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          className
        )}
        onMouseEnter={scheduleOpenOnHover}
        onMouseLeave={clearHoverTimer}
        onClick={openModal}
        aria-label={alt ? `Play ${alt} video` : "Play intro video"}
      >
        <img
          src={src}
          alt={alt}
          decoding="async"
          draggable={false}
          className={cn(
            "w-full object-cover rounded-2xl border border-border",
            "transition-transform duration-300 ease-out will-change-transform group-hover:scale-[1.02]",
            imgClassName
          )}
          style={{ objectPosition }}
        />
        <span
          className={cn(
            "pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl",
            "bg-black/20 opacity-0 transition-opacity duration-200",
            "group-hover:opacity-100 group-focus-visible:opacity-100"
          )}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/95 shadow-lg ring-2 ring-white/20">
            <Play className="h-7 w-7 fill-primary-foreground text-primary-foreground" />
          </span>
        </span>
      </button>

      {videoUrl && (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent
            className={cn(
              "z-[200] max-w-none gap-0 overflow-hidden border-none bg-black p-0 shadow-2xl sm:rounded-xl",
              "w-[min(96vw,1280px)] sm:w-[min(94vw,1280px)]",
              "[&>button]:right-3 [&>button]:top-3 [&>button]:z-10 [&>button]:text-white hover:[&>button]:text-white"
            )}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <DialogTitle className="sr-only">{alt || "Intro"} — video</DialogTitle>
            <div className="flex min-h-[200px] items-center justify-center bg-black">
              <video
                ref={videoRef}
                src={videoUrl}
                poster={posterUrl}
                className="block max-h-[88vh] w-full object-contain"
                controls
                playsInline
                preload={open ? "auto" : "metadata"}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

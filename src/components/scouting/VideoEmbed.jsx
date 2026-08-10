import { ExternalLink, Video } from "lucide-react";
import { resolveVideoEmbed } from "@/lib/videoEmbed";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Plays a pasted video link inline where it can, and always keeps the link
 * reachable either way.
 *
 * There is deliberately no "the embed failed, switch to a link" state. We cannot
 * detect that failure: a cross-origin iframe that renders a permission wall or an
 * error page has *loaded successfully* as far as the browser is concerned, so no
 * `error` event fires. An earlier version listened for one; it would never have
 * run, which is worse than not trying, because it implies a safety net that isn't
 * there.
 *
 * So the guarantee is structural instead of reactive: the plain link is rendered
 * in every branch. If the frame shows a video, great. If it shows "you need
 * access", the user still has an obvious way out directly underneath it.
 */
export default function VideoEmbed({ url, className }) {
  const { t } = useTranslation();
  const trimmed = typeof url === "string" ? url.trim() : "";
  // Nothing to link to — rendering an anchor here would point at the current page.
  if (!trimmed) return null;

  const embed = resolveVideoEmbed(trimmed);

  if (isDirectVideoUrl(trimmed)) {
    return (
      <div className={cn("relative w-full overflow-hidden rounded-xl border border-border bg-black aspect-video", className)}>
        <video
          src={trimmed}
          controls
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full"
        />
      </div>
    );
  }

  if (!embed) {
    return (
      <VideoLink
        url={trimmed}
        label={t("commonPages.scoutOpenVideo")}
        className={cn(
          "inline-flex rounded-lg border border-border bg-secondary/60 px-2.5 py-1.5 text-xs text-foreground hover:border-primary/40",
          className
        )}
      />
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="relative w-full overflow-hidden rounded-xl border border-border bg-black aspect-video">
        <iframe
          src={embed.embedUrl}
          title={t("commonPages.scoutVideoTitle", { provider: embed.label })}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      {/* The escape hatch: if the frame above shows a permission wall rather than
          the clip, this is how the user still gets to it. */}
      <VideoLink
        url={trimmed}
        label={t("commonPages.scoutOpenVideoOn", { provider: embed.label })}
        className="text-[11px] text-muted-foreground hover:text-foreground"
      />
    </div>
  );
}

function isDirectVideoUrl(url) {
  const clean = url.split("?")[0].split("#")[0].toLowerCase();
  return /\.(mp4|webm|mov|m4v|ogg|ogv)$/.test(clean) || clean.includes("/uploads/");
}

function VideoLink({ url, label, className }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex items-center gap-1.5 transition-colors max-w-full", className)}
    >
      <Video className="w-3.5 h-3.5 shrink-0 text-primary" />
      <span className="truncate max-w-[16rem]">{label}</span>
      <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
    </a>
  );
}

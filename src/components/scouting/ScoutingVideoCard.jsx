import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Heart, MessageCircle, Play, User } from "lucide-react";

function playerMeta(video) {
  return [
    video.showcase_position || video.position,
    video.country_code || video.country,
  ].filter(Boolean).join(" · ");
}

export default function ScoutingVideoCard({ video, onOpen, onLike }) {
  const title = video.title || "Showcase video";
  const liked = video.liked_by_me === true || video.liked_by_me === 1 || video.liked_by_me === "1";

  async function handleLike(event) {
    event.stopPropagation();
    await onLike?.(video);
  }

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={onOpen}
        className="group relative block aspect-video w-full overflow-hidden bg-secondary text-left"
        aria-label={`Watch ${title}`}
      >
        <video
          src={video.media_url || video.url}
          className="h-full w-full object-cover"
          preload="metadata"
          muted
          playsInline
        />
        <span className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/10" />
        <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm">
          <Play className="h-5 w-5 fill-current" />
        </span>
      </button>

      <div className="space-y-3 p-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-foreground">{title}</h2>
          <Link
            to={video.player_id ? `/players/${video.player_id}` : "#"}
            className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            {video.avatar_url ? (
              <img src={video.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary">
                <User className="h-3 w-3" />
              </span>
            )}
            <span className="truncate font-semibold">{video.gamertag || "Unknown player"}</span>
            {playerMeta(video) && <span className="truncate">{playerMeta(video)}</span>}
          </Link>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button type="button" size="sm" variant="outline" onClick={handleLike} className="h-8 gap-1.5">
            <Heart className={cn("h-3.5 w-3.5", liked && "fill-current text-destructive")} />
            {Number(video.likes_count || 0)}
          </Button>
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {Number(video.comments_count || 0)}
          </button>
        </div>
      </div>
    </article>
  );
}

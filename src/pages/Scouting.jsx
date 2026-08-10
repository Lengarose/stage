import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ScoutingVideoCard from "@/components/scouting/ScoutingVideoCard";
import ScoutingVideoModal from "@/components/scouting/ScoutingVideoModal";
import { cn } from "@/lib/utils";
import { Binoculars, Loader2, Search, Video } from "lucide-react";

const POSITIONS = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST", "CF"];

export default function Scouting() {
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState("all");
  const [position, setPosition] = useState("all");
  const [country, setCountry] = useState("");
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const queryVideoId = searchParams.get("video");
  const queryCommentId = searchParams.get("comment");

  const requestQuery = useMemo(() => ({
    filter: filter === "trending" ? "trending" : "recent",
    position: position === "all" ? undefined : position,
    country: country.trim() || undefined,
  }), [filter, position, country]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    stageClient.http.get("/player-showcase-videos/scouting", requestQuery)
      .then((rows) => {
        if (cancelled) return;
        const safe = Array.isArray(rows) ? rows : [];
        setVideos(safe);
        if (queryVideoId) {
          const match = safe.find((video) => String(video.id) === String(queryVideoId));
          if (match) setSelectedVideo(match);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setVideos([]);
          setError(err?.message || "Could not load scouting videos.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [requestQuery, queryVideoId]);

  useEffect(() => {
    let cancelled = false;
    if (!queryVideoId || selectedVideo || videos.some((video) => String(video.id) === String(queryVideoId))) {
      return undefined;
    }
    stageClient.entities.PlayerShowcaseVideo.get(queryVideoId)
      .then((video) => {
        if (!cancelled && video?.id) setSelectedVideo(video);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [queryVideoId, selectedVideo, videos]);

  function replaceVideo(updated) {
    if (!updated?.id) return;
    setVideos((prev) => prev.map((video) => (video.id === updated.id ? { ...video, ...updated } : video)));
    setSelectedVideo((current) => (current?.id === updated.id ? { ...current, ...updated } : current));
  }

  async function toggleLike(video) {
    const updated = await stageClient.http.post(`/player-showcase-videos/${video.id}/like`, {});
    replaceVideo(updated);
    return updated;
  }

  const activeCount = videos.length;

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Binoculars className="h-6 w-6 shrink-0 text-primary" />
            <div>
              <h1 className="font-heading text-4xl font-black uppercase text-foreground md:text-5xl">
                Scouting
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeCount} showcase {activeCount === 1 ? "video" : "videos"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 border-y border-border py-4 md:grid-cols-[11rem_11rem_1fr]">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger aria-label="Scouting sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All videos</SelectItem>
              <SelectItem value="recent">Recent</SelectItem>
              <SelectItem value="trending">Trending</SelectItem>
            </SelectContent>
          </Select>

          <Select value={position} onValueChange={setPosition}>
            <SelectTrigger aria-label="Position filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All positions</SelectItem>
              {POSITIONS.map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              placeholder="Country or code"
              className="pl-9"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : videos.length === 0 ? (
          <div className="py-20 text-center">
            <Video className="mx-auto h-9 w-9 text-muted-foreground" />
            <h2 className="mt-3 text-lg font-bold text-foreground">No showcase videos found</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Try a different position or country filter.
            </p>
            {(filter !== "all" || position !== "all" || country) && (
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => { setFilter("all"); setPosition("all"); setCountry(""); }}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className={cn("grid gap-4", "sm:grid-cols-2 xl:grid-cols-3")}>
            {videos.map((video) => (
              <ScoutingVideoCard
                key={video.id}
                video={video}
                onOpen={() => setSelectedVideo(video)}
                onLike={() => toggleLike(video)}
              />
            ))}
          </div>
        )}
      </div>

      <ScoutingVideoModal
        video={selectedVideo}
        highlightCommentId={queryCommentId}
        onClose={() => setSelectedVideo(null)}
        onLike={toggleLike}
        onVideoChanged={replaceVideo}
      />
    </div>
  );
}

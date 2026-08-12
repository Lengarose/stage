import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { stageClient } from "@/api/stageClient";
import { cn } from "@/lib/utils";
import { Heart, Loader2, MessageCircle, Send, User } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

function meta(video) {
  return [
    video?.showcase_position || video?.position,
    video?.country_code || video?.country,
  ].filter(Boolean).join(" · ");
}

export default function ScoutingVideoModal({
  video,
  highlightCommentId,
  onClose,
  onLike,
  onVideoChanged,
}) {
  const { t } = useTranslation();
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const highlightedRef = useRef(null);

  const open = Boolean(video?.id);
  const liked = video?.liked_by_me === true || video?.liked_by_me === 1 || video?.liked_by_me === "1";

  useEffect(() => {
    let cancelled = false;
    if (!video?.id) {
      setComments([]);
      return undefined;
    }
    setLoadingComments(true);
    setError(null);
    stageClient.http.get(`/player-showcase-videos/${video.id}/comments`)
      .then((rows) => {
        if (!cancelled) setComments(Array.isArray(rows) ? rows : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Could not load comments.");
      })
      .finally(() => {
        if (!cancelled) setLoadingComments(false);
      });
    return () => { cancelled = true; };
  }, [video?.id]);

  useEffect(() => {
    if (!highlightCommentId || !highlightedRef.current) return;
    highlightedRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightCommentId, comments]);

  async function handleLike() {
    if (!video?.id) return;
    setError(null);
    try {
      await onLike?.(video);
    } catch (err) {
      setError(err?.message || t("commonPages.scoutVoteFailed"));
    }
  }

  async function submitComment() {
    const next = content.trim();
    if (!next || !video?.id) return;
    setSaving(true);
    setError(null);
    try {
      const created = await stageClient.http.post(`/player-showcase-videos/${video.id}/comments`, { content: next });
      setComments((prev) => [...prev, created]);
      setContent("");
      onVideoChanged?.({
        ...video,
        comments_count: Number(video.comments_count || 0) + 1,
      });
    } catch (err) {
      setError(err?.message || t("commonPages.scoutCommentFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose?.()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden p-0">
        {video && (
          <div className="grid max-h-[92vh] grid-rows-[auto_minmax(0,1fr)]">
            <DialogHeader className="border-b border-border px-4 py-3 text-left">
              <DialogTitle className="truncate text-base">{video.title || t("commonPages.showcaseUntitled")}</DialogTitle>
            </DialogHeader>

            <div className="grid min-h-0 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1fr)_21rem]">
              <div className="min-h-0 bg-black">
                <video
                  src={video.media_url || video.url}
                  className="h-full max-h-[64vh] min-h-[16rem] w-full bg-black object-contain"
                  controls
                  playsInline
                />
              </div>

              <aside className="flex min-h-0 flex-col border-t border-border bg-card lg:border-l lg:border-t-0">
                <div className="space-y-3 border-b border-border p-4">
                  <Link
                    to={video.player_id ? `/players/${video.player_id}` : "#"}
                    onClick={onClose}
                    className="flex min-w-0 items-center gap-3 text-foreground transition-colors hover:text-primary"
                  >
                    {video.avatar_url ? (
                      <img src={video.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                        <User className="h-5 w-5" />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{video.gamertag || t("commonPages.scoutUnknownPlayer")}</span>
                      {meta(video) && <span className="block truncate text-xs text-muted-foreground">{meta(video)}</span>}
                    </span>
                  </Link>

                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={handleLike} className="gap-1.5">
                      <Heart className={cn("h-4 w-4", liked && "fill-current text-destructive")} />
                      {Number(video.likes_count || 0)}
                    </Button>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <MessageCircle className="h-4 w-4" />
                      {Number(video.comments_count || comments.length || 0)}
                    </span>
                  </div>
                </div>

                {error && (
                  <p className="mx-4 mt-3 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {error}
                  </p>
                )}

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  {loadingComments ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : comments.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">{t("commonPages.scoutNoComments")}</p>
                  ) : (
                    <div className="space-y-3">
                      {comments.map((comment) => {
                        const highlighted = String(comment.id) === String(highlightCommentId || "");
                        return (
                          <div
                            key={comment.id}
                            ref={highlighted ? highlightedRef : null}
                            className={cn(
                              "rounded-lg border border-border bg-background p-3",
                              highlighted && "border-primary/50 bg-primary/10"
                            )}
                          >
                            <div className="mb-1 flex items-center gap-2">
                              {comment.author_avatar_url ? (
                                <img src={comment.author_avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                              ) : (
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                                  <User className="h-3 w-3" />
                                </span>
                              )}
                              <span className="truncate text-xs font-bold text-foreground">
                                {comment.author_name || t("commonPages.scoutUnknownPlayer")}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{comment.content}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="border-t border-border p-4">
                  <Textarea
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder={t("commonPages.addComment")}
                    rows={3}
                    maxLength={1000}
                  />
                  <Button
                    type="button"
                    onClick={submitComment}
                    disabled={!content.trim() || saving}
                    className="mt-2 w-full gap-1.5"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {t("commonPages.scoutComment")}
                  </Button>
                </div>
              </aside>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

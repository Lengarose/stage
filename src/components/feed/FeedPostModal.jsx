import { useEffect, useRef, useState } from "react";
import { Heart, Loader2, MessageSquare, Send, Trash2, X } from "lucide-react";
import { stageClient } from "@/api/stageClient";
import FeedPostImageFrame from "@/components/feed/FeedPostImageFrame";
import { cn } from "@/lib/utils";

function userLikedPost(post, currentUser) {
  return (post.likes || []).some((email) =>
    String(email).toLowerCase() === String(currentUser?.email || "").toLowerCase()
  );
}

export default function FeedPostModal({
  post,
  currentUser,
  onClose,
  onLike,
  onPostUpdated,
  likePending = false,
  onDelete,
  renderContent,
}) {
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentError, setCommentError] = useState("");
  const commentsEndRef = useRef();
  const liked = userLikedPost(post, currentUser);

  useEffect(() => {
    let cancelled = false;
    setLoadingComments(true);
    setCommentError("");
    stageClient.entities.Comment
      .filter({ post_id: post.id }, "created_date", 100)
      .then((data) => {
        if (!cancelled) setComments(data);
      })
      .catch((err) => {
        if (!cancelled) setCommentError(err?.message || "Could not load comments.");
      })
      .finally(() => {
        if (!cancelled) setLoadingComments(false);
      });
    return () => {
      cancelled = true;
    };
  }, [post.id]);

  async function submitComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmitting(true);
    setCommentError("");
    try {
      const result = await stageClient.comments.createForPost({
        post_id: post.id,
        content: commentText.trim(),
      });
      if (result.comment) setComments(prev => [...prev, result.comment]);
      if (result.post) onPostUpdated(result.post);
      setCommentText("");
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      setCommentError(err?.message || "Could not add comment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {post.media_url ? (
          <div className="md:w-1/2 bg-black flex items-center justify-center shrink-0">
            {post.media_type === "image" ? (
              <FeedPostImageFrame post={post} variant="modal" className="bg-black" alt="" />
            ) : (
              <video src={post.media_url} poster={post.media_cover_url || undefined} controls className="w-full max-h-[60vh] md:max-h-[90vh]" />
            )}
          </div>
        ) : null}

        <div className={cn("flex flex-col flex-1 min-h-0", !post.media_url && "w-full")}>
          <div className="flex items-center gap-3 p-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
              {post.author_avatar
                ? <img src={post.author_avatar} className="w-full h-full object-cover" alt="" />
                : <span className="text-primary font-bold text-sm">{(post.author_name || "?")[0].toUpperCase()}</span>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground truncate">{post.author_name}</p>
              <p className="text-[11px] text-muted-foreground">{post.created_date ? new Date(post.created_date).toLocaleDateString() : ""}</p>
            </div>
            {onDelete && (
              <button type="button" onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-lg hover:bg-destructive/10">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {post.content && (
            <div className="px-4 py-3 border-b border-border shrink-0">
              <p className="text-sm text-foreground whitespace-pre-line">
                {renderContent ? renderContent(post) : post.content}
              </p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {loadingComments ? (
              <div className="text-center py-4">
                <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No comments yet. Be the first!</p>
            ) : (
              comments.map(c => (
                <div key={c.id} className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 text-[10px] font-bold text-primary">
                    {(c.author_name || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-foreground mr-1.5">{c.author_name}</span>
                    <span className="text-xs text-foreground/80">{c.content}</span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{c.created_date ? new Date(c.created_date).toLocaleDateString() : ""}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={commentsEndRef} />
          </div>

          <div className="px-4 py-3 border-t border-border space-y-2 shrink-0">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={onLike}
                disabled={likePending}
                className={cn("flex items-center gap-1.5 text-sm font-medium transition-colors",
                  liked ? "text-red-500" : "text-muted-foreground hover:text-red-500",
                  likePending && "opacity-60 cursor-not-allowed")}
              >
                {likePending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Heart className="w-5 h-5" fill={liked ? "currentColor" : "none"} />}
                {post.likes_count || 0} likes
              </button>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MessageSquare className="w-4 h-4" />
                {post.comments_count || 0} comments
              </span>
            </div>

            {currentUser && (
              <form onSubmit={submitComment} className="flex gap-2">
                <input
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
                />
                <button type="submit" disabled={submitting || !commentText.trim()}
                  className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            )}
            {commentError && <p className="text-xs text-destructive">{commentError}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

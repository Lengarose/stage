import { useState, useEffect, useRef } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Image, Video, Send, Heart, MessageSquare, Loader2, X, Trash2 } from "lucide-react";
import VideoCoverPicker from "./VideoCoverPicker";
import { cn } from "@/lib/utils";

export default function PlayerFeed({ currentUser, player, isOwner }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState(null);
  const [mediaType, setMediaType] = useState("none");
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [expandedPost, setExpandedPost] = useState(null);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [mediaCoverUrl, setMediaCoverUrl] = useState(null);
  const imageRef = useRef();
  const videoRef = useRef();

  useEffect(() => {
    async function load() {
      const all = await stageClient.entities.Post.filter({ author_email: player.email }, "-created_date", 50);
      const data = all.filter(p => !p.club_id);
      setPosts(data);
      setLoading(false);
    }
    load();

    const unsub = stageClient.entities.Post.subscribe((event) => {
      if (event.type === "create" && event.data.author_email === player.email) {
        setPosts(prev => [event.data, ...prev]);
      } else if (event.type === "update") {
        setPosts(prev => prev.map(p => p.id === event.id ? event.data : p));
        setExpandedPost(prev => prev?.id === event.id ? event.data : prev);
      } else if (event.type === "delete") {
        setPosts(prev => prev.filter(p => p.id !== event.id));
        setExpandedPost(prev => prev?.id === event.id ? null : prev);
      }
    }, { author_email: player.email });
    return unsub;
  }, [player.email]);

  async function uploadMedia(e, type) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await stageClient.integrations.Core.UploadFile({ file });
    setMediaUrl(file_url);
    setMediaType(type);
    setUploading(false);
    e.target.value = "";
  }

  async function submitPost() {
    if (!content.trim() && !mediaUrl) return;
    setPosting(true);
    await stageClient.entities.Post.create({
      author_email: currentUser.email,
      author_name: player?.gamertag || currentUser.full_name || currentUser.email,
      author_avatar: player?.avatar_url,
      content: content.trim(),
      media_url: mediaUrl || undefined,
      media_cover_url: mediaCoverUrl || undefined,
      media_type: mediaType,
      likes: [],
      likes_count: 0,
    });
    setContent("");
    setMediaUrl(null);
    setMediaType("none");
    setMediaCoverUrl(null);
    setPosting(false);
  }

  async function toggleLike(post) {
    const liked = post.likes?.includes(currentUser?.email);
    const likes = liked
      ? post.likes.filter(e => e !== currentUser.email)
      : [...(post.likes || []), currentUser.email];
    await stageClient.entities.Post.update(post.id, { likes, likes_count: likes.length });
  }

  async function deletePost(postId) {
    await stageClient.entities.Post.delete(postId);
  }

  return (
    <div className="space-y-5">
      {/* Composer — only for own profile */}
      {isOwner && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
              {player?.avatar_url
                ? <img src={player.avatar_url} className="w-full h-full object-cover" alt="" />
                : <span className="text-primary leading-relaxed font-bold text-sm">{(player?.gamertag || "?")[0].toUpperCase()}</span>
              }
            </div>
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Share a moment with the community…"
              className="bg-secondary border-border resize-none text-sm flex-1"
              rows={2}
            />
          </div>

          {mediaUrl && (
            <div className="relative inline-block ml-12">
              {mediaType === "image" && <img src={mediaUrl} alt="preview" className="max-h-52 rounded-xl object-cover" />}
              {mediaType === "video" && (
                <div className="space-y-1">
                  <video src={mediaUrl} className="max-h-52 rounded-xl" controls />
                  <button onClick={() => setCoverPickerOpen(true)} className="text-xs text-primary hover:underline">
                    {mediaCoverUrl ? "✓ Cover set — change it" : "Pick a cover frame"}
                  </button>
                </div>
              )}
              <button onClick={() => { setMediaUrl(null); setMediaType("none"); setMediaCoverUrl(null); }}
                className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 text-white hover:bg-black/80">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between ml-12">
            <div className="flex gap-2">
              <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={e => uploadMedia(e, "image")} />
              <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={e => uploadMedia(e, "video")} />
              <button onClick={() => imageRef.current?.click()} disabled={uploading}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-secondary">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />} Photo
              </button>
              <button onClick={() => videoRef.current?.click()} disabled={uploading}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-secondary">
                <Video className="w-4 h-4" /> Video
              </button>
            </div>
            <Button onClick={submitPost} disabled={posting || (!content.trim() && !mediaUrl)}
              size="sm" className="bg-primary text-primary-foreground leading-relaxed">
              {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-3.5 h-3.5 mr-1.5" />Post</>}
            </Button>
          </div>
        </div>
      )}

      {/* Post count */}
      {posts.length > 0 && (
        <p className="text-sm text-muted-foreground">{posts.length} post{posts.length !== 1 ? "s" : ""}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-7 h-7 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
      ) : posts.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground text-sm">
          {isOwner ? "No posts yet. Share your first moment!" : "No posts yet."}
        </div>
      ) : (
        /* Instagram-style grid — always */
        <div className="grid grid-cols-3 gap-1">
          {posts.map(post => (
            <button key={post.id} onClick={() => setExpandedPost(post)}
              className="relative aspect-square bg-secondary rounded-lg overflow-hidden group">
              {post.media_url && post.media_type === "image" ? (
                <img src={post.media_url} className="w-full h-full object-cover" alt="" />
              ) : post.media_url && post.media_type === "video" ? (
                post.media_cover_url
                  ? <img src={post.media_cover_url} className="w-full h-full object-cover" alt="" />
                  : <video src={post.media_url} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-3 bg-secondary">
                  <p className="text-xs text-muted-foreground text-center line-clamp-4">{post.content}</p>
                </div>
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100">
                <span className="flex items-center gap-1 text-white text-sm font-bold">
                  <Heart className="w-4 h-4" fill="white" />{post.likes_count || 0}
                </span>
                <span className="flex items-center gap-1 text-white text-sm font-bold">
                  <MessageSquare className="w-4 h-4" fill="white" />{post.comments_count || 0}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <VideoCoverPicker
        open={coverPickerOpen}
        onClose={() => setCoverPickerOpen(false)}
        videoUrl={mediaUrl}
        onConfirm={(url) => { setMediaCoverUrl(url); setCoverPickerOpen(false); }}
      />

      {/* Expanded post modal — Instagram style */}
      {expandedPost && (
        <PostModal
          post={expandedPost}
          currentUser={currentUser}
          isOwner={isOwner}
          onClose={() => setExpandedPost(null)}
          onLike={() => toggleLike(expandedPost)}
          onDelete={isOwner && expandedPost.author_email === currentUser?.email ? () => { deletePost(expandedPost.id); setExpandedPost(null); } : null}
        />
      )}
    </div>
  );
}

function PostModal({ post, currentUser, onClose, onLike, onDelete }) {
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const commentsEndRef = useRef();

  const liked = post.likes?.includes(currentUser?.email);

  useEffect(() => {
    stageClient.entities.Comment.filter({ post_id: post.id }, "created_date", 100).then(setComments);
  }, [post.id]);

  async function submitComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmitting(true);
    await stageClient.entities.Comment.create({
      post_id: post.id,
      author_email: currentUser.email,
      author_name: currentUser.full_name || currentUser.email,
      content: commentText.trim(),
    });
    await stageClient.entities.Post.update(post.id, { comments_count: (post.comments_count || 0) + 1 });
    setComments(prev => [...prev, {
      id: Date.now(),
      post_id: post.id,
      author_email: currentUser.email,
      author_name: currentUser.full_name || currentUser.email,
      content: commentText.trim(),
      created_date: new Date().toISOString(),
    }]);
    setCommentText("");
    setSubmitting(false);
    setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Left: media */}
        {post.media_url ? (
          <div className="md:w-1/2 bg-black flex items-center justify-center shrink-0">
            {post.media_type === "image" ? (
              <img src={post.media_url} className="w-full h-full object-contain max-h-[60vh] md:max-h-[90vh]" alt="" />
            ) : (
              <video src={post.media_url} poster={post.media_cover_url || undefined} controls className="w-full max-h-[60vh] md:max-h-[90vh]" />
            )}
          </div>
        ) : null}

        {/* Right: info + comments */}
        <div className={cn("flex flex-col flex-1 min-h-0", !post.media_url && "w-full")}>
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
              {post.author_avatar
                ? <img src={post.author_avatar} className="w-full h-full object-cover" alt="" />
                : <span className="text-primary font-bold text-sm">{(post.author_name || "?")[0].toUpperCase()}</span>
              }
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-foreground">{post.author_name}</p>
              <p className="text-[11px] text-muted-foreground">{post.created_date ? new Date(post.created_date).toLocaleDateString() : ""}</p>
            </div>
            {onDelete && (
              <button onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-lg hover:bg-destructive/10">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Caption */}
          {post.content && (
            <div className="px-4 py-3 border-b border-border shrink-0">
              <p className="text-sm text-foreground whitespace-pre-line">{post.content}</p>
            </div>
          )}

          {/* Comments list */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {comments.length === 0 ? (
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

          {/* Like + comment count */}
          <div className="px-4 py-3 border-t border-border space-y-2 shrink-0">
            <div className="flex items-center gap-4">
              <button onClick={onLike}
                className={cn("flex items-center gap-1.5 text-sm font-medium transition-colors",
                  liked ? "text-red-500" : "text-muted-foreground hover:text-red-500")}>
                <Heart className="w-5 h-5" fill={liked ? "currentColor" : "none"} />
                {post.likes_count || 0} likes
              </button>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MessageSquare className="w-4 h-4" />
                {post.comments_count || 0} comments
              </span>
            </div>

            {/* Comment input */}
            {currentUser && (
              <form onSubmit={submitComment} className="flex gap-2">
                <input
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Add a comment…"
                  className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
                />
                <button type="submit" disabled={submitting || !commentText.trim()}
                  className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
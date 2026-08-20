import { useState, useEffect, useRef, useId} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import { AlertCircle, Heart, MessageCircle, Plus, Image, Move, Send, X, Loader2, Zap, Trophy, Megaphone, Star, BarChart3, Rss } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import FeedPostImageFrame from "@/components/feed/FeedPostImageFrame";
import FeedPostModal from "@/components/feed/FeedPostModal";
import ImagePositionEditor from "@/components/ImagePositionEditor";
import { cn } from "@/lib/utils";
import { DEFAULT_POST_MEDIA_FRAME } from "@/lib/feedMedia";
import { useTranslation } from "@/hooks/useTranslation";
import { getMentionPlayerId } from "@/lib/mentions";

export default function Social() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const targetPostId = searchParams.get("post");
  const targetCommentId = searchParams.get("comment");
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [postForm, setPostForm] = useState({ content: "" });
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState("");
  const [mediaPosition, setMediaPosition] = useState(DEFAULT_POST_MEDIA_FRAME.position);
  const [mediaZoom, setMediaZoom] = useState(DEFAULT_POST_MEDIA_FRAME.zoom);
  const [mediaEditorOpen, setMediaEditorOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [expandedPost, setExpandedPost] = useState(null);
  const [likePendingId, setLikePendingId] = useState(null);
  const [actionError, setActionError] = useState("");
  const fileInputId = useId();
  const fileRef = useRef();
  const postRefs = useRef(new Map());

  useEffect(() => {
    async function load() {
      const { user: u, player: myPl } = await resolveMyPlayerAndClub();
      if (!u) { setLoading(false); return; }
      setUser(u);
      const [postData, newsData, targetPost] = await Promise.all([
        stageClient.entities.Post.list("-created_date", 30),
        stageClient.entities.NewsItem.list("-published_at", 10),
        targetPostId ? stageClient.entities.Post.get(targetPostId).catch(() => null) : Promise.resolve(null),
      ]);
      const socialPosts = targetPost && !postData.some((post) => post.id === targetPost.id)
        ? [targetPost, ...postData]
        : postData;
      const allPosts = [
        ...socialPosts.map(p => ({ ...p, _type: "post", _sortDate: p.created_date })),
        ...newsData.map(n => ({ ...n, _type: "news", _sortDate: n.published_at || n.created_date })),
      ].sort((a, b) => new Date(b._sortDate || 0) - new Date(a._sortDate || 0));
      setPosts(allPosts);
      if (myPl) setMyPlayer(myPl);
      setLoading(false);
    }
    load();

    const unsub = stageClient.entities.Post.subscribe((event) => {
      if (event.type === "create") setPosts(prev => [{ ...event.data, _type: "post", _sortDate: event.data.created_date }, ...prev]);
      if (event.type === "update") setPosts(prev => prev.map(p => p.id === event.id ? { ...event.data, _type: "post", _sortDate: event.data.created_date } : p));
      if (event.type === "delete") setPosts(prev => prev.filter(p => p.id !== event.id));
    });
    const unsubNews = stageClient.entities.NewsItem.subscribe((event) => {
      if (event.type === "create") setPosts(prev => [{ ...event.data, _type: "news", _sortDate: event.data.published_at || event.data.created_date }, ...prev]);
    });
    return () => { unsub(); unsubNews(); };
  }, [targetPostId]);

  useEffect(() => {
    const target = targetPostId ? postRefs.current.get(targetPostId) : null;
    if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [posts, targetPostId]);

  useEffect(() => () => {
    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
  }, [mediaPreviewUrl]);

  function clearMediaFile() {
    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    setMediaFile(null);
    setMediaPreviewUrl("");
    setMediaPosition(DEFAULT_POST_MEDIA_FRAME.position);
    setMediaZoom(DEFAULT_POST_MEDIA_FRAME.zoom);
  }

  function handleMediaFile(file) {
    if (!file) return;
    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    setMediaFile(file);
    setMediaPreviewUrl(URL.createObjectURL(file));
    setMediaPosition(DEFAULT_POST_MEDIA_FRAME.position);
    setMediaZoom(DEFAULT_POST_MEDIA_FRAME.zoom);
  }

  async function createPost() {
    if (!postForm.content.trim() && !mediaFile) return;
    setPosting(true);
    setActionError("");
    let media_url = "";
    let media_type = "none";
    try {
      if (mediaFile) {
        const res = await stageClient.integrations.Core.UploadFile({ file: mediaFile });
        media_url = res.file_url;
        media_type = "image";
      }
      await stageClient.entities.Post.create({
        author_email: user.email,
        author_name: myPlayer?.gamertag || user.full_name || user.email,
        author_avatar: myPlayer?.avatar_url || "",
        content: postForm.content,
        media_url,
        media_type,
        media_position: mediaFile ? mediaPosition : undefined,
        media_zoom: mediaFile ? mediaZoom : undefined,
        media_aspect: mediaFile ? "square" : undefined,
      });
      setPostForm({ content: "" });
      clearMediaFile();
      setCreateOpen(false);
    } catch (err) {
      setActionError(err?.message || "Could not publish this post.");
    } finally {
      setPosting(false);
    }
  }

  async function deletePost(postId) {
    await stageClient.entities.Post.delete(postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
    setExpandedPost(prev => prev?.id === postId ? null : prev);
  }

  function replaceFeedPost(updatedPost) {
    const normalizedPost = { ...updatedPost, _type: "post", _sortDate: updatedPost.created_date };
    setPosts(prev => prev.map(p => p.id === updatedPost.id ? normalizedPost : p));
    setExpandedPost(prev => prev?.id === updatedPost.id ? normalizedPost : prev);
  }

  async function toggleLike(post) {
    if (likePendingId === post.id) return;
    setLikePendingId(post.id);
    setActionError("");
    try {
      const result = await stageClient.posts.likeToggle(post.id);
      replaceFeedPost(result.post);
    } catch (err) {
      setActionError(err?.message || "Could not update like.");
    } finally {
      setLikePendingId(null);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Rss className="w-6 h-6 text-primary shrink-0" />
            <div>
              <h1
                className="font-heading font-black text-5xl md:text-6xl text-foreground uppercase"
                style={{ transform: "skewX(-8deg)", letterSpacing: "-0.02em", transformOrigin: "left center" }}
              >
                {t("commonPages.feedTitle")}
              </h1>
              <p className="text-xs text-muted-foreground mt-1">{t("commonPages.feedSubtitle")}</p>
            </div>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground gap-2 shrink-0">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">{t("commonPages.post")}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-xl">{t("commonPages.createPost")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <Textarea
                  value={postForm.content}
                  onChange={e => setPostForm(f => ({ ...f, content: e.target.value }))}
                  className="bg-secondary border-border min-h-[100px]"
                  placeholder={t("commonPages.shareWithCommunity")}
                />
                {mediaPreviewUrl && (
                  <div className="relative">
                    <FeedPostImageFrame
                      post={{ media_url: mediaPreviewUrl, media_position: mediaPosition, media_zoom: mediaZoom, media_aspect: "square" }}
                      variant="preview"
                      className="rounded-xl border border-border"
                      alt="preview"
                    />
                    <button type="button" onClick={clearMediaFile} className="absolute top-2 right-2 bg-black/50 rounded-full p-1.5 hover:bg-black/70 transition-colors">
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <input id={fileInputId} ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={e => handleMediaFile(e.target.files[0])} />
                  <label htmlFor={fileInputId} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-secondary cursor-pointer touch-manipulation">
                    <Image className="w-4 h-4" /> Photo
                  </label>
                  {mediaPreviewUrl && (
                    <button type="button" onClick={() => setMediaEditorOpen(true)} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-secondary">
                      <Move className="w-4 h-4" /> Frame
                    </button>
                  )}
                </div>
                {actionError && (
                  <p className="text-xs text-destructive flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3" /> {actionError}
                  </p>
                )}
                <Button onClick={createPost} disabled={posting || (!postForm.content.trim() && !mediaFile)}
                  className="w-full bg-primary text-primary-foreground">
                  {posting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("commonPages.posting")}</> : <><Send className="w-4 h-4 mr-2" /> {t("commonPages.share")}</>}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Posts */}
        {posts.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <MessageCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-foreground font-medium">{t("commonPages.noPostsYet")}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("commonPages.firstToShare")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => {
              if (post._type === "news") return <NewsPostCard key={"news_" + post.id} item={post} />;
              return (
                <div key={post.id} ref={(node) => {
                  if (node) postRefs.current.set(post.id, node);
                  else postRefs.current.delete(post.id);
                }}>
                  <PostCard
                    post={post}
                    user={user}
                    onLike={toggleLike}
                    likePending={likePendingId === post.id}
                    actionError={actionError}
                    onDelete={deletePost}
                    onPostUpdated={replaceFeedPost}
                    onOpenPost={(post) => setExpandedPost(post)}
                    focusCommentId={post.id === targetPostId ? targetCommentId : null}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
      <ImagePositionEditor
        open={mediaEditorOpen}
        onClose={() => setMediaEditorOpen(false)}
        imageUrl={mediaPreviewUrl}
        aspect="square"
        initialPosition={mediaPosition}
        initialZoom={mediaZoom}
        onConfirm={(_url, position, zoom) => {
          setMediaPosition(position || DEFAULT_POST_MEDIA_FRAME.position);
          setMediaZoom(zoom || DEFAULT_POST_MEDIA_FRAME.zoom);
          setMediaEditorOpen(false);
        }}
      />
      {expandedPost && (
        <FeedPostModal
          post={expandedPost}
          currentUser={user}
          onClose={() => setExpandedPost(null)}
          onLike={() => toggleLike(expandedPost)}
          onPostUpdated={replaceFeedPost}
          likePending={likePendingId === expandedPost.id}
          onDelete={expandedPost.author_email === user?.email ? () => deletePost(expandedPost.id) : null}
          renderContent={(modalPost) => <PostContent content={modalPost.content} tags={modalPost.tags} />}
        />
      )}
    </div>
  );
}

const NEWS_TYPE_CONFIG = {
  tournament:   { labelKey: "tournaments", icon: Trophy,    color: "text-accent",   bg: "bg-accent/10 border-accent/30" },
  achievement:  { labelKey: "achievement", icon: Star,      color: "text-warning",  bg: "bg-warning/10 border-warning/30" },
  app_update:   { labelKey: "appUpdate",   icon: Zap,       color: "text-primary",  bg: "bg-primary/10 border-primary/30" },
  ranking:      { labelKey: "rankings",    icon: BarChart3, color: "text-success",  bg: "bg-success/10 border-success/30" },
  announcement: { labelKey: "announcement", icon: Megaphone, color: "text-primary",  bg: "bg-primary/10 border-primary/30" },
};

function NewsPostCard({ item }) {
  const { t } = useTranslation();
  const cfg = NEWS_TYPE_CONFIG[item.type] || NEWS_TYPE_CONFIG.announcement;
  const Icon = cfg.icon;
  return (
    <div className={cn("bg-card border rounded-2xl overflow-hidden", cfg.bg)}>
      {item.image_url && <img src={item.image_url} alt={item.title} className="w-full max-h-48 object-cover" />}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Zap className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-xs font-bold text-primary">STAGE</span>
          <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ml-auto", cfg.bg, cfg.color)}>
            <Icon className="w-2.5 h-2.5" /> {t(`commonPages.${cfg.labelKey || "announcement"}`)}
          </div>
        </div>
        <h3 className="font-bold text-foreground text-sm leading-snug">{item.title}</h3>
        {item.body && <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{item.body}</p>}
        <p className="text-[10px] text-muted-foreground/50 mt-2">{item.published_at ? new Date(item.published_at).toLocaleDateString() : ""}</p>
      </div>
    </div>
  );
}


function PostCard({ post, user, onLike, likePending, actionError, onDelete, onPostUpdated, onOpenPost, focusCommentId }) {
  const { t } = useTranslation();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [highlightedCommentId, setHighlightedCommentId] = useState(null);
  const commentsLoaded = useRef(false);
  const commentRefs = useRef(new Map());
  const liked = (post.likes || []).some((email) => String(email).toLowerCase() === String(user?.email || "").toLowerCase());

  async function loadComments() {
    if (!commentsLoaded.current) {
      setLoadingComments(true);
      const data = await stageClient.entities.Comment.filter({ post_id: post.id }, "created_date");
      setComments(data);
      commentsLoaded.current = true;
      setLoadingComments(false);
    }
    setCommentsOpen(prev => !prev);
  }

  useEffect(() => {
    if (!focusCommentId) return;
    setCommentsOpen(true);
    if (commentsLoaded.current) return;
    setLoadingComments(true);
    stageClient.entities.Comment.filter({ post_id: post.id }, "created_date")
      .then((data) => {
        setComments(data);
        commentsLoaded.current = true;
      })
      .finally(() => setLoadingComments(false));
  }, [focusCommentId, post.id]);

  useEffect(() => {
    const comment = focusCommentId ? commentRefs.current.get(focusCommentId) : null;
    if (!comment) return;
    setHighlightedCommentId(focusCommentId);
    comment.scrollIntoView({ behavior: "smooth", block: "center" });
    const timeout = window.setTimeout(() => setHighlightedCommentId(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [comments, focusCommentId]);

  async function addComment(e) {
    e.preventDefault();
    if (!commentInput.trim()) return;
    setCommentSubmitting(true);
    setCommentError("");
    try {
      const result = await stageClient.comments.createForPost({
        post_id: post.id,
        content: commentInput.trim(),
      });
      if (result.comment) setComments(prev => [...prev, result.comment]);
      if (result.post) onPostUpdated(result.post);
      setCommentInput("");
    } catch (err) {
      setCommentError(err?.message || "Could not add comment.");
    } finally {
      setCommentSubmitting(false);
    }
  }

  function openPostFromKeyboard(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpenPost(post);
    }
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Author */}
      <div className="flex items-center gap-3 p-4 pb-3">
        <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center overflow-hidden shrink-0 border border-border">
          {post.author_avatar
            ? <img src={post.author_avatar} alt={post.author_name} className="w-full h-full object-cover" />
            : <span className="font-bold text-primary text-sm">{post.author_name?.[0]?.toUpperCase()}</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm truncate">{post.author_name}</p>
          <p className="text-xs text-muted-foreground">{post.created_date ? new Date(post.created_date).toLocaleDateString() : ""}</p>
        </div>
        {post.author_email === user?.email && (
          <button onClick={() => onDelete(post.id)} className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-lg hover:bg-destructive/10 shrink-0">
            {t("commonPages.delete")}
          </button>
        )}
      </div>

      {/* Content */}
      {post.content && <p className="px-4 pb-3 text-sm text-foreground leading-relaxed"><PostContent content={post.content} tags={post.tags} /></p>}

      {/* Media */}
      {post.media_url && post.media_type === "image" && (
        <button
          type="button"
          onClick={() => onOpenPost(post)}
          className="block w-full cursor-zoom-in"
          aria-label="Open post"
        >
          <FeedPostImageFrame post={post} variant="card" alt="post media" />
        </button>
      )}
      {post.media_url && post.media_type === "video" && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => onOpenPost(post)}
          onKeyDown={openPostFromKeyboard}
          className="cursor-zoom-in"
          aria-label="Open post"
        >
          <video src={post.media_url} poster={post.media_cover_url || undefined} controls className="w-full max-h-96" />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 px-4 py-3 border-t border-border/50">
        <button
          onClick={() => onLike(post)}
          disabled={likePending}
          className={cn("flex items-center gap-1.5 text-sm transition-colors",
            liked ? "text-primary" : "text-muted-foreground hover:text-foreground",
            likePending && "opacity-60 cursor-not-allowed"
          )}
        >
          {likePending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" fill={liked ? "currentColor" : "none"} />}
          <span>{post.likes_count || 0}</span>
        </button>
        <button
          onClick={loadComments}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          <span>{post.comments_count || 0}</span>
        </button>
      </div>
      {actionError && <p className="px-4 pb-3 text-xs text-destructive">{actionError}</p>}

      {/* Comments */}
      {commentsOpen && (
        <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-3">
          {loadingComments && <div className="text-center py-2"><div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>}
          {comments.map(c => (
            <div key={c.id} ref={(node) => {
              if (node) commentRefs.current.set(c.id, node);
              else commentRefs.current.delete(c.id);
            }} className={cn("flex gap-2 transition-colors", highlightedCommentId === c.id && "rounded-lg bg-primary/10")}>
              <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-primary">{c.author_name?.[0]?.toUpperCase()}</span>
              </div>
              <div className="bg-secondary rounded-xl px-3 py-2 text-xs flex-1">
                <span className="font-semibold text-primary">{c.author_name} </span>
                <span className="text-foreground">{c.content}</span>
              </div>
            </div>
          ))}
          <form onSubmit={addComment} className="flex gap-2 mt-2">
            <input
              value={commentInput}
              onChange={e => setCommentInput(e.target.value)}
              placeholder={t("commonPages.addComment")}
              className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
            />
            <Button type="submit" size="icon" className="bg-primary/10 text-primary hover:bg-primary/20 border-0 w-8 h-8 shrink-0" disabled={commentSubmitting || !commentInput.trim()}>
              {commentSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            </Button>
          </form>
          {commentError && <p className="text-xs text-destructive">{commentError}</p>}
        </div>
      )}
    </div>
  );
}

function PostContent({ content, tags }) {
  const nodes = [];
  let lastIndex = 0;
  for (const match of String(content).matchAll(/(^|\s)@([A-Za-z0-9_-]{2,32})\b/g)) {
    const prefix = match[1];
    const gamertag = match[2];
    const mentionStart = match.index + prefix.length;
    nodes.push(String(content).slice(lastIndex, mentionStart));
    const playerId = getMentionPlayerId(tags, gamertag);
    nodes.push(playerId
      ? <Link key={`${mentionStart}-${gamertag}`} to={`/players/${playerId}`} className="font-semibold text-primary hover:underline">@{gamertag}</Link>
      : `@${gamertag}`);
    lastIndex = mentionStart + gamertag.length + 1;
  }
  nodes.push(String(content).slice(lastIndex));
  return nodes;
}

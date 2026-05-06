import { useState, useEffect, useRef } from "react";
import { stageClient } from "@/api/stageClient";
import { Heart, MessageCircle, Plus, Image, Send, X, Loader2, Mic, Zap, Trophy, Megaphone, Star, BarChart3, Rss } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function Social() {
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [postForm, setPostForm] = useState({ content: "", media_type: "none" });
  const [mediaFile, setMediaFile] = useState(null);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    async function load() {
      const u = await stageClient.auth.me();
      setUser(u);
      const [postData, plData, newsData, pressData] = await Promise.all([
        stageClient.entities.Post.list("-created_date", 30),
        stageClient.entities.Player.filter({ email: u.email }),
        stageClient.entities.NewsItem.list("-published_at", 10),
        stageClient.entities.PressArticle.list("-published_at", 10),
      ]);
      const allPosts = [
        ...postData.map(p => ({ ...p, _type: "post", _sortDate: p.created_date })),
        ...newsData.map(n => ({ ...n, _type: "news", _sortDate: n.published_at || n.created_date })),
        ...pressData.map(a => ({ ...a, _type: "press", _sortDate: a.published_at })),
      ].sort((a, b) => new Date(b._sortDate || 0) - new Date(a._sortDate || 0));
      setPosts(allPosts);
      if (plData.length > 0) setMyPlayer(plData[0]);
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
    const unsubPress = stageClient.entities.PressArticle.subscribe((event) => {
      if (event.type === "create") setPosts(prev => [{ ...event.data, _type: "press", _sortDate: event.data.published_at || event.data.created_date }, ...prev]);
    });
    return () => { unsub(); unsubNews(); unsubPress(); };
  }, []);

  async function createPost() {
    if (!postForm.content.trim() && !mediaFile) return;
    setPosting(true);
    let media_url = "";
    let media_type = "none";
    if (mediaFile) {
      const res = await stageClient.integrations.Core.UploadFile({ file: mediaFile });
      media_url = res.file_url;
      media_type = mediaFile.type.startsWith("video") ? "video" : "image";
    }
    await stageClient.entities.Post.create({
      author_email: user.email,
      author_name: myPlayer?.gamertag || user.full_name || user.email,
      author_avatar: myPlayer?.avatar_url || "",
      content: postForm.content,
      media_url,
      media_type,
      likes: [],
      likes_count: 0,
      comments_count: 0,
    });
    setPostForm({ content: "", media_type: "none" });
    setMediaFile(null);
    setPosting(false);
    setCreateOpen(false);
  }

  async function deletePost(postId) {
    await stageClient.entities.Post.delete(postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
  }

  async function toggleLike(post) {
    const liked = post.likes?.includes(user.email);
    const newLikes = liked
      ? post.likes.filter(e => e !== user.email)
      : [...(post.likes || []), user.email];
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: newLikes, likes_count: newLikes.length } : p));
    await stageClient.entities.Post.update(post.id, { likes: newLikes, likes_count: newLikes.length });
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
                FEED
              </h1>
              <p className="text-xs text-muted-foreground mt-1">Community highlights &amp; updates</p>
            </div>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground gap-2 shrink-0">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Post</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-xl">Create Post</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <Textarea
                  value={postForm.content}
                  onChange={e => setPostForm(f => ({ ...f, content: e.target.value }))}
                  className="bg-secondary border-border min-h-[100px]"
                  placeholder="Share something with the community..."
                />
                {mediaFile && (
                  <div className="relative">
                    {mediaFile.type.startsWith("image") ? (
                      <img src={URL.createObjectURL(mediaFile)} className="w-full rounded-xl object-cover max-h-48" alt="preview" />
                    ) : (
                      <video src={URL.createObjectURL(mediaFile)} className="w-full rounded-xl max-h-48" controls />
                    )}
                    <button onClick={() => setMediaFile(null)} className="absolute top-2 right-2 bg-black/50 rounded-full p-1.5 hover:bg-black/70 transition-colors">
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-secondary">
                    <Image className="w-4 h-4" /> Photo/Video
                  </button>
                  <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={e => setMediaFile(e.target.files[0])} />
                </div>
                <Button onClick={createPost} disabled={posting || (!postForm.content.trim() && !mediaFile)}
                  className="w-full bg-primary text-primary-foreground">
                  {posting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Posting...</> : <><Send className="w-4 h-4 mr-2" /> Share</>}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Posts */}
        {posts.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <MessageCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-foreground font-medium">No posts yet</p>
            <p className="text-sm text-muted-foreground mt-1">Be the first to share something with the community!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => {
              if (post._type === "news") return <NewsPostCard key={"news_" + post.id} item={post} />;
              if (post._type === "press") return <PressPostCard key={"press_" + post.id} item={post} />;
              return <PostCard key={post.id} post={post} user={user} onLike={toggleLike} onDelete={deletePost} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const NEWS_TYPE_CONFIG = {
  tournament:   { label: "Tournament",    icon: Trophy,    color: "text-accent",   bg: "bg-accent/10 border-accent/30" },
  achievement:  { label: "Achievement",   icon: Star,      color: "text-warning",  bg: "bg-warning/10 border-warning/30" },
  app_update:   { label: "App Update",    icon: Zap,       color: "text-primary",  bg: "bg-primary/10 border-primary/30" },
  ranking:      { label: "Rankings",      icon: BarChart3, color: "text-success",  bg: "bg-success/10 border-success/30" },
  announcement: { label: "Announcement", icon: Megaphone, color: "text-primary",  bg: "bg-primary/10 border-primary/30" },
};

function NewsPostCard({ item }) {
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
            <Icon className="w-2.5 h-2.5" /> {cfg.label}
          </div>
        </div>
        <h3 className="font-bold text-foreground text-sm leading-snug">{item.title}</h3>
        {item.body && <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{item.body}</p>}
        <p className="text-[10px] text-muted-foreground/50 mt-2">{item.published_at ? new Date(item.published_at).toLocaleDateString() : ""}</p>
      </div>
    </div>
  );
}

function PressPostCard({ item }) {
  return (
    <div className="bg-card border border-purple-500/20 rounded-2xl overflow-hidden">
      {(item.photo_url || item.player_avatar_url) && (
        <div className="h-36 w-full overflow-hidden relative">
          <img src={item.photo_url || item.player_avatar_url} alt={item.headline} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-3 left-4">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/30 border border-purple-500/40 text-purple-300 text-[10px] font-bold uppercase tracking-wider">
              <Mic className="w-2.5 h-2.5" /> Press Conference
            </div>
          </div>
        </div>
      )}
      <div className="p-4">
        {!(item.photo_url || item.player_avatar_url) && (
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[10px] font-bold uppercase tracking-wider mb-2">
            <Mic className="w-2.5 h-2.5" /> Press Conference
          </div>
        )}
        <div className="flex items-center gap-2 mb-2">
          {item.player_avatar_url && <img src={item.player_avatar_url} alt={item.player_name} className="w-6 h-6 rounded-full object-cover border border-purple-500/30 shrink-0" />}
          <span className="text-xs font-bold text-foreground">{item.player_name}</span>
          {item.club_name && <span className="text-xs text-muted-foreground">· {item.club_name}</span>}
          <span className="text-xs text-muted-foreground/50 ml-auto shrink-0">{item.published_at ? new Date(item.published_at).toLocaleDateString() : ""}</span>
        </div>
        <h3 className="font-bold text-foreground text-sm leading-snug">{item.headline}</h3>
        {item.quotes?.[0] && <p className="text-xs text-muted-foreground mt-1.5 italic line-clamp-2">"{item.quotes[0].answer}"</p>}
      </div>
    </div>
  );
}

function PostCard({ post, user, onLike, onDelete }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const liked = post.likes?.includes(user?.email);

  async function loadComments() {
    if (!commentsOpen) {
      setLoadingComments(true);
      const data = await stageClient.entities.Comment.filter({ post_id: post.id }, "created_date");
      setComments(data);
      setLoadingComments(false);
    }
    setCommentsOpen(prev => !prev);
  }

  async function addComment(e) {
    e.preventDefault();
    if (!commentInput.trim()) return;
    const c = await stageClient.entities.Comment.create({
      post_id: post.id,
      author_email: user.email,
      author_name: user.full_name || user.email,
      content: commentInput.trim(),
    });
    await stageClient.entities.Post.update(post.id, { comments_count: (post.comments_count || 0) + 1 });
    setComments(prev => [...prev, c]);
    setCommentInput("");
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
            Delete
          </button>
        )}
      </div>

      {/* Content */}
      {post.content && <p className="px-4 pb-3 text-sm text-foreground leading-relaxed">{post.content}</p>}

      {/* Media */}
      {post.media_url && post.media_type === "image" && (
        <img src={post.media_url} alt="post media" className="w-full max-h-96 object-cover" />
      )}
      {post.media_url && post.media_type === "video" && (
        <video src={post.media_url} poster={post.media_cover_url || undefined} controls className="w-full max-h-96" />
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 px-4 py-3 border-t border-border/50">
        <button
          onClick={() => onLike(post)}
          className={cn("flex items-center gap-1.5 text-sm transition-colors",
            liked ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Heart className="w-4 h-4" fill={liked ? "currentColor" : "none"} />
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

      {/* Comments */}
      {commentsOpen && (
        <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-3">
          {loadingComments && <div className="text-center py-2"><div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>}
          {comments.map(c => (
            <div key={c.id} className="flex gap-2">
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
              placeholder="Add a comment..."
              className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
            />
            <Button type="submit" size="icon" className="bg-primary/10 text-primary hover:bg-primary/20 border-0 w-8 h-8 shrink-0" disabled={!commentInput.trim()}>
              <Send className="w-3 h-3" />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
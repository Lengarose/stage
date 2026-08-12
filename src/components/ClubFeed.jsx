import { useState, useEffect, useRef, useId} from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { AlertCircle, Image, Move, Send, Heart, MessageSquare, Loader2, X } from "lucide-react";
import FeedPostImageFrame from "@/components/feed/FeedPostImageFrame";
import FeedPostModal from "@/components/feed/FeedPostModal";
import ImagePositionEditor from "@/components/ImagePositionEditor";
import { DEFAULT_POST_MEDIA_FRAME } from "@/lib/feedMedia";

export default function ClubFeed({ club, currentUser, myPlayer, isMember }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState(null);
  const [mediaType, setMediaType] = useState("none");
  const [mediaPosition, setMediaPosition] = useState(DEFAULT_POST_MEDIA_FRAME.position);
  const [mediaZoom, setMediaZoom] = useState(DEFAULT_POST_MEDIA_FRAME.zoom);
  const [mediaEditorOpen, setMediaEditorOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [expandedPost, setExpandedPost] = useState(null);
  const [likePendingId, setLikePendingId] = useState(null);
  const [actionError, setActionError] = useState("");
  const imageInputId = useId();
  const imageRef = useRef();

  useEffect(() => {
    async function load() {
      const data = await stageClient.entities.Post.filter({ club_id: club.id }, "-created_date", 50);
      setPosts(data);
      setLoading(false);
    }
    load();

    const unsub = stageClient.entities.Post.subscribe((event) => {
      if (event.type === "create" && event.data.club_id === club.id) {
        setPosts(prev => [event.data, ...prev]);
      } else if (event.type === "update") {
        setPosts(prev => prev.map(p => p.id === event.id ? event.data : p));
        setExpandedPost(prev => prev?.id === event.id ? event.data : prev);
      } else if (event.type === "delete") {
        setPosts(prev => prev.filter(p => p.id !== event.id));
        setExpandedPost(prev => prev?.id === event.id ? null : prev);
      }
    }, { club_id: club.id });
    return unsub;
  }, [club.id]);

  function replacePost(updatedPost) {
    setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
    setExpandedPost(prev => prev?.id === updatedPost.id ? updatedPost : prev);
  }

  async function uploadMedia(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await stageClient.integrations.Core.UploadFile({ file });
    setMediaUrl(file_url);
    setMediaType("image");
    setMediaPosition(DEFAULT_POST_MEDIA_FRAME.position);
    setMediaZoom(DEFAULT_POST_MEDIA_FRAME.zoom);
    setUploading(false);
    e.target.value = "";
  }

  function clearMedia() {
    setMediaUrl(null);
    setMediaType("none");
    setMediaPosition(DEFAULT_POST_MEDIA_FRAME.position);
    setMediaZoom(DEFAULT_POST_MEDIA_FRAME.zoom);
  }

  async function submitPost() {
    if (!content.trim() && !mediaUrl) return;
    setPosting(true);
    setActionError("");
    try {
      await stageClient.entities.Post.create({
        author_email: currentUser.email,
        author_name: club.name,
        author_avatar: club.logo_url || undefined,
        content: content.trim(),
        media_url: mediaUrl || undefined,
        media_type: mediaType,
        media_position: mediaUrl ? mediaPosition : undefined,
        media_zoom: mediaUrl ? mediaZoom : undefined,
        media_aspect: mediaUrl ? "square" : undefined,
        club_id: club.id,
        club_name: club.name,
      });
      setContent("");
      clearMedia();
    } catch (err) {
      setActionError(err?.message || "Could not publish this post.");
    } finally {
      setPosting(false);
    }
  }

  async function deletePost(postId) {
    await stageClient.entities.Post.delete(postId);
  }

  async function toggleLike(post) {
    if (likePendingId === post.id) return;
    setLikePendingId(post.id);
    setActionError("");
    try {
      const result = await stageClient.posts.likeToggle(post.id);
      replacePost(result.post);
    } catch (err) {
      setActionError(err?.message || "Could not update like.");
    } finally {
      setLikePendingId(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Composer — members only */}
      {isMember && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
              {club.logo_url
                ? <img src={club.logo_url} className="w-full h-full object-cover" alt="" style={{ objectPosition: club.logo_position || "50% 50%" }} />
                : <span className="text-primary leading-relaxed font-bold text-sm">{(club.name || "?")[0].toUpperCase()}</span>
              }
            </div>
            <input
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={`Post to ${club.name}'s feed…`}
              className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
            />
          </div>

          {mediaUrl && (
            <div className="relative inline-block">
              {mediaType === "image" && (
                <FeedPostImageFrame
                  post={{ media_url: mediaUrl, media_position: mediaPosition, media_zoom: mediaZoom, media_aspect: "square" }}
                  variant="preview"
                  className="rounded-xl border border-border"
                  alt="preview"
                />
              )}
              <button type="button" onClick={clearMedia}
                className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 text-white hover:bg-black/80">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <input id={imageInputId} ref={imageRef} type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={uploadMedia} />
              <label htmlFor={uploading ? undefined : imageInputId}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-secondary cursor-pointer touch-manipulation">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />} Photo
              </label>
              {mediaUrl && (
                <button type="button" onClick={() => setMediaEditorOpen(true)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-secondary">
                  <Move className="w-4 h-4" /> Frame
                </button>
              )}
            </div>
            <Button onClick={submitPost} disabled={posting || (!content.trim() && !mediaUrl)}
              size="sm" className="bg-primary text-primary-foreground leading-relaxed">
              {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-3.5 h-3.5 mr-1.5" /> Post</>}
            </Button>
          </div>
          {actionError && (
            <p className="text-xs text-destructive flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3" /> {actionError}
            </p>
          )}
        </div>
      )}

      {/* Instagram-style grid */}
      {loading ? (
        <div className="flex justify-center py-10"><div className="w-7 h-7 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
      ) : posts.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground text-sm">
          No posts yet. {isMember ? "Be the first to post!" : ""}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{posts.length} post{posts.length !== 1 ? "s" : ""}</p>
          <div className="grid grid-cols-3 gap-1">
            {posts.map(post => (
              <button key={post.id} onClick={() => setExpandedPost(post)}
                className="relative aspect-square bg-secondary rounded-lg overflow-hidden group">
                {post.media_url && post.media_type === "image" ? (
                  <FeedPostImageFrame post={post} variant="thumbnail" alt="" />
                ) : post.media_url && post.media_type === "video" ? (
                  post.media_cover_url
                    ? <FeedPostImageFrame post={{ ...post, media_url: post.media_cover_url }} variant="thumbnail" alt="" />
                    : <video src={post.media_url} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-3 bg-secondary">
                    <p className="text-xs text-muted-foreground text-center line-clamp-4">{post.content}</p>
                  </div>
                )}
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
        </>
      )}

      {/* Expanded post modal */}
      {expandedPost && (
        <FeedPostModal
          post={expandedPost}
          currentUser={currentUser}
          onClose={() => setExpandedPost(null)}
          onLike={() => toggleLike(expandedPost)}
          onPostUpdated={replacePost}
          likePending={likePendingId === expandedPost.id}
          onDelete={expandedPost.author_email === currentUser?.email ? () => { deletePost(expandedPost.id); setExpandedPost(null); } : null}
        />
      )}
      <ImagePositionEditor
        open={mediaEditorOpen}
        onClose={() => setMediaEditorOpen(false)}
        imageUrl={mediaUrl}
        aspect="square"
        initialPosition={mediaPosition}
        initialZoom={mediaZoom}
        onConfirm={(_url, position, zoom) => {
          setMediaPosition(position || DEFAULT_POST_MEDIA_FRAME.position);
          setMediaZoom(zoom || DEFAULT_POST_MEDIA_FRAME.zoom);
          setMediaEditorOpen(false);
        }}
      />
    </div>
  );
}

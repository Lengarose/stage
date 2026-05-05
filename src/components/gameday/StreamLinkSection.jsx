import { useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Radio, ExternalLink, Pencil, X, Plus, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import TwitchPlayer from "./TwitchPlayer";
import { Dialog, DialogContent } from "@/components/ui/dialog";

function extractTwitchChannel(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!u.hostname.includes("twitch.tv")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[0] || null;
  } catch {
    return null;
  }
}

// Extract channel from Twitch JS embed snippet e.g. channel: "futdaddyh"
function extractTwitchChannelFromHtml(html) {
  if (!html) return null;
  const match = html.match(/channel\s*:\s*["']([^"']+)["']/);
  return match ? match[1] : null;
}

function getStreamPlatform(url) {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("youtube") || host.includes("youtu.be")) return { name: "YouTube", color: "text-red-500" };
    if (host.includes("twitch")) return { name: "Twitch", color: "text-purple-500" };
    if (host.includes("kick")) return { name: "Kick", color: "text-green-500" };
    return { name: "Live", color: "text-primary" };
  } catch {
    return null;
  }
}

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function StreamEntry({ label, url, isOwn, onEdit, onRemove, canManage }) {
  const platform = getStreamPlatform(url);
  return (
    <div className="flex items-center gap-2 bg-secondary/50 border border-border rounded-lg px-3 py-2">
      <Radio className={cn("w-3.5 h-3.5 shrink-0 animate-pulse", platform?.color || "text-primary")} />
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold shrink-0">
        {label}
      </span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 min-w-0 flex items-center gap-1 text-xs font-semibold text-primary hover:underline truncate"
      >
        Watch on {platform?.name || "Stream"}
        <ExternalLink className="w-3 h-3 shrink-0" />
      </a>
      {isOwn && canManage && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Edit link"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={onRemove}
            className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
            title="Remove link"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function StreamInputForm({ defaultValue, defaultHtml, onSave, onSaveHtml, onCancel }) {
  const [mode, setMode] = useState(defaultHtml ? "html" : "url");
  const [url, setUrl] = useState(defaultValue || "");
  const [html, setHtml] = useState(defaultHtml || "");
  const [error, setError] = useState("");

  function handleSave() {
    if (mode === "url") {
      const trimmed = url.trim();
      if (!trimmed) { setError("Please enter a URL."); return; }
      if (!isValidUrl(trimmed)) { setError("Please enter a valid URL (must start with http:// or https://)."); return; }
      onSave(trimmed);
    } else {
      const trimmed = html.trim();
      if (!trimmed) { setError("Please paste your embed HTML."); return; }
      onSaveHtml(trimmed);
    }
  }

  return (
    <div className="space-y-2">
      {/* Mode toggle */}
      <div className="flex gap-1 p-0.5 bg-secondary rounded-lg w-fit">
        <button
          onClick={() => { setMode("url"); setError(""); }}
          className={cn("px-3 py-1 text-[10px] font-semibold rounded-md transition-colors", mode === "url" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          URL
        </button>
        <button
          onClick={() => { setMode("html"); setError(""); }}
          className={cn("px-3 py-1 text-[10px] font-semibold rounded-md transition-colors", mode === "html" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          Embed HTML
        </button>
      </div>

      {mode === "url" ? (
        <input
          type="url"
          value={url}
          onChange={e => { setUrl(e.target.value); setError(""); }}
          placeholder="https://twitch.tv/yourname or YouTube/Kick link..."
          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          autoFocus
          onKeyDown={e => { if (e.key === "Escape") onCancel(); }}
        />
      ) : (
        <textarea
          value={html}
          onChange={e => { setHtml(e.target.value); setError(""); }}
          placeholder={'Paste your <iframe> embed code here...\ne.g. <iframe src="https://player.twitch.tv/?channel=xxx&parent=yourdomain" ...></iframe>'}
          rows={4}
          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono resize-none"
          autoFocus
          onKeyDown={e => { if (e.key === "Escape") onCancel(); }}
        />
      )}

      {error && <p className="text-[10px] text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} className="text-xs h-7 px-3">Save</Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="text-xs h-7 px-3">Cancel</Button>
      </div>
    </div>
  );
}

export default function StreamLinkSection({ game, isMyMatch, amIHomeTeam, isCompleted, onGameUpdate }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [streamModal, setStreamModal] = useState(false);

  const homeStream = game.home_stream_url || null;
  const awayStream = game.away_stream_url || null;
  const embedHtml = game.stream_embed_html || null;
  const hasAnyStream = homeStream || awayStream || embedHtml;

  // Prefer home stream for Twitch embed, fall back to away
  const embedUrl = homeStream || awayStream;
  const twitchChannel = extractTwitchChannel(embedUrl) || extractTwitchChannelFromHtml(embedHtml);
  const isMyHomeStream = amIHomeTeam;
  const myStreamUrl = isMyHomeStream ? homeStream : awayStream;
  const canManage = isMyMatch && !isCompleted;

  async function saveStream(url) {
    setSaving(true);
    const field = isMyHomeStream ? "home_stream_url" : "away_stream_url";
    await stageClient.entities.Match.update(game.id, { [field]: url || null });
    const updated = { ...game, [field]: url || null };
    setEditing(false);
    setSaving(false);
    if (onGameUpdate) onGameUpdate(updated);
  }

  async function saveEmbedHtml(html) {
    setSaving(true);
    await stageClient.entities.Match.update(game.id, { stream_embed_html: html || null });
    const updated = { ...game, stream_embed_html: html || null };
    setEditing(false);
    setSaving(false);
    if (onGameUpdate) onGameUpdate(updated);
  }

  async function removeStream() {
    setSaving(true);
    const field = isMyHomeStream ? "home_stream_url" : "away_stream_url";
    await stageClient.entities.Match.update(game.id, { [field]: null });
    const updated = { ...game, [field]: null };
    setSaving(false);
    if (onGameUpdate) onGameUpdate(updated);
  }

  async function removeEmbedHtml() {
    setSaving(true);
    await stageClient.entities.Match.update(game.id, { stream_embed_html: null });
    const updated = { ...game, stream_embed_html: null };
    setSaving(false);
    if (onGameUpdate) onGameUpdate(updated);
  }

  // Don't render if no stream and match is completed
  if (!hasAnyStream && isCompleted) return null;

  return (
    <div className="px-5 py-4 border-b border-border space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Live Stream
          </span>
        </div>
        {canManage && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 font-semibold transition-colors"
          >
            <Plus className="w-3 h-3" /> {hasAnyStream ? "Edit" : "Add Stream Link"}
          </button>
        )}
      </div>

      {/* Input form */}
      {editing && (
        <StreamInputForm
          defaultValue={myStreamUrl || ""}
          defaultHtml={embedHtml || ""}
          onSave={saveStream}
          onSaveHtml={saveEmbedHtml}
          onCancel={() => setEditing(false)}
        />
      )}

      {saving && !editing && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-3.5 h-3.5 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
          Saving...
        </div>
      )}

      {/* Stream links */}
      {!editing && (
        <div className="space-y-2">
          {homeStream && (
            <StreamEntry
              label="Home"
              url={homeStream}
              isOwn={isMyHomeStream}
              canManage={canManage}
              onEdit={() => setEditing(true)}
              onRemove={removeStream}
            />
          )}
          {awayStream && (
            <StreamEntry
              label="Away"
              url={awayStream}
              isOwn={!isMyHomeStream}
              canManage={canManage}
              onEdit={() => setEditing(true)}
              onRemove={removeStream}
            />
          )}
          {!hasAnyStream && !canManage && (
            <p className="text-xs text-muted-foreground">No stream links added yet.</p>
          )}
          {!hasAnyStream && canManage && !editing && (
            <p className="text-xs text-muted-foreground">No stream links yet. Add yours above!</p>
          )}
        </div>
      )}

      {/* Twitch inline embed (from URL) */}
      {twitchChannel && !editing && (
        <div className="relative group cursor-pointer" onClick={() => setStreamModal(true)}>
          <TwitchPlayer channel={twitchChannel} />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors rounded-xl">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 rounded-full p-2">
              <Maximize2 className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      )}

      {/* HTML embed (custom iframe code) */}
      {embedHtml && !twitchChannel && !editing && (
        <div className="space-y-2">
          <div
            className="relative group cursor-pointer w-full rounded-xl overflow-hidden border border-border bg-black"
            style={{ aspectRatio: "16/9" }}
            onClick={() => setStreamModal(true)}
          >
            <div dangerouslySetInnerHTML={{ __html: embedHtml }} className="w-full h-full pointer-events-none" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 rounded-full p-2">
                <Maximize2 className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
          {canManage && (
            <button
              onClick={removeEmbedHtml}
              className="flex items-center gap-1 text-[10px] text-destructive hover:text-destructive/80 font-semibold transition-colors"
            >
              <X className="w-3 h-3" /> Remove embed
            </button>
          )}
        </div>
      )}

      {/* Fullscreen stream modal */}
      <Dialog open={streamModal} onOpenChange={setStreamModal}>
        <DialogContent className="max-w-5xl w-full p-2 bg-black border-border">
          <div className="w-full" style={{ aspectRatio: "16/9" }}>
            {twitchChannel ? (
              <TwitchPlayer channel={twitchChannel} />
            ) : embedHtml ? (
              <div dangerouslySetInnerHTML={{ __html: embedHtml }} className="w-full h-full" />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
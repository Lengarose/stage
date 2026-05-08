import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Shield, Radio, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "@/lib/momentDate";
import { Link } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";

function extractTwitchChannel(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!u.hostname.includes("twitch.tv")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[0] || null;
  } catch { return null; }
}

function extractTwitchChannelFromHtml(html) {
  if (!html) return null;
  const match = html.match(/channel\s*:\s*["']([^"']+)["']/);
  return match ? match[1] : null;
}

export default function FollowedClubRow({ club, matchData }) {
  const [expanded, setExpanded] = useState(false);
  const [streamModal, setStreamModal] = useState(false);
  const hasMatch = !!matchData;
  const isLive = matchData?.isLive;
  const match = matchData?.match;

  const isHome = match?.home_club_id === club.id;
  const opponentName = isHome ? match?.away_club_name : match?.home_club_name;

  // Stream detection
  const embedHtml = match?.stream_embed_html || null;
  const streamUrl = match?.home_stream_url || match?.away_stream_url || null;
  const twitchChannel = extractTwitchChannel(streamUrl) || extractTwitchChannelFromHtml(embedHtml);
  const hasStream = !!(embedHtml || streamUrl);

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card hover:border-primary/30 transition-colors">
      <div
        className={cn("flex items-center gap-3 px-4 py-3", hasMatch && "cursor-pointer")}
        onClick={() => hasMatch && setExpanded(e => !e)}
      >
        {/* Logo */}
        <div className="w-11 h-11 rounded-full overflow-hidden bg-secondary border border-border shrink-0">
          {club.logo_url ? (
            <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              to={`/clubs/${club.id}`}
              onClick={e => e.stopPropagation()}
              className="font-bold text-sm text-foreground hover:text-primary transition-colors uppercase tracking-wide truncate"
            >
              {club.name}
            </Link>
            {club.tag && (
              <span className="text-xs px-1.5 py-0.5 bg-secondary border border-border rounded text-muted-foreground uppercase font-mono shrink-0">
                [{club.tag}]
              </span>
            )}
            {isLive && (
              <span className="text-xs px-2 py-0.5 bg-red-500/20 border border-red-500/50 rounded text-red-400 font-bold uppercase animate-pulse shrink-0">
                LIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
            <span>{club.platform}</span>
            {club.region && <><span>•</span><span>{club.region}</span></>}
            {hasMatch && !isLive && match?.scheduled_date && (
              <><span>•</span><span className="text-primary/80">{format(new Date(match.scheduled_date), "MMM d, HH:mm")}</span></>
            )}
          </div>
        </div>

        {/* Right side */}
        {hasMatch && (
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform", expanded && "rotate-180")} />
        )}
      </div>

      {/* Expanded match details */}
      <AnimatePresence>
        {expanded && hasMatch && match && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={cn("mx-4 mb-3 px-4 py-3 rounded-lg border", isLive ? "bg-red-500/5 border-red-500/20" : "bg-secondary/50 border-border")}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    {isLive ? "Live Match" : "Next Match"}
                  </p>
                  <p className="font-bold text-sm text-foreground">
                    {isHome ? club.name : opponentName}
                    <span className="text-muted-foreground font-normal mx-2">vs</span>
                    {isHome ? opponentName : club.name}
                  </p>
                  {match.scheduled_date && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(match.scheduled_date), "EEEE, MMMM d • HH:mm")}
                    </p>
                  )}
                </div>
                {isLive && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Score</p>
                    <p className="text-xl font-heading font-bold text-red-400">
                      {match.home_score ?? 0} – {match.away_score ?? 0}
                    </p>
                  </div>
                )}
              </div>
              {isLive && (
                hasStream ? (
                  <button
                    onClick={() => setStreamModal(true)}
                    className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 font-bold text-xs uppercase tracking-wider transition-colors w-full justify-center"
                  >
                    <Radio className="w-3.5 h-3.5 animate-pulse" />
                    Watch the Game
                  </button>
                ) : (
                  <Link
                    to="/game-day"
                    onClick={e => e.stopPropagation()}
                    className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 font-bold text-xs uppercase tracking-wider transition-colors w-full justify-center"
                  >
                    <Radio className="w-3.5 h-3.5 animate-pulse" />
                    Watch the Game
                  </Link>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stream modal */}
      <Dialog open={streamModal} onOpenChange={setStreamModal}>
        <DialogContent className="max-w-5xl w-full p-2 bg-black border-border">
          <div className="w-full" style={{ aspectRatio: "16/9" }}>
            {twitchChannel ? (
              <iframe
                src={`https://player.twitch.tv/?channel=${twitchChannel}&parent=${window.location.hostname}`}
                className="w-full h-full rounded-lg"
                allowFullScreen
              />
            ) : embedHtml ? (
              <div dangerouslySetInnerHTML={{ __html: embedHtml }} className="w-full h-full" />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
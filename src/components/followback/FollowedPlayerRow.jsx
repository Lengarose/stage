import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, User, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Link } from "react-router-dom";

export default function FollowedPlayerRow({ player, matchData, allClubs }) {
  const [expanded, setExpanded] = useState(false);
  const hasMatch = !!matchData;
  const isLive = matchData?.isLive;
  const match = matchData?.match;

  const playerClub = allClubs?.find(c => c.id === player.club_id);
  const isHome = match?.home_club_id === player.club_id;
  const opponentName = isHome ? match?.away_club_name : match?.home_club_name;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card hover:border-primary/30 transition-colors">
      <div
        className={cn("flex items-center gap-3 px-4 py-3", hasMatch && "cursor-pointer")}
        onClick={() => hasMatch && setExpanded(e => !e)}
      >
        {/* Avatar */}
        <div className="w-11 h-11 rounded-full overflow-hidden bg-secondary border border-border shrink-0">
          {player.avatar_url ? (
            <img
              src={player.avatar_url}
              alt={player.gamertag}
              className="w-full h-full object-cover"
              style={player.avatar_position ? { objectPosition: player.avatar_position } : {}}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/players/${player.id}`}
              onClick={e => e.stopPropagation()}
              className="font-bold text-sm text-foreground hover:text-primary transition-colors uppercase tracking-wide"
            >
              {player.gamertag}
            </Link>
            {player.position && (
              <span className="text-xs px-1.5 py-0.5 bg-primary/10 border border-primary/30 rounded text-primary font-bold uppercase font-mono shrink-0">
                {player.position}
              </span>
            )}
            {isLive && (
              <span className="text-xs px-2 py-0.5 bg-red-500/20 border border-red-500/50 rounded text-red-400 font-bold uppercase animate-pulse shrink-0">
                LIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
            <span>{player.platform}</span>
            {player.country_code && (
              <><span>•</span><span>{player.country_code} {player.country}</span></>
            )}
            {playerClub && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 text-primary/80">
                  <Shield className="w-3 h-3" />
                  {playerClub.name}
                </span>
              </>
            )}
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
                    {isHome ? (playerClub?.name || match.home_club_name) : opponentName}
                    <span className="text-muted-foreground font-normal mx-2">vs</span>
                    {isHome ? opponentName : (playerClub?.name || match.away_club_name)}
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
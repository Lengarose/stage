import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

const TYPE_BADGE = {
  match_invite:    { label: "Match Invite",     color: "bg-accent/10 text-accent border-accent/20" },
  contract_offer:  { label: "Contract",         color: "bg-warning/10 text-warning border-warning/20" },
  club_invite:     { label: "Club Invite",      color: "bg-primary/10 text-primary border-primary/20" },
  challenge:       { label: "Challenge",        color: "bg-destructive/10 text-destructive border-destructive/20" },
  announcement:    { label: "Announcement",     color: "bg-muted text-muted-foreground border-border" },
  general:         { label: "Message",          color: "bg-secondary text-secondary-foreground border-border" },
};

const STATUS_LABEL = {
  accepted:              { label: "Accepted",              color: "bg-success/10 text-success" },
  confirmed:             { label: "Confirmed",             color: "bg-success/10 text-success" },
  declined:              { label: "Declined",              color: "bg-destructive/10 text-destructive" },
  date_change_requested: { label: "Date Change Requested", color: "bg-warning/10 text-warning" },
};

export default function InboxMessageList({ messages, selectedId, onSelect }) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground p-6">
        <p className="text-sm">No messages</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {messages.map((msg) => {
        const badge = TYPE_BADGE[msg.message_type] || TYPE_BADGE.general;
        const isSelected = msg.id === selectedId;
        const needsAction = msg.action_type && msg.action_type !== "none" && msg.status === "pending";
        const isActioned = msg.action_type && msg.action_type !== "none" && msg.status !== "pending";
        const statusInfo = isActioned ? STATUS_LABEL[msg.status] : null;

        return (
          <button
            key={msg.id}
            onClick={() => onSelect(msg)}
            className={cn(
              "w-full text-left px-4 py-3.5 transition-all hover:bg-secondary/50 flex items-start gap-3",
              isSelected && "bg-primary/8 border-l-2 border-l-primary",
              !msg.is_read && !isSelected && "bg-primary/[0.04]",
              needsAction && !isSelected && "border-l-2 border-l-warning"
            )}
          >
            {/* Avatar */}
            <div className="shrink-0 mt-0.5 relative">
              {msg.is_system ? (
                <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-base">
                  ⚡
                </div>
              ) : msg.sender_avatar_url ? (
                <img
                  src={msg.sender_avatar_url}
                  alt={msg.sender_gamertag}
                  className="w-9 h-9 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center text-sm font-bold text-foreground">
                  {(msg.sender_gamertag || "?")[0].toUpperCase()}
                </div>
              )}
              {/* Unread dot on avatar */}
              {!msg.is_read && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Row 1: sender + time */}
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className={cn(
                  "text-xs font-semibold truncate",
                  !msg.is_read ? "text-foreground" : "text-muted-foreground"
                )}>
                  {msg.is_system ? "STAGE System" : (msg.sender_gamertag || "Unknown")}
                </span>
                <span className="text-[10px] text-muted-foreground/50 shrink-0">
                  {formatDistanceToNow(new Date(msg.created_date), { addSuffix: false })}
                </span>
              </div>

              {/* Row 2: subject */}
              <p className={cn(
                "text-sm truncate leading-snug",
                !msg.is_read ? "font-semibold text-foreground" : "text-muted-foreground"
              )}>
                {msg.subject}
              </p>

              {/* Row 3: badges */}
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", badge.color)}>
                  {badge.label}
                </span>

                {needsAction && (
                  <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-warning/10 text-warning border-warning/30">
                    <AlertCircle className="w-2.5 h-2.5" />
                    Needs Action
                  </span>
                )}

                {statusInfo && (
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", statusInfo.color)}>
                    {statusInfo.label}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
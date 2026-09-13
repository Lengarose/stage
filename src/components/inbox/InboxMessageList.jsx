import { format, isToday } from "@/lib/momentDate";
import { cn } from "@/lib/utils";
import { inboxMessageIsActioned, inboxMessageNeedsAction } from "@/lib/inboxActionTypes";
import { useTranslation } from "@/hooks/useTranslation";

function isYesterdayLocal(dateValue) {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return false;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return (
    d.getFullYear() === y.getFullYear()
    && d.getMonth() === y.getMonth()
    && d.getDate() === y.getDate()
  );
}

function listTimestamp(dateValue, t) {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "";
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterdayLocal(d)) return t("matchFlow.yesterday", "Yesterday");
  return format(d, "dd/MM/yyyy");
}

function previewText(msg) {
  const body = String(msg?.body || "").replace(/\s+/g, " ").trim();
  if (body) return body;
  return String(msg?.subject || "").trim();
}

function SenderAvatar({ msg, t }) {
  if (msg.is_system) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/30 to-teal-700/40 text-lg ring-1 ring-cyan-400/20">
        ⚡
      </div>
    );
  }
  if (msg.sender_avatar_url) {
    return (
      <img
        src={msg.sender_avatar_url}
        alt={msg.sender_gamertag || ""}
        className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-white/10"
      />
    );
  }
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1c2433] text-sm font-bold text-white/80 ring-1 ring-white/10">
      {(msg.sender_gamertag || t("matchFlow.unknown") || "?")[0].toUpperCase()}
    </div>
  );
}

export default function InboxMessageList({ messages, selectedId, onSelect }) {
  const { t } = useTranslation();

  if (messages.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center p-6 text-center text-white/40">
        <p className="text-sm">{t("matchFlow.noMessages")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {messages.map((msg) => {
        const isSelected = msg.id === selectedId;
        const unread = !msg.is_read;
        const needsAction = inboxMessageNeedsAction(msg);
        const isActioned = inboxMessageIsActioned(msg);
        const name = msg.is_system
          ? t("matchFlow.stageSystem")
          : (msg.sender_gamertag || t("matchFlow.unknown"));
        const preview = previewText(msg);
        const time = listTimestamp(msg.created_date, t);

        return (
          <button
            key={msg.id}
            type="button"
            onClick={() => onSelect(msg)}
            className={cn(
              "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors",
              isSelected ? "bg-white/[0.08]" : "hover:bg-white/[0.04]",
              unread && !isSelected && "bg-cyan-500/[0.04]"
            )}
          >
            <SenderAvatar msg={msg} t={t} />

            <div className="min-w-0 flex-1 border-b border-white/[0.06] pb-3">
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    "truncate text-[15px] leading-tight",
                    unread ? "font-semibold text-white" : "font-medium text-white/85"
                  )}
                >
                  {name}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[11px] tabular-nums",
                    unread ? "font-semibold text-cyan-300" : "text-white/35"
                  )}
                >
                  {time}
                </span>
              </div>

              <div className="mt-0.5 flex items-center gap-2">
                <p
                  className={cn(
                    "min-w-0 flex-1 truncate text-[13px] leading-snug",
                    unread ? "text-white/70" : "text-white/40"
                  )}
                >
                  {msg.subject ? (
                    <>
                      <span className={unread ? "text-white/90" : "text-white/55"}>{msg.subject}</span>
                      {preview && preview !== msg.subject ? (
                        <span className="text-white/35"> — {preview}</span>
                      ) : null}
                    </>
                  ) : (
                    preview
                  )}
                </p>

                <div className="flex shrink-0 items-center gap-1.5">
                  {needsAction && (
                    <span className="h-2 w-2 rounded-full bg-amber-400" title={t("matchFlow.needsAction")} />
                  )}
                  {isActioned && (
                    <span className="text-[10px] text-emerald-400/80">✓</span>
                  )}
                  {unread && (
                    <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-cyan-400 px-1 text-[10px] font-bold text-[#061018]">
                      1
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// @ts-nocheck
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Forward,
  Loader2,
  Reply,
  ReplyAll,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  avatarColor,
  formatMailDetailWhen,
  joinAddressList,
  messageRecipients,
  parseAddressList,
} from "@/lib/adminMailUtils";

function MailAvatar({ name, email, size = "md" }) {
  const label = String(name || email || "?").trim();
  const initial = label.charAt(0).toUpperCase();
  const hue = avatarColor(String(email || name || label).toLowerCase());
  const sizeClass = size === "lg" ? "h-10 w-10 text-base" : "h-9 w-9 text-sm";

  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-full font-semibold text-white", sizeClass)}
      style={{ backgroundColor: `hsl(${hue} 55% 45%)` }}
    >
      {initial}
    </span>
  );
}

function RecipientLine({ label, emails }) {
  if (!emails.length) return null;
  return (
    <p className="text-sm text-muted-foreground">
      <span className="mr-1 font-medium text-foreground/80">{label}</span>
      {emails.join(", ")}
    </p>
  );
}

export default function MailDetailPane({
  message,
  mailbox,
  messages,
  purging,
  t,
  onClose,
  onReply,
  onReplyAll,
  onForward,
  onContinueDraft,
  onTrash,
  onDeletePermanent,
  onSelectMessage,
}) {
  const isDraft = message.folder === "drafts";
  const isIncoming = message.direction === "in";
  const isTrash = message.folder === "trash";
  const { to, cc, bcc } = messageRecipients(message);
  const index = messages.findIndex((row) => row.id === message.id);
  const canGoPrev = index > 0;
  const canGoNext = index >= 0 && index < messages.length - 1;

  const senderName = isIncoming
    ? (String(message.from_name || "").trim() || message.from_email || "—")
    : "STAGE Admin";
  const senderEmail = isIncoming ? (message.from_email || "—") : (mailbox || message.from_email || "—");
  const when = formatMailDetailWhen(message.received_at || message.updated_date || message.created_date);

  const visibleTo = isIncoming
    ? (to.length ? to : [mailbox].filter(Boolean))
    : to;
  const showCc = cc.length > 0;
  const showBcc = bcc.length > 0;

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-start gap-2">
          <Button type="button" size="icon" variant="ghost" className="mt-0.5 h-8 w-8 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold leading-tight text-foreground">
              {message.subject || t("admin.mail.noSubject")}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={!canGoPrev} onClick={() => canGoPrev && onSelectMessage(messages[index - 1])}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={!canGoNext} onClick={() => canGoNext && onSelectMessage(messages[index + 1])}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="border-b border-border px-4 py-3">
        <div className="flex items-start gap-3">
          <MailAvatar name={senderName} email={senderEmail} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {senderName}
                  {senderEmail ? (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      &lt;
                      {senderEmail}
                      &gt;
                    </span>
                  ) : null}
                </p>
                <div className="mt-1 space-y-0.5">
                  <RecipientLine label={`${t("admin.mail.toPlaceholder")} :`} emails={visibleTo} />
                  {showCc ? <RecipientLine label={`${t("admin.mail.cc")} :`} emails={cc} /> : null}
                  {showBcc ? <RecipientLine label={`${t("admin.mail.bcc")} :`} emails={bcc} /> : null}
                  {!visibleTo.length && !showCc && !showBcc && message.to_email ? (
                    <RecipientLine label={`${t("admin.mail.toPlaceholder")} :`} emails={[message.to_email]} />
                  ) : null}
                </div>
              </div>
              <p className="shrink-0 text-xs text-muted-foreground">{when}</p>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1">
          {isDraft ? (
            <Button type="button" size="sm" onClick={() => onContinueDraft(message)}>
              {t("admin.mail.continueDraft")}
            </Button>
          ) : null}
          {isIncoming && !isTrash ? (
            <>
              <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={() => onReply(message)}>
                <Reply className="h-4 w-4" />
                {t("admin.mail.reply")}
              </Button>
              <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={() => onReplyAll(message)}>
                <ReplyAll className="h-4 w-4" />
                {t("admin.mail.replyAll")}
              </Button>
            </>
          ) : null}
          {!isDraft && !isTrash ? (
            <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={() => onForward(message)}>
              <Forward className="h-4 w-4" />
              {t("admin.mail.forward")}
            </Button>
          ) : null}
          {!isTrash ? (
            <Button type="button" size="icon" variant="ghost" className="ml-auto h-8 w-8" onClick={() => onTrash(message.id)} title={t("admin.mail.moveToTrash")}>
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" size="sm" variant="destructive" disabled={purging} onClick={() => onDeletePermanent(message.id)}>
              {purging ? <Loader2 className="h-4 w-4 animate-spin" /> : t("admin.mail.deletePermanent")}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {message.body_html ? (
          <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: message.body_html }} />
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
            {message.body_text || t("admin.mail.emptyBody")}
          </pre>
        )}
      </div>
    </div>
  );
}

export function draftPreviewLabel(message, t) {
  return message?.subject?.trim() || joinAddressList(parseAddressList(message?.to_addresses)) || t("admin.mail.noSubject");
}

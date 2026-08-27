// @ts-nocheck
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MailPlus, FilePenLine } from "lucide-react";

function formatDraftWhen(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function MailComposeChoiceDialog({
  open,
  onOpenChange,
  drafts,
  onContinueDraft,
  onNewMessage,
  t,
}) {
  const latest = drafts?.[0] || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("admin.mail.composeChoiceTitle")}</DialogTitle>
          <DialogDescription>{t("admin.mail.composeChoiceDesc")}</DialogDescription>
        </DialogHeader>

        {latest ? (
          <button
            type="button"
            onClick={() => onContinueDraft(latest)}
            className="w-full rounded-lg border border-border bg-muted/20 px-3 py-3 text-left transition-colors hover:bg-muted/40"
          >
            <div className="flex items-start gap-3">
              <FilePenLine className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {latest.subject?.trim() || t("admin.mail.noSubject")}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {latest.to_email || t("admin.mail.draftNoRecipients")}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {t("admin.mail.draftSavedAt", { when: formatDraftWhen(latest.updated_date || latest.created_date) })}
                </p>
              </div>
            </div>
          </button>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("admin.actions.cancel")}
          </Button>
          <div className="flex gap-2">
            {latest ? (
              <Button type="button" variant="outline" onClick={() => onContinueDraft(latest)}>
                {t("admin.mail.continueDraft")}
              </Button>
            ) : null}
            <Button type="button" className="gap-1.5" onClick={onNewMessage}>
              <MailPlus className="h-4 w-4" />
              {t("admin.mail.newMessage")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

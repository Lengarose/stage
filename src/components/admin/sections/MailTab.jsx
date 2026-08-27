// @ts-nocheck — admin UI uses project shadcn primitives without full prop inference.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import MailMergeDialog from "@/components/admin/sections/MailMergeDialog";
import MailComposeChoiceDialog from "@/components/admin/sections/MailComposeChoiceDialog";
import MailDetailPane from "@/components/admin/sections/MailDetailPane";
import MailRecipientInput from "@/components/admin/sections/MailRecipientInput";
import {
  hasDraftContent,
  joinAddressList,
  messageRecipients,
  parseAddressList,
  parseDraftMeta,
} from "@/lib/adminMailUtils";
import {
  ArrowLeft,
  ChevronDown,
  FilePenLine,
  Inbox,
  Loader2,
  MailPlus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { swalConfirm } from "@/lib/swal";
import { useTranslation } from "@/hooks/useTranslation";

const FOLDERS = [
  { id: "inbox", icon: Inbox },
  { id: "drafts", icon: FilePenLine },
  { id: "sent", icon: Send },
  { id: "trash", icon: Trash2 },
];

const EMPTY_DRAFT = { to: "", cc: "", bcc: "", subject: "", body: "" };

function notifyAdminMailChanged() {
  window.dispatchEvent(new CustomEvent("stage:admin-mail-changed"));
}

function formatWhen(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function displayFrom(message) {
  if (message.folder === "drafts") return message.to_email || "—";
  if (message.direction === "out") return message.to_email || "—";
  const name = String(message.from_name || "").trim();
  const email = String(message.from_email || "").trim();
  if (name && email) return name;
  return email || name || "—";
}

function recipientSummary(message, t) {
  const { to, cc, bcc } = messageRecipients(message);
  const all = [...to, ...cc, ...bcc];
  if (all.length === 1) return all[0];
  if (all.length > 1) return t("admin.mail.recipientCount", { count: all.length });
  const summary = String(message.to_email || "").trim();
  return summary || "—";
}

function listPrimaryLine(message, folder, t) {
  if (folder === "sent" || folder === "drafts" || message.direction === "out") {
    return message.subject || t("admin.mail.noSubject");
  }
  return displayFrom(message);
}

function listSecondaryLine(message, folder, t) {
  if (folder === "sent" || (message.direction === "out" && message.folder !== "drafts")) {
    return `${t("admin.mail.toLabel")} ${recipientSummary(message, t)}`;
  }
  if (folder === "drafts") {
    return `${t("admin.mail.toLabel")} ${recipientSummary(message, t)}`;
  }
  return message.subject || t("admin.mail.noSubject");
}

function OutlookFieldRow({ label, children, actions }) {
  return (
    <div className="flex min-h-[40px] items-center gap-3 border-b border-border/80 px-4">
      <span className="w-8 shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

function MailComposePane({
  draft,
  setDraft,
  sending,
  onSend,
  onDiscard,
  onOpenMerge,
  audienceLabel,
  showCc,
  setShowCc,
  showBcc,
  setShowBcc,
  setAudience,
  draftSavedAt,
  draftSaving,
  t,
}) {
  const bodyRef = useRef(null);
  const canSend = Boolean(draft.to.trim() || draft.bcc.trim());

  useEffect(() => {
    bodyRef.current?.focus();
  }, []);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center">
          <Button
            type="button"
            size="sm"
            disabled={sending || !canSend}
            onClick={onSend}
            className="rounded-r-none gap-1.5 bg-[#0f6cbd] hover:bg-[#0f5cad] text-white px-4"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t("admin.mail.send")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                disabled={sending}
                className="rounded-l-none border-l border-white/20 bg-[#0f6cbd] hover:bg-[#0f5cad] text-white px-2"
                aria-label={t("admin.mail.sendOptions")}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[220px]">
              <DropdownMenuItem disabled={sending || !canSend} onClick={onSend}>
                {t("admin.mail.send")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="text-muted-foreground">
                {t("admin.mail.scheduleSend")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenMerge}>
                {t("admin.mail.startMailMerge")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => void onDiscard()} title={t("admin.mail.discard")}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {audienceLabel ? (
        <div className="border-b border-primary/20 bg-primary/5 px-4 py-2 text-xs text-primary">
          {t("admin.mail.mergeHint")}
        </div>
      ) : null}
      <OutlookFieldRow
        label={t("admin.mail.toPlaceholder")}
        actions={(
          <>
            {!showCc && (
              <button type="button" className="text-sm text-[#0f6cbd] hover:underline" onClick={() => setShowCc(true)}>
                {t("admin.mail.cc")}
              </button>
            )}
            {!showBcc && (
              <button type="button" className="text-sm text-[#0f6cbd] hover:underline" onClick={() => setShowBcc(true)}>
                {t("admin.mail.bcc")}
              </button>
            )}
          </>
        )}
      >
        <MailRecipientInput
          value={draft.to}
          onChange={(to) => setDraft((d) => ({ ...d, to }))}
          placeholder={t("admin.mail.searchContacts")}
          emptyHint={t("admin.mail.searchContactsHint")}
          noResultsHint={t("admin.mail.noContactsFound")}
        />
      </OutlookFieldRow>

      {showCc && (
        <OutlookFieldRow label={t("admin.mail.cc")}>
          <MailRecipientInput
            value={draft.cc}
            onChange={(cc) => setDraft((d) => ({ ...d, cc }))}
            placeholder={t("admin.mail.searchContacts")}
            emptyHint={t("admin.mail.searchContactsHint")}
            noResultsHint={t("admin.mail.noContactsFound")}
          />
        </OutlookFieldRow>
      )}

      {showBcc && (
        <OutlookFieldRow label={t("admin.mail.bcc")}>
          <MailRecipientInput
            value={draft.bcc}
            onChange={(bcc) => {
              setDraft((d) => ({ ...d, bcc }));
              if (!bcc.trim()) setAudience(null);
            }}
            bulkLabel={audienceLabel ? t("admin.mail.mergeAudience", { label: `${audienceLabel}` }) : ""}
            placeholder={t("admin.mail.searchContacts")}
            emptyHint={t("admin.mail.searchContactsHint")}
            noResultsHint={t("admin.mail.noContactsFound")}
          />
        </OutlookFieldRow>
      )}

      {/* Subject */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <input
          value={draft.subject}
          onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
          placeholder={t("admin.mail.addSubject")}
          className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {(draftSavedAt || draftSaving) ? (
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {draftSaving ? t("admin.mail.draftSaving") : t("admin.mail.draftSavedAtShort", { when: formatWhen(draftSavedAt) })}
          </span>
        ) : null}
      </div>

      {/* Body */}
      <textarea
        ref={bodyRef}
        value={draft.body}
        onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
        placeholder={t("admin.mail.bodyPlaceholder")}
        className="min-h-[280px] flex-1 resize-none border-0 bg-transparent px-4 py-3 text-sm outline-none"
      />

      {/* Draft tab strip (Outlook-style) */}
      <div className="border-t border-border bg-muted/20 px-3 py-1.5">
        <div className="inline-flex max-w-full items-center gap-1.5 rounded border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
          <MailPlus className="h-3 w-3 shrink-0" />
          <span className="truncate">{draft.subject.trim() || t("admin.mail.noSubject")}</span>
          <button type="button" onClick={onDiscard} className="shrink-0 hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MailTab() {
  const { t } = useTranslation();
  const [folder, setFolder] = useState("inbox");
  const [search, setSearch] = useState("");
  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [compose, setCompose] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [audience, setAudience] = useState(null);
  const [purging, setPurging] = useState(false);
  const [draftId, setDraftId] = useState(null);
  const [replyToId, setReplyToId] = useState(null);
  const [composeChoiceOpen, setComposeChoiceOpen] = useState(false);
  const [savedDrafts, setSavedDrafts] = useState([]);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const persistTimerRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, statusRes] = await Promise.all([
        stageClient.http.get("/admin-mail", {
          folder,
          search: search.trim() || undefined,
          limit: 100,
        }),
        stageClient.http.get("/admin-mail/status").catch(() => null),
      ]);
      setMessages(Array.isArray(listRes?.messages) ? listRes.messages : []);
      setStatus(statusRes || listRes?.configured || null);
      notifyAdminMailChanged();
    } catch (err) {
      const msg = String(err?.message || "");
      setError(msg.includes("not found") ? t("admin.mail.endpointMissing") : (msg || t("admin.mail.loadFailed")));
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [folder, search, t]);

  useEffect(() => { void load(); }, [load]);

  const unreadInbox = useMemo(
    () => (folder === "inbox" ? messages.filter((m) => !m.is_read).length : 0),
    [folder, messages],
  );

  const draftCount = useMemo(
    () => (folder === "drafts" ? messages.length : savedDrafts.length),
    [folder, messages.length, savedDrafts.length],
  );

  const persistDraft = useCallback(async ({ silent = true } = {}) => {
    if (!hasDraftContent(draft)) return null;
    if (!silent) setDraftSaving(true);
    try {
      const saved = await stageClient.http.post("/admin-mail/drafts", {
        id: draftId || undefined,
        to: draft.to.trim() || undefined,
        cc: draft.cc.trim() || undefined,
        bcc: draft.bcc.trim() || undefined,
        subject: draft.subject.trim(),
        body: draft.body,
        audience: audience || undefined,
        reply_to_id: replyToId || undefined,
      });
      if (saved?.id) setDraftId(saved.id);
      setDraftSavedAt(saved?.updated_date || saved?.created_date || new Date().toISOString());
      setSavedDrafts((prev) => {
        const rest = prev.filter((row) => row.id !== saved.id);
        return [saved, ...rest];
      });
      notifyAdminMailChanged();
      return saved;
    } catch {
      return null;
    } finally {
      if (!silent) setDraftSaving(false);
    }
  }, [audience, draft, draftId, replyToId]);

  useEffect(() => {
    if (!compose || !hasDraftContent(draft)) return undefined;
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => { void persistDraft(); }, 2000);
    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    };
  }, [compose, draft, persistDraft]);

  useEffect(() => () => {
    if (compose && hasDraftContent(draft)) void persistDraft();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void stageClient.http.get("/admin-mail", { folder: "drafts", limit: 10 })
      .then((res) => setSavedDrafts(Array.isArray(res?.messages) ? res.messages : []))
      .catch(() => setSavedDrafts([]));
  }, [folder, compose]);

  async function syncInbox() {
    setSyncing(true);
    setError(null);
    try {
      const res = await stageClient.http.post("/admin-mail/sync", {});
      if (res?.reason === "not_configured") setError(t("admin.mail.notConfigured"));
      await load();
      if (folder === "inbox" && res?.synced > 0) setSelected(null);
    } catch (err) {
      setError(err?.message || t("admin.mail.syncFailed"));
    } finally {
      setSyncing(false);
    }
  }

  async function openMessage(message) {
    if (message.folder === "drafts") {
      openDraft(message);
      return;
    }
    setCompose(false);
    setSelected(message);
    if (!message.is_read && message.folder === "inbox") {
      try {
        const updated = await stageClient.http.patch(`/admin-mail/${message.id}`, { is_read: true });
        setMessages((prev) => prev.map((m) => (m.id === message.id ? updated : m)));
        setSelected(updated);
        notifyAdminMailChanged();
      } catch {
        // ignore
      }
    }
  }

  async function sendMail() {
    setSending(true);
    setError(null);
    try {
      const sent = await stageClient.http.post("/admin-mail/send", {
        to: draft.to.trim() || undefined,
        cc: draft.cc.trim() || undefined,
        bcc: draft.bcc.trim() || undefined,
        subject: draft.subject.trim(),
        body: draft.body,
        reply_to_id: replyToId || (selected?.direction === "in" ? selected.id : undefined),
        audience: audience || undefined,
        draft_id: draftId || undefined,
      });
      await closeCompose({ discardDraft: true });
      setSelected(sent);
      if (folder !== "sent") setFolder("sent");
      else await load();
    } catch (err) {
      setError(err?.message || t("admin.mail.sendFailed"));
    } finally {
      setSending(false);
    }
  }

  async function trashMessage(id) {
    try {
      await stageClient.http.delete(`/admin-mail/${id}`);
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (selected?.id === id) setSelected(null);
      notifyAdminMailChanged();
    } catch (err) {
      setError(err?.message || t("admin.mail.deleteFailed"));
    }
  }

  async function deletePermanent(id) {
    if (!(await swalConfirm(t("admin.mail.deletePermanentConfirm")))) return;
    setPurging(true);
    setError(null);
    try {
      await stageClient.http.delete(`/admin-mail/${id}/permanent`);
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (selected?.id === id) setSelected(null);
      notifyAdminMailChanged();
    } catch (err) {
      setError(err?.message || t("admin.mail.deletePermanentFailed"));
    } finally {
      setPurging(false);
    }
  }

  async function emptyTrash() {
    if (messages.length === 0) return;
    if (!(await swalConfirm(t("admin.mail.emptyTrashConfirm", { count: messages.length })))) return;
    setPurging(true);
    setError(null);
    try {
      await stageClient.http.post("/admin-mail/trash/empty", {});
      setMessages([]);
      setSelected(null);
      notifyAdminMailChanged();
    } catch (err) {
      setError(err?.message || t("admin.mail.emptyTrashFailed"));
    } finally {
      setPurging(false);
    }
  }

  async function closeCompose({ discardDraft = false } = {}) {
    if (discardDraft && draftId) {
      try {
        await stageClient.http.delete(`/admin-mail/drafts/${draftId}`);
        setSavedDrafts((prev) => prev.filter((row) => row.id !== draftId));
      } catch {
        // ignore
      }
    } else if (hasDraftContent(draft)) {
      await persistDraft();
    }
    setCompose(false);
    setDraftId(null);
    setReplyToId(null);
    setDraft(EMPTY_DRAFT);
    setShowCc(false);
    setShowBcc(false);
    setAudience(null);
    setDraftSavedAt(null);
  }

  async function saveAndLeaveCompose() {
    if (compose && hasDraftContent(draft)) await persistDraft();
    setCompose(false);
    setSelected(null);
  }

  function applyMailMerge({ bcc, audience: picked, label, count }) {
    setDraft((d) => ({ ...d, bcc, to: "" }));
    setShowBcc(true);
    setAudience({
      type: picked?.type,
      id: picked?.id,
      label: label || picked?.label,
      count,
    });
  }

  function openDraft(message) {
    const meta = parseDraftMeta(message.draft_meta);
    setCompose(true);
    setSelected(null);
    setDraftId(message.id);
    setReplyToId(message.in_reply_to || null);
    setDraft({
      to: joinAddressList(parseAddressList(message.to_addresses)),
      cc: joinAddressList(parseAddressList(message.cc_addresses)),
      bcc: joinAddressList(parseAddressList(message.bcc_addresses)),
      subject: message.subject || "",
      body: message.body_text || "",
    });
    setAudience(meta.audience || null);
    setShowCc(Boolean(parseAddressList(message.cc_addresses).length));
    setShowBcc(Boolean(parseAddressList(message.bcc_addresses).length) || Boolean(meta.audience));
    setDraftSavedAt(message.updated_date || message.created_date || null);
    if (message.folder === "drafts") setFolder("drafts");
  }

  function startReply(target) {
    startCompose(target, { mode: "reply" });
  }

  function startReplyAll(target) {
    const { to, cc } = messageRecipients(target);
    const self = String(mailbox || "").trim().toLowerCase();
    const recipients = [...new Set(
      [target.from_email, ...to, ...cc]
        .map((email) => String(email || "").trim().toLowerCase())
        .filter((email) => email && email !== self),
    )];
    setCompose(true);
    setSelected(null);
    setDraftId(null);
    setReplyToId(target.id || null);
    setShowCc(false);
    setShowBcc(false);
    setDraftSavedAt(null);
    setDraft({
      ...EMPTY_DRAFT,
      to: recipients.join(", "),
      subject: target.subject?.startsWith("Re:") ? target.subject : `Re: ${target.subject || ""}`,
      body: `\n\n---\n${target.body_text || ""}`.trim(),
    });
  }

  function startForward(target) {
    setCompose(true);
    setSelected(null);
    setDraftId(null);
    setReplyToId(null);
    setShowCc(false);
    setShowBcc(false);
    setDraftSavedAt(null);
    setDraft({
      ...EMPTY_DRAFT,
      subject: target.subject?.startsWith("Fwd:") ? target.subject : `Fwd: ${target.subject || ""}`,
      body: [
        "",
        "---------- Forwarded message ----------",
        `From: ${target.from_name || target.from_email || "—"}`,
        `Date: ${formatWhen(target.received_at || target.created_date)}`,
        `Subject: ${target.subject || ""}`,
        "",
        target.body_text || "",
      ].join("\n").trim(),
    });
  }

  function startCompose(replyTarget, { forceNew = false, mode = "new" } = {}) {
    setCompose(true);
    setSelected(null);
    setDraftId(null);
    setReplyToId(null);
    setShowCc(false);
    setShowBcc(false);
    setDraftSavedAt(null);
    if (mode === "reply" && replyTarget) {
      setReplyToId(replyTarget.id || null);
      setDraft({
        ...EMPTY_DRAFT,
        to: replyTarget.from_email || "",
        subject: replyTarget.subject?.startsWith("Re:") ? replyTarget.subject : `Re: ${replyTarget.subject || ""}`,
        body: `\n\n---\n${replyTarget.body_text || ""}`.trim(),
      });
    } else {
      setDraft(EMPTY_DRAFT);
    }
    if (forceNew) setComposeChoiceOpen(false);
  }

  async function handleComposeClick() {
    let drafts = savedDrafts;
    if (!drafts.length) {
      try {
        const res = await stageClient.http.get("/admin-mail", { folder: "drafts", limit: 10 });
        drafts = Array.isArray(res?.messages) ? res.messages : [];
        setSavedDrafts(drafts);
      } catch {
        drafts = [];
      }
    }
    if (compose && hasDraftContent(draft)) {
      await persistDraft();
    }
    if (drafts.length > 0) {
      setComposeChoiceOpen(true);
      return;
    }
    startCompose(null, { forceNew: true });
  }

  const mailbox = status?.mailbox || "info@stageleagues.com";

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <div className={cn(
        "grid min-h-[calc(100vh-8rem)]",
        compose ? "grid-cols-1 lg:grid-cols-[220px_1fr]" : "grid-cols-1 lg:grid-cols-[220px_300px_1fr]",
      )}
      >
        {/* Folder rail */}
        <aside className="flex flex-col border-b border-border bg-muted/15 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <Link to="/admin" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("admin.nav.dashboard")}
            </Link>
          </div>

          <div className="p-3">
            <Button type="button" size="sm" className="w-full justify-start gap-2" onClick={() => void handleComposeClick()}>
              <MailPlus className="h-4 w-4" />
              {t("admin.mail.compose")}
            </Button>
          </div>

          <nav className="flex-1 space-y-0.5 px-2">
            {FOLDERS.map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => { void saveAndLeaveCompose(); setFolder(id); setSelected(null); }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-sm transition-colors",
                  folder === id && !compose ? "bg-primary/12 text-primary font-medium" : "text-foreground hover:bg-muted/50",
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4 opacity-70" />
                  {t(`admin.mail.folder_${id}`)}
                </span>
                {id === "inbox" && unreadInbox > 0 && (
                  <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {unreadInbox}
                  </span>
                )}
                {id === "drafts" && draftCount > 0 && (
                  <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold text-foreground">
                    {draftCount}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="mt-auto border-t border-border px-3 py-3 text-[10px] text-muted-foreground leading-relaxed">
            <p className="truncate font-medium text-foreground/80">{mailbox}</p>
            {!status?.smtp && <p className="mt-1 text-warning/90">{t("admin.mail.smtpMissingShort")}</p>}
          </div>
        </aside>

        {compose ? (
          <MailComposePane
            draft={draft}
            setDraft={setDraft}
            sending={sending}
            onSend={() => void sendMail()}
            onDiscard={() => void closeCompose({ discardDraft: true })}
            onOpenMerge={() => setMergeOpen(true)}
            audienceLabel={audience?.label ? `${audience.label} (${audience.count || 0})` : ""}
            showCc={showCc}
            setShowCc={setShowCc}
            showBcc={showBcc}
            setShowBcc={setShowBcc}
            setAudience={setAudience}
            draftSavedAt={draftSavedAt}
            draftSaving={draftSaving}
            t={t}
          />
        ) : (
          <>
            {/* Message list */}
            <section className="flex flex-col border-b border-border lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-2 border-b border-border p-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void load(); }}
                    placeholder={t("admin.mail.searchPlaceholder")}
                    className="h-9 pl-8 text-sm"
                  />
                </div>
                <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0" disabled={syncing} onClick={() => void syncInbox()} title={t("admin.mail.sync")}>
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
                {folder === "trash" && messages.length > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="shrink-0 h-9 text-xs"
                    disabled={purging}
                    onClick={() => void emptyTrash()}
                  >
                    {purging ? <Loader2 className="h-4 w-4 animate-spin" /> : t("admin.mail.emptyTrash")}
                  </Button>
                ) : null}
              </div>

              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-16 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : error && messages.length === 0 ? (
                  <p className="px-4 py-10 text-center text-xs text-muted-foreground">{error}</p>
                ) : messages.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t("admin.mail.empty")}</p>
                ) : (
                  messages.map((message) => (
                    <button
                      key={message.id}
                      type="button"
                      onClick={() => void openMessage(message)}
                      className={cn(
                        "w-full border-b border-border/50 px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
                        selected?.id === message.id && "bg-primary/8",
                        !message.is_read && message.folder === "inbox" && "bg-muted/15",
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={cn("truncate text-sm", !message.is_read && message.folder === "inbox" && "font-semibold")}>
                          {listPrimaryLine(message, folder, t)}
                        </p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{formatWhen(message.received_at || message.updated_date || message.created_date)}</span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{listSecondaryLine(message, folder, t)}</p>
                    </button>
                  ))
                )}
              </div>
            </section>

            {/* Reading pane */}
            <section className="flex min-h-[280px] flex-col bg-background">
              {selected ? (
                <MailDetailPane
                  message={selected}
                  mailbox={mailbox}
                  messages={messages}
                  purging={purging}
                  t={t}
                  onClose={() => setSelected(null)}
                  onReply={startReply}
                  onReplyAll={startReplyAll}
                  onForward={startForward}
                  onContinueDraft={openDraft}
                  onTrash={(id) => void trashMessage(id)}
                  onDeletePermanent={(id) => void deletePermanent(id)}
                  onSelectMessage={(message) => void openMessage(message)}
                />
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-muted-foreground">
                  <Inbox className="h-8 w-8 opacity-30" />
                  <p className="text-sm">{t("admin.mail.selectMessage")}</p>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <MailMergeDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        onApply={applyMailMerge}
      />

      <MailComposeChoiceDialog
        open={composeChoiceOpen}
        onOpenChange={setComposeChoiceOpen}
        drafts={savedDrafts}
        onContinueDraft={(row) => {
          setComposeChoiceOpen(false);
          openDraft(row);
        }}
        onNewMessage={() => {
          setComposeChoiceOpen(false);
          startCompose(null, { forceNew: true });
        }}
        t={t}
      />
    </div>
  );
}

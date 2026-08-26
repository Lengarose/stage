// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmails(value) {
  return String(value || "")
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function joinEmails(emails) {
  return emails.join(", ");
}

function avatarColor(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i += 1) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  const hues = [210, 24, 140, 280, 45, 190, 330];
  return hues[Math.abs(hash) % hues.length];
}

function ContactAvatar({ contact }) {
  const email = contact?.email || "";
  const label = contact?.label || email;
  const initial = (label || email || "?").charAt(0).toUpperCase();
  const hue = avatarColor(email || label);

  if (contact?.avatar_url) {
    return (
      <img
        src={contact.avatar_url}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
      style={{ backgroundColor: `hsl(${hue} 55% 45%)` }}
    >
      {initial}
    </span>
  );
}

function RecipientChip({ label, email, onRemove }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded bg-muted/80 px-2 py-0.5 text-xs text-foreground">
      <span className="truncate">{label || email}</span>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground"
        aria-label="Remove"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export default function MailRecipientInput({
  value,
  onChange,
  bulkLabel = "",
  placeholder = "",
  emptyHint = "",
  noResultsHint = "",
  className,
}) {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [labels, setLabels] = useState({});
  const [activeIndex, setActiveIndex] = useState(-1);

  const emails = useMemo(() => parseEmails(value), [value]);
  const selectedSet = useMemo(() => new Set(emails.map((e) => e.toLowerCase())), [emails]);

  const addRecipient = useCallback((contact) => {
    const email = String(contact?.email || "").trim();
    if (!EMAIL_RE.test(email) || selectedSet.has(email.toLowerCase())) {
      setQuery("");
      setOpen(false);
      return;
    }
    const next = [...emails, email];
    onChange(joinEmails(next));
    if (contact?.label) {
      setLabels((prev) => ({ ...prev, [email.toLowerCase()]: contact.label }));
    }
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }, [emails, onChange, selectedSet]);

  const removeRecipient = useCallback((email) => {
    onChange(joinEmails(emails.filter((item) => item.toLowerCase() !== email.toLowerCase())));
  }, [emails, onChange]);

  const commitFreeText = useCallback(() => {
    const raw = query.trim().replace(/[,;]+$/, "");
    if (!raw) return;
    if (EMAIL_RE.test(raw)) {
      addRecipient({ email: raw, label: raw });
      return;
    }
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      addRecipient(suggestions[activeIndex]);
    }
  }, [activeIndex, addRecipient, query, suggestions]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await stageClient.http.get("/admin-mail/contacts", { q, limit: 12 });
        if (cancelled) return;
        const contacts = Array.isArray(res?.contacts) ? res.contacts : [];
        setSuggestions(contacts.filter((row) => row.email && !selectedSet.has(row.email.toLowerCase())));
        setOpen(true);
        setActiveIndex(contacts.length ? 0 : -1);
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, selectedSet]);

  useEffect(() => {
    function onDocClick(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <div
        className="flex min-h-[36px] flex-wrap items-center gap-1.5 py-1"
        onClick={() => inputRef.current?.focus()}
      >
        {bulkLabel ? (
          <RecipientChip
            label={bulkLabel}
            email=""
            onRemove={() => onChange("")}
          />
        ) : emails.map((email) => (
          <RecipientChip
            key={email}
            email={email}
            label={labels[email.toLowerCase()] || email}
            onRemove={() => removeRecipient(email)}
          />
        ))}

        {!bulkLabel && (
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => { if (query.trim().length >= 2) setOpen(true); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
                setActiveIndex((idx) => Math.min(idx + 1, suggestions.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((idx) => Math.max(idx - 1, 0));
              } else if (e.key === "Enter" || e.key === "," || e.key === ";") {
                e.preventDefault();
                commitFreeText();
              } else if (e.key === "Escape") {
                setOpen(false);
              } else if (e.key === "Backspace" && !query && emails.length) {
                removeRecipient(emails[emails.length - 1]);
              }
            }}
            onBlur={() => {
              window.setTimeout(() => {
                if (!rootRef.current?.contains(document.activeElement)) commitFreeText();
              }, 120);
            }}
            placeholder={emails.length ? "" : placeholder}
            className="min-w-[120px] flex-1 border-0 bg-transparent py-1 text-sm outline-none"
          />
        )}

        {loading && !bulkLabel ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" /> : null}
      </div>

      {open && !bulkLabel && query.trim().length >= 2 ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-lg">
          {suggestions.length === 0 && !loading ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">{noResultsHint || emptyHint}</p>
          ) : suggestions.map((contact, index) => (
            <button
              key={`${contact.email}-${contact.player_id || contact.user_id || index}`}
              type="button"
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/60",
                index === activeIndex && "bg-muted/60 ring-1 ring-inset ring-border",
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addRecipient(contact)}
            >
              <ContactAvatar contact={contact} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{contact.label || contact.email}</span>
                <span className="block truncate text-xs text-muted-foreground">{contact.email}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

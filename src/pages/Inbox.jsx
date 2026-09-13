import { useMemo, useState, useEffect } from "react";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import { CheckCheck, Inbox, Search } from "lucide-react";
import InboxMessageList from "@/components/inbox/InboxMessageList";
import InboxMessageDetail from "@/components/inbox/InboxMessageDetail";
import { inboxMessageBelongsToTournament } from "@/lib/inboxActionTypes";
import { useTranslation } from "@/hooks/useTranslation";

function hasInboxContent(m) {
  return Boolean(String(m?.subject || "").trim() || String(m?.body || "").trim());
}

export default function InboxPage({ tournamentId: scopedTournamentId } = {}) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);
  const [myClub, setMyClub] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let unsub = null;
    let intervalId = null;
    let stopped = false;

    async function load() {
      const { user: u, player, club } = await resolveMyPlayerAndClub();
      if (!u) { setLoading(false); return; }
      setUser(u);
      const currentEmail = String(u.email || "").trim().toLowerCase();

      setMyPlayer(player);
      setMyClub(club);

      const data = await stageClient.entities.InboxMessage.filter({ recipient_email: currentEmail }, "-created_date", 200);
      setMessages((data || []).filter(hasInboxContent));

      const params = new URLSearchParams(window.location.search);
      const targetId = params.get("id");
      if (targetId && data?.length) {
        const target = data.find(m => m.id === targetId);
        if (target) openMessage(target);
      }

      setLoading(false);

      unsub = stageClient.entities.InboxMessage.subscribe((event) => {
        const recipientEmail = String(event.data?.recipient_email || "").trim().toLowerCase();
        if (event.type === "delete") {
          setMessages(prev => prev.filter(m => m.id !== event.id));
          setSelected(prev => prev?.id === event.id ? null : prev);
          return;
        }
        if (recipientEmail !== currentEmail) return;
        if (!hasInboxContent(event.data)) return;
        setMessages(prev => {
          const idx = prev.findIndex(m => m.id === event.id);
          if (idx >= 0) {
            const next = prev.slice();
            next[idx] = event.data;
            return next;
          }
          return [event.data, ...prev];
        });
        setSelected(prev => prev?.id === event.id ? event.data : prev);
      });

      intervalId = window.setInterval(async () => {
        if (stopped) return;
        const latest = await stageClient.entities.InboxMessage
          .filter({ recipient_email: currentEmail }, "-created_date", 200)
          .catch(() => null);
        if (latest) setMessages(latest.filter(hasInboxContent));
      }, 15000);
    }

    load();

    return () => {
      stopped = true;
      if (intervalId) window.clearInterval(intervalId);
      if (unsub) unsub();
    };
  }, []);

  async function openMessage(msg) {
    setSelected(msg);
    if (!msg.is_read) {
      try {
        await stageClient.entities.InboxMessage.update(msg.id, { is_read: true });
        const updated = { ...msg, is_read: true };
        setMessages(prev => prev.map(m => m.id === msg.id ? updated : m));
        setSelected(updated);
      } catch {
        // ignore mark-as-read failure
      }
    }
  }

  async function markAllAsRead() {
    const unread = mailboxMessages.filter(m => !m.is_read);
    if (unread.length === 0) return;
    const unreadIds = new Set(unread.map(m => m.id));
    await Promise.all(unread.map(m => stageClient.entities.InboxMessage.update(m.id, { is_read: true })));
    setMessages(prev => prev.map(m => unreadIds.has(m.id) ? { ...m, is_read: true } : m));
    if (selected && unreadIds.has(selected.id)) setSelected(prev => ({ ...prev, is_read: true }));
  }

  function handleDeleted(id) {
    setMessages(prev => prev.filter(m => m.id !== id));
    setSelected(null);
  }

  function handleStatusChanged(id, newStatus) {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, status: newStatus, is_read: true } : m));
    setSelected(prev => prev?.id === id ? { ...prev, status: newStatus, is_read: true } : prev);
  }

  const mailboxMessages = useMemo(() => {
    if (!scopedTournamentId) return messages;
    return messages.filter((m) => inboxMessageBelongsToTournament(m, scopedTournamentId));
  }, [messages, scopedTournamentId]);

  const unreadCount = mailboxMessages.filter(m => !m.is_read).length;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mailboxMessages;
    return mailboxMessages.filter((m) => {
      const hay = [
        m.subject,
        m.body,
        m.sender_gamertag,
        m.sender_club_name,
        m.message_type,
      ].map((v) => String(v || "").toLowerCase()).join(" ");
      return hay.includes(q);
    });
  }, [mailboxMessages, query]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#060912]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/20 border-t-cyan-400" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col bg-[#060912] text-white lg:h-screen">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Discussions column */}
        <aside
          className={`
            flex min-h-0 w-full flex-col border-r border-white/[0.07] bg-[#0a101c]
            ${selected ? "hidden lg:flex lg:w-[380px] xl:w-[420px] shrink-0" : "flex"}
          `}
        >
          <div className="shrink-0 border-b border-white/[0.07] px-4 pb-3 pt-4">
            <div className="mb-3 flex items-center gap-2">
              <h1 className="font-heading text-2xl font-black uppercase tracking-tight text-white">
                {t("matchFlow.inboxTitle")}
              </h1>
              {unreadCount > 0 && (
                <span className="rounded-full bg-cyan-400 px-2 py-0.5 text-[11px] font-bold text-[#061018]">
                  {unreadCount}
                </span>
              )}
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-white/45 transition hover:text-cyan-300"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  {t("matchFlow.markAllRead")}
                </button>
              )}
            </div>

            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("matchFlow.inboxSearch", "Search")}
                className="w-full rounded-lg border-0 bg-[#141b28] py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-white/35 outline-none ring-1 ring-white/[0.06] focus:ring-cyan-400/40"
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
                <Inbox className="mb-3 h-12 w-12 text-white/15" />
                <p className="text-sm text-white/40">
                  {mailboxMessages.length === 0 ? t("matchFlow.inboxEmpty") : t("matchFlow.noMessages")}
                </p>
              </div>
            ) : (
              <InboxMessageList
                messages={filtered}
                selectedId={selected?.id}
                onSelect={(msg) => openMessage(msg)}
              />
            )}
          </div>
        </aside>

        {/* Conversation pane */}
        <section
          className={`
            relative min-h-0 flex-1 flex-col
            ${selected ? "flex" : "hidden lg:flex"}
          `}
        >
          {selected ? (
            <InboxMessageDetail
              message={selected}
              onDeleted={handleDeleted}
              onStatusChanged={handleStatusChanged}
              onBack={() => setSelected(null)}
              myClub={myClub}
              myEmail={user?.email}
              myGamertag={myPlayer?.gamertag}
            />
          ) : (
            <div className="relative flex h-full flex-col items-center justify-center overflow-hidden">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.12]"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 1px 1px, rgba(0,229,255,0.35) 1px, transparent 0)",
                  backgroundSize: "28px 28px",
                }}
              />
              <div className="relative z-10 flex flex-col items-center px-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.04] ring-1 ring-white/10">
                  <Inbox className="h-7 w-7 text-cyan-300/70" />
                </div>
                <p className="text-sm text-white/45">{t("matchFlow.selectMessage")}</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

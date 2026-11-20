import { useMemo, useState, useEffect } from "react";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import { inboxCategory, inboxNeedsResponse } from "@/lib/inboxPresentation";
import "./inbox.css";
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
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("all");
  const [background, setBackground] = useState("");
  const [query, setQuery] = useState("");
  const [error,setError]=useState("");
  const [marking,setMarking]=useState(false);

  useEffect(() => {
    let active = true;
    stageClient.entities.InboxPageConfig.filter({key:"main"}, "-updated_date", 1)
      .then(rows => { if (active) setBackground(rows?.[0]?.background_url || ""); })
      .catch(() => {}); // Optional artwork never blocks correspondence.
    return () => { active = false; };
  }, []);

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
        if (target && (!scopedTournamentId || inboxMessageBelongsToTournament(target, scopedTournamentId))) {
          openMessage(target);
        }
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
        if (latest) {
          const nextMessages = latest.filter(hasInboxContent);
          setMessages(nextMessages);
          setSelected(prev => {
            if (!prev?.id) return prev;
            return nextMessages.find(m => m.id === prev.id) || null;
          });
        }
      }, 15000);
    }

    load().catch(e=>{if(!stopped){setError(e.message);setLoading(false);}});

    return () => {
      stopped = true;
      if (intervalId) window.clearInterval(intervalId);
      if (unsub) unsub();
    };
  }, [scopedTournamentId]);

  async function openMessage(msg) {
    setSelected(msg);
    if (!msg.is_read) {
      try {
        await stageClient.entities.InboxMessage.update(msg.id, { is_read: true });
        const updated = { ...msg, is_read: true };
        setMessages(prev => prev.map(m => m.id === msg.id ? updated : m));
        setSelected(updated);
      } catch(e) {setError(e.message); }
    }
  }

  async function markAllAsRead() {
    setMarking(true);setError('');
    try {await stageClient.http.post('/inbox-messages/mark-all-read',{});setMessages(prev=>prev.map(m=>({...m,is_read:true})));setSelected(prev=>prev?{...prev,is_read:true}:null);window.dispatchEvent(new CustomEvent('stage-inbox-changed'));}
    catch(e){setError(e.message);}finally{setMarking(false);}
  }
  function handleDeleted(id,ids=[id]) {
    setMessages(prev=>prev.filter(m=>!ids.includes(m.id)));setSelected(null);window.dispatchEvent(new CustomEvent('stage-inbox-changed'));
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
    return mailboxMessages.filter((m) => {
      if (filter === "unread" && m.is_read) return false;
      if (filter === "response" && !inboxNeedsResponse(m)) return false;
      if (category !== "all" && inboxCategory(m) !== category) return false;
      const hay = [
        m.subject,
        m.body,
        m.sender_gamertag,
        m.sender_club_name,
        m.message_type,
      ].map((v) => String(v || "").toLowerCase()).join(" ");
      return hay.includes(q);
    });
  }, [mailboxMessages, query, filter, category]);

  if (loading) return <div className="stage-inbox inbox-loading" role="status">Loading your Inbox…</div>;
  return <main className={`stage-inbox ${selected ? "has-selection" : ""}`}>
    {background && <div className="inbox-artwork" aria-hidden="true" style={{backgroundImage:`url(${JSON.stringify(background)})`}}/>}
    <header className="inbox-page-header"><div><p className="inbox-eyebrow">STAGE / CORRESPONDENCE</p><h1>{t("matchFlow.inboxTitle")}<span className="inbox-title-square" aria-hidden="true" /></h1><p>Your club. Your matches. Your next move.</p></div><div className="inbox-header-actions"><span>{unreadCount} unread</span><button type="button" disabled={marking || !unreadCount} onClick={markAllAsRead}><CheckCheck size={17}/>{marking ? "Marking…" : t("matchFlow.markAllRead")}</button></div></header>
    {error && <p role="alert" className="inbox-error">{error}</p>}
    <div className="inbox-workspace">
      <aside className="inbox-sidebar" aria-label="Messages"><div className="inbox-tools">
        <label className="inbox-search"><Search size={18}/><input aria-label="Search messages" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search your Inbox"/></label>
        <nav className="inbox-filters" aria-label="Message filters">{[["all","All"],["unread","Unread"],["response","Needs response"]].map(([value,label])=><button type="button" key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</nav>
        <label className="inbox-category">Category<select value={category} onChange={e=>setCategory(e.target.value)}>{[["all","All categories"],["contracts","Contracts"],["matches","Matches"],["competitions","Competitions"],["system","System & other"]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <p className="inbox-result-count">{filtered.length} {filtered.length===1?"message":"messages"}{messages.length>=200?" · latest 200 loaded":""}</p>
      </div><div className="inbox-message-scroll">{filtered.length?<InboxMessageList messages={filtered} selectedId={selected?.id} onSelect={openMessage}/>:<div className="inbox-empty"><Inbox size={32}/><h2>{mailboxMessages.length?"No matching messages":"You're all caught up"}</h2><p>{mailboxMessages.length?"Try another filter or search.":"New correspondence will appear here."}</p></div>}</div></aside>
      <section className="inbox-reading" aria-label="Selected correspondence">{selected?<InboxMessageDetail message={selected} onDeleted={handleDeleted} onStatusChanged={handleStatusChanged} onBack={()=>setSelected(null)} myClub={myClub} myEmail={user?.email} myGamertag={myPlayer?.gamertag}/>:<div className="inbox-empty inbox-welcome"><span className="inbox-eyebrow">YOUR CLUB OFFICE</span><h2>Every next step<br/>starts with a message.</h2><p>Select correspondence to read it and review any available response.</p></div>}</section>
    </div>
  </main>;
}

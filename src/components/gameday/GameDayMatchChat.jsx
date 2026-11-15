import { useState, useEffect, useRef } from 'react';
import { stageClient } from '@/api/stageClient';
import { Bell, BellOff, MessageSquare, Send } from 'lucide-react';
import IdentityAvatar from '@/components/profile/IdentityAvatar';
import { useChatChannel } from '@/lib/ChatNotificationsContext';

const sort = rows => [...rows].sort((a,b)=>new Date(a.created_date||0)-new Date(b.created_date||0));
export default function GameDayMatchChat({game,myClub,myPlayer,user}) {
  const [messages,setMessages]=useState([]),[draft,setDraft]=useState('');
  const [loading,setLoading]=useState(true),[sending,setSending]=useState(false),[error,setError]=useState('');
  const bottom=useRef(null),busy=useRef(false);
  const {isMuted,toggleMuted,markRead}=useChatChannel(game.id);
  const readRef=useRef(markRead);readRef.current=markRead;
  useEffect(()=>{
    let stopped=false,revision=0;
    setMessages([]);setDraft('');setError('');setLoading(true);
    const upsert=record=>setMessages(prev=>sort([...prev.filter(m=>m.id!==record.id),record]));
    async function refresh(){
      const started=revision;
      try{
        const rows=await stageClient.entities.ChatMessage.filter({match_id:game.id},'created_date',200);
        if(stopped)return;
        if(started===revision)setMessages(sort(rows||[]));
        setError('');
        await readRef.current();
      }catch(e){if(!stopped)setError(e.message||'Chat could not load. Retrying shortly.');}
      finally{if(!stopped)setLoading(false);}
    }
    refresh();
    // Reconcile if a socket reconnect or a missed event left the conversation stale.
    const timer=setInterval(()=>{if(!document.hidden)refresh();},5000);
    const off=stageClient.entities.ChatMessage.subscribe(event=>{
      if(stopped)return;
      if(event.type==='delete'){revision++;setMessages(prev=>prev.filter(m=>m.id!==event.id));return;}
      if(event.data?.match_id!==game.id)return;
      revision++;upsert(event.data);readRef.current();
    },{match_id:game.id});
    return()=>{stopped=true;clearInterval(timer);off?.();};
  },[game.id]);
  useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth',block:'nearest'});},[messages]);
  async function send(e){
    e.preventDefault();const content=draft.trim();if(!content||busy.current)return;
    busy.current=true;setSending(true);setError('');
    try{
      const record=await stageClient.entities.ChatMessage.create({match_id:game.id,content});
      setDraft('');setMessages(prev=>sort([...prev.filter(m=>m.id!==record.id),record]));
    }catch(err){setError(err.message||'Message not sent. Please try again.');}
    finally{busy.current=false;setSending(false);}
  }
  const home=game.home_club_name||game.home_player_name||'Home';
  const away=game.away_club_name||game.away_player_name||'Away';
  return <div className="flex h-[min(480px,58dvh)] min-h-[280px] flex-col">
    <div className="gd-chat-header"><MessageSquare className="h-5 w-5 shrink-0 text-blue-200"/><div className="min-w-0 flex-1"><strong>Opponent channel</strong><small>{home} vs {away}</small></div><button type="button" aria-label={isMuted?'Unmute chat notifications':'Mute chat notifications'} onClick={toggleMuted} className="p-3 text-blue-100">{isMuted?<BellOff size={18}/>:<Bell size={18}/>}</button></div>
    <div className="gd-chat-messages" role="log" aria-label="Match conversation" aria-live="polite">
      {loading?<p className="text-sm text-slate-400">Loading chat…</p>:messages.length===0?<div className="m-auto text-center"><MessageSquare className="mx-auto mb-3 text-slate-500"/><p className="text-sm text-slate-300">Start the matchday conversation.</p><p className="mt-1 text-xs text-slate-500">Coordinate with your opponents before, during or after the match.</p></div>:messages.map(m=>{
        const own=String(m.sender_email).toLowerCase()===String(user?.email).toLowerCase();
        const avatar=m.sender_avatar||(own?(myClub?.logo_url||myPlayer?.avatar_url):null);
        const date=m.created_date?new Date(m.created_date):null;
        return <article key={m.id} className={`gd-chat-message${own?' is-own':''}`}><IdentityAvatar src={avatar} name={m.sender_name||'Player'} className="w-9 shrink-0"/><div><header><strong>{m.sender_name||'Player'}{own?' · You':''}</strong>{date&&Number.isFinite(date.getTime())&&<time dateTime={date.toISOString()}>{date.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time>}</header><p>{m.content}</p></div></article>;
      })}<div ref={bottom}/>
    </div>
    {error&&<p role="alert" className="py-2 text-xs text-red-300">{error}</p>}
    <form onSubmit={send} className="gd-chat-compose"><input aria-label="Message your opponent" maxLength={2000} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Message your opponent…"/><button aria-label={sending?'Sending message':'Send message'} type="submit" disabled={sending||!draft.trim()}><Send className="mx-auto h-4 w-4"/></button></form>
  </div>;
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Shield, User, ChevronRight } from 'lucide-react';
import { formatProfilePlatform } from '@/lib/profilePlatform';

export function participantRows(rows, query = '', order = 'asc', platform = '') {
  return [...new Map(rows.map(p => [String(p.id), p])).values()].filter(p => (!query.trim() || String(p.gamertag || p.name || '').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) && (!platform || p.platform === platform))
    .sort((a, b) => (order === 'desc' ? -1 : 1) * (String(a.gamertag || a.name).localeCompare(String(b.gamertag || b.name)) || String(a.id).localeCompare(String(b.id))));
}
function Portrait({ participant, player }) {
  const [failed, setFailed] = useState(false);
  const url = participant.avatar_url || participant.logo_url;
  return url && !failed ? <img src={url} alt="" onError={() => setFailed(true)} className="h-12 w-12 shrink-0 object-contain" /> : player ? <User className="h-10 w-10 shrink-0 text-muted-foreground" /> : <Shield className="h-10 w-10 shrink-0 text-muted-foreground" />;
}
export default function ParticipantDirectory({ participants, player = false, myId, title }) {
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState('asc');
  const [platform, setPlatform] = useState('');
  const all = participantRows(participants);
  const rows = participantRows(all, search, order, platform);
  const platforms = [...new Set(all.map(p => p.platform).filter(Boolean))].sort();
  return <section className="min-w-0"><div className="flex flex-wrap items-end justify-between gap-4"><h2 className="font-heading text-2xl uppercase">{title || (player ? 'Players' : 'Clubs')}</h2><div className="flex w-full flex-wrap gap-3 sm:w-auto"><label className="relative w-full min-w-0 flex-none sm:w-64 sm:flex-1"><span className="sr-only">Search participants</span><Search size={17} className="absolute left-3 top-3.5 text-muted-foreground" /><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={player ? 'Search players...' : 'Search clubs...'} className="h-11 w-full min-w-0 border border-border bg-background pl-10 pr-3 text-sm" /></label>{platforms.length > 1 && <select aria-label="Participant platform" value={platform} onChange={e => setPlatform(e.target.value)} className="h-11 max-w-full border border-border bg-background px-3 text-sm"><option value="">All platforms</option>{platforms.map(p => <option key={p} value={p}>{formatProfilePlatform(p, 'Unavailable', { preserveUnspecified: true })}</option>)}</select>}<select aria-label="Participant sort order" value={order} onChange={e => setOrder(e.target.value)} className="h-11 border border-border bg-background px-3 text-sm"><option value="asc">Name A–Z</option><option value="desc">Name Z–A</option></select></div></div>
    <p role="status" className="my-5 text-sm text-muted-foreground">Showing {rows.length} of {all.length} {player ? 'players' : 'clubs'}</p>
    <div className="divide-y divide-border border-y border-border">{rows.map(p => { const Row = p.available === false ? "div" : Link; return <Row key={p.id} to={p.available === false ? undefined : `/${player ? 'players' : 'clubs'}/${encodeURIComponent(p.id)}`} className={`flex min-h-20 items-center gap-4 border-l-2 px-3 py-4 transition hover:bg-secondary/30 focus-visible:ring-2 focus-visible:ring-primary ${String(myId) === String(p.id) ? 'border-l-primary bg-primary/5' : 'border-l-transparent'}`}><Portrait participant={p} player={player} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-3"><strong className="break-words">{p.gamertag || p.name || 'Participant unavailable'}</strong>{!player && p.tag && <span className="text-sm text-muted-foreground">[{p.tag}]</span>}{String(myId) === String(p.id) && <span className="text-xs font-semibold text-primary">{player ? 'You' : 'Your club'}</span>}</div><p className="mt-1 break-words text-sm text-muted-foreground">{[player && p.position, formatProfilePlatform(p.platform, 'Platform unavailable', { preserveUnspecified: true }), p.country || p.country_code || p.region || 'Country unavailable'].filter(Boolean).join(' · ')}</p></div>{p.available !== false && <ChevronRight size={18} aria-hidden="true" />}</Row>; })}</div>
    {!rows.length && <div className="py-8"><p className="text-muted-foreground">{all.length ? 'No participants match the selected filters.' : 'No confirmed participants yet.'}</p>{all.length > 0 && <button type="button" onClick={() => { setSearch(''); setPlatform(''); setOrder('asc'); }} className="mt-3 min-h-11 text-primary">Clear filters</button>}</div>}
  </section>;
}

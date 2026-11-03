import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { stageClient } from '@/api/stageClient';

export default function RegionalCups() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true; setError(''); setData(null);
    stageClient.http.get('/regional-leagues/cups/public').then(result => { if (active) setData(result); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [revision]);
  const requested = params.get('edition');
  const selected = requested ? data?.cups.find(c => c.id === requested) : data?.cups[0];
  const time = value => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  return <main className="min-h-screen bg-background text-foreground"><div className="mx-auto max-w-6xl space-y-8 px-5 py-10">
    <Link to="/leagues" className="inline-flex min-h-11 items-center text-sm">← Regional leagues</Link>
    <header><p className="text-sm text-muted-foreground">REGIONAL COMPETITIONS</p><h1 className="mt-2 font-heading text-4xl uppercase">Regional Cups</h1><p className="mt-3 text-muted-foreground">One regional cup. Clubs from every participating division.</p></header>
    {error && <div role="alert"><p>{error}</p><button type="button" className="min-h-11 font-semibold" onClick={() => setRevision(r => r + 1)}>Retry</button></div>}
    {!data && !error && <p role="status">Loading regional cups…</p>}
    {data && !data.cups.length && <p role="status">Regional Cups appear here when an edition is activated. No Cup is currently published.</p>}
    {data && requested && !selected && <p role="status">This Cup edition is unavailable. <Link to="/regional-cups" className="font-semibold">View available Cups →</Link></p>}
    {selected && <>
      <label className="block text-sm">Cup edition<select value={selected.id} onChange={e => setParams({ edition: e.target.value })} className="mt-2 min-h-11 w-full border border-border bg-background px-3">{data.cups.map(c => <option key={c.id} value={c.id}>{c.name} · Season {c.season_number} · {c.status}</option>)}</select></label>
      <section className="flex flex-wrap items-center gap-8 border-y border-border py-7">
        {selected.trophy?.image_url && <img src={selected.trophy.image_url} alt={selected.trophy.name || selected.name} className="h-44 w-32 object-contain" />}
        <div><p className="text-sm text-muted-foreground">{selected.platform} · Season {selected.season_number} · {selected.status}</p><h2 className="mt-2 font-heading text-3xl uppercase">{selected.name}</h2><p className="mt-3">{selected.participant_count} clubs · Single-match knockout</p>{selected.winner_club_name && <p className="mt-3 font-semibold">Champion: {selected.winner_club_name}</p>}<p className="mt-2 text-sm text-muted-foreground">No automatic GOST qualification. Times below are shown in your local timezone.</p></div>
      </section>
      <section className="border-b border-border pb-5" aria-label="Cup rewards"><h3 className="font-heading text-xl uppercase">Cup rewards</h3>{selected.rewards?.winner_stc ? <><p className="mt-3">Winner: {Number(selected.rewards.winner_stc).toLocaleString()} STC · Finalist: {Number(selected.rewards.runner_up_stc).toLocaleString()} STC</p><p className="mt-2 text-sm text-muted-foreground">Funded by STAGE · No third-place prize · No additional Cup entry fee</p><p className="mt-2 text-sm">Payment status: {selected.rewards.state} · Trophy: {selected.honours_state || 'pending'}</p></> : <p className="mt-3 text-muted-foreground">Prize terms for this edition are awaiting review.</p>}</section>
      <details className="border-b border-border pb-4"><summary className="min-h-11 cursor-pointer py-3 font-semibold">Cup rules</summary><p className="max-w-3xl whitespace-pre-line text-sm text-muted-foreground">{selected.rules}</p><p className="mt-3 text-sm">At least three eligible human players per club. Each participating player needs active STAGE Plus. Keeper optional; ANY allowed. Publish your selection and confirm readiness in GameDay.</p></details>
      <div className="space-y-8">{selected.rounds.map(round => <section key={round.number} className="border-b border-border pb-6">
        <div className="flex flex-wrap justify-between gap-3"><h3 className="font-heading text-xl uppercase">Round {round.number}</h3><p className="text-sm text-muted-foreground">Week {round.week} · {time(round.kickoff_at)}</p></div>
        {!round.drawn && <p className="mt-4 text-sm text-muted-foreground">The open draw follows confirmation of every result in the previous round.</p>}
        {!!round.byes.length && <p className="mt-4 text-sm text-muted-foreground">Byes: {round.byes.map(id => selected.participants.find(c => c.id === id)?.name || 'Club unavailable').join(' · ')}</p>}
        <ul className="mt-3 divide-y divide-border">{round.matches.map(match => <li key={match.id}><Link to={`/game-day?match=${encodeURIComponent(match.id)}`} className="flex min-h-20 flex-wrap items-center justify-between gap-4 py-4 hover:bg-muted/20"><div><p className="font-semibold">{match.home_club_name} <span className="px-2 text-muted-foreground">vs</span> {match.away_club_name}</p><p className="mt-1 text-sm text-muted-foreground">{time(match.kickoff_at)} · {match.status}{match.decided_on_penalties && ' · Penalties'}</p></div><span className="font-semibold">{match.home_score != null && match.away_score != null ? `${match.home_score} – ${match.away_score}` : 'GameDay →'}</span></Link></li>)}</ul>
      </section>)}</div>
    </>}
  </div></main>;
}

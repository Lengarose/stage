import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { stageClient } from '@/api/stageClient';

export default function RegionalCycleDraw({ cycleId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null); setError('');
    stageClient.http.get(`/regional-leagues/cycles/${encodeURIComponent(cycleId)}/draw`)
      .then(result => { if (active) setData(result); })
      .catch(err => { if (active) setError(err.message || 'The published draw could not be loaded.'); });
    return () => { active = false; };
  }, [cycleId, revision]);
  return <section className="border-b border-border py-6">
    <h2 className="font-heading text-2xl uppercase">Season decisions and promotion draw</h2>
    <p className="mt-2 max-w-3xl text-sm text-muted-foreground">The club shown first plays at home. Official results determine the next round and sporting places; the draw remains recorded for this season.</p>
    <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Equal final league places are settled before promotion play-offs. Two tied clubs play one deciding match; three or four play each other once. Larger ties or another decisive tie require Admin review. These extra matches do not change the original league points.</p>
    {error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}<button type="button" className="ml-3 min-h-11 font-semibold" onClick={() => setRevision(n => n + 1)}>Retry</button></p> : !data ? <p role="status" className="py-5 text-sm">Loading the published draw…</p> : <>
      <p className="mt-3 text-sm">Season {data.season_number} · {data.status === 'allocated' ? 'Sporting allocation confirmed' : 'Sporting allocation pending'}</p>
      {data.blockers.map(message => <p role="status" key={message} className="mt-3 text-sm text-warning">The sporting ranking requires review before the next round can be confirmed.</p>)}
      <details className="mt-3"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">View {data.fixtures.length} published fixtures</summary><div className="max-h-96 overflow-y-auto">{data.fixtures.length ? data.fixtures.map(f => <div key={f.id} className="flex min-h-20 flex-wrap items-center justify-between gap-4 border-b border-border py-3 text-sm"><div><p className="font-semibold">{f.home_club_name} – {f.away_club_name}</p><p className="mt-1 text-muted-foreground">{f.phase === 'knockout_final' ? 'Single-match decision' : `Group match · round ${f.round}`} · {String(f.status).replaceAll('_', ' ')}</p></div><Link className="inline-flex min-h-11 items-center font-semibold" to={`/game-day?match=${encodeURIComponent(f.match_id)}`}>Open GAMEDAY →</Link></div>) : <p className="py-5 text-sm text-muted-foreground">This initial twenty-club field does not require placement matches.</p>}</div></details>
    </>}
  </section>;
}

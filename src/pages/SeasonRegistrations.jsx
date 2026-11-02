import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resolveMyPlayerAndClub } from '@/api/stageClient';
import RegionalRegistrationPanel from '@/components/competition/RegionalRegistrationPanel';

export default function SeasonRegistrations() {
  const [params] = useSearchParams();
  const [club, setClub] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    resolveMyPlayerAndClub().then(result => { if (active) { setClub(result.club); setLoaded(true); } }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);
  return <main className="competition-surface min-h-screen bg-background px-5 py-8 text-foreground sm:px-8"><div className="mx-auto max-w-4xl">
    <Link to="/leagues" className="inline-flex min-h-11 items-center font-semibold">← Back to Regional Leagues</Link>
    <h1 className="mt-5 font-heading text-3xl uppercase sm:text-4xl">Your club’s regional participation</h1>
    {error ? <p role="alert" className="py-6 text-destructive">{error}</p> : loaded ? <RegionalRegistrationPanel clubId={params.get('club') || club?.id} region={params.get('region') || ''} /> : <p role="status" className="py-6">Loading your club…</p>}
  </div></main>;
}

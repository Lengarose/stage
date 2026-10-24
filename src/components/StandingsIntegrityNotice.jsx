import { useEffect, useState } from 'react';
import { stageClient } from '@/api/stageClient';
import { swalPrompt } from '@/lib/swal';

export default function StandingsIntegrityNotice({ kind, editionId, isAdmin, onRefresh }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const url = `/competition-views/${kind}/${encodeURIComponent(editionId)}?review=standings`;
  useEffect(() => {
    let active = true;
    setReport(null); setError('');
    if (editionId) stageClient.http.get(url).then(data => { if (active) setReport(data); })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [url, editionId]);
  async function repair() {
    const reason = await swalPrompt('Reason for repairing standings from confirmed results');
    if (!reason) return;
    setBusy(true); setError('');
    try {
      await stageClient.http.post(`/competition-views/${kind}/${encodeURIComponent(editionId)}/reconcile`, { action: 'standings', apply: true, reason });
      setReport(await stageClient.http.get(url));
      await onRefresh?.();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  if (!report?.requires_review && !error) return null;
  return <section className="border border-warning/40 p-3 text-sm" aria-label="Standings integrity">
    <p role="status">Standings require review. Missing: {report?.missing?.length || 0}; duplicates: {report?.duplicates?.length || 0}; invalid: {report?.invalid?.length || 0}; incorrect totals: {report?.mismatches?.length || 0}.</p>
    {report?.conflicts?.map(message => <p key={message}>{message}</p>)}
    {error && <p role="alert">{error}</p>}
    {isAdmin && report && <details className="mt-2"><summary>Review expected standings</summary>
      <div className="max-h-64 overflow-auto"><table className="w-full"><thead><tr><th>Club</th><th>P</th><th>GF</th><th>GA</th><th>Pts</th></tr></thead><tbody>
        {report.expected.map(r => <tr key={r.club_id}><td>{r.club_name}</td><td>{r.played}</td><td>{r.goals_for}</td><td>{r.goals_against}</td><td>{r.points}</td></tr>)}
      </tbody></table></div>
      <button type="button" className="mt-2 text-primary disabled:opacity-50" onClick={repair} disabled={!report.repairable || busy}>{busy ? 'Repairing...' : 'Repair Standings'}</button>
    </details>}
  </section>;
}

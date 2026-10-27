import { useEffect, useState } from 'react';
import { stageClient } from '@/api/stageClient';
import { swalPrompt } from '@/lib/swal';

export default function CompetitionTrophySelector({ competitionId }) {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    const result = await stageClient.http.get(`/gost/${encodeURIComponent(competitionId)}/trophy`);
    setData(result); setSelected(result.selected_id || '');
  }
  useEffect(() => {
    let active = true;
    stageClient.http.get(`/gost/${encodeURIComponent(competitionId)}/trophy`).then(result => {
      if (active) { setData(result); setSelected(result.selected_id || ''); }
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [competitionId]);
  async function save() {
    const reason = await swalPrompt('Reason for changing this competition’s trophy artwork. Captured editions and earned trophies will not change.');
    if (!reason) return;
    setBusy(true); setError('');
    try {
      await stageClient.http.post(`/gost/${encodeURIComponent(competitionId)}/trophy`, { trophy_item_id: selected || null, revision: data.revision, reason });
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const trophy = data?.items.find(item => item.id === selected);
  return <section className="space-y-2 border-t border-border/50 pt-3">
    <label className="block text-xs font-bold" htmlFor={`competition-trophy-${competitionId}`}>Competition trophy</label>
    {data ? <>
      <div className="flex flex-wrap items-center gap-3">
        <select id={`competition-trophy-${competitionId}`} value={selected} disabled={busy} onChange={e => setSelected(e.target.value)} className="min-h-11 min-w-0 max-w-full flex-1 border border-border bg-background px-2 text-sm">
          <option value="">Not assigned</option>
          {data.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button type="button" disabled={busy} onClick={save} className="min-h-11 px-2 text-sm font-semibold text-primary disabled:opacity-50">{busy ? 'Saving...' : 'Save trophy'}</button>
      </div>
      {trophy && <div className="flex items-center gap-3">{trophy.image_url && <img src={trophy.image_url} alt="" className="h-20 w-16 object-contain" />}<span className="text-xs">{trophy.name}</span></div>}
      {data.guidance && <p className="text-xs text-warning">{data.guidance}</p>}
      <p className="text-xs text-muted-foreground">Artwork is managed in Trophies. Selection does not award a trophy. Captured editions use their existing design; amendments remain in Rewards review.</p>
    </> : !error && <p className="text-xs text-muted-foreground">Loading catalogue...</p>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </section>;
}

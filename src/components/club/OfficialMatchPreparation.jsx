import { useEffect, useRef, useState } from 'react';
import { stageClient } from '@/api/stageClient';
import { useTranslation } from '@/hooks/useTranslation';

export default function OfficialMatchPreparation({ clubId, fixtureId, players = [], onState, onChanged, hideForbidden = false }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [outId, setOutId] = useState('');
  const [inId, setInId] = useState('');
  const sequence = useRef(0);
  const alive = useRef(true);
  const base = `/club-fixture-lineups/preparation/${encodeURIComponent(clubId)}/${encodeURIComponent(fixtureId)}`;
  async function refresh() {
    if (!alive.current) return;
    const request = ++sequence.current;
    try {
      const result = await stageClient.http.get(base);
      if (!alive.current || request !== sequence.current) return;
      setData(result); setError(null); onState(result);
    } catch (err) {
      if (!alive.current || request !== sequence.current) return;
      if (hideForbidden && Number(err.status) === 403) { setData({ official: false }); setError(null); onState(null); return; }
      setError(err.message); onState({ unavailable: true });
    }
  }
  useEffect(() => {
    alive.current = true;
    setData(null); setError(null); setOutId(''); setInId(''); onState(null);
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => { clearInterval(timer); alive.current = false; sequence.current += 1; };
    // Refresh follows the selected club/fixture, not the parent's render cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, fixtureId]);
  async function act(action) {
    setBusy(true); setError(null);
    try {
      await stageClient.http.post(base, { action, expected_revision: data.selection_revision, out_player_id: outId, in_player_id: inId });
      if (!alive.current) return;
      setOutId(''); setInId(''); await onChanged(); await refresh();
    } catch (err) { if (alive.current) { await refresh(); if (alive.current) setError(err.message); } }
    finally { if (alive.current) setBusy(false); }
  }
  const label = id => players.find(player => player.id === id)?.gamertag || data?.player_labels?.[id] || id;
  const date = value => new Date(value).toLocaleString();
  const withdraw = data?.selection?.bench.includes(outId);
  if (!data?.official && !error) return null;
  return <section className="space-y-3 border border-white/10 p-4 text-sm" aria-live="polite">
    <p className="font-semibold text-white">{t('commonPages.coopMatchPreparation', 'Official match preparation')}</p>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {data?.official && <>
      <p className="text-slate-300">{t('commonPages.coopReadyOpens', 'Ready check opens')}: {date(data.ready_opens_at)} · {t('commonPages.coopLocksAt', 'Selection locks')}: {date(data.locks_at)}</p>
      <p>{data.started ? t('commonPages.coopPreparationStarted', 'Match started; the selection is frozen.') : data.locked ? t('commonPages.coopPreparationLocked', 'Selection locked. Only declared reserves can replace starters before actual kickoff. An unused reserve may be withdrawn.') : t('commonPages.coopPreparationOpen', 'Publish your starters and reserves before the lock deadline.')}</p>
      {data.selection && <p className="text-slate-300">{t('commonPages.coopStartingXi', 'Starting players')}: {data.selection.starters.map(label).join(', ')}<br />{t('commonPages.coopBench', 'Reserves')}: {data.selection.bench.map(label).join(', ') || '—'}</p>}
      {data.eligibility_message && <p role="alert" className="text-amber-300">{data.eligibility_message}</p>}
      <p>{data.ready_at ? t('commonPages.coopOwnReady', 'Your club is marked ready.') : t('commonPages.coopOwnNotReady', 'Your club is not marked ready.')} {data.opponent_ready ? t('commonPages.coopOpponentReady', 'Opponent marked ready.') : t('commonPages.coopOpponentNotReady', 'Opponent not marked ready.')}</p>
      {data.waiting_elapsed && !data.started && <p className="text-amber-300">{t('commonPages.coopWaitingElapsed', 'The ten-minute waiting period has elapsed. Contact Admin if the opponent is absent; no automatic forfeit is awarded.')}</p>}
      {!data.started && <button type="button" className="border border-white/20 px-3 py-2 disabled:opacity-40" disabled={busy || !data.can_ready || !data.selection || data.eligible === false} onClick={() => act('ready')}>{t('commonPages.coopMarkReady', 'Mark selection ready')}</button>}
      {data.locked && !data.started && data.selection && <div className="flex flex-wrap gap-2">
        <select aria-label={t('commonPages.coopPlayerOut', 'Player to replace or withdraw')} value={outId} onChange={event => { setOutId(event.target.value); setInId(''); }} className="bg-slate-950 border border-white/20 p-2">
          <option value="">{t('commonPages.coopPlayerOut', 'Player to replace or withdraw')}</option>
          {data.selection.ids.map(id => <option key={id} value={id}>{label(id)}</option>)}
        </select>
        {!withdraw && <select aria-label={t('commonPages.coopReserveIn', 'Previously declared reserve')} value={inId} onChange={event => setInId(event.target.value)} className="bg-slate-950 border border-white/20 p-2">
          <option value="">{t('commonPages.coopReserveIn', 'Previously declared reserve')}</option>
          {data.selection.bench.map(id => <option key={id} value={id}>{label(id)}</option>)}
        </select>}
        <button type="button" className="border border-white/20 px-3 py-2 disabled:opacity-40" disabled={busy || !outId || (!withdraw && !inId)} onClick={() => act(withdraw ? 'withdraw_reserve' : 'reserve')}>{withdraw ? t('commonPages.coopWithdrawReserve', 'Withdraw unused reserve') : t('commonPages.coopChangeReserve', 'Apply reserve change')}</button>
      </div>}
    </>}
    <button type="button" className="text-slate-300" disabled={busy} onClick={refresh}>{t('commonPages.coopRefreshPreparation', 'Refresh preparation')}</button>
  </section>;
}

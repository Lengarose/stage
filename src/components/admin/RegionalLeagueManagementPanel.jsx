import { useState } from 'react';
import { Plus, Archive, Trash2, Search } from 'lucide-react';
import { stageClient } from '@/api/stageClient';
import { adminEndpointError, managementPreviewReady, buildLeagueManagementRequest } from '@/lib/adminLeagueLifecycle';

const repairPairs = [
  { name: 'Premier Division', source_id: '46dbb09f-8319-4607-ab97-ec941745bfd8', canonical_id: 'c2d6e60f-89e0-4813-81a1-967551d8d69f' },
  { name: 'North American Division 1', source_id: 'e582c55b-1e72-45f5-ab63-137c3420404a', canonical_id: 'e91c6c27-4fd2-45d9-b6ed-6a3591d7b210' },
];
const initialDefinition = { name: '', region_slug: '', division: 1, platform: 'cross-platform', max_clubs: 20, linked_league_slug: '', trophy_item_id: '' };

export default function RegionalLeagueManagementPanel({ definitions = [], trophyItems = [], onRefresh }) {
  const [action, setAction] = useState('create');
  const [leagueId, setLeagueId] = useState('');
  const [definition, setDefinition] = useState(initialDefinition);
  const [rules, setRules] = useState('{}');
  const [rewards, setRewards] = useState('{}');
  const [reason, setReason] = useState('');
  const [review, setReview] = useState(null);
  const [confirmation, setConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [repairPreview, setRepairPreview] = useState(null);
  const [applied, setApplied] = useState(false);
  function invalidate() { setReview(null); setConfirmation(false); setApplied(false); }
  function edit(field, value) { invalidate(); setDefinition(current => ({ ...current, [field]: value })); }
  async function run(task) {
    setBusy(true); setError('');
    try { await task(); } catch (err) { setError(adminEndpointError(err)); }
    finally { setBusy(false); }
  }
  async function preview() {
    invalidate();
    await run(async () => {
      const parseObject = (text, label) => {
        const value = JSON.parse(text);
        if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(`${label} must be a JSON object.`);
        return value;
      };
      const request = buildLeagueManagementRequest({ action, league_id: leagueId, reason,
        definition: action === 'create' ? { ...definition, division: Number(definition.division), max_clubs: Number(definition.max_clubs), trophy_item_id: definition.trophy_item_id || null, rules: parseObject(rules, 'Rules'), reward_defaults: parseObject(rewards, 'Reward defaults') } : undefined });
      const result = await stageClient.http.post('/regional-leagues/management', { ...request, apply: false });
      setReview({ request, result });
    });
  }
  async function apply() {
    if (!confirmation || !managementPreviewReady(review?.result) || review.request.action === 'review') return;
    await run(async () => {
      const result = await stageClient.http.post('/regional-leagues/management', { ...review.request, apply: true, expected_revision: review.result.revision });
      if (result?.applied !== true && result?.already_applied !== true) {
        setReview(null); setConfirmation(false);
        throw new Error(`The backend did not confirm this operation. Review again. ${JSON.stringify(result)}`);
      }
      setReview(null); setConfirmation(false); setApplied(true);
      await onRefresh?.();
    });
  }
  const inputClass = 'block min-h-10 w-full min-w-0 rounded border border-border bg-background px-2 text-sm';
  return <section className="space-y-3 border-y border-border py-4">
    <h4 className="font-heading text-base">Permanent league management</h4>
    <fieldset disabled={busy} className="space-y-3 disabled:opacity-60">
      <label className="block text-xs">Action<select className={inputClass} value={action} onChange={e => { invalidate(); setAction(e.target.value); }}>
        <option value="create">Create league and initial edition</option><option value="review">Review dependencies</option><option value="retire">Retire league, preserve history</option><option value="delete">Delete unused draft league</option>
      </select></label>
      {action !== 'create' ? <label className="block text-xs">Permanent league<select className={inputClass} value={leagueId} onChange={e => { invalidate(); setLeagueId(e.target.value); }}>
        <option value="">Select league</option>{definitions.map(league => <option key={league.id} value={league.id}>{league.name} · D{league.division} · {league.platform} · {league.id}</option>)}
      </select></label> : <div className="grid gap-3 sm:grid-cols-2">
        {['name', 'region_slug', 'platform', 'division', 'max_clubs', 'linked_league_slug'].map(field => <label key={field} className="block text-xs">{({ name: 'Name', region_slug: 'Regional system slug', platform: 'Platform', division: 'Division', max_clubs: 'Capacity', linked_league_slug: 'Linked division slug' })[field]}
          <input className={inputClass} type={['division', 'max_clubs'].includes(field) ? 'number' : 'text'} min={field === 'max_clubs' ? 2 : 1} value={definition[field]} onChange={e => edit(field, e.target.value)} />
        </label>)}
        <label className="block text-xs">Default trophy<select className={inputClass} value={definition.trophy_item_id} onChange={e => edit('trophy_item_id', e.target.value)}><option value="">Not assigned</option>{trophyItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="block text-xs">Rules (JSON)<textarea className={inputClass} value={rules} onChange={e => { invalidate(); setRules(e.target.value); }} /></label>
        <label className="block text-xs">Reward defaults (JSON)<textarea className={inputClass} value={rewards} onChange={e => { invalidate(); setRewards(e.target.value); }} /></label>
      </div>}
      <label className="block text-xs">Reason<input className={inputClass} value={reason} onChange={e => { invalidate(); setReason(e.target.value); }} /></label>
      <button type="button" onClick={preview} disabled={!reason.trim() || (action === 'create' ? !definition.name.trim() || !definition.region_slug.trim() : !leagueId)} className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-primary disabled:opacity-50"><Search className="h-4 w-4" />Preview dependencies and consequences</button>
      {review && <>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(review.result, null, 2)}</pre>
        {managementPreviewReady(review.result) && action !== 'review' && <>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmation} onChange={e => setConfirmation(e.target.checked)} />I confirm the reviewed {action} operation and its consequences.</label>
          <button type="button" disabled={!confirmation} onClick={apply} className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-primary disabled:opacity-50">{action === 'create' ? <Plus className="h-4 w-4" /> : action === 'retire' ? <Archive className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}Confirm {action}</button>
        </>}
      </>}
      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-xs">Requested duplicate consolidation: retain the original identities and preserve valid editions. Preview only; production apply is pending review.</p>
        {repairPairs.map(pair => <button key={pair.source_id} type="button" className="block min-h-10 text-left text-sm text-primary" onClick={() => run(async () => {
          setRepairPreview(null);
          const result = await stageClient.http.post('/regional-leagues/edition-review', { ...pair, mode: 'consolidate', apply: false });
          setRepairPreview({ ...pair, result });
        })}>Preview {pair.name} consolidation</button>)}
        {repairPreview && <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(repairPreview, null, 2)}</pre>}
      </div>
    </fieldset>
    {applied && <p role="status" className="text-sm">League management operation confirmed. Catalogue refreshed.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}

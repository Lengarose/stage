import { useState } from 'react';
import RegionalWizardSteps from './RegionalWizardSteps';
import OfficialCompetitionDecisions from './OfficialCompetitionDecisions';
import { Plus, Archive, Trash2, Search } from 'lucide-react';
import { stageClient } from '@/api/stageClient';
import { adminEndpointError, managementPreviewReady, buildLeagueManagementRequest, REGIONAL_DUPLICATE_REPAIRS, buildDuplicateLeagueRequest } from '@/lib/adminLeagueLifecycle';

const repairPairs = REGIONAL_DUPLICATE_REPAIRS;
const initialDefinition = { name: '', region_slug: '', division: 1, platform: 'cross-platform', max_clubs: 20, linked_league_slug: '', trophy_item_id: '' };

export default function RegionalLeagueManagementPanel({ definitions = [], trophyItems = [], onRefresh, initialAction = 'create', initialLeagueId = '', onResolveDuplicate, standalone = false }) {
  const [action, setAction] = useState(initialAction);
  const [step, setStep] = useState(0);
  const [leagueId, setLeagueId] = useState(initialLeagueId);
  const [definition, setDefinition] = useState(initialDefinition);
  const [rules, setRules] = useState('{}');
  const [rewards, setRewards] = useState('{}');
  const [reason, setReason] = useState('');
  const [testHistoryReset, setTestHistoryReset] = useState(false);
  const [review, setReview] = useState(null);
  const [confirmation, setConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
      const request = action === 'consolidate' ? buildDuplicateLeagueRequest(leagueId, reason, testHistoryReset) : buildLeagueManagementRequest({ action, league_id: leagueId, reason,
        definition: action === 'create' ? { ...definition, division: Number(definition.division), max_clubs: Number(definition.max_clubs), trophy_item_id: definition.trophy_item_id || null, rules: parseObject(rules, 'Rules'), reward_defaults: parseObject(rewards, 'Reward defaults') } : undefined });
      const result = await stageClient.http.post(action === 'consolidate' ? '/regional-leagues/edition-review' : '/regional-leagues/management', { ...request, apply: false });
      setReview({ request, result }); setStep(1);
    });
  }
  async function apply() {
    if (!confirmation || !managementPreviewReady(review?.result) || review.request.action === 'review') return;
    await run(async () => {
      const result = await stageClient.http.post(review.request.mode === 'consolidate' ? '/regional-leagues/edition-review' : '/regional-leagues/management', { ...review.request, apply: true, expected_revision: review.result.revision });
      if (result?.applied !== true && result?.already_applied !== true) {
        setReview(null); setConfirmation(false); setStep(0);
        throw new Error(`The backend did not confirm this operation. Review again. ${JSON.stringify(result)}`);
      }
      setReview(null); setConfirmation(false); setApplied(true); setStep(2);
      await onRefresh?.();
    });
  }
  const selectedRepair = repairPairs.find(pair => pair.source_id === leagueId);
  function resolveDuplicate(id) {
    if (onResolveDuplicate) { onResolveDuplicate(id); return; }
    invalidate(); setAction('consolidate'); setLeagueId(id); setStep(0);
  }
  const inputClass = 'block min-h-10 w-full min-w-0 rounded border border-border bg-background px-2 text-sm';
  return <section className="space-y-3 border-y border-border py-4">
    <RegionalWizardSteps steps={['League details', 'Review & confirm', 'Completed']} current={step} />
    <h4 className="font-heading text-lg">{step === 0 ? (action === 'create' ? 'Set up your league' : action === 'consolidate' ? 'Choose the duplicate to resolve' : 'Choose the permanent league') : step === 1 ? 'Review the consequences' : 'Operation completed'}</h4>
    <fieldset disabled={busy} className="space-y-3 disabled:opacity-60">
      {step === 0 && <>
      {!standalone && <label className="block text-xs">Action<select className={inputClass} value={action} onChange={e => { invalidate(); setAction(e.target.value); }}>
        <option value="create">Create league and initial edition</option><option value="consolidate">Resolve a known duplicate league</option><option value="review">Review dependencies</option><option value="retire">Retire league, preserve history</option><option value="delete">Delete unused draft league</option>
      </select></label>}
      {action === 'consolidate' ? <div className="space-y-3">
        <label className="block text-xs">Duplicate league<select className={inputClass} value={leagueId} onChange={e => { invalidate(); setLeagueId(e.target.value); }}><option value="">Select a reviewed duplicate</option>{repairPairs.map(pair => <option key={pair.source_id} value={pair.source_id}>{pair.name} · {pair.source_id}</option>)}</select></label>
        {selectedRepair && <div className="border border-border p-3 text-sm space-y-2"><p>Keep original league: <span className="break-all">{selectedRepair.canonical_id}</span></p><p>Remove the extra independent league entry by linking <span className="break-all">{selectedRepair.source_id}</span> as its season edition.</p><p>Fixtures, results, trophies and payment history keep their existing references. No physical deletion or reset is performed.</p></div>}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={testHistoryReset} onChange={e => { invalidate(); setTestHistoryReset(e.target.checked); }} />This duplicate contains disposable test-pack history. Retire it from public history before the fresh-start reset (super admin only).</label>
      </div> : action !== 'create' ? <label className="block text-xs">Permanent league<select className={inputClass} value={leagueId} onChange={e => { invalidate(); setLeagueId(e.target.value); }}>
        <option value="">Select league</option>{definitions.map(league => <option key={league.id} value={league.id}>{league.name} · D{league.division} · {league.platform} · {league.id}</option>)}
      </select></label> : <div className="grid gap-3 sm:grid-cols-2">
        {['name', 'region_slug', 'platform', 'division', 'max_clubs', 'linked_league_slug'].map(field => <label key={field} className="block text-xs">{({ name: 'Name', region_slug: 'Regional system slug', platform: 'Platform', division: 'Division', max_clubs: 'Capacity', linked_league_slug: 'Linked division slug' })[field]}
          <input className={inputClass} type={['division', 'max_clubs'].includes(field) ? 'number' : 'text'} min={field === 'max_clubs' ? 2 : 1} value={definition[field]} onChange={e => edit(field, e.target.value)} />
        </label>)}
        <label className="block text-xs">Default trophy<select className={inputClass} value={definition.trophy_item_id} onChange={e => edit('trophy_item_id', e.target.value)}><option value="">Not assigned</option>{trophyItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <details className="sm:col-span-2"><summary className="min-h-11 cursor-pointer py-3 text-sm">Advanced rules and reward defaults (optional)</summary><div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs">Rules (JSON)<textarea className={inputClass} value={rules} onChange={e => { invalidate(); setRules(e.target.value); }} /></label>
        <label className="block text-xs">Reward defaults (JSON)<textarea className={inputClass} value={rewards} onChange={e => { invalidate(); setRewards(e.target.value); }} /></label>
        </div></details>
      </div>}
      <label className="block text-xs">Reason<input className={inputClass} value={reason} onChange={e => { invalidate(); setReason(e.target.value); }} /></label>
      <button type="button" onClick={preview} disabled={!reason.trim() || (action === 'create' ? !definition.name.trim() || !definition.region_slug.trim() : !leagueId)} className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-primary disabled:opacity-50"><Search className="h-4 w-4" />Preview dependencies and consequences</button>
      </>}
      {step === 1 && review && <>
        <p className="text-sm font-semibold">{action === 'create' ? review.request.definition.name : selectedRepair?.name || definitions.find(league => league.id === leagueId)?.name} · {action === 'consolidate' ? 'resolve duplicate' : action}</p>
        {action === 'consolidate' && <div className="border border-border p-3 text-sm space-y-2"><p>Original retained: <span className="break-all">{review.result.canonical_id}</span></p><p>{review.result.historical_access}</p><p>{review.result.already_applied ? 'This duplicate is already linked to the original league.' : `Current edition after repair: ${review.result.before_after?.current_edition_id || 'See full report'}`}</p><p>No matches, honours or financial records will be deleted or paid again.</p></div>}
        {review.request.test_history_reset && <p className="text-sm">{review.result.test_history_reset === true ? 'The duplicate will be retained as an invalidated test edition. Its original identity is preserved in the audit. Next, run the fresh-start reset to clear test results and honours across all selected leagues.' : 'The connected backend does not support test-history retirement yet. Deploy the updated backend before confirming.'}</p>}
        {action === 'delete' && selectedRepair && review.result.blockers?.length > 0 && <div className="border border-primary/40 p-3 text-sm"><p>This is a known duplicate with linked season history. Use the consolidation workflow to remove its independent league entry while preserving its references.</p><button type="button" className="min-h-11 font-semibold text-primary" onClick={() => resolveDuplicate(leagueId)}>Resolve this duplicate safely</button></div>}
        <ul className="list-disc space-y-2 pl-5 text-sm">{review.result.consequences?.map(message => <li key={message}>{message}</li>)}</ul>
        {review.result.blockers?.map(message => <p key={message} role="alert" className="rounded border border-destructive/30 p-3 text-sm text-destructive">{message}</p>)}
        {review.result.editions && <p className="text-sm text-muted-foreground">{review.result.editions.length} linked edition(s). Review the dependency report before confirming.</p>}
        <details><summary className="min-h-11 cursor-pointer py-3 text-sm">Full dependency report</summary><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(review.result, null, 2)}</pre></details>
        <button type="button" className="min-h-11 text-sm font-semibold" onClick={() => { invalidate(); setStep(0); }}>← Back to details</button>
        {managementPreviewReady(review.result) && (!review.request.test_history_reset || review.result.test_history_reset === true) && action !== 'review' && <>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmation} onChange={e => setConfirmation(e.target.checked)} />I confirm the reviewed {action} operation and its consequences.</label>
          <button type="button" disabled={!confirmation} onClick={apply} className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-primary disabled:opacity-50">{action === 'create' ? <Plus className="h-4 w-4" /> : action === 'retire' ? <Archive className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}{action === 'consolidate' ? 'Confirm duplicate consolidation' : `Confirm ${action}`}</button>
        </>}
      </>}
      {(!standalone || action === 'review') && <div className="space-y-2 border-t border-border pt-3">
        <p className="text-xs">Known duplicate leagues: keep the original identity and review the preserved season references before confirming consolidation.</p>
        {repairPairs.map(pair => <button key={pair.source_id} type="button" className="block min-h-10 text-left text-sm text-primary" onClick={() => resolveDuplicate(pair.source_id)}>Resolve {pair.name} duplicate</button>)}

      </div>}
    </fieldset>
    {!standalone && <OfficialCompetitionDecisions definitions={definitions} onRefresh={onRefresh} />}
    {applied && <p role="status" className="text-sm">League management operation confirmed. Catalogue refreshed.{action === 'create' && ' Next: open registration, confirm the participant field, then prepare placement and the season calendar.'}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}

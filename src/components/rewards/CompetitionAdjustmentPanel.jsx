import { useState } from 'react';
import { stageClient } from '@/api/stageClient';
const inputClass = 'block w-full min-w-0 border border-border bg-background p-2 text-sm';
export default function CompetitionAdjustmentPanel() {
 const [form, setForm] = useState({ recipient_type: 'club', recipient_id: '', kind: 'refund', reference_transaction_id: '', amount: '', reason: '' });
 const [transactions, setTransactions] = useState([]);
 const [decisionId, setDecisionId] = useState(() => crypto.randomUUID());
 const [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState(null), [confirm, setConfirm] = useState(false);
 function edit(key, value) { if (['recipient_id', 'recipient_type'].includes(key)) setTransactions([]); setForm({ ...form, [key]: value }); setDecisionId(crypto.randomUUID()); setConfirm(false); setResult(null); }
 async function apply() { setBusy(true); setError(''); try { const response = await stageClient.http.post('/reward-configs/adjustments', { ...form, decision_id: decisionId }); setResult(response.adjustment); setConfirm(false); } catch (err) { setError(err.message || 'The adjustment was not confirmed. Keep this decision unchanged before retrying.'); } finally { setBusy(false); } }
 return <section className="space-y-3 border-y border-border py-4">
  <h3 className="font-heading text-xl">Competition financial exceptions</h3>
  <p className="text-sm text-muted-foreground">Normal configured prizes remain automatic. Refunds and compensation require your explicit decision and a transaction reference. This creates a separate ledger entry; original payments and prize history stay unchanged.</p>
  <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
   <label className="text-xs">Recipient type<select className={inputClass} value={form.recipient_type} onChange={e => edit('recipient_type', e.target.value)}><option value="club">Club</option><option value="player">Player</option></select></label>
   <label className="text-xs">Decision type<select className={inputClass} value={form.kind} onChange={e => edit('kind', e.target.value)}><option value="refund">Refund of an existing debit</option><option value="compensation">Explicit compensation or correction</option></select></label>
   {['recipient_id', 'reference_transaction_id', 'amount', 'reason'].map(key => <label key={key} className="text-xs">{({ recipient_id: 'Recipient ID', reference_transaction_id: 'Original ledger transaction ID (same account for refunds)', amount: 'STC amount (negative only for an explicit correction)', reason: 'Decision reason' })[key]}<input className={inputClass} value={form[key]} onChange={e => edit(key, e.target.value)} /></label>)}
   <button type="button" className="min-h-11 text-left text-sm" disabled={!form.recipient_id} onClick={async () => { setError(''); try { const entity = stageClient.entities[form.recipient_type === 'player' ? 'PlayerStcTransaction' : 'STCTransaction']; setTransactions(await entity.filter({ [form.recipient_type === 'player' ? 'player_id' : 'club_id']: form.recipient_id }, '-created_date', 50)); } catch (err) { setError(err.message); } }}>Load this account’s latest ledger entries</button>
   {transactions.length > 0 && <label className="text-xs">Choose a reference from the account ledger<select className={inputClass} value={form.reference_transaction_id} onChange={e => edit('reference_transaction_id', e.target.value)}><option value="">Select an original transaction</option>{transactions.map(t => <option key={t.id} value={t.id}>{t.created_date} · {t.amount} STC · {t.category || t.type}</option>)}</select></label>}
   <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} />I confirm the recipient, original transaction, explicit amount and reason.</label>
   <button type="button" disabled={!confirm || !!result || !form.reason.trim()} onClick={apply} className="min-h-11 text-left text-sm font-bold disabled:opacity-50">Record this separate financial decision</button>
  </fieldset>
  {result && <p role="status" className="break-words text-sm">Applied {result.amount} STC. New balance: {result.balance_after} STC. Separate ledger entry: {result.ledger_transaction_id}.</p>}
  {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
 </section>;
}

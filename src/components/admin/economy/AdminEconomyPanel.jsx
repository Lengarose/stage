import { useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DollarSign, Activity, Wallet, Building2, Filter, ClipboardList,
  RefreshCw, Search, Zap, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtStc, fmtDate } from "../shared/adminFormatters";
import { TX_CATEGORIES } from "../shared/adminConstants";

export default function AdminEconomyPanel() {
  const [open, setOpen]         = useState(false);
  const [section, setSection]   = useState('health'); // health | player | club | txs | audit
  const [msg, setMsg]           = useState(null);
  const [busy, setBusy]         = useState(false);

  function flash(type, text) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  }

  // ── Health Check state ────────────────────────────────────────────────────
  const [health, setHealth]     = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);

  async function runHealthCheck() {
    setHealthLoading(true);
    try {
      const res = await stageClient.functions.invoke('adminEconomyControl', { action: 'health_check' });
      setHealth(res?.data);
    } catch (err) { flash('error', err?.message || 'Health check failed'); }
    setHealthLoading(false);
  }

  async function fixNullWallets(dry) {
    setBusy(true);
    try {
      const res = await stageClient.functions.invoke('adminEconomyControl', { action: 'backfill_player_wallets', dry_run: dry });
      if (dry) {
        flash('info', `Dry run: would fix ${res?.data?.would_fix || 0} wallets.`);
      } else {
        flash('success', `Fixed ${res?.data?.fixed || 0} null wallets ✓`);
        runHealthCheck();
      }
    } catch (err) { flash('error', err?.message || 'Failed'); }
    setBusy(false);
  }

  async function fixNullClubs() {
    setBusy(true);
    try {
      const res = await stageClient.functions.invoke('adminEconomyControl', { action: 'backfill_club_finances' });
      flash('success', `Fixed ${res?.data?.fixed || 0} club finances ✓`);
      runHealthCheck();
    } catch (err) { flash('error', err?.message || 'Failed'); }
    setBusy(false);
  }

  // ── Player Wallet state ───────────────────────────────────────────────────
  const [pLookup, setPLookup]   = useState('');
  const [pData, setPData]       = useState(null);
  const [pLoading, setPLoading] = useState(false);
  const [pNewBal, setPNewBal]   = useState('');
  const [pTxAmt, setPTxAmt]     = useState('');
  const [pTxCat, setPTxCat]     = useState('admin_correction');
  const [pTxDesc, setPTxDesc]   = useState('');
  const [pReason, setPReason]   = useState('');

  async function lookupPlayer() {
    if (!pLookup.trim()) return;
    setPLoading(true);
    setPData(null);
    try {
      const isId = pLookup.length > 20 && !pLookup.includes('@');
      const res = await stageClient.functions.invoke('adminEconomyControl', {
        action: 'get_player_wallet',
        ...(isId ? { player_id: pLookup } : { player_email: pLookup }),
      });
      setPData(res?.data);
      setPNewBal(String(Number(res?.data?.player?.stc || 0)));
    } catch (err) { flash('error', err?.message || 'Player not found'); }
    setPLoading(false);
  }

  async function setPlayerBalance() {
    if (!pData || pNewBal === '') return;
    setBusy(true);
    try {
      await stageClient.functions.invoke('adminEconomyControl', {
        action: 'set_player_balance', player_id: pData.player.id,
        balance: Number(pNewBal), reason: pReason || undefined,
      });
      flash('success', 'Player balance updated ✓');
      lookupPlayer();
    } catch (err) { flash('error', err?.message || 'Failed'); }
    setBusy(false);
  }

  async function addPlayerTx() {
    if (!pData || !pTxAmt) return;
    setBusy(true);
    try {
      await stageClient.functions.invoke('adminEconomyControl', {
        action: 'add_player_tx', player_id: pData.player.id,
        amount: Number(pTxAmt), category: pTxCat,
        description: pTxDesc || undefined, reason: pReason || undefined,
      });
      flash('success', 'Transaction added ✓');
      setPTxAmt(''); setPTxDesc('');
      lookupPlayer();
    } catch (err) { flash('error', err?.message || 'Failed'); }
    setBusy(false);
  }

  // ── Club Finance state ────────────────────────────────────────────────────
  const [cLookup, setCLookup]   = useState('');
  const [cData, setCData]       = useState(null);
  const [cLoading, setCLoading] = useState(false);
  const [cNewBal, setCNewBal]   = useState('');
  const [cTransfer, setCTransfer] = useState('');
  const [cWage, setCWage]       = useState('');
  const [cTxAmt, setCTxAmt]     = useState('');
  const [cTxCat, setCTxCat]     = useState('admin_correction');
  const [cTxDesc, setCTxDesc]   = useState('');
  const [cReason, setCReason]   = useState('');
  const [compAmt, setCompAmt]   = useState('');
  const [compDesc, setCompDesc] = useState('');

  async function lookupClub() {
    if (!cLookup.trim()) return;
    setCLoading(true);
    setCData(null);
    try {
      const res = await stageClient.functions.invoke('adminEconomyControl', {
        action: 'get_club_finance', club_id: cLookup,
      });
      setCData(res?.data);
      setCNewBal(String(Number(res?.data?.club?.stc || 0)));
      setCTransfer(String(Number(res?.data?.club?.transfer_budget_stc || 0)));
      setCWage(String(Number(res?.data?.club?.wage_budget_stc || 0)));
    } catch (err) { flash('error', err?.message || 'Club not found'); }
    setCLoading(false);
  }

  async function setClubFinance() {
    if (!cData) return;
    setBusy(true);
    try {
      await stageClient.functions.invoke('adminEconomyControl', {
        action: 'set_club_finance', club_id: cData.club.id,
        balance: cNewBal !== '' ? Number(cNewBal) : undefined,
        transfer_budget: cTransfer !== '' ? Number(cTransfer) : undefined,
        wage_budget: cWage !== '' ? Number(cWage) : undefined,
        reason: cReason || undefined,
      });
      flash('success', 'Club finances updated ✓');
      lookupClub();
    } catch (err) { flash('error', err?.message || 'Failed'); }
    setBusy(false);
  }

  async function addClubTx() {
    if (!cData || !cTxAmt) return;
    setBusy(true);
    try {
      await stageClient.functions.invoke('adminEconomyControl', {
        action: 'add_club_tx', club_id: cData.club.id,
        amount: Number(cTxAmt), category: cTxCat,
        description: cTxDesc || undefined, reason: cReason || undefined,
      });
      flash('success', 'Transaction added ✓');
      setCTxAmt(''); setCTxDesc('');
      lookupClub();
    } catch (err) { flash('error', err?.message || 'Failed'); }
    setBusy(false);
  }

  async function distributeCompReward() {
    if (!cData || !compAmt) return;
    setBusy(true);
    try {
      await stageClient.functions.invoke('adminEconomyControl', {
        action: 'distribute_competition_reward', club_id: cData.club.id,
        amount: Number(compAmt), description: compDesc || undefined,
      });
      flash('success', 'Competition reward distributed ✓');
      setCompAmt(''); setCompDesc('');
      lookupClub();
    } catch (err) { flash('error', err?.message || 'Failed'); }
    setBusy(false);
  }

  // ── Transaction Search state ──────────────────────────────────────────────
  const [txMode, setTxMode]     = useState('player'); // player | club
  const [txPId, setTxPId]       = useState('');
  const [txPEmail, setTxPEmail] = useState('');
  const [txCId, setTxCId]       = useState('');
  const [txCat, setTxCat]       = useState('');
  const [txFrom, setTxFrom]     = useState('');
  const [txTo, setTxTo]         = useState('');
  const [txMin, setTxMin]       = useState('');
  const [txMax, setTxMax]       = useState('');
  const [txLimit, setTxLimit]   = useState('100');
  const [txResults, setTxResults] = useState(null);
  const [txLoading, setTxLoading] = useState(false);

  async function searchTxs() {
    setTxLoading(true);
    try {
      const payload = {
        action: txMode === 'player' ? 'search_player_txs' : 'search_club_txs',
        ...(txMode === 'player' ? { player_id: txPId || undefined, player_email: txPEmail || undefined } : { club_id: txCId || undefined }),
        category: txCat || undefined,
        date_from: txFrom || undefined,
        date_to: txTo || undefined,
        min_amount: txMin !== '' ? Number(txMin) : undefined,
        max_amount: txMax !== '' ? Number(txMax) : undefined,
        limit: Number(txLimit) || 100,
      };
      const res = await stageClient.functions.invoke('adminEconomyControl', payload);
      setTxResults(res?.data?.transactions || []);
    } catch (err) { flash('error', err?.message || 'Search failed'); }
    setTxLoading(false);
  }

  // ── Audit Log state ───────────────────────────────────────────────────────
  const [auditLog, setAuditLog] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState('');

  async function loadAuditLog() {
    setAuditLoading(true);
    try {
      const res = await stageClient.functions.invoke('adminEconomyControl', {
        action: 'get_audit_log', limit: 200,
        entity_type: auditFilter || undefined,
      });
      setAuditLog(res?.data?.log || []);
    } catch (err) { flash('error', err?.message || 'Failed'); }
    setAuditLoading(false);
  }

  const SECTION_TABS = [
    { id: 'health', label: 'Health', icon: Activity },
    { id: 'player', label: 'Player', icon: Wallet },
    { id: 'club',   label: 'Club',   icon: Building2 },
    { id: 'txs',    label: 'Transactions', icon: Filter },
    { id: 'audit',  label: 'Audit Log', icon: ClipboardList },
  ];

  return (
    <div className="mb-4 bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => { setOpen(o => !o); if (!open && !health) runHealthCheck(); }}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
      >
        <span className="text-xs font-bold text-foreground flex items-center gap-2">
          <DollarSign className="w-3.5 h-3.5 text-primary" /> Economy Control Centre
        </span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border">
          <div className="flex gap-1 p-3 pb-0 flex-wrap">
            {SECTION_TABS.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setSection(t.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border",
                    section === t.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}>
                  <Icon className="w-3 h-3" />{t.label}
                </button>
              );
            })}
          </div>

          <div className="p-4 space-y-4">
            {msg && (
              <p className={cn("text-xs font-medium px-3 py-2 rounded-lg border",
                msg.type === 'success' ? 'text-success bg-success/10 border-success/20'
                : msg.type === 'info'    ? 'text-primary bg-primary/10 border-primary/20'
                : 'text-destructive bg-destructive/10 border-destructive/20'
              )}>{msg.text}</p>
            )}

            {section === 'health' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Economy Health Check</p>
                  <Button size="sm" variant="ghost" onClick={runHealthCheck} disabled={healthLoading} className="text-xs gap-1 h-7">
                    <RefreshCw className={cn("w-3 h-3", healthLoading && "animate-spin")} /> {healthLoading ? 'Checking…' : 'Run Check'}
                  </Button>
                </div>

                {health && (
                  <>
                    <div className={cn("px-4 py-3 rounded-xl border text-sm font-semibold",
                      health.summary?.issues === 0
                        ? "bg-success/10 border-success/20 text-success"
                        : "bg-destructive/10 border-destructive/20 text-destructive"
                    )}>
                      {health.summary?.issues === 0
                        ? `✓ All ${health.summary.checks_run} checks passed — economy looks healthy`
                        : `⚠ ${health.summary.issues} issue${health.summary.issues !== 1 ? 's' : ''} detected across ${health.summary.checks_run} checks`}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      {[
                        { key: 'players_negative_balance', label: 'Players with negative STC', fix: null, color: 'destructive' },
                        { key: 'clubs_negative_balance',   label: 'Clubs with negative STC',   fix: null, color: 'destructive' },
                        { key: 'players_null_wallet',      label: 'Players with null wallet',   fix: () => fixNullWallets(false), fixLabel: 'Fix All', color: 'warning' },
                        { key: 'clubs_null_balance',       label: 'Clubs with null balance',    fix: fixNullClubs, fixLabel: 'Fix All', color: 'warning' },
                        { key: 'clubs_missing_transfer',   label: 'Clubs missing transfer budget', fix: fixNullClubs, fixLabel: 'Fix All', color: 'warning' },
                        { key: 'clubs_missing_wage',       label: 'Clubs missing wage budget',  fix: fixNullClubs, fixLabel: 'Fix All', color: 'warning' },
                        { key: 'wagers_stuck',             label: 'Stuck wagers (active + completed)', fix: null, color: 'destructive' },
                        { key: 'contracts_broken',         label: 'Broken contracts', fix: null, color: 'destructive' },
                      ].map(({ key, label, fix, fixLabel, color }) => {
                        const items = health[key] || [];
                        return (
                          <div key={key} className={cn(
                            "rounded-xl border p-3",
                            items.length > 0
                              ? color === 'destructive' ? "bg-destructive/5 border-destructive/20" : "bg-warning/5 border-warning/20"
                              : "bg-success/5 border-success/20"
                          )}>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">{label}</p>
                              {items.length > 0 && fix && (
                                <Button size="sm" onClick={fix} disabled={busy} className={cn("text-[10px] h-6 px-2", color === 'warning' ? "bg-warning/20 text-warning border border-warning/30" : "bg-destructive/20 text-destructive border border-destructive/30")}>
                                  {fixLabel}
                                </Button>
                              )}
                            </div>
                            <p className={cn("text-xl font-black", items.length > 0 ? (color === 'destructive' ? 'text-destructive' : 'text-warning') : 'text-success')}>
                              {items.length}
                            </p>
                            {items.length > 0 && items.length <= 5 && (
                              <div className="mt-2 space-y-0.5">
                                {items.map((it, i) => (
                                  <p key={i} className="text-[10px] text-muted-foreground truncate">
                                    {it.gamertag || it.name || it.home_club_name || it.id} {it.stc != null ? `· ${fmtStc(it.stc)} STC` : ''}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={() => fixNullWallets(true)} disabled={busy} className="text-xs bg-secondary/60 border border-border text-muted-foreground hover:text-foreground">
                        <Zap className="w-3 h-3 mr-1" /> Dry-run wallet backfill
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {section === 'player' && (
              <div className="space-y-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Player Wallet</p>

                <div className="flex gap-2">
                  <Input placeholder="Player ID or email" value={pLookup} onChange={e => setPLookup(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && lookupPlayer()} className="text-xs flex-1" />
                  <Button size="sm" onClick={lookupPlayer} disabled={pLoading || !pLookup} className="text-xs bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30">
                    {pLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                  </Button>
                </div>

                {pData && (
                  <>
                    <div className="bg-secondary/40 border border-border rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-bold text-foreground">{pData.player.gamertag}</p>
                          <p className="text-xs text-muted-foreground">{pData.player.email} · {pData.player.platform}</p>
                        </div>
                        <p className="font-black text-2xl text-success">{fmtStc(pData.player.stc)} STC</p>
                      </div>
                      {pData.contract && (
                        <p className="text-xs text-muted-foreground border-t border-border pt-2">
                          Contract: {pData.contract.club_name || pData.contract.club_id} · {fmtStc(pData.contract.weekly_salary_stc)}/wk
                        </p>
                      )}
                      {pData.lifestyle?.length > 0 && (
                        <p className="text-xs text-muted-foreground">Lifestyle assets: {pData.lifestyle.length} active item{pData.lifestyle.length !== 1 ? 's' : ''}</p>
                      )}
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Set Balance Directly</p>
                      <div className="flex gap-2 flex-wrap">
                        <Input type="number" placeholder="New balance (STC)" value={pNewBal} onChange={e => setPNewBal(e.target.value)} className="text-xs w-48" />
                        <Input placeholder="Reason (optional)" value={pReason} onChange={e => setPReason(e.target.value)} className="text-xs flex-1 min-w-[150px]" />
                        <Button size="sm" onClick={setPlayerBalance} disabled={busy || pNewBal === ''} className="text-xs bg-warning/20 text-warning border border-warning/30 hover:bg-warning/30">
                          Set Balance
                        </Button>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Add Manual Transaction</p>
                      <div className="grid sm:grid-cols-2 gap-2">
                        <Input type="number" placeholder="Amount (negative to deduct)" value={pTxAmt} onChange={e => setPTxAmt(e.target.value)} className="text-xs" />
                        <select value={pTxCat} onChange={e => setPTxCat(e.target.value)}
                          className="bg-secondary border border-border rounded px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/50">
                          {TX_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <Input placeholder="Description" value={pTxDesc} onChange={e => setPTxDesc(e.target.value)} className="text-xs sm:col-span-2" />
                      </div>
                      <Button size="sm" onClick={addPlayerTx} disabled={busy || !pTxAmt} className="mt-2 text-xs bg-success/20 text-success border border-success/30 hover:bg-success/30">
                        Add Transaction
                      </Button>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Recent Transactions</p>
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {(pData.transactions || []).map((t, i) => (
                          <div key={t.id || i} className="flex items-center gap-2 px-3 py-1.5 bg-secondary/40 rounded-lg text-xs">
                            <span className={cn("font-bold w-20 shrink-0", Number(t.amount) >= 0 ? 'text-success' : 'text-destructive')}>
                              {Number(t.amount) >= 0 ? '+' : ''}{fmtStc(t.amount)}
                            </span>
                            <span className="text-muted-foreground flex-1 truncate">{t.category || t.type} — {t.description || t.source || '—'}</span>
                            <span className="text-muted-foreground shrink-0">{fmtDate(t.created_date)}</span>
                          </div>
                        ))}
                        {!pData.transactions?.length && <p className="text-xs text-muted-foreground">No transactions.</p>}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {section === 'club' && (
              <div className="space-y-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Club Finance</p>

                <div className="flex gap-2">
                  <Input placeholder="Club ID" value={cLookup} onChange={e => setCLookup(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && lookupClub()} className="text-xs flex-1" />
                  <Button size="sm" onClick={lookupClub} disabled={cLoading || !cLookup} className="text-xs bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30">
                    {cLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                  </Button>
                </div>

                {cData && (
                  <>
                    <div className="bg-secondary/40 border border-border rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-bold text-foreground">{cData.club.name} <span className="text-muted-foreground text-xs">[{cData.club.tag}]</span></p>
                          <p className="text-xs text-muted-foreground">{cData.club.platform} · {cData.club.region}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 border-t border-border pt-3">
                        {[
                          { label: 'Balance', value: fmtStc(cData.club.stc), color: 'text-success' },
                          { label: 'Transfer Budget', value: fmtStc(cData.club.transfer_budget_stc), color: 'text-primary' },
                          { label: 'Wage Budget', value: fmtStc(cData.club.wage_budget_stc), color: 'text-warning' },
                        ].map(f => (
                          <div key={f.label}>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{f.label}</p>
                            <p className={cn("font-black text-lg", f.color)}>{f.value}</p>
                          </div>
                        ))}
                      </div>
                      {cData.contracts?.length > 0 && (
                        <p className="text-xs text-muted-foreground border-t border-border pt-2">
                          {cData.contracts.length} active contract{cData.contracts.length !== 1 ? 's' : ''} · total wages: {fmtStc(cData.contracts.reduce((s, c) => s + Number(c.weekly_salary_stc || 0), 0))}/wk
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Update Finances</p>
                      <div className="grid sm:grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-1">Balance (STC)</label>
                          <Input type="number" value={cNewBal} onChange={e => setCNewBal(e.target.value)} className="text-xs" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-1">Transfer Budget</label>
                          <Input type="number" value={cTransfer} onChange={e => setCTransfer(e.target.value)} className="text-xs" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-1">Wage Budget</label>
                          <Input type="number" value={cWage} onChange={e => setCWage(e.target.value)} className="text-xs" />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <Input placeholder="Reason (optional)" value={cReason} onChange={e => setCReason(e.target.value)} className="text-xs flex-1 min-w-[200px]" />
                        <Button size="sm" onClick={setClubFinance} disabled={busy} className="text-xs bg-warning/20 text-warning border border-warning/30 hover:bg-warning/30">
                          Save Club Finances
                        </Button>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Add Manual Transaction</p>
                      <div className="grid sm:grid-cols-2 gap-2">
                        <Input type="number" placeholder="Amount (negative to deduct)" value={cTxAmt} onChange={e => setCTxAmt(e.target.value)} className="text-xs" />
                        <select value={cTxCat} onChange={e => setCTxCat(e.target.value)}
                          className="bg-secondary border border-border rounded px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/50">
                          {TX_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <Input placeholder="Description" value={cTxDesc} onChange={e => setCTxDesc(e.target.value)} className="text-xs sm:col-span-2" />
                      </div>
                      <Button size="sm" onClick={addClubTx} disabled={busy || !cTxAmt} className="mt-2 text-xs bg-success/20 text-success border border-success/30 hover:bg-success/30">
                        Add Transaction
                      </Button>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Competition Reward</p>
                      <div className="flex gap-2 flex-wrap">
                        <Input type="number" placeholder="Reward amount (STC)" value={compAmt} onChange={e => setCompAmt(e.target.value)} className="text-xs w-48" />
                        <Input placeholder="Description" value={compDesc} onChange={e => setCompDesc(e.target.value)} className="text-xs flex-1 min-w-[150px]" />
                        <Button size="sm" onClick={distributeCompReward} disabled={busy || !compAmt} className="text-xs bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30">
                          Distribute
                        </Button>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Recent Transactions</p>
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {(cData.transactions || []).map((t, i) => (
                          <div key={t.id || i} className="flex items-center gap-2 px-3 py-1.5 bg-secondary/40 rounded-lg text-xs">
                            <span className={cn("font-bold w-20 shrink-0", Number(t.amount) >= 0 ? 'text-success' : 'text-destructive')}>
                              {Number(t.amount) >= 0 ? '+' : ''}{fmtStc(t.amount)}
                            </span>
                            <span className="text-muted-foreground flex-1 truncate">{t.category || t.type} — {t.description || '—'}</span>
                            <span className="text-muted-foreground shrink-0">{fmtDate(t.created_date)}</span>
                          </div>
                        ))}
                        {!cData.transactions?.length && <p className="text-xs text-muted-foreground">No transactions.</p>}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {section === 'txs' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Transaction Search</p>
                  <div className="flex gap-1">
                    {['player', 'club'].map(m => (
                      <button key={m} onClick={() => setTxMode(m)}
                        className={cn("px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-all",
                          txMode === m ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40")}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-2">
                  {txMode === 'player' ? (
                    <>
                      <Input placeholder="Player ID" value={txPId} onChange={e => setTxPId(e.target.value)} className="text-xs" />
                      <Input placeholder="Player Email" value={txPEmail} onChange={e => setTxPEmail(e.target.value)} className="text-xs" />
                    </>
                  ) : (
                    <Input placeholder="Club ID" value={txCId} onChange={e => setTxCId(e.target.value)} className="text-xs sm:col-span-2" />
                  )}
                  <select value={txCat} onChange={e => setTxCat(e.target.value)}
                    className="bg-secondary border border-border rounded px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/50">
                    <option value="">All categories</option>
                    {TX_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <Input placeholder="Limit (max 500)" type="number" value={txLimit} onChange={e => setTxLimit(e.target.value)} className="text-xs" />
                  <Input type="datetime-local" value={txFrom} onChange={e => setTxFrom(e.target.value)} className="text-xs" title="From date" />
                  <Input type="datetime-local" value={txTo} onChange={e => setTxTo(e.target.value)} className="text-xs" title="To date" />
                  <Input type="number" placeholder="Min amount" value={txMin} onChange={e => setTxMin(e.target.value)} className="text-xs" />
                  <Input type="number" placeholder="Max amount" value={txMax} onChange={e => setTxMax(e.target.value)} className="text-xs" />
                </div>

                <Button size="sm" onClick={searchTxs} disabled={txLoading}
                  className="text-xs bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30 gap-1">
                  <Search className="w-3 h-3" /> {txLoading ? 'Searching…' : 'Search Transactions'}
                </Button>

                {txResults !== null && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-2">{txResults.length} result{txResults.length !== 1 ? 's' : ''}</p>
                    <div className="space-y-1 max-h-96 overflow-y-auto">
                      {txResults.map((t, i) => (
                        <div key={t.id || i} className="flex items-center gap-2 px-3 py-1.5 bg-secondary/40 rounded-lg text-xs">
                          <span className={cn("font-bold w-20 shrink-0", Number(t.amount) >= 0 ? 'text-success' : 'text-destructive')}>
                            {Number(t.amount) >= 0 ? '+' : ''}{fmtStc(t.amount)}
                          </span>
                          <span className="font-medium text-foreground shrink-0">{t.gamertag || t.club_name || '—'}</span>
                          <span className="text-muted-foreground truncate flex-1">{t.category || t.type} — {t.description || t.source || '—'}</span>
                          <span className="text-muted-foreground shrink-0 hidden sm:block">bal: {fmtStc(t.balance_after)}</span>
                          <span className="text-muted-foreground shrink-0">{fmtDate(t.created_date)}</span>
                        </div>
                      ))}
                      {txResults.length === 0 && <p className="text-xs text-muted-foreground">No results.</p>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {section === 'audit' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Admin Audit Log</p>
                  <div className="flex gap-2">
                    <select value={auditFilter} onChange={e => setAuditFilter(e.target.value)}
                      className="bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground outline-none">
                      <option value="">All types</option>
                      {['player','club','wager','lifestyle_purchase','system'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <Button size="sm" variant="ghost" onClick={loadAuditLog} disabled={auditLoading} className="text-xs gap-1 h-7">
                      <RefreshCw className={cn("w-3 h-3", auditLoading && "animate-spin")} /> {auditLog ? 'Refresh' : 'Load Log'}
                    </Button>
                  </div>
                </div>

                {!auditLog && !auditLoading && (
                  <p className="text-xs text-muted-foreground">Click "Load Log" to view admin audit entries.</p>
                )}
                {auditLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
                {auditLog && (
                  <div className="space-y-2 max-h-[32rem] overflow-y-auto">
                    {auditLog.map((entry, i) => (
                      <div key={entry.id || i} className="bg-secondary/40 border border-border rounded-xl p-3">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-foreground">{entry.action}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 uppercase tracking-wider">{entry.entity_type}</span>
                            {entry.entity_name && <span className="text-[10px] text-muted-foreground">{entry.entity_name}</span>}
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">{fmtDate(entry.created_date)}</span>
                        </div>
                        <div className="flex gap-4 text-[10px] text-muted-foreground flex-wrap">
                          <span>Admin: <span className="text-foreground">{entry.admin_email || entry.admin_user_id || '—'}</span></span>
                          {entry.old_value && <span>Before: <span className="text-destructive font-mono">{entry.old_value.length > 40 ? entry.old_value.slice(0, 40) + '…' : entry.old_value}</span></span>}
                          {entry.new_value && <span>After: <span className="text-success font-mono">{entry.new_value.length > 40 ? entry.new_value.slice(0, 40) + '…' : entry.new_value}</span></span>}
                          {entry.reason && <span>Reason: <span className="text-foreground italic">{entry.reason}</span></span>}
                        </div>
                      </div>
                    ))}
                    {auditLog.length === 0 && <p className="text-xs text-muted-foreground">No audit entries yet.</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

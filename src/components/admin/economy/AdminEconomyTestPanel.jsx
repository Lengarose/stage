import { useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Zap, Activity, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import TestResultBadge from "./TestResultBadge";
import { SIM_TEST_META, VERIFY_TEST_META } from "../shared/adminConstants";

export default function AdminEconomyTestPanel() {
  const [open, setOpen]             = useState(false);
  const [results, setResults]       = useState({});
  const [running, setRunning]       = useState(new Set());
  const [expanded, setExpanded]     = useState(new Set());
  const [msg, setMsg]               = useState(null);

  function flash(type, text) { setMsg({ type, text }); setTimeout(() => setMsg(null), 4000); }
  function setResult(name, r) { setResults(p => ({ ...p, [name]: r })); }
  function startTest(name)    { setRunning(p => { const s = new Set(p); s.add(name);    return s; }); }
  function endTest(name)      { setRunning(p => { const s = new Set(p); s.delete(name); return s; }); }
  function toggleExpand(name) { setExpanded(p => { const s = new Set(p); s.has(name) ? s.delete(name) : s.add(name); return s; }); }
  const anyRunning = running.size > 0;

  async function runSingle(testName) {
    startTest(testName);
    try {
      const res = await stageClient.functions.invoke('economyTests', { action: 'run_test', test_name: testName });
      const r = res?.data?.result;
      setResult(testName, r);
      if (r?.status === 'fail' || r?.status === 'error') setExpanded(p => new Set(p).add(testName));
    } catch (err) {
      setResult(testName, { name: testName, status: 'error', message: err?.message || 'Network error', assertions: [] });
    }
    endTest(testName);
  }

  async function runSuite(suite) {
    const tests = suite === 'sim' ? SIM_TEST_META : suite === 'verify' ? VERIFY_TEST_META : [...SIM_TEST_META, ...VERIFY_TEST_META];
    for (const t of tests) await runSingle(t.name);
    flash('success', `${suite === 'sim' ? 'Simulation' : suite === 'verify' ? 'Verification' : 'Full'} suite complete.`);
  }

  function suiteStats(tests) {
    const pass = tests.filter(t => results[t.name]?.status === 'pass').length;
    const fail = tests.filter(t => ['fail','error'].includes(results[t.name]?.status)).length;
    const warn = tests.filter(t => results[t.name]?.status === 'warn').length;
    return { pass, fail, warn };
  }

  function TestCard({ test }) {
    const r = results[test.name];
    const isRunning = running.has(test.name);
    const isExpanded = expanded.has(test.name);
    return (
      <div className={cn('border rounded-xl p-3 transition-all',
        r?.status === 'pass'  ? 'bg-success/5 border-success/20'
        : (r?.status === 'fail' || r?.status === 'error') ? 'bg-destructive/5 border-destructive/20'
        : r?.status === 'warn' ? 'bg-warning/5 border-warning/20'
        : 'bg-secondary/30 border-border'
      )}>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              {isRunning
                ? <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                : r ? <TestResultBadge status={r.status} /> : null}
              <p className="text-xs font-bold text-foreground">{test.name.replace(/_/g,' ')}</p>
              {r?.duration_ms && <span className="text-[9px] text-muted-foreground">{r.duration_ms}ms</span>}
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">{test.description}</p>
            {r?.message && r.status !== 'pass' && (
              <p className={cn('text-[10px] mt-1 font-medium', r.status === 'warn' ? 'text-warning' : 'text-destructive')}>{r.message}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
            {r?.assertions?.length > 0 && (
              <button onClick={() => toggleExpand(test.name)} className="text-[10px] text-primary hover:underline">
                {isExpanded ? 'hide' : 'details'}
              </button>
            )}
            <Button size="sm" onClick={() => runSingle(test.name)} disabled={isRunning || anyRunning}
              className="text-[10px] h-6 px-2 bg-secondary border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground">
              {isRunning ? '…' : 'Run'}
            </Button>
          </div>
        </div>
        {isExpanded && r?.assertions?.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/50 space-y-0.5">
            {r.assertions.map((a, i) => (
              <p key={i} className={cn('text-[10px]',
                a.startsWith('✓') ? 'text-success'
                : a.startsWith('⚠') ? 'text-warning'
                : 'text-destructive')}>
                {a}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  const simStats    = suiteStats(SIM_TEST_META);
  const verifyStats = suiteStats(VERIFY_TEST_META);

  return (
    <div className="mb-4 bg-card border border-border rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors">
        <span className="text-xs font-bold text-foreground flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-warning" /> Economy Test Suite
        </span>
        <div className="flex items-center gap-3">
          {(simStats.pass + verifyStats.pass) > 0 && (
            <span className="text-[10px] text-success">{simStats.pass + verifyStats.pass}/{SIM_TEST_META.length + VERIFY_TEST_META.length} pass</span>
          )}
          {(simStats.fail + verifyStats.fail) > 0 && (
            <span className="text-[10px] text-destructive">{simStats.fail + verifyStats.fail} fail</span>
          )}
          <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {open && (
        <div className="border-t border-border">
          <div className="px-4 py-2.5 bg-warning/5 border-b border-warning/15">
            <p className="text-[10px] text-warning font-medium">
              ⚠ Simulations create and immediately delete isolated test records in the real database. They are atomic and leave no trace.
              Verifications are read-only and safe to run at any time.
            </p>
          </div>

          <div className="p-4 space-y-6">
            {msg && (
              <p className={cn('text-xs font-medium px-3 py-2 rounded-lg border',
                msg.type === 'success' ? 'text-success bg-success/10 border-success/20'
                : 'text-destructive bg-destructive/10 border-destructive/20'
              )}>{msg.text}</p>
            )}

            <div>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Simulation Tests ({SIM_TEST_META.length})</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Create isolated records → run logic → verify → clean up automatically</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-success">{simStats.pass}/{SIM_TEST_META.length} pass</span>
                  {simStats.fail > 0 && <span className="text-[10px] text-destructive">{simStats.fail} fail</span>}
                  {simStats.warn > 0 && <span className="text-[10px] text-warning">{simStats.warn} warn</span>}
                  <Button size="sm" onClick={() => runSuite('sim')} disabled={anyRunning}
                    className="text-[10px] h-7 px-2 bg-warning/20 text-warning border border-warning/30 hover:bg-warning/30 gap-1">
                    <Zap className="w-2.5 h-2.5" /> {anyRunning ? `Running…` : 'Run Sims'}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {SIM_TEST_META.map(t => <TestCard key={t.name} test={t} />)}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Verification Tests ({VERIFY_TEST_META.length})</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Read-only checks against live data — safe to run anytime</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-success">{verifyStats.pass}/{VERIFY_TEST_META.length} pass</span>
                  {verifyStats.fail > 0 && <span className="text-[10px] text-destructive">{verifyStats.fail} fail</span>}
                  {verifyStats.warn > 0 && <span className="text-[10px] text-warning">{verifyStats.warn} warn</span>}
                  <Button size="sm" onClick={() => runSuite('verify')} disabled={anyRunning}
                    className="text-[10px] h-7 px-2 bg-success/20 text-success border border-success/30 hover:bg-success/30 gap-1">
                    <Activity className="w-2.5 h-2.5" /> {anyRunning ? `Running…` : 'Run Checks'}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {VERIFY_TEST_META.map(t => <TestCard key={t.name} test={t} />)}
              </div>
            </div>

            <Button onClick={() => runSuite('all')} disabled={anyRunning}
              className="w-full gap-2 text-xs bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30">
              <Zap className="w-3.5 h-3.5" />
              {anyRunning ? `Running (${running.size} active)…` : `Run Full Test Suite (${SIM_TEST_META.length + VERIFY_TEST_META.length} tests)`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

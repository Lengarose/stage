import { useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Coins, RefreshCw, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminWagersPanel() {
  const [open, setOpen]       = useState(false);
  const [wagers, setWagers]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy]       = useState(null);
  const [msg, setMsg]         = useState(null);
  const [settleDialog, setSettleDialog] = useState(null);
  const [settleWinner, setSettleWinner] = useState('home');
  const [settleNote, setSettleNote]     = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await stageClient.functions.invoke('wagerManagement', { action: 'get_all' });
      setWagers(res?.data?.wagers || []);
    } catch (err) { setMsg({ type: 'error', text: err?.message || 'Failed to load' }); }
    setLoading(false);
  }

  async function cancelAndRefund(matchId) {
    setBusy(matchId + '_cancel');
    try {
      await stageClient.functions.invoke('wagerManagement', { action: 'cancel_and_refund', match_id: matchId });
      setMsg({ type: 'success', text: 'Wager cancelled and refunded ✓' });
      load();
    } catch (err) { setMsg({ type: 'error', text: err?.message || 'Failed' }); }
    setBusy(null);
  }

  async function forceSettle() {
    if (!settleDialog) return;
    setBusy(settleDialog.match.id + '_settle');
    try {
      await stageClient.functions.invoke('wagerManagement', {
        action: 'force_settle', match_id: settleDialog.match.id,
        winner: settleWinner, note: settleNote || undefined,
      });
      setMsg({ type: 'success', text: 'Wager force-settled ✓' });
      setSettleDialog(null);
      setSettleNote('');
      load();
    } catch (err) { setMsg({ type: 'error', text: err?.message || 'Failed' }); }
    setBusy(null);
  }

  const fmt = (n) => Number(n || 0).toLocaleString();

  const STATUS_COLOR = {
    pending_acceptance: 'text-warning',
    active:             'text-success',
    settling:           'text-primary',
    settled:            'text-primary',
    refunded:           'text-muted-foreground',
    declined:           'text-destructive',
    cancelled:          'text-destructive',
  };

  return (
    <div className="mb-4 bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => { setOpen(o => !o); if (!open && !wagers) load(); }}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
      >
        <span className="text-xs font-bold text-foreground flex items-center gap-2">
          <Coins className="w-3.5 h-3.5 text-warning" /> Wager Management
        </span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-4">
          {msg && (
            <p className={cn("text-xs font-medium", msg.type === 'success' ? 'text-success' : 'text-destructive')}>{msg.text}</p>
          )}

          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">All Wagers</p>
            <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="text-xs gap-1 h-7">
              <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} /> Refresh
            </Button>
          </div>

          {loading && !wagers ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : !wagers?.length ? (
            <p className="text-xs text-muted-foreground">No wagers found.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {wagers.map(w => {
                const homeName = w.mode === 'club' ? w.home_club_name : w.home_player_name;
                const awayName = w.mode === 'club' ? w.away_club_name : w.away_player_name;
                const modeLabel = w.mode === 'club' ? 'Club' : 'Player';
                const isBusy = busy?.startsWith(w.id);
                const canAct = w.wager_status === 'active' || w.wager_status === 'settling';
                return (
                  <div key={w.id} className="bg-secondary/40 border border-border rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-foreground truncate">{homeName} vs {awayName}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 uppercase tracking-wider shrink-0">{modeLabel}</span>
                          <span className={cn("text-[9px] font-bold uppercase tracking-wider shrink-0", STATUS_COLOR[w.wager_status] || 'text-muted-foreground')}>
                            {w.wager_status || '—'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                          <span className="text-warning font-semibold">{fmt(w.wager_stc)} STC each</span>
                          <span>Pot: {fmt(Number(w.wager_stc) * 2)} STC</span>
                          {w.home_score != null && <span>Score: {w.home_score}–{w.away_score}</span>}
                          {w.scheduled_date && <span>{new Date(w.scheduled_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                          <span>{w.wager_home_locked ? '🔒 Home locked' : '⚠ Home unlocked'}</span>
                          <span>{w.wager_away_locked ? '🔒 Away locked' : '⚠ Away unlocked'}</span>
                        </div>
                      </div>
                      {canAct && (
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button
                            size="sm"
                            onClick={() => { setSettleDialog({ match: w }); setSettleWinner('home'); setSettleNote(''); }}
                            disabled={isBusy}
                            className="text-[10px] h-7 px-2 bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30"
                          >
                            Force Settle
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => cancelAndRefund(w.id)}
                            disabled={isBusy}
                            className="text-[10px] h-7 px-2 bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20"
                          >
                            {isBusy === w.id + '_cancel' ? 'Refunding…' : 'Cancel & Refund'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {settleDialog && (
            <div className="border border-primary/30 bg-primary/5 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-primary">Force Settle Wager</p>
              <p className="text-[10px] text-muted-foreground">
                {settleDialog.match.mode === 'club'
                  ? `${settleDialog.match.home_club_name} vs ${settleDialog.match.away_club_name}`
                  : `${settleDialog.match.home_player_name} vs ${settleDialog.match.away_player_name}`}
                {' — '}{fmt(settleDialog.match.wager_stc)} STC each (pot: {fmt(Number(settleDialog.match.wager_stc) * 2)} STC)
              </p>
              <div className="flex gap-2">
                {['home', 'away', 'draw'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setSettleWinner(opt)}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all",
                      settleWinner === opt
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    {opt === 'home'
                      ? (settleDialog.match.mode === 'club' ? settleDialog.match.home_club_name : settleDialog.match.home_player_name) || 'Home'
                      : opt === 'away'
                      ? (settleDialog.match.mode === 'club' ? settleDialog.match.away_club_name : settleDialog.match.away_player_name) || 'Away'
                      : 'Draw'}
                  </button>
                ))}
              </div>
              <Input
                placeholder="Admin note (optional)"
                value={settleNote}
                onChange={e => setSettleNote(e.target.value)}
                className="text-xs"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={forceSettle} disabled={!!busy}
                  className="flex-1 bg-primary text-primary-foreground text-xs">
                  {busy ? 'Settling…' : 'Confirm Settle'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSettleDialog(null)} className="text-xs">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

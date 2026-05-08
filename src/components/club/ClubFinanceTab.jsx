import { useState, useEffect, useCallback } from "react";
import { stageClient } from "@/api/stageClient";
import { formatSTC, calculatePlayerValue } from "@/lib/playerValue";
import { cn } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Wallet, Users, Trophy, Coins,
  AlertTriangle, ChevronLeft, ChevronRight, SlidersHorizontal,
  RefreshCw, DollarSign, Zap, Gift, ArrowLeftRight, Ticket, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Category metadata ──────────────────────────────────────────────────────
const TX_CATEGORIES = {
  ticket_revenue:  { label: "Ticket Revenue",  color: "text-success",      bg: "bg-success/10",      border: "border-success/20",      icon: Ticket },
  stadium_upgrade: { label: "Stadium Upgrade", color: "text-warning",      bg: "bg-warning/10",      border: "border-warning/20",      icon: Building2 },
  salary:          { label: "Salary",          color: "text-destructive",  bg: "bg-destructive/10",  border: "border-destructive/20",  icon: Users },
  wager_win:       { label: "Wager Win",        color: "text-success",      bg: "bg-success/10",      border: "border-success/20",      icon: Trophy },
  wager_loss:      { label: "Wager Loss",       color: "text-destructive",  bg: "bg-destructive/10",  border: "border-destructive/20",  icon: TrendingDown },
  wager_refund:    { label: "Wager Refund",     color: "text-warning",      bg: "bg-warning/10",      border: "border-warning/20",      icon: RefreshCw },
  wager_stake:     { label: "Wager Stake",      color: "text-warning",      bg: "bg-warning/10",      border: "border-warning/20",      icon: ArrowLeftRight },
  comp_reward:     { label: "Competition",      color: "text-primary",      bg: "bg-primary/10",      border: "border-primary/20",      icon: Gift },
  adjustment:      { label: "Adjustment",       color: "text-muted-foreground", bg: "bg-secondary", border: "border-border",           icon: SlidersHorizontal },
  admin_adjustment:{ label: "Admin Adj.",       color: "text-muted-foreground", bg: "bg-secondary", border: "border-border",           icon: SlidersHorizontal },
};

function getCategoryMeta(tx) {
  const key = tx.category || tx.type || "";
  return TX_CATEGORIES[key] || {
    label: key || "Transaction",
    color: tx.amount >= 0 ? "text-success" : "text-destructive",
    bg:    tx.amount >= 0 ? "bg-success/10"  : "bg-destructive/10",
    border:tx.amount >= 0 ? "border-success/20" : "border-destructive/20",
    icon:  tx.amount >= 0 ? TrendingUp : TrendingDown,
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("w-3.5 h-3.5", color)} />
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      </div>
      <p className={cn("font-light text-xl tracking-tight leading-none", color)}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Budget Slider ──────────────────────────────────────────────────────────
function BudgetSlider({ transferBudget, wageBudget, weeklyWages, onSave, saving }) {
  const total = transferBudget + wageBudget;
  const [sliderVal, setSliderVal] = useState(transferBudget);
  const [open, setOpen] = useState(false);

  useEffect(() => { setSliderVal(transferBudget); }, [transferBudget]);

  const newTransfer = Math.round(sliderVal / 100_000) * 100_000;
  const newWage     = total - newTransfer;
  const wageUsedPct = newWage > 0 ? Math.min(100, (weeklyWages / newWage) * 100) : 0;
  const canSave = (newTransfer !== transferBudget || newWage !== wageBudget) && newWage >= weeklyWages;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between px-4 py-3 bg-card border border-border rounded-xl hover:border-primary/40 transition-colors group"
      >
        <span className="text-xs text-muted-foreground flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 group-hover:text-primary transition-colors" />
          Adjust Budget Allocation
        </span>
        <span className="text-[10px] text-primary font-medium">Manage →</span>
      </button>
    );
  }

  return (
    <div className="bg-card border border-primary/30 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-foreground flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-primary" /> Budget Allocation
        </p>
        <button onClick={() => setOpen(false)} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Close</button>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Total controllable budget: <span className="font-medium text-foreground">{formatSTC(total)}</span>. Moving funds from one budget reduces the other.
      </p>

      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-primary font-medium">Transfer: {formatSTC(newTransfer)}</span>
          <span className="text-warning font-medium">Wages: {formatSTC(newWage)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={total}
          step={100_000}
          value={sliderVal}
          onChange={e => setSliderVal(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>0 STC → transfers</span>
          <span>wages → {formatSTC(total)}</span>
        </div>
      </div>

      {newWage < weeklyWages && (
        <p className="text-xs text-destructive flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Wage budget can't drop below committed wages ({formatSTC(weeklyWages)}/wk)
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className={cn("rounded-lg p-2 text-center border", wageUsedPct > 90 ? "bg-destructive/10 border-destructive/30" : "bg-secondary border-border")}>
          <p className="text-muted-foreground text-[10px] mb-0.5">Wage Usage</p>
          <p className={cn("font-bold", wageUsedPct > 90 ? "text-destructive" : wageUsedPct > 70 ? "text-warning" : "text-success")}>
            {wageUsedPct.toFixed(0)}%
          </p>
        </div>
        <Button
          size="sm"
          disabled={!canSave || saving}
          onClick={() => onSave(newTransfer, newWage).then(() => setOpen(false))}
          className="h-full text-xs bg-primary/20 text-primary hover:bg-primary/30 border border-primary/40"
        >
          {saving ? "Saving…" : "Apply Changes"}
        </Button>
      </div>
    </div>
  );
}

// ── Transaction Row ────────────────────────────────────────────────────────
function TxRow({ tx, isAdmin, onDelete }) {
  const meta = getCategoryMeta(tx);
  const Icon = meta.icon;
  const isPos = tx.amount >= 0;
  return (
    <div className={cn("border rounded-xl px-4 py-2.5 flex items-center gap-3", meta.bg, meta.border)}>
      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border", meta.border)}>
        <Icon className={cn("w-3.5 h-3.5", meta.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{tx.description || meta.label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md border font-medium", meta.bg, meta.border, meta.color)}>{meta.label}</span>
          <span className="text-[10px] text-muted-foreground">
            {new Date(tx.created_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
          </span>
          {tx.balance_after != null && (
            <span className="text-[10px] text-muted-foreground">→ {formatSTC(tx.balance_after)}</span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <span className={cn("font-medium text-sm", isPos ? "text-success" : "text-destructive")}>
          {isPos ? "+" : ""}{formatSTC(tx.amount)}
        </span>
        {isAdmin && (
          <button
            onClick={() => onDelete(tx.id)}
            className="block text-[10px] text-muted-foreground hover:text-destructive mt-0.5 transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
const CATEGORY_FILTERS = [
  { key: "all",             label: "All" },
  { key: "ticket_revenue",  label: "Tickets" },
  { key: "stadium_upgrade", label: "Stadium" },
  { key: "salary",          label: "Salary" },
  { key: "wager_win",       label: "Wager Win" },
  { key: "wager_loss",      label: "Wager Loss" },
  { key: "wager_refund",    label: "Refund" },
  { key: "comp_reward",     label: "Competition" },
  { key: "adjustment",      label: "Adjustment" },
];

export default function ClubFinanceTab({ club, isAdmin = false }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [catFilter, setCatFilter] = useState("all");
  const [sliderSaving, setSliderSaving] = useState(false);

  const load = useCallback(async () => {
    if (!club?.id) return;
    setLoading(true);
    try {
      const [contracts, allTx, squadPlayers] = await Promise.all([
        stageClient.entities.PlayerContract.filter({ team_id: club.id, status: "active" }, null, 200),
        stageClient.entities.STCTransaction.filter({ club_id: club.id }, "-created_date", 500),
        stageClient.entities.Player.filter({ club_id: club.id }, null, 100),
      ]);

      const weeklyWages  = (contracts || []).reduce((s, c) => s + Number(c.weekly_salary_stc || 0), 0);
      const thirtyAgo    = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recent       = (allTx || []).filter(t => new Date(t.created_date).getTime() >= thirtyAgo);
      const income_30d   = recent.filter(t => t.amount > 0).reduce((s, t) => s + Number(t.amount), 0);
      const expenses_30d = recent.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
      const squadValue   = (squadPlayers || []).reduce((s, p) => s + calculatePlayerValue(p), 0);

      setData({
        balance:          Number(club.stc || 0),
        transfer_budget:  Number(club.transfer_budget_stc || 0),
        wage_budget:      Number(club.wage_budget_stc || 0),
        weekly_wages:     weeklyWages,
        contracts:        contracts || [],
        allTransactions:  allTx || [],
        squadPlayers:     squadPlayers || [],
        squad_value:      squadValue,
        income_30d,
        expenses_30d,
      });
    } catch (err) {
      console.error("[ClubFinanceTab] load failed:", err);
      setData(null);
    }
    setLoading(false);
  }, [club?.id, club?.stc, club?.transfer_budget_stc, club?.wage_budget_stc]);

  useEffect(() => { load(); }, [load]);

  async function handleAdjustBudgets(transfer, wage) {
    setSliderSaving(true);
    try {
      await stageClient.functions.invoke("clubFinance", {
        action: "adjust_budgets",
        club_id: club.id,
        transfer_budget: transfer,
        wage_budget: wage,
      });
      await load();
    } catch (err) {
      alert(err?.message || "Failed to adjust budgets");
    }
    setSliderSaving(false);
  }

  async function handleDeleteTx(txId) {
    if (!confirm("Delete this transaction? This cannot be undone.")) return;
    try {
      await stageClient.functions.invoke("clubFinance", {
        action: "delete_transaction", club_id: club.id, transaction_id: txId,
      });
      await load();
    } catch (err) {
      alert(err?.message || "Failed");
    }
  }

  if (loading && !data) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!data) return (
    <div className="text-center py-12 text-sm text-muted-foreground">
      Could not load finance data.
    </div>
  );

  const {
    balance, transfer_budget, wage_budget, weekly_wages,
    contracts, allTransactions, squad_value, income_30d, expenses_30d,
  } = data;

  const net30 = income_30d - expenses_30d;
  const wageUsedPct = wage_budget > 0 ? Math.min(100, (weekly_wages / wage_budget) * 100) : 0;

  const filteredTx = catFilter === "all"
    ? allTransactions
    : allTransactions.filter(tx => (tx.category || tx.type || "") === catFilter);
  const PAGE_SIZE  = 25;
  const totalPages = Math.ceil(filteredTx.length / PAGE_SIZE) || 1;
  const visibleTx  = filteredTx.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-5">

      {/* Balance + Budget Cards */}
      <div className="grid grid-cols-2 gap-2.5">
        <StatCard icon={Wallet}  label="Club Balance"     value={formatSTC(balance)}          color="text-success"  sub="Available funds" />
        <StatCard icon={TrendingUp} label="Squad Value"   value={formatSTC(squad_value || 0)} color="text-purple-400" sub="Combined player value" />
        <StatCard icon={Users}   label="Wage Budget"      value={formatSTC(wage_budget)}       color="text-warning"  sub={`${formatSTC(weekly_wages)}/wk committed`} />
        <StatCard icon={Coins}   label="Transfer Budget"  value={formatSTC(transfer_budget)}   color="text-primary"  sub="Signing funds" />
      </div>

      {/* Wage Usage Bar */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" /> Weekly Wage Bill
          </p>
          <p className={cn("text-sm font-light", wageUsedPct > 90 ? "text-destructive" : wageUsedPct > 70 ? "text-warning" : "text-success")}>
            {formatSTC(weekly_wages)} / {formatSTC(wage_budget)}
          </p>
        </div>
        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", wageUsedPct > 90 ? "bg-destructive" : wageUsedPct > 70 ? "bg-warning" : "bg-success")}
            style={{ width: `${wageUsedPct}%` }}
          />
        </div>
        {wageUsedPct > 90 && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Wage budget nearly exhausted
          </p>
        )}

        {/* Wage roll */}
        {contracts.length > 0 && (
          <div className="pt-1 space-y-1.5 border-t border-border mt-3">
            {contracts.map(c => (
              <div key={c.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{c.player_gamertag || c.contract_type} contract</span>
                <span className="font-medium text-foreground">{formatSTC(c.weekly_salary_stc || 0)}/wk</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FM-style Budget Slider */}
      <BudgetSlider
        transferBudget={transfer_budget}
        wageBudget={wage_budget}
        weeklyWages={weekly_wages}
        onSave={handleAdjustBudgets}
        saving={sliderSaving}
      />

      {/* 30-Day Summary */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-success/10 border border-success/20 rounded-xl p-3 text-center">
          <TrendingUp className="w-4 h-4 text-success mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Income (30d)</p>
          <p className="font-light text-success text-lg tracking-tight">{formatSTC(income_30d)}</p>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-center">
          <TrendingDown className="w-4 h-4 text-destructive mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Expenses (30d)</p>
          <p className="font-light text-destructive text-lg tracking-tight">{formatSTC(expenses_30d)}</p>
        </div>
        <div className={cn("border rounded-xl p-3 text-center", net30 >= 0 ? "bg-success/10 border-success/20" : "bg-destructive/10 border-destructive/20")}>
          <DollarSign className={cn("w-4 h-4 mx-auto mb-1", net30 >= 0 ? "text-success" : "text-destructive")} />
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Net (30d)</p>
          <p className={cn("font-light text-lg tracking-tight", net30 >= 0 ? "text-success" : "text-destructive")}>
            {net30 >= 0 ? "+" : ""}{formatSTC(net30)}
          </p>
        </div>
      </div>

      {/* Transaction History */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Transaction History
            {allTransactions.length > 0 && <span className="ml-2 text-muted-foreground font-normal">({allTransactions.length})</span>}
          </h4>
          <button onClick={() => load()} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => { setCatFilter(f.key); setPage(1); }}
              className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors",
                catFilter === f.key
                  ? "bg-primary/20 text-primary border-primary/40"
                  : "bg-secondary text-muted-foreground border-transparent hover:border-border"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {visibleTx.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No transactions found.</p>
        ) : (
          <div className="space-y-2">
            {visibleTx.map(tx => (
              <TxRow key={tx.id} tx={tx} isAdmin={isAdmin} onDelete={handleDeleteTx} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => { setPage(p => Math.max(1, p - 1)); }}
              disabled={page === 1 || loading}
              className="p-1.5 rounded-lg bg-secondary hover:bg-muted disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
            <button
              onClick={() => { setPage(p => Math.min(totalPages, p + 1)); }}
              disabled={page === totalPages || loading}
              className="p-1.5 rounded-lg bg-secondary hover:bg-muted disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

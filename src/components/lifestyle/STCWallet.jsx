import { useState, useEffect, useCallback } from "react";
import { stageClient } from "@/api/stageClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Coins, TrendingUp, TrendingDown, Zap, Wallet, Calendar,
  ShoppingBag, Dumbbell, Building2, Trophy, Shield, RefreshCw,
  ChevronDown, Briefcase, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

const CATEGORY_META = {
  initial_grant:            { label: "Welcome Bonus",       icon: Coins,       color: "text-success",     bg: "bg-success/10"     },
  salary:                   { label: "Weekly Salary",       icon: Briefcase,   color: "text-primary",    bg: "bg-primary/10"     },
  lifestyle_purchase:       { label: "Lifestyle Purchase",  icon: ShoppingBag, color: "text-destructive", bg: "bg-destructive/10" },
  lifestyle_rent:           { label: "Lifestyle Rental",    icon: Building2,   color: "text-destructive", bg: "bg-destructive/10" },
  lifestyle_passive_income: { label: "Investment Return",   icon: TrendingUp,  color: "text-accent",      bg: "bg-accent/10"      },
  wager_stake:              { label: "Wager Stake",         icon: Coins,       color: "text-warning",     bg: "bg-warning/10"     },
  wager_win:                { label: "Wager Won",           icon: Trophy,      color: "text-success",     bg: "bg-success/10"     },
  wager_loss:               { label: "Wager Lost",          icon: Zap,         color: "text-destructive", bg: "bg-destructive/10" },
  wager_refund:             { label: "Wager Refunded",      icon: Zap,         color: "text-warning",     bg: "bg-warning/10"     },
  competition_reward:       { label: "Competition Reward",  icon: Trophy,      color: "text-success",     bg: "bg-success/10"     },
  signing_bonus:            { label: "Signing Bonus",       icon: Briefcase,   color: "text-primary",     bg: "bg-primary/10"     },
  admin_credit:             { label: "Admin Credit",        icon: Coins,       color: "text-success",     bg: "bg-success/10"     },
  admin_debit:              { label: "Admin Debit",         icon: Coins,       color: "text-destructive", bg: "bg-destructive/10" },
};

function getCategoryMeta(category) {
  return CATEGORY_META[category] || { label: category || "Transaction", icon: Coins, color: "text-foreground", bg: "bg-secondary" };
}

function fmt(n) { return Number(n || 0).toLocaleString(); }

function TxRow({ tx }) {
  const meta = getCategoryMeta(tx.category);
  const Icon = meta.icon;
  const isPos = Number(tx.amount) > 0;
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", meta.bg)}>
        <Icon className={cn("w-4 h-4", meta.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">{tx.description || meta.label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn("text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded", meta.bg, meta.color)}>{meta.label}</span>
          {tx.source && <span className="text-[10px] text-muted-foreground truncate">{tx.source}</span>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className={cn("font-heading font-black text-sm", isPos ? "text-success" : "text-destructive")}>
          {isPos ? "+" : ""}{fmt(tx.amount)}
        </p>
        <p className="text-[9px] text-muted-foreground">
          {new Date(tx.created_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
        </p>
      </div>
    </div>
  );
}

export default function STCWallet({ player: initialPlayer, compact = false }) {
  const [data, setData]         = useState(null);
  const [txFilter, setTxFilter] = useState("all"); // all | income | expense
  const [loading, setLoading]   = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [page, setPage]         = useState(1);
  const [allTx, setAllTx]       = useState([]);
  const [totalTx, setTotalTx]   = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadBalance = useCallback(async () => {
    try {
      const res = await stageClient.functions.invoke("playerWallet", { action: "get_balance" });
      setData(res?.data || null);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  const loadHistory = useCallback(async (pageNum = 1, append = false) => {
    if (append) setLoadingMore(true);
    try {
      const res = await stageClient.functions.invoke("playerWallet", { action: "get_history", page: pageNum, limit: 20 });
      const txs = res?.data?.transactions || [];
      setTotalTx(res?.data?.total || 0);
      setAllTx(prev => append ? [...prev, ...txs] : txs);
      setPage(pageNum);
    } catch { /* silent */ }
    setLoadingMore(false);
  }, []);

  useEffect(() => {
    loadBalance();
    loadHistory(1);
  }, [loadBalance, loadHistory]);

  async function collectPassive() {
    setCollecting(true);
    try {
      const res = await stageClient.functions.invoke("collectPassiveIncome", {});
      if ((res?.data?.collected || 0) > 0) {
        await loadBalance();
        await loadHistory(1);
      }
    } catch { /* silent */ }
    setCollecting(false);
  }

  async function collectSalary() {
    setCollecting(true);
    try {
      await stageClient.functions.invoke("playerWallet", { action: "pay_salary" });
      await loadBalance();
      await loadHistory(1);
    } catch { /* silent */ }
    setCollecting(false);
  }

  const balance    = data?.balance ?? (initialPlayer?.stc || 0);
  const contract   = data?.contract;
  const salary     = Number(data?.weekly_salary || 0);
  const nextDays   = data?.next_salary_days;
  const summary    = data?.summary || [];

  const totalIncome  = summary.filter(s => s.type === "income").reduce((a, s) => a + Number(s.total || 0), 0);
  const totalExpense = summary.filter(s => s.type === "expense").reduce((a, s) => a + Math.abs(Number(s.total || 0)), 0);

  const filteredTx = txFilter === "all" ? allTx
    : txFilter === "income"  ? allTx.filter(t => Number(t.amount) > 0)
    : allTx.filter(t => Number(t.amount) < 0);

  const hasPassiveItems = true; // allow collect attempt always (server returns 0 if nothing)
  const salaryDue = salary > 0 && (nextDays === 0 || nextDays === null);
  const salaryDueText = nextDays > 0 ? `In ${nextDays} day${nextDays !== 1 ? "s" : ""}` : "Due now";

  if (loading) {
    return <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* ── Balance card ── */}
      <div className="relative overflow-hidden rounded-2xl border border-success/20 bg-gradient-to-br from-success/8 via-card to-primary/8 p-6">
        <div className="absolute top-0 right-0 w-48 h-48 opacity-5">
          <Wallet className="w-full h-full" />
        </div>
        <div className="flex items-start justify-between gap-4 relative">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">STC Balance</p>
            <p className="font-heading font-black text-5xl text-success leading-none">{fmt(balance)}</p>
            <p className="text-xs text-muted-foreground mt-1.5">Stage Coin</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-success/15 flex items-center justify-center shrink-0">
            <Coins className="w-7 h-7 text-success" />
          </div>
        </div>

        {/* Income / Expense stats (30 day) */}
        <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-border/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-success/15 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-success" />
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">30d Income</p>
              <p className="text-sm font-bold text-success">+{fmt(totalIncome)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-destructive/15 flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">30d Spent</p>
              <p className="text-sm font-bold text-destructive">-{fmt(totalExpense)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Income sources ── */}
      {!compact && (salary > 0 || hasPassiveItems) && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-secondary/30">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Income Sources</p>
          </div>
          <div className="divide-y divide-border/50">
            {salary > 0 && (
              <div className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Briefcase className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Weekly Salary</p>
                    <p className="text-[10px] text-muted-foreground">
                      {contract?.team_id ? "From club contract" : "No club"} · {salaryDueText}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <p className="font-heading font-black text-sm text-primary">+{fmt(salary)}</p>
                  {salaryDue && (
                    <Button size="sm" onClick={collectSalary} disabled={collecting}
                      className="h-7 px-3 text-xs bg-primary text-primary-foreground gap-1">
                      {collecting ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <><Coins className="w-3 h-3" />Collect</>}
                    </Button>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Investment Returns</p>
                  <p className="text-[10px] text-muted-foreground">Passive income from lifestyle assets</p>
                </div>
              </div>
              <Button size="sm" onClick={collectPassive} disabled={collecting}
                className="h-7 px-3 text-xs bg-accent/20 text-accent hover:bg-accent/30 border-0 gap-1 shrink-0">
                {collecting ? <div className="w-3 h-3 border border-accent/30 border-t-accent rounded-full animate-spin" /> : <><RefreshCw className="w-3 h-3" />Collect</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Transaction history ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Transaction History</p>
          <span className="text-[9px] text-muted-foreground">{totalTx} total</span>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-0 border-b border-border">
          {[["all", "All"], ["income", "Income"], ["expense", "Expenses"]].map(([val, lbl]) => (
            <button key={val} onClick={() => setTxFilter(val)}
              className={cn("flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors",
                txFilter === val ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground")}>
              {lbl}
            </button>
          ))}
        </div>

        {filteredTx.length === 0 ? (
          <div className="py-12 text-center">
            <Coins className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No transactions yet</p>
          </div>
        ) : (
          <>
            <div>
              {filteredTx.map(tx => <TxRow key={tx.id} tx={tx} />)}
            </div>
            {allTx.length < totalTx && (
              <div className="p-3 border-t border-border">
                <Button variant="ghost" size="sm" onClick={() => loadHistory(page + 1, true)} disabled={loadingMore}
                  className="w-full text-xs text-muted-foreground gap-1.5">
                  {loadingMore ? <div className="w-3 h-3 border border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Earn guide (only in full mode) ── */}
      {!compact && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <p className="text-xs font-bold text-foreground uppercase tracking-wider">How to earn STC</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {[
              { label: "Weekly Salary",       val: "Per contract",    color: "text-primary",  desc: "Collect from your active contract" },
              { label: "Wager Win",           val: "Wager × 2",       color: "text-success",  desc: "Win a wagered PvP match" },
              { label: "Investment Income",   val: "Passive daily",   color: "text-accent",   desc: "From lifestyle assets you own" },
              { label: "Competition Reward",  val: "Prize pool share",color: "text-warning",  desc: "Tournament top placements" },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between rounded-lg px-3 py-2 text-xs bg-secondary/40 border border-border">
                <div className="flex flex-col gap-0.5 flex-1">
                  <span className="text-foreground font-medium">{r.label}</span>
                  <span className="text-[9px] text-muted-foreground">{r.desc}</span>
                </div>
                <span className={cn("font-bold whitespace-nowrap ml-2 text-[11px]", r.color)}>{r.val}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

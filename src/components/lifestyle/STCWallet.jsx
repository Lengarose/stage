import { useState, useEffect, useCallback } from "react";
import { stageClient } from "@/api/stageClient";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import {
  Coins, TrendingUp, Zap, Wallet,
  ShoppingBag, Building2, Trophy, RefreshCw,
  ChevronDown, Briefcase, ArrowUpRight, ArrowDownRight, Lock,
} from "lucide-react";

function getCategoryMeta(category, t) {
  const CATEGORY_META = {
    initial_grant:            { label: t("commonPages.walCatWelcomeBonus"),      icon: Coins,       color: "text-success",     bg: "bg-success/10"     },
    salary:                   { label: t("commonPages.cccWeeklySalary"),           icon: Briefcase,   color: "text-primary",    bg: "bg-primary/10"     },
    lifestyle_purchase:       { label: t("commonPages.walCatLifestylePurchase"), icon: ShoppingBag, color: "text-destructive", bg: "bg-destructive/10" },
    lifestyle_rent:           { label: t("commonPages.walCatLifestyleRental"),   icon: Building2,   color: "text-destructive", bg: "bg-destructive/10" },
    lifestyle_passive_income: { label: t("commonPages.walCatInvestmentReturn"),  icon: TrendingUp,  color: "text-accent",      bg: "bg-accent/10"      },
    wager_stake:              { label: t("commonPages.walCatWagerStake"),          icon: Coins,       color: "text-warning",     bg: "bg-warning/10"     },
    wager_win:                { label: t("commonPages.walCatWagerWon"),          icon: Trophy,      color: "text-success",     bg: "bg-success/10"     },
    wager_loss:               { label: t("commonPages.walCatWagerLost"),         icon: Zap,         color: "text-destructive", bg: "bg-destructive/10" },
    wager_refund:             { label: t("commonPages.walCatWagerRefunded"),     icon: Zap,         color: "text-warning",     bg: "bg-warning/10"     },
    competition_reward:       { label: t("commonPages.walCatCompetitionReward"), icon: Trophy,      color: "text-success",     bg: "bg-success/10"     },
    signing_bonus:            { label: t("commonPages.cccSigningBonus"),         icon: Briefcase,   color: "text-primary",     bg: "bg-primary/10"     },
    admin_credit:             { label: t("commonPages.walCatAdminCredit"),       icon: Coins,       color: "text-success",     bg: "bg-success/10"     },
    admin_debit:              { label: t("commonPages.walCatAdminDebit"),        icon: Coins,       color: "text-destructive", bg: "bg-destructive/10" },
  };
  return CATEGORY_META[category] || { label: category || t("commonPages.walCatTransaction"), icon: Coins, color: "text-foreground", bg: "bg-secondary" };
}

function fmt(n) { return Number(n || 0).toLocaleString(); }

const panel = "overflow-hidden rounded-2xl border border-[#f5c542]/20 bg-card/80 shadow-[0_0_80px_-28px_rgba(245,197,66,0.35)] backdrop-blur-md";
const goldCta = "h-10 gap-1.5 rounded-sm bg-gradient-to-b from-[#ffe27a] to-[#c9a227] px-3 font-heading text-xs font-black uppercase tracking-[0.16em] text-black hover:from-[#fff0a8] hover:to-[#d4ad30] focus-visible:ring-2 focus-visible:ring-[#f5c542]";

function TxRow({ tx, t }) {
  const meta = getCategoryMeta(tx.category, t);
  const Icon = meta.icon;
  const isPos = Number(tx.amount) > 0;
  return (
    <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3 last:border-0 hover:bg-secondary/30">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-sm", meta.bg)}>
        <Icon className={cn("h-4 w-4", meta.color)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-foreground">{tx.description || meta.label}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className={cn("rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", meta.bg, meta.color)}>{meta.label}</span>
          {tx.source && <span className="truncate text-[10px] text-muted-foreground">{tx.source}</span>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn("font-heading text-sm font-black tabular-nums", isPos ? "text-success" : "text-destructive")}>
          {isPos ? "+" : ""}{fmt(tx.amount)}
        </p>
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
          {new Date(tx.created_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
        </p>
      </div>
    </div>
  );
}

export default function STCWallet({ player: initialPlayer, compact = false }) {
  const { t } = useTranslation();
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
    : txFilter === "income"  ? allTx.filter(row => Number(row.amount) > 0)
    : allTx.filter(row => Number(row.amount) < 0);

  const lastWager = allTx.find((tx) =>
    ["wager_stake", "wager_win", "wager_loss", "wager_refund"].includes(tx.category)
  );
  const lockedWager = lastWager?.category === "wager_stake" && Number(lastWager.amount) < 0
    ? lastWager
    : null;
  const lockedStake = lockedWager ? Math.abs(Number(lockedWager.amount)) : 0;

  const hasPassiveItems = true; // allow collect attempt always (server returns 0 if nothing)
  const salaryDue = salary > 0 && (nextDays === 0 || nextDays === null);
  const salaryDueText = nextDays > 0
    ? (nextDays === 1 ? t("commonPages.walSalaryDueInDay") : t("commonPages.walSalaryDueInDays", { days: nextDays }))
    : t("commonPages.walSalaryDueNow");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" aria-label={t("commonPages.loading")}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#f5c542] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-[#f5c542]/28 bg-card/70 shadow-[0_0_80px_-24px_rgba(245,197,66,0.4)] backdrop-blur-md">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background: [
              "radial-gradient(ellipse 90% 55% at 50% -8%, rgba(245,197,66,0.18), transparent 52%)",
              "radial-gradient(ellipse 42% 58% at 12% 48%, rgba(0,229,255,0.08), transparent 58%)",
              "repeating-linear-gradient(90deg, rgba(8,21,15,0.55) 0px, rgba(8,21,15,0.55) 56px, rgba(11,28,19,0.35) 56px, rgba(11,28,19,0.35) 112px)",
            ].join(", "),
          }}
        />
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-[46%] h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
        <div className="relative z-[1] p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <p className="font-heading text-[11px] font-black uppercase tracking-[0.28em] text-[#f5c542]">
              {t("commonPages.walStcBalance")}
            </p>
            <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-[#f5c542]/35 bg-[#f5c542]/10">
              <Coins className="h-4 w-4 text-[#f5c542]" />
            </div>
          </div>

          <div className="text-center">
            <p className={cn(
              "font-heading font-black tabular-nums leading-none text-success",
              compact ? "text-4xl" : "text-5xl sm:text-7xl"
            )}>
              {fmt(balance)}
            </p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
              {t("commonPages.walStageCoin")}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-success/15">
                <ArrowUpRight className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{t("commonPages.wal30dIncome")}</p>
                <p className="font-heading text-sm font-black tabular-nums text-success">+{fmt(totalIncome)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-destructive/15">
                <ArrowDownRight className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{t("commonPages.wal30dSpent")}</p>
                <p className="font-heading text-sm font-black tabular-nums text-destructive">-{fmt(totalExpense)}</p>
              </div>
            </div>
          </div>

          {lockedStake > 0 && (
            <div className="mx-auto mt-5 flex max-w-lg items-center justify-center gap-3 rounded-sm border border-[#f5c542]/35 bg-black/40 px-4 py-2.5 text-[#f5c542]">
              <Coins className="h-4 w-4 shrink-0" />
              <p className="font-heading text-xs font-black uppercase tracking-[0.18em] sm:text-sm">
                {t("commonPages.walCatWagerStake")} · {fmt(lockedStake)}
              </p>
              <Lock className="h-3.5 w-3.5 shrink-0 text-[#f5c542]/80" />
            </div>
          )}
        </div>
        <Wallet className="pointer-events-none absolute -right-6 -top-6 h-40 w-40 text-foreground/5" />
      </div>

      {!compact && (salary > 0 || hasPassiveItems) && (
        <div className={panel}>
          <div className="border-b border-[#f5c542]/15 bg-secondary/30 px-4 py-3">
            <p className="font-heading text-[11px] font-black uppercase tracking-[0.18em] text-[#f5c542]">{t("commonPages.walIncomeSources")}</p>
          </div>
          <div className="divide-y divide-border/50">
            {salary > 0 && (
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-primary/10">
                    <Briefcase className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{t("commonPages.cccWeeklySalary")}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {contract?.team_id ? t("commonPages.walFromClubContract") : t("commonPages.walNoClub")} · {salaryDueText}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <p className="font-heading text-sm font-black tabular-nums text-primary">+{fmt(salary)}</p>
                  {salaryDue && (
                    <Button size="sm" onClick={collectSalary} disabled={collecting} className={goldCta}>
                      {collecting ? <div className="h-3 w-3 animate-spin rounded-full border border-black/30 border-t-black" /> : <><Coins className="h-3.5 w-3.5" />{t("commonPages.walCollect")}</>}
                    </Button>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-accent/10">
                  <TrendingUp className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{t("commonPages.walInvestmentReturns")}</p>
                  <p className="text-[10px] text-muted-foreground">{t("commonPages.walPassiveIncomeDesc")}</p>
                </div>
              </div>
              <Button size="sm" onClick={collectPassive} disabled={collecting} className={goldCta}>
                {collecting ? <div className="h-3 w-3 animate-spin rounded-full border border-black/30 border-t-black" /> : <><RefreshCw className="h-3.5 w-3.5" />{t("commonPages.walCollect")}</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className={panel}>
        <div className="flex items-center justify-between border-b border-[#f5c542]/15 bg-secondary/30 px-4 py-3">
          <p className="font-heading text-[11px] font-black uppercase tracking-[0.18em] text-[#f5c542]">{t("commonPages.walTransactionHistory")}</p>
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{t("commonPages.walTotalCount", { count: totalTx })}</span>
        </div>

        <div className="flex gap-0 border-b border-border">
          {[["all", t("commonPages.all")], ["income", t("commonPages.walIncome")], ["expense", t("commonPages.walExpenses")]].map(([val, lbl]) => (
            <button
              key={val}
              type="button"
              onClick={() => setTxFilter(val)}
              className={cn(
                "min-h-11 flex-1 py-2 font-heading text-[10px] font-black uppercase tracking-[0.16em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f5c542]",
                txFilter === val
                  ? "border-b-2 border-[#f5c542] bg-[#f5c542]/5 text-[#f5c542]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {lbl}
            </button>
          ))}
        </div>

        {filteredTx.length === 0 ? (
          <div className="py-12 text-center">
            <Coins className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">{t("commonPages.walNoTransactions")}</p>
          </div>
        ) : (
          <>
            <div>
              {filteredTx.map(tx => <TxRow key={tx.id} tx={tx} t={t} />)}
            </div>
            {allTx.length < totalTx && (
              <div className="border-t border-border p-3">
                <Button variant="ghost" size="sm" onClick={() => loadHistory(page + 1, true)} disabled={loadingMore}
                  className="h-10 w-full gap-1.5 text-xs text-muted-foreground">
                  {loadingMore ? <div className="h-3 w-3 animate-spin rounded-full border border-muted-foreground/30 border-t-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {t("commonPages.crLoadMore")}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {!compact && (
        <div className={cn(panel, "space-y-3 p-5")}>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#00e5ff]" />
            <p className="font-heading text-xs font-black uppercase tracking-[0.16em] text-foreground">{t("commonPages.walHowToEarn")}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { key: "salary",      label: t("commonPages.cccWeeklySalary"),         val: t("commonPages.walEarnPerContract"),   color: "text-primary",  desc: t("commonPages.walEarnSalaryDesc") },
              { key: "wager",       label: t("commonPages.walCatWagerWon"),          val: t("commonPages.walEarnWagerWinVal"),   color: "text-success",  desc: t("commonPages.walEarnWagerWinDesc") },
              { key: "investment",  label: t("commonPages.walEarnInvestmentIncome"), val: t("commonPages.walEarnPassiveDaily"),  color: "text-accent",   desc: t("commonPages.walEarnInvestmentDesc") },
              { key: "competition", label: t("commonPages.walCatCompetitionReward"), val: t("commonPages.walEarnPrizePool"), color: "text-warning",  desc: t("commonPages.walEarnCompetitionDesc") },
            ].map(r => (
              <div key={r.key} className="flex items-center justify-between rounded-sm border border-border bg-secondary/40 px-3 py-2 text-xs">
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="font-medium text-foreground">{r.label}</span>
                  <span className="text-[9px] text-muted-foreground">{r.desc}</span>
                </div>
                <span className={cn("ml-2 whitespace-nowrap font-heading text-[11px] font-black uppercase", r.color)}>{r.val}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

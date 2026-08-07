import { useState, useEffect, useCallback, useMemo } from "react";
import { stageClient } from "@/api/stageClient";
import { formatSTC, calculatePlayerValue } from "@/lib/playerValue";
import { getContractType, normalizePlayerContracts } from "@/lib/playerContractFields";
import { cn } from "@/lib/utils";
import { swalAlert, swalConfirm } from "@/lib/swal";
import { useTranslation } from "@/hooks/useTranslation";
import {
  TrendingUp, TrendingDown, Wallet, Users, Trophy, Coins,
  AlertTriangle, ChevronLeft, ChevronRight, SlidersHorizontal,
  RefreshCw, DollarSign, Gift, ArrowLeftRight, Ticket, Building2,
  ShoppingBag,
} from "lucide-react";

function buildTxCategories(t) {
  return {
    ticket_revenue:  { label: t("commonPages.cfinCatTicketRevenue"),  color: "text-success",      bg: "bg-success/10",      border: "border-success/20",      icon: Ticket },
    shirt_revenue:   { label: t("commonPages.cfinCatShirtSales"),      color: "text-success",      bg: "bg-success/10",      border: "border-success/20",      icon: ShoppingBag },
    stadium_upgrade: { label: t("commonPages.cfinCatStadiumUpgrade"), color: "text-warning",      bg: "bg-warning/10",      border: "border-warning/20",      icon: Building2 },
    salary:          { label: t("commonPages.cfinCatSalary"),          color: "text-destructive",  bg: "bg-destructive/10",  border: "border-destructive/20",  icon: Users },
    wager_win:       { label: t("commonPages.cfinCatWagerWin"),        color: "text-success",      bg: "bg-success/10",      border: "border-success/20",      icon: Trophy },
    wager_loss:      { label: t("commonPages.cfinCatWagerLoss"),       color: "text-destructive",  bg: "bg-destructive/10",  border: "border-destructive/20",  icon: TrendingDown },
    wager_refund:    { label: t("commonPages.cfinCatWagerRefund"),     color: "text-warning",      bg: "bg-warning/10",      border: "border-warning/20",      icon: RefreshCw },
    wager_stake:     { label: t("commonPages.cfinCatWagerStake"),      color: "text-warning",      bg: "bg-warning/10",      border: "border-warning/20",      icon: ArrowLeftRight },
    comp_reward:        { label: t("commonPages.cfinCatCompetition"),       color: "text-primary",      bg: "bg-primary/10",      border: "border-primary/20",      icon: Gift },
    tournament_entry:   { label: t("commonPages.cfinCatTournamentEntry"), color: "text-destructive",  bg: "bg-destructive/10",  border: "border-destructive/20",  icon: Trophy },
    tournament_prize:   { label: t("commonPages.cfinCatTournamentPrize"), color: "text-success",      bg: "bg-success/10",      border: "border-success/20",      icon: Trophy },
    tournament_refund:  { label: t("commonPages.cfinCatTournamentRefund"),color: "text-warning",      bg: "bg-warning/10",      border: "border-warning/20",      icon: Trophy },
    operating_costs:    { label: "Operating costs", color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20", icon: Building2 },
    transfer_locked:    { label: "Transfer locked", color: "text-warning", bg: "bg-warning/10", border: "border-warning/20", icon: ArrowLeftRight },
    transfer_release:   { label: "Transfer released", color: "text-primary", bg: "bg-primary/10", border: "border-primary/20", icon: RefreshCw },
    transfer_spending:  { label: "Transfer spending", color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20", icon: ArrowLeftRight },
    starting_balance:   { label: "Starting balance", color: "text-primary", bg: "bg-primary/10", border: "border-primary/20", icon: Building2 },
    adjustment:         { label: t("commonPages.cfinCatAdjustment"),       color: "text-muted-foreground", bg: "bg-secondary", border: "border-border",           icon: SlidersHorizontal },
    admin_adjustment:   { label: t("commonPages.cfinCatAdminAdj"),       color: "text-muted-foreground", bg: "bg-secondary", border: "border-border",           icon: SlidersHorizontal },
  };
}

function getCategoryMeta(tx, t) {
  const key = tx.category || tx.type || "";
  const TX_CATEGORIES = buildTxCategories(t);
  return TX_CATEGORIES[key] || {
    label: key || t("commonPages.cfinCatTransaction"),
    color: tx.amount >= 0 ? "text-success" : "text-destructive",
    bg:    tx.amount >= 0 ? "bg-success/10"  : "bg-destructive/10",
    border:tx.amount >= 0 ? "border-success/20" : "border-destructive/20",
    icon:  tx.amount >= 0 ? TrendingUp : TrendingDown,
  };
}

function buildCategoryFilters(t) {
  return [
    { key: "all",             label: t("commonPages.all") },
    { key: "ticket_revenue",  label: t("commonPages.cfinFilterTickets") },
    { key: "shirt_revenue",   label: t("commonPages.cfinFilterShirts") },
    { key: "stadium_upgrade", label: t("commonPages.cfinFilterStadium") },
    { key: "salary",          label: t("commonPages.cfinCatSalary") },
    { key: "wager_win",       label: t("commonPages.cfinCatWagerWin") },
    { key: "wager_stake",     label: t("commonPages.cfinFilterStake") },
    { key: "wager_loss",      label: t("commonPages.cfinCatWagerLoss") },
    { key: "wager_refund",    label: t("commonPages.cfinFilterRefund") },
    { key: "comp_reward",       label: t("commonPages.cfinCatCompetition") },
    { key: "tournament_entry", label: t("commonPages.cfinFilterTournament") },
    { key: "tournament_prize", label: t("commonPages.cfinCatTournamentPrize") },
    { key: "transfer_spending", label: "Transfers" },
    { key: "operating_costs", label: "Operating costs" },
    { key: "adjustment",       label: t("commonPages.cfinCatAdjustment") },
  ];
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

// ── Transaction Row ────────────────────────────────────────────────────────
function TxRow({ tx, isAdmin, onDelete }) {
  const { t } = useTranslation();
  const meta = getCategoryMeta(tx, t);
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
            type="button"
            onClick={() => onDelete(tx.id)}
            className="block text-[10px] text-muted-foreground hover:text-destructive mt-0.5 transition-colors"
          >
            {t("commonPages.delete")}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function ClubFinanceTab({ club, isAdmin = false }) {
  const { t } = useTranslation();
  const categoryFilters = useMemo(() => buildCategoryFilters(t), [t]);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [catFilter, setCatFilter] = useState("all");

  const load = useCallback(async () => {
    if (!club?.id) return;
    setLoading(true);
    try {
      const [overviewRes, squadPlayers] = await Promise.all([
        stageClient.functions.invoke("clubFinance", { action: "get_overview", club_id: club.id }),
        stageClient.entities.Player.filter({ club_id: club.id }, null, 100),
      ]);

      const overview = overviewRes?.data || {};
      const safeContracts = normalizePlayerContracts(overview.contracts || []);
      const squadValue   = (squadPlayers || []).reduce((s, p) => s + calculatePlayerValue(p), 0);

      setData({
        balance:          Number(overview.balance ?? club.stc ?? 0),
        transfer_budget:  Number(overview.transfer_budget ?? club.transfer_budget_stc ?? 0),
        wage_budget:      Number(overview.wage_budget ?? club.wage_budget_stc ?? 0),
        weekly_wages:     Number(overview.weekly_wages || 0),
        pending_weekly_wages: Number(overview.pending_weekly_wages || 0),
        committed_weekly_wages: Number(overview.committed_weekly_wages ?? overview.weekly_wages ?? 0),
        wage_room: Number(overview.wage_room || 0),
        transfer_locked: Number(overview.transfer_locked || 0),
        transfer_remaining: Number(overview.transfer_remaining ?? club.transfer_budget_stc ?? 0),
        available_balance: Number(overview.available_balance ?? overview.balance ?? club.stc ?? 0),
        monthly_operating_cost_estimate: Number(overview.monthly_operating_cost_estimate || 0),
        stadium_tier: overview.stadium_tier,
        stadium_capacity: Number(overview.stadium_capacity ?? club.stadium_capacity ?? 5000),
        contracts:        safeContracts,
        allTransactions:  overview.transactions || [],
        squadPlayers:     squadPlayers || [],
        squad_value:      squadValue,
        income_30d: Number(overview.income_30d || 0),
        expenses_30d: Number(overview.expenses_30d || 0),
      });
    } catch (err) {
      console.error("[ClubFinanceTab] load failed:", err);
      setData(null);
    }
    setLoading(false);
  }, [club?.id, club?.stc, club?.transfer_budget_stc, club?.wage_budget_stc, club?.stadium_capacity]);

  useEffect(() => { load(); }, [load]);

  async function handleDeleteTx(txId) {
    if (!(await swalConfirm(t("commonPages.cfinDeleteConfirm")))) return;
    try {
      await stageClient.functions.invoke("clubFinance", {
        action: "delete_transaction", club_id: club.id, transaction_id: txId,
      });
      await load();
    } catch (err) {
      await swalAlert(err?.message || t("commonPages.cfinActionFailed"));
    }
  }

  if (loading && !data) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!data) return (
    <div className="text-center py-12 text-sm text-muted-foreground">
      {t("commonPages.cfinLoadFailed")}
    </div>
  );

  const {
    balance, transfer_budget, wage_budget, weekly_wages,
    pending_weekly_wages, committed_weekly_wages, wage_room,
    transfer_locked, transfer_remaining, available_balance,
    monthly_operating_cost_estimate, stadium_tier, stadium_capacity,
    contracts, allTransactions, squad_value, income_30d, expenses_30d,
  } = data;

  const net30 = income_30d - expenses_30d;
  const wageUsedPct = wage_budget > 0 ? Math.min(100, (committed_weekly_wages / wage_budget) * 100) : 0;
  const transferUsedPct = transfer_budget > 0 ? Math.min(100, (transfer_locked / transfer_budget) * 100) : 0;

  const filteredTx = catFilter === "all"
    ? allTransactions
    : allTransactions.filter(tx => (tx.category || tx.type || "") === catFilter);
  const PAGE_SIZE  = 25;
  const totalPages = Math.ceil(filteredTx.length / PAGE_SIZE) || 1;
  const visibleTx  = filteredTx.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-5">

      {/* Balance + Budget Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
        <StatCard icon={Wallet}  label={t("commonPages.cfinClubBalance")}     value={formatSTC(balance)}          color="text-success"  sub={`Available: ${formatSTC(available_balance)}`} />
        <StatCard icon={TrendingUp} label={t("commonPages.cfinSquadValue")}   value={formatSTC(squad_value || 0)} color="text-purple-400" sub={t("commonPages.cfinCombinedPlayerValue")} />
        <StatCard icon={Users}   label="Weekly wage cap"      value={`${formatSTC(wage_budget)}/wk`}       color="text-warning"  sub={`Room: ${formatSTC(wage_room)}/wk`} />
        <StatCard icon={Coins}   label="Transfer cap"  value={formatSTC(transfer_budget)}   color="text-primary"  sub={`Remaining: ${formatSTC(transfer_remaining)}`} />
        <StatCard icon={Building2} label="Stadium tier" value={stadium_tier?.name || "Local Ground"} color="text-cyan-300" sub={`${Number(stadium_capacity || 0).toLocaleString()} capacity`} />
        <StatCard icon={DollarSign} label="Monthly costs" value={formatSTC(monthly_operating_cost_estimate)} color="text-destructive" sub="Wages + stadium maintenance" />
      </div>

      {/* Wage Usage Bar */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" /> {t("commonPages.cfinWeeklyWageBill")}
          </p>
          <p className={cn("text-sm font-light", wageUsedPct > 90 ? "text-destructive" : wageUsedPct > 70 ? "text-warning" : "text-success")}>
            {formatSTC(committed_weekly_wages)} / {formatSTC(wage_budget)}
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
            <AlertTriangle className="w-3 h-3" /> {t("commonPages.cfinWageNearlyExhausted")}
          </p>
        )}

        {/* Wage roll */}
        {contracts.length > 0 && (
          <div className="pt-1 space-y-1.5 border-t border-border mt-3">
            {contracts.map(c => (
              <div key={c.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t("commonPages.cfinContractLabel", { name: c.player_gamertag || getContractType(c) })}</span>
                <span className={cn("font-medium", c.status === "active" ? "text-foreground" : "text-warning")}>
                  {formatSTC(c.weekly_salary_stc || 0)}/wk{c.status !== "active" ? " pending" : ""}
                </span>
              </div>
            ))}
            {pending_weekly_wages > 0 && (
              <p className="text-[10px] text-warning pt-1">Pending offers reserve {formatSTC(pending_weekly_wages)}/wk inside the cap.</p>
            )}
          </div>
        )}
      </div>

      {/* Transfer room */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-foreground flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-muted-foreground" /> Transfer Budget
          </p>
          <p className="text-sm font-light text-primary">
            {formatSTC(transfer_remaining)} remaining
          </p>
        </div>
        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all bg-warning" style={{ width: `${transferUsedPct}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
          <span>Cap: <b className="text-foreground">{formatSTC(transfer_budget)}</b></span>
          <span>Locked: <b className="text-warning">{formatSTC(transfer_locked)}</b></span>
          <span>Balance: <b className="text-success">{formatSTC(balance)}</b></span>
        </div>
      </div>

      {/* 30-Day Summary */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-success/10 border border-success/20 rounded-xl p-3 text-center">
          <TrendingUp className="w-4 h-4 text-success mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t("commonPages.cfinIncome30d")}</p>
          <p className="font-light text-success text-lg tracking-tight">{formatSTC(income_30d)}</p>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-center">
          <TrendingDown className="w-4 h-4 text-destructive mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t("commonPages.cfinExpenses30d")}</p>
          <p className="font-light text-destructive text-lg tracking-tight">{formatSTC(expenses_30d)}</p>
        </div>
        <div className={cn("border rounded-xl p-3 text-center", net30 >= 0 ? "bg-success/10 border-success/20" : "bg-destructive/10 border-destructive/20")}>
          <DollarSign className={cn("w-4 h-4 mx-auto mb-1", net30 >= 0 ? "text-success" : "text-destructive")} />
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t("commonPages.cfinNet30d")}</p>
          <p className={cn("font-light text-lg tracking-tight", net30 >= 0 ? "text-success" : "text-destructive")}>
            {net30 >= 0 ? "+" : ""}{formatSTC(net30)}
          </p>
        </div>
      </div>

      {/* Transaction History */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {t("commonPages.cfinTxHistory")}
            {allTransactions.length > 0 && <span className="ml-2 text-muted-foreground font-normal">({allTransactions.length})</span>}
          </h4>
          <button type="button" onClick={() => load()} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            <RefreshCw className="w-3 h-3" /> {t("commonPages.cfinRefresh")}
          </button>
        </div>

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {categoryFilters.map(f => (
            <button
              type="button"
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
          <p className="text-sm text-muted-foreground text-center py-8">{t("commonPages.cfinNoTx")}</p>
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
              type="button"
              onClick={() => { setPage(p => Math.max(1, p - 1)); }}
              disabled={page === 1 || loading}
              className="p-1.5 rounded-lg bg-secondary hover:bg-muted disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-muted-foreground">{t("commonPages.cfinPageOf", { page, total: totalPages })}</span>
            <button
              type="button"
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

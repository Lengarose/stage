import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { formatSTC } from "@/lib/playerValue";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Wallet, Users, Trophy, Coins, AlertTriangle } from "lucide-react";

export default function ClubFinanceTab({ club }) {
  const [contracts, setContracts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!club?.id) return;
    Promise.all([
      stageClient.entities.PlayerContract.filter({ team_id: club.id, status: "active" }),
      stageClient.entities.STCTransaction.filter({ club_id: club.id }, "-created_date", 30),
    ]).then(([c, t]) => {
      setContracts(c);
      setTransactions(t);
      setLoading(false);
    });
  }, [club?.id]);

  const totalWeeklyWages = contracts.reduce((s, c) => s + (c.weekly_salary_stc || 0), 0);
  const totalBudget = club?.stc || 0;
  const wageBudget = club?.wage_budget_stc || 0;
  const transferBudget = club?.transfer_budget_stc || 0;
  const wageUsedPct = wageBudget > 0 ? Math.min(100, (totalWeeklyWages / wageBudget) * 100) : 0;

  const income = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expenses = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const net = income - expenses;

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Budget Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <FinanceStat icon={<Wallet className="w-4 h-4 text-success" />} label="Club Balance" value={formatSTC(totalBudget)} color="text-success" />
        <FinanceStat icon={<Users className="w-4 h-4 text-warning" />} label="Wage Budget" value={formatSTC(wageBudget)} color="text-warning" />
        <FinanceStat icon={<Coins className="w-4 h-4 text-primary" />} label="Transfer Budget" value={formatSTC(transferBudget)} color="text-primary" />
      </div>

      {/* Wage Usage Bar */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" /> Weekly Wage Bill
          </p>
          <p className={cn("text-sm font-light", wageUsedPct > 90 ? "text-destructive" : wageUsedPct > 70 ? "text-warning" : "text-success")}>
            {formatSTC(totalWeeklyWages)} / {formatSTC(wageBudget)}
          </p>
        </div>
        <div className="w-full h-2.5 bg-secondary rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", wageUsedPct > 90 ? "bg-destructive" : wageUsedPct > 70 ? "bg-warning" : "bg-success")}
            style={{ width: `${wageUsedPct}%` }}
          />
        </div>
        {wageUsedPct > 90 && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Wage budget nearly exhausted — cannot offer new contracts
          </p>
        )}
        <div className="pt-1 space-y-1.5">
          {contracts.map(c => (
            <div key={c.id} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground capitalize">{c.contract_type} contract</span>
              <span className="font-medium text-foreground">{formatSTC(c.weekly_salary_stc || 0)} / wk</span>
            </div>
          ))}
          {contracts.length === 0 && <p className="text-xs text-muted-foreground">No active contracts.</p>}
        </div>
      </div>

      {/* Income vs Expenses */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-success/10 border border-success/20 rounded-xl p-3 text-center">
          <TrendingUp className="w-4 h-4 text-success mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Income</p>
          <p className="font-light text-success text-lg tracking-tight">{formatSTC(income)}</p>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-center">
          <TrendingDown className="w-4 h-4 text-destructive mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Expenses</p>
          <p className="font-light text-destructive text-lg tracking-tight">{formatSTC(expenses)}</p>
        </div>
        <div className={cn("border rounded-xl p-3 text-center", net >= 0 ? "bg-success/10 border-success/20" : "bg-destructive/10 border-destructive/20")}>
          <Coins className={cn("w-4 h-4 mx-auto mb-1", net >= 0 ? "text-success" : "text-destructive")} />
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Net</p>
          <p className={cn("font-light text-lg tracking-tight", net >= 0 ? "text-success" : "text-destructive")}>{net >= 0 ? "+" : ""}{formatSTC(net)}</p>
        </div>
      </div>

      {/* Recent Transactions */}
      <div>
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Recent Transactions</h4>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No transactions yet.</p>
        ) : (
          <div className="space-y-2">
            {transactions.slice(0, 15).map(tx => {
              const isPos = tx.amount > 0;
              return (
                <div key={tx.id} className="bg-card border border-border rounded-xl px-4 py-2.5 flex items-center gap-3">
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", isPos ? "bg-success/15" : "bg-destructive/15")}>
                    {isPos ? <TrendingUp className="w-3.5 h-3.5 text-success" /> : <TrendingDown className="w-3.5 h-3.5 text-destructive" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{tx.description || tx.type}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(tx.created_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</p>
                  </div>
                  <span className={cn("font-light text-sm shrink-0", isPos ? "text-success" : "text-destructive")}>
                    {isPos ? "+" : ""}{formatSTC(tx.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FinanceStat({ icon, label, value, color }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1">{icon}<p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p></div>
      <p className={cn("font-light text-xl tracking-tight", color)}>{value}</p>
    </div>
  );
}
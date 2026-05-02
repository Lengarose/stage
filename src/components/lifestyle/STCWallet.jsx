import { cn } from "@/lib/utils";
import { Coins, TrendingUp, TrendingDown, Zap } from "lucide-react";

const TX_TYPE_LABELS = {
  wager_win: "Wager Win",
  wager_loss: "Wager Loss",
  wager_lock: "Wager Locked",
  wager_refund: "Wager Refunded",
  tournament_win: "Tournament Win (1st Place)",
  tournament_final: "Tournament Runner-up (2nd Place)",
  salary: "Weekly Salary",
  signing_bonus: "Signing Bonus",
  lifestyle_purchase: "Lifestyle Purchase",
  passive_income: "Passive Income (Investment)",
  admin_grant: "Admin Grant",
};

export default function STCWallet({ player, transactions }) {
  const stc = player?.stc || 0;

  const earned = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const spent = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className="space-y-6">
      {/* Balance card */}
      <div className="bg-gradient-to-br from-success/10 via-card to-primary/10 border border-success/20 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
            <Coins className="w-6 h-6 text-success" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">STC Balance</p>
            <p className="font-heading font-black text-4xl text-success">{stc.toLocaleString()}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-success" />
            <div>
              <p className="text-xs text-muted-foreground">Earned (recent)</p>
              <p className="font-bold text-success">+{earned.toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">Spent (recent)</p>
              <p className="font-bold text-destructive">-{spent.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* How to earn */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
         <div>
           <h3 className="font-bold text-foreground text-sm">Player STC Earnings</h3>
           <p className="text-[10px] text-muted-foreground mt-0.5">Earn STC directly to your wallet through:</p>
         </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-2">
          {[
            { label: "Weekly Salary", amount: "Per contract", color: "text-primary", desc: "From your club contract" },
            { label: "PvP Wager Win", amount: "Match wager × 2", color: "text-success", desc: "Win a wagered 1v1 match" },
            { label: "PvP Solo Tournament 1st", amount: "80% of pool", color: "text-success", desc: "Win a player-only tournament" },
            { label: "PvP Solo Tournament 2nd", amount: "20% of pool", color: "text-warning", desc: "Runner-up in player tournament" },
            { label: "Lifestyle Investment Income", amount: "Varies daily", color: "text-accent", desc: "Passive income from assets" },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between rounded-lg px-3 py-2 text-xs bg-success/5 border border-success/20">
              <div className="flex flex-col gap-0.5 flex-1">
                <span className="text-muted-foreground font-medium">{row.label}</span>
                <span className="text-[9px] text-muted-foreground/60">{row.desc}</span>
              </div>
              <span className={cn("font-bold whitespace-nowrap ml-2", row.color)}>{row.amount}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction history */}
      <div>
        <h3 className="font-bold text-foreground text-sm mb-3 uppercase tracking-wider">Recent Transactions</h3>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No transactions yet.</p>
        ) : (
          <div className="space-y-2">
            {transactions.map(tx => {
              const isPos = tx.amount > 0;
              return (
                <div key={tx.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    isPos ? "bg-success/15" : "bg-destructive/15"
                  )}>
                    {isPos ? <TrendingUp className="w-4 h-4 text-success" /> : <TrendingDown className="w-4 h-4 text-destructive" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{tx.description || TX_TYPE_LABELS[tx.type] || tx.type}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(tx.created_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                  </div>
                  <span className={cn("font-heading font-black text-base shrink-0", isPos ? "text-success" : "text-destructive")}>
                    {isPos ? "+" : ""}{tx.amount.toLocaleString()}
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
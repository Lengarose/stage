import BackfillStcButton from "@/components/admin/economy/BackfillStcButton";
import MarketValueConfigPanel from "@/components/admin/economy/MarketValueConfigPanel";
import AdminContractsPanel from "@/components/admin/economy/AdminContractsPanel";
import AdminShirtSalesPanel from "@/components/admin/economy/AdminShirtSalesPanel";
import { Button } from "@/components/ui/button";
import { Search, Coins, Ban } from "lucide-react";

export default function PlayersTab({
  players,
  playerSearch,
  setPlayerSearch,
  setCreditsDialog,
  setCreditsAmount,
  openPlayerWallet,
  kickFromClub,
}) {
  return (
    <>
      <BackfillStcButton />
      <MarketValueConfigPanel />
      <AdminContractsPanel />
      <AdminShirtSalesPanel />
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={playerSearch} onChange={e => setPlayerSearch(e.target.value)}
          className="w-full bg-secondary border border-border rounded pl-9 pr-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
          placeholder="Search by gamertag..." />
      </div>
      <div className="space-y-2">
        {players.filter(p => p.gamertag?.toLowerCase().includes(playerSearch.toLowerCase())).map(p => (
          <div key={p.id} className="bg-card border border-border rounded p-4 flex items-center gap-4">
            <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 overflow-hidden">
              {p.avatar_url ? <img src={p.avatar_url} alt={p.gamertag} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-primary">{(p.gamertag || "?")[0].toUpperCase()}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{p.gamertag}</p>
              <p className="text-xs text-muted-foreground truncate">{p.email} · {p.platform} · {p.position}</p>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0 text-xs">
              <span className="font-semibold text-success">{((p.stc || 0) / 1000).toFixed(0)}K STC</span>
              {p.market_value_stc > 0 && (
                <span className="text-purple-400 font-medium">{((p.market_value_stc || 0) / 1_000_000).toFixed(1)}M val</span>
              )}
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => openPlayerWallet(p)} className="border-success/30 text-success hover:bg-success/10 gap-1 text-xs"><Coins className="w-3.5 h-3.5" /> Wallet</Button>
              <Button size="sm" variant="outline" onClick={() => { setCreditsDialog(p); setCreditsAmount(0); }} className="border-warning/30 text-warning hover:bg-warning/10 gap-1 text-xs"><Coins className="w-3.5 h-3.5" /> Credits</Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => p.club_id && kickFromClub(p.id)}
                disabled={!p.club_id}
                title={!p.club_id ? "Player is not linked to a club" : "Remove player from current club"}
                className="border-destructive/30 text-destructive hover:bg-destructive/10 gap-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Ban className="w-3.5 h-3.5" /> {p.club_id ? "Kick" : "No Club"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

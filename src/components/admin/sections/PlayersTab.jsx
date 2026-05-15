import BackfillStcButton from "@/components/admin/economy/BackfillStcButton";
import MarketValueConfigPanel from "@/components/admin/economy/MarketValueConfigPanel";
import AdminContractsPanel from "@/components/admin/economy/AdminContractsPanel";
import AdminShirtSalesPanel from "@/components/admin/economy/AdminShirtSalesPanel";
import { Button } from "@/components/ui/button";
import { Search, Coins, Ban, BadgeCheck, Check, X, ExternalLink } from "lucide-react";

export default function PlayersTab({
  players,
  identityClaims = [],
  playerSearch,
  setPlayerSearch,
  setCreditsDialog,
  setCreditsAmount,
  openPlayerWallet,
  kickFromClub,
  reviewIdentityClaim,
}) {
  return (
    <>
      <BackfillStcButton />
      <MarketValueConfigPanel />
      <AdminContractsPanel />
      <AdminShirtSalesPanel />
      <div className="mb-4 rounded border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <BadgeCheck className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Identity Claims</h2>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{identityClaims.length} pending</span>
        </div>
        {identityClaims.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            New player verification requests appear here and through the Admin → Identity Claims menu.
          </p>
        ) : (
          <div className="space-y-2">
            {identityClaims.map(claim => (
              <div key={claim.id} className="rounded border border-border bg-card p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{claim.gamertag || claim.email}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {claim.platform} · {claim.platform_handle}
                    {claim.ea_id ? ` · EA: ${claim.ea_id}` : ""}
                    {claim.discord_handle ? ` · Discord: ${claim.discord_handle}` : ""}
                  </p>
                  {claim.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{claim.notes}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {claim.proof_url && (
                    <a href={claim.proof_url} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline" className="gap-1 text-xs">
                        <ExternalLink className="w-3.5 h-3.5" /> Proof
                      </Button>
                    </a>
                  )}
                  <Button size="sm" onClick={() => reviewIdentityClaim?.(claim, "approved")} className="gap-1 text-xs bg-success text-white hover:bg-success/90">
                    <Check className="w-3.5 h-3.5" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => reviewIdentityClaim?.(claim, "rejected")} className="gap-1 text-xs border-destructive/30 text-destructive hover:bg-destructive/10">
                    <X className="w-3.5 h-3.5" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
              <p className="text-xs text-muted-foreground truncate">
                {p.email} · {p.platform} · {p.position}
                {Number(p.is_verified) === 1 ? " · verified" : ""}
              </p>
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

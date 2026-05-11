import AdminStadiumPanel from "@/components/admin/economy/AdminStadiumPanel";
import EmptyState from "@/components/admin/shared/EmptyState";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Search, Shield, Building2, LogIn, Coins, Trash2 } from "lucide-react";

export default function ClubsTab({
  migrateClubBalances,
  migrating,
  resetAllRankings,
  resettingRankings,
  migrateResult,
  clubSearch,
  setClubSearch,
  clubs,
  takeControl,
  setClubStcDialog,
  setClubStcAmount,
  setClubWageBudget,
  setClubTransferBudget,
  deleteClub,
}) {
  return (
    <>
      <AdminStadiumPanel />
      <div className="mb-4 flex gap-2 flex-wrap items-center">
        <Button
          variant="outline" size="sm" onClick={migrateClubBalances} disabled={migrating}
          className="border-border text-muted-foreground hover:text-foreground text-xs h-8 rounded gap-1.5"
        >
          {migrating ? <><span className="w-3 h-3 border-2 border-primary/20 border-t-primary rounded-full animate-spin inline-block" /> Migrating...</> : "Migrate All Clubs (+20M STC)"}
        </Button>
        <Button
          variant="outline" size="sm" onClick={resetAllRankings} disabled={resettingRankings}
          className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs h-8 rounded gap-1.5"
        >
          {resettingRankings ? <><span className="w-3 h-3 border-2 border-destructive/20 border-t-destructive rounded-full animate-spin inline-block" /> Resetting...</> : "Reset All Club Rankings"}
        </Button>
        {migrateResult && (
          <span className={cn("text-xs font-medium", migrateResult.success ? "text-success" : "text-destructive")}>
            {migrateResult.success ? `✓ Updated ${migrateResult.count} clubs` : `✗ ${migrateResult.error}`}
          </span>
        )}
      </div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={clubSearch} onChange={e => setClubSearch(e.target.value)}
          className="w-full bg-secondary border border-border rounded pl-9 pr-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
          placeholder="Search by club name..." />
      </div>
      {clubs.length === 0 ? (
        <EmptyState icon={Building2} text="No clubs found." />
      ) : (
        <div className="space-y-2">
          {clubs.filter(c => c.name?.toLowerCase().includes(clubSearch.toLowerCase())).map(c => (
            <div key={c.id} className="bg-card border border-border rounded p-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 overflow-hidden">
                {c.logo_url ? <img src={c.logo_url} alt={c.name} className="w-full h-full object-cover" /> : <Shield className="w-4 h-4 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{c.name} <span className="text-muted-foreground text-xs">[{c.tag}]</span></p>
                <p className="text-xs text-muted-foreground truncate">{c.platform} · {c.region} · Owner: {c.owner_email}</p>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => takeControl(c)} className="border-warning/30 text-warning hover:bg-warning/10 gap-1 text-xs"><LogIn className="w-3.5 h-3.5" /> Take Control</Button>
                <Button size="sm" variant="outline" onClick={() => { setClubStcDialog(c); setClubStcAmount(""); setClubWageBudget(c.wage_budget_stc || ""); setClubTransferBudget(c.transfer_budget_stc || ""); }} className="border-success/30 text-success hover:bg-success/10 gap-1 text-xs"><Coins className="w-3.5 h-3.5" /> Finance</Button>
                <Link to={`/clubs/${c.id}`}><Button size="sm" variant="outline" className="border-border text-xs">View</Button></Link>
                <Button size="sm" variant="outline" onClick={() => deleteClub(c.id)} className="border-destructive/30 text-destructive hover:bg-destructive/10 gap-1 text-xs"><Trash2 className="w-3.5 h-3.5" /> Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

import AdminEconomyTestPanel from "@/components/admin/economy/AdminEconomyTestPanel";
import AdminEconomyPanel from "@/components/admin/economy/AdminEconomyPanel";
import AdminWagersPanel from "@/components/admin/economy/AdminWagersPanel";
import EmptyState from "@/components/admin/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Gavel } from "lucide-react";

export default function DisputesTab({ disputes, setResolveDialog, setSelectedWinner }) {
  return (
    <>
      <AdminEconomyTestPanel />
      <AdminEconomyPanel />
      <AdminWagersPanel />
      {disputes.length === 0 ? (
        <EmptyState icon={AlertTriangle} text="No disputed matches." />
      ) : (
        <div className="space-y-3">
          {disputes.map(m => {
            const parseSub = (raw) => { try { return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null; } catch { return null; } };
            const hs = parseSub(m.home_submission);
            const as_ = parseSub(m.away_submission);
            const homeLbl = (m.home_club_name || m.home_player_name) ?? "Home";
            const awayLbl = (m.away_club_name || m.away_player_name) ?? "Away";
            const hScore = hs ? `${hs.home_score}–${hs.away_score}` : "?";
            const aScore = as_ ? `${as_.home_score}–${as_.away_score}` : "?";
            return (
              <div key={m.id} className="bg-card border border-destructive/20 rounded p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] px-2 py-0.5 rounded border border-destructive/30 bg-destructive/10 text-destructive font-bold uppercase tracking-wider">DISPUTED</span>
                  </div>
                  <p className="font-bold text-foreground">{homeLbl} vs {awayLbl}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {homeLbl} says <strong className="text-foreground">{hScore}</strong>
                    {" · "}
                    {awayLbl} says <strong className="text-foreground">{aScore}</strong>
                  </p>
                </div>
                <Button onClick={() => { setResolveDialog({ match: m, type: m._source }); setSelectedWinner(""); }} className="bg-primary text-primary-foreground shrink-0 gap-2" size="sm">
                  <Gavel className="w-4 h-4" /> Resolve
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

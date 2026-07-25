import AdminEconomyTestPanel from "@/components/admin/economy/AdminEconomyTestPanel";
import AdminEconomyPanel from "@/components/admin/economy/AdminEconomyPanel";
import AdminWagersPanel from "@/components/admin/economy/AdminWagersPanel";
import EmptyState from "@/components/admin/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { AlertTriangle, ExternalLink, Gavel, Image as ImageIcon } from "lucide-react";

export default function DisputesTab({ disputes, setResolveDialog, setSelectedWinner }) {
  const { t } = useTranslation();

  return (
    <>
      <AdminEconomyTestPanel />
      <AdminEconomyPanel />
      <AdminWagersPanel />
      {disputes.length === 0 ? (
        <EmptyState icon={AlertTriangle} text={t("admin.disputes.noDisputedMatches")} />
      ) : (
        <div className="space-y-3">
          {disputes.map(m => {
            const parseSub = (raw) => { try { return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null; } catch { return null; } };
            const hs = parseSub(m.home_submission);
            const as_ = parseSub(m.away_submission);
            const homeLbl = (m.home_club_name || m.home_player_name) ?? t("admin.disputes.home");
            const awayLbl = (m.away_club_name || m.away_player_name) ?? t("admin.disputes.away");
            const hScore = hs ? `${hs.home_score}–${hs.away_score}` : "?";
            const aScore = as_ ? `${as_.home_score}–${as_.away_score}` : "?";
            const proofLinks = [
              { label: t("admin.disputes.proofFor", { name: homeLbl }), url: hs?.proof_url },
              { label: t("admin.disputes.proofFor", { name: awayLbl }), url: as_?.proof_url },
              { label: t("admin.disputes.matchProof"), url: !hs?.proof_url && !as_?.proof_url ? (m.proof_url || m.forfeit_proof_url) : null },
            ].filter(link => link.url);
            return (
              <div key={m.id} className="bg-card border border-destructive/20 rounded p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] px-2 py-0.5 rounded border border-destructive/30 bg-destructive/10 text-destructive font-bold uppercase tracking-wider">{t("admin.disputes.disputed")}</span>
                  </div>
                  <p className="font-bold text-foreground">{homeLbl} vs {awayLbl}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("admin.disputes.claimsScore", { name: homeLbl, score: hScore })}
                    {" · "}
                    {t("admin.disputes.claimsScore", { name: awayLbl, score: aScore })}
                  </p>
                  {proofLinks.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {proofLinks.map(link => (
                        <a
                          key={`${m.id}-${link.label}`}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-primary underline underline-offset-2"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          {link.label}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <Button onClick={() => { setResolveDialog({ match: m, type: m._source }); setSelectedWinner(""); }} className="bg-primary text-primary-foreground shrink-0 gap-2" size="sm">
                  <Gavel className="w-4 h-4" /> {t("admin.disputes.resolve")}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

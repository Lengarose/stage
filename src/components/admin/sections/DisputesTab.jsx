import { useState } from "react";
import AdminEconomyTestPanel from "@/components/admin/economy/AdminEconomyTestPanel";
import AdminEconomyPanel from "@/components/admin/economy/AdminEconomyPanel";
import AdminWagersPanel from "@/components/admin/economy/AdminWagersPanel";
import EmptyState from "@/components/admin/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { AlertTriangle, Download, Gavel, Image as ImageIcon, X } from "lucide-react";

export default function DisputesTab({ disputes, setResolveDialog, setSelectedWinner }) {
  const { t } = useTranslation();
  const [previewProof, setPreviewProof] = useState(null);

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
                        <button
                          type="button"
                          key={`${m.id}-${link.label}`}
                          onClick={() => setPreviewProof(link)}
                          className="inline-flex items-center gap-1.5 text-xs text-primary underline underline-offset-2"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          {link.label}
                        </button>
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
      {previewProof && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-4xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-bold text-foreground">{previewProof.label}</p>
                <p className="text-xs text-muted-foreground truncate max-w-[70vw]">{previewProof.url}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewProof.url}
                  download
                  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewProof(null)}
                  className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="max-h-[78vh] overflow-auto bg-background/60 p-4">
              <img
                src={previewProof.url}
                alt={previewProof.label}
                className="mx-auto max-h-[72vh] max-w-full rounded-lg border border-border object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

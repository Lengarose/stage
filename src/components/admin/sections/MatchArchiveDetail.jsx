// @ts-nocheck — admin UI uses project shadcn primitives without full prop inference.
import { useEffect, useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, ExternalLink, ImageOff, Loader2, PencilLine, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

function Field({ label, value, tone }) {
  return (
    <div className="rounded border border-border bg-secondary/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-sm font-semibold break-words", tone || "text-foreground")}>{value ?? "—"}</p>
    </div>
  );
}

function submittedScore(submission) {
  if (!submission) return null;
  const { home_score: h, away_score: a } = submission;
  if (h == null && a == null) return null;
  return `${h ?? 0} – ${a ?? 0}`;
}

/**
 * The detail an admin reads to settle a dispute.
 *
 * The layout puts the two submitted scores next to the official one on purpose:
 * a dispute is almost always "they claimed a different result", and that
 * comparison is the whole reason to open this screen.
 */
export default function MatchArchiveDetail({ matchId, onClose }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [correcting, setCorrecting] = useState(false);
  const [newHome, setNewHome] = useState("");
  const [newAway, setNewAway] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [correctError, setCorrectError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!matchId) return undefined;
    setLoading(true);
    setError(null);
    stageClient.http.get(`/match-archive/${matchId}`)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) setError(err?.message || t("admin.matchArchive.detailFailed")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [matchId, t]);

  async function submitCorrection() {
    setSaving(true);
    setCorrectError(null);
    try {
      await stageClient.http.post(`/match-archive/${matchId}/correct-score`, {
        home_score: Number(newHome),
        away_score: Number(newAway),
        reason: reason.trim(),
      });
      // Refetch rather than patch locally: the server also stamps who corrected
      // it and when, and guessing those client-side would be a second source of
      // truth for something an audit depends on.
      const fresh = await stageClient.http.get(`/match-archive/${matchId}`);
      setData(fresh);
      setCorrecting(false);
      setReason("");
    } catch (err) {
      setCorrectError(err?.message || t("admin.matchArchive.correctFailed"));
    } finally {
      setSaving(false);
    }
  }

  const match = data?.match;
  const proofs = Array.isArray(data?.proofs) ? data.proofs : [];
  const homeClaim = submittedScore(match?.home_submission) || match?.home_submitted_score;
  const awayClaim = submittedScore(match?.away_submission) || match?.away_submitted_score;
  const claimsDisagree = Boolean(homeClaim && awayClaim && homeClaim !== awayClaim);

  return (
    <Dialog open={!!matchId} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{t("admin.matchArchive.detailTitle")}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</p>
        ) : !match ? null : (
          <div className="space-y-5">
            <div className="text-center py-3 rounded-xl border border-border bg-secondary/40">
              <p className="text-sm text-muted-foreground">
                {match.home_club_name || match.home_player_name || "—"}
                <span className="mx-2 text-muted-foreground">vs</span>
                {match.away_club_name || match.away_player_name || "—"}
              </p>
              <p className="font-heading text-3xl text-foreground mt-1">
                {match.home_score ?? 0} – {match.away_score ?? 0}
              </p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">
                {t("admin.matchArchive.officialScore")}
              </p>
              {match.score_corrected_at && (
                <p className="text-[11px] text-warning mt-1">
                  {t("admin.matchArchive.correctedStamp", { date: match.score_corrected_at })}
                </p>
              )}
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                {t("admin.matchArchive.submittedScores")}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("admin.matchArchive.homeClaim")} value={homeClaim} tone={claimsDisagree ? "text-warning" : undefined} />
                <Field label={t("admin.matchArchive.awayClaim")} value={awayClaim} tone={claimsDisagree ? "text-warning" : undefined} />
              </div>
              {claimsDisagree && (
                <p className="text-[11px] text-warning mt-2">{t("admin.matchArchive.claimsDisagree")}</p>
              )}
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Field label={t("admin.matchArchive.matchId")} value={match.id} />
              <Field label={t("admin.matchArchive.type")} value={match.type || match.mode} />
              <Field label={t("admin.matchArchive.status")} value={match.status} />
              <Field label={t("admin.matchArchive.scheduled")} value={match.scheduled_date} />
              <Field label={t("admin.matchArchive.played")} value={match.played_at} />
              <Field label={t("admin.matchArchive.rankingImpact")}
                value={Number(match.stats_processed) === 1
                  ? t("admin.matchArchive.counted")
                  : t("admin.matchArchive.notCounted")} />
              <Field label={t("admin.matchArchive.homeEmail")} value={match.home_player_email || match.home_owner_email} />
              <Field label={t("admin.matchArchive.awayEmail")} value={match.away_player_email || match.away_owner_email} />
              <Field
                label={t("admin.matchArchive.wager")}
                value={Number(match.wager_stc || 0) > 0
                  ? `${Number(match.wager_stc).toLocaleString()} STC · ${match.wager_status || t("admin.matchArchive.wagerUnsettled")}`
                  : t("admin.matchArchive.noWager")}
                tone={Number(match.wager_stc || 0) > 0 ? "text-warning" : undefined}
              />
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                {t("admin.matchArchive.proofs")}
              </p>
              {proofs.length === 0 ? (
                // Saying "none" outright beats an empty area the admin has to interpret.
                <p className="text-sm text-muted-foreground flex items-center gap-2 rounded border border-dashed border-border p-4">
                  <ImageOff className="w-4 h-4 shrink-0" /> {t("admin.matchArchive.noProof")}
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {proofs.map((proof) => (
                    <button
                      key={proof.url}
                      type="button"
                      onClick={() => setPreview(proof)}
                      className="group rounded-lg border border-border overflow-hidden bg-black text-left"
                    >
                      <img src={proof.url} alt={proof.label} className="w-full h-24 object-cover" loading="lazy" />
                      <span className="block px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground group-hover:text-foreground">
                        {proof.side === "home"
                          ? t("admin.matchArchive.proofHome")
                          : proof.side === "away"
                          ? t("admin.matchArchive.proofAway")
                          : t("admin.matchArchive.proofMatch")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-border pt-4">
              {!correcting ? (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5 border-border"
                  onClick={() => {
                    setNewHome(String(match.home_score ?? 0));
                    setNewAway(String(match.away_score ?? 0));
                    setCorrectError(null);
                    setCorrecting(true);
                  }}
                >
                  <PencilLine className="w-4 h-4" /> {t("admin.matchArchive.correctScore")}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
                        {t("admin.matchArchive.newHomeScore")}
                      </label>
                      <Input type="number" min="0" step="1" value={newHome} onChange={(e) => setNewHome(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
                        {t("admin.matchArchive.newAwayScore")}
                      </label>
                      <Input type="number" min="0" step="1" value={newAway} onChange={(e) => setNewAway(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
                      {t("admin.matchArchive.correctionReason")}
                    </label>
                    <Textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={2}
                      placeholder={t("admin.matchArchive.correctionReasonPlaceholder")}
                    />
                  </div>

                  {/* Stated plainly so nobody expects the correction to move money
                      or to refresh the tables straight away. */}
                  <p className="text-[11px] text-muted-foreground rounded border border-border bg-secondary/40 p-2">
                    {t("admin.matchArchive.correctionScope")}
                  </p>

                  {correctError && (
                    <p className="text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                      {correctError}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button type="button" onClick={submitCorrection} disabled={saving || !reason.trim()} className="gap-1.5">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PencilLine className="w-4 h-4" />}
                      {t("admin.matchArchive.saveCorrection")}
                    </Button>
                    <Button type="button" variant="outline" className="border-border" onClick={() => setCorrecting(false)}>
                      {t("admin.matchArchive.cancel")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {preview && (
          <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
            <img src={preview.url} alt={preview.label} className="max-h-[80vh] max-w-full object-contain rounded" />
            <div className="flex items-center gap-2 mt-4">
              {/* download + open both offered: a proof is evidence, an admin may
                  need to keep a copy outside the app. */}
              <a href={preview.url} download target="_blank" rel="noopener noreferrer">
                <Button type="button" className="gap-1.5">
                  <Download className="w-4 h-4" /> {t("admin.matchArchive.download")}
                </Button>
              </a>
              <a href={preview.url} target="_blank" rel="noopener noreferrer">
                <Button type="button" variant="outline" className="gap-1.5 border-border">
                  <ExternalLink className="w-4 h-4" /> {t("admin.matchArchive.openOriginal")}
                </Button>
              </a>
              <Button type="button" variant="outline" onClick={() => setPreview(null)} className="gap-1.5 border-border">
                <X className="w-4 h-4" /> {t("admin.matchArchive.close")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRightLeft, Loader2, Shield } from "lucide-react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { asObject } from "@/lib/safeData";
import { useTranslation } from "@/hooks/useTranslation";
import { swalAlert } from "@/lib/swal";

const MODE_MOVE = "move";
const MODE_ASSIGN = "assign";
const MODE_DETACH = "detach";

/**
 * Admin dialog to reassign a club's president via POST /presidents/:id/transfer.
 * Pairing/matchmaking stays on club_id; this only updates president↔club links.
 */
export default function PresidentTransferDialog({
  open,
  club,
  clubs = [],
  onOpenChange,
  onDone,
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPresident, setCurrentPresident] = useState(null);
  const [presidents, setPresidents] = useState([]);
  const [mode, setMode] = useState(MODE_MOVE);
  const [targetClubId, setTargetClubId] = useState("");
  const [assignPresidentId, setAssignPresidentId] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open || !club?.id) return;
    let cancelled = false;
    setLoading(true);
    setMode(MODE_MOVE);
    setTargetClubId("");
    setAssignPresidentId("");
    setReason("");

    (async () => {
      try {
        let president = null;
        if (club.president_id) {
          president = asObject(await stageClient.entities.President.get(club.president_id).catch(() => null));
        }
        if (!president?.id) {
          const byClub = await stageClient.entities.President.filter({ club_id: club.id }, null, 1).catch(() => []);
          president = asObject(byClub?.[0]);
        }
        const all = await stageClient.entities.President.filter({}, "-created_date", 200).catch(() => []);
        if (cancelled) return;
        setCurrentPresident(president?.id ? president : null);
        setPresidents(Array.isArray(all) ? all.filter((row) => row?.id) : []);
        if (!president?.id) setMode(MODE_ASSIGN);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, club?.id, club?.president_id]);

  const otherClubs = useMemo(
    () => (clubs || []).filter((c) => c?.id && String(c.id) !== String(club?.id)),
    [clubs, club?.id]
  );

  const assignablePresidents = useMemo(
    () => presidents.filter((p) => !currentPresident?.id || String(p.id) !== String(currentPresident.id)),
    [presidents, currentPresident?.id]
  );

  const canSubmit = (() => {
    if (saving || loading) return false;
    if (mode === MODE_DETACH) return Boolean(currentPresident?.id);
    if (mode === MODE_MOVE) return Boolean(currentPresident?.id && targetClubId);
    if (mode === MODE_ASSIGN) return Boolean(assignPresidentId);
    return false;
  })();

  async function handleSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      if (mode === MODE_DETACH) {
        await stageClient.presidents.transfer(currentPresident.id, {
          club_id: null,
          reason: reason.trim() || undefined,
        });
      } else if (mode === MODE_MOVE) {
        await stageClient.presidents.transfer(currentPresident.id, {
          club_id: targetClubId,
          reason: reason.trim() || undefined,
        });
      } else {
        await stageClient.presidents.transfer(assignPresidentId, {
          club_id: club.id,
          reason: reason.trim() || undefined,
        });
      }
      onOpenChange?.(false);
      onDone?.();
    } catch (err) {
      console.error("[PresidentTransferDialog] transfer failed:", err);
      await swalAlert(err?.data?.error || err?.message || t("admin.alerts.unknownError"));
    } finally {
      setSaving(false);
    }
  }

  const presidentLabel = currentPresident
    ? (currentPresident.display_name || currentPresident.email || currentPresident.id)
    : t("admin.clubs.noPresidentLinked");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl uppercase tracking-tight flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-amber-400" />
            {t("admin.dialogs.presidentTransfer", { name: club?.name || "" })}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 mt-1">
            <div className="rounded-lg border border-border bg-secondary/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">
                {t("admin.clubs.currentPresident")}
              </p>
              <div className="flex items-center gap-2 min-w-0">
                <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                <p className="text-sm text-foreground truncate">{presidentLabel}</p>
                {currentPresident?.id ? (
                  <Link
                    to={`/presidents/${currentPresident.id}`}
                    className="text-xs text-primary hover:underline shrink-0 ml-auto"
                  >
                    {t("admin.actions.view")}
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <label className="label-xs">{t("admin.dialogs.presidentTransferMode")}</label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MODE_MOVE} disabled={!currentPresident?.id}>
                    {t("admin.dialogs.presidentTransferMove")}
                  </SelectItem>
                  <SelectItem value={MODE_ASSIGN}>{t("admin.dialogs.presidentTransferAssign")}</SelectItem>
                  <SelectItem value={MODE_DETACH} disabled={!currentPresident?.id}>
                    {t("admin.dialogs.presidentTransferDetach")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {mode === MODE_MOVE ? (
              <div className="space-y-2">
                <label className="label-xs">{t("admin.dialogs.presidentTransferTargetClub")}</label>
                <Select value={targetClubId} onValueChange={setTargetClubId}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder={t("admin.dialogs.presidentTransferSelectClub")} />
                  </SelectTrigger>
                  <SelectContent>
                    {otherClubs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.tag ? ` [${c.tag}]` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">{t("admin.dialogs.presidentTransferMoveHint")}</p>
              </div>
            ) : null}

            {mode === MODE_ASSIGN ? (
              <div className="space-y-2">
                <label className="label-xs">{t("admin.dialogs.presidentTransferSelectPresident")}</label>
                <Select value={assignPresidentId} onValueChange={setAssignPresidentId}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder={t("admin.dialogs.presidentTransferSelectPresidentPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {assignablePresidents.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.display_name || p.email || p.id}
                        {p.club_id ? ` · ${t("admin.clubs.linkedClub")}` : ` · ${t("admin.clubs.unlinked")}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">{t("admin.dialogs.presidentTransferAssignHint")}</p>
              </div>
            ) : null}

            {mode === MODE_DETACH ? (
              <p className="text-xs text-muted-foreground bg-warning/10 border border-warning/30 rounded-lg px-3 py-2">
                {t("admin.dialogs.presidentTransferDetachHint")}
              </p>
            ) : null}

            <div className="space-y-2">
              <label className="label-xs">{t("admin.dialogs.reasonOptional")}</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                placeholder={t("admin.dialogs.presidentTransferReasonPlaceholder")}
              />
            </div>

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 border border-amber-400/40 gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
              {saving ? t("admin.actions.savingDots") : t("admin.dialogs.presidentTransferConfirm")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

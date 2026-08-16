import { useState } from "react";
import { Calendar, XCircle } from "lucide-react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/useTranslation";
import {
  actorFromProfile,
  canConfirmMatchCancel,
  canRequestMatchCancel,
  canRequestMatchReschedule,
  isCancelPendingForActor,
  isPlayerManagedMatch,
} from "@/lib/matchFixtureLifecycle";

export default function GameDayFixtureActions({ game, user, myPlayer, myClub, isMyMatch, onGameUpdate }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState("");
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  if (!isMyMatch || !isPlayerManagedMatch(game)) return null;

  const actor = actorFromProfile({ user, player: myPlayer, club: myClub });
  const canRequest = canRequestMatchCancel(game, actor);
  const canConfirm = canConfirmMatchCancel(game, actor);
  const waiting = isCancelPendingForActor(game, actor);
  const canReschedule = canRequestMatchReschedule(game, actor);

  if (!canRequest && !canConfirm && !waiting && !canReschedule) return null;

  async function invoke(action, extra = {}) {
    setLoading(action);
    setError("");
    try {
      const res = await stageClient.functions.invoke("matchFixtureActions", {
        action,
        match_id: game.id,
        ...extra,
      });
      const patch = res?.data?._match_patch || {};
      onGameUpdate?.({ ...game, ...patch });
      if (action === "request_cancel") {
        onGameUpdate?.({ ...game, cancel_status: "pending", cancel_requested_by: actor.email });
      }
      setShowReschedule(false);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || t("matchFlow.actionFailed"));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mx-5 mb-3 space-y-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">
        {t("matchFlow.fixtureActions", "Fixture")}
      </p>
      {waiting ? (
        <p className="text-xs text-warning">
          {t("matchFlow.cancelWaitingOpponent", "Waiting for your opponent to confirm the cancel.")}
        </p>
      ) : null}
      {canConfirm ? (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => invoke("confirm_cancel")}
            disabled={!!loading}
            className="flex-1 bg-destructive text-white text-xs h-8"
          >
            {loading === "confirm_cancel" ? t("matchFlow.confirming") : t("matchFlow.confirmCancel", "Confirm cancel")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => invoke("decline_cancel")}
            disabled={!!loading}
            className="flex-1 text-xs h-8"
          >
            {loading === "decline_cancel" ? t("matchFlow.declining") : t("matchFlow.keepMatch", "Keep match")}
          </Button>
        </div>
      ) : null}
      {canReschedule && showReschedule ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="h-8 text-xs" />
            <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="h-8 w-28 text-xs" />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!!loading || !newDate || !newTime}
              onClick={() => invoke("request_reschedule", { new_date: newDate, new_time: newTime })}
              className="gap-1.5 text-xs h-8"
            >
              <Calendar className="h-3.5 w-3.5" />
              {loading === "request_reschedule" ? t("matchFlow.sending") : t("matchFlow.sendProposal")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowReschedule(false)} className="text-xs h-8">
              {t("matchFlow.cancel")}
            </Button>
          </div>
        </div>
      ) : null}
      <div className="flex gap-2">
        {canReschedule && !showReschedule ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowReschedule(true)}
            disabled={!!loading}
            className="flex-1 gap-1.5 text-xs h-8"
          >
            <Calendar className="h-3.5 w-3.5" />
            {t("matchFlow.changeTime", "Change time")}
          </Button>
        ) : null}
        {canRequest ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => invoke("request_cancel")}
            disabled={!!loading}
            className="flex-1 gap-1.5 text-xs h-8 border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            <XCircle className="h-3.5 w-3.5" />
            {loading === "request_cancel" ? t("matchFlow.sending") : t("matchFlow.cancelGame", "Cancel game")}
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </div>
  );
}

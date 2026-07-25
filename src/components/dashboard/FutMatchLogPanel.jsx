import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { stageClient } from "@/api/stageClient";
import { buildFutSummary } from "@/lib/dashboardData";

const RESULT_STYLE = {
  win: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  draw: "text-muted-foreground bg-secondary border-border",
  loss: "text-destructive bg-destructive/10 border-destructive/30",
};

function toLocalDatetimeInput(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatPlayedAt(value) {
  if (!value) return "—";
  const dt = new Date(value);
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) +
    " · " +
    dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function FutMatchLogPanel({ playerId, initialMatches = [], compact = false, readOnly = false, onMatchesChange }) {
  const { t } = useTranslation();
  const [matches, setMatches] = useState(initialMatches);
  const [openForm, setOpenForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    played_at: toLocalDatetimeInput(),
    result: "win",
    goals_for: "0",
    goals_against: "0",
    mode: "rivals",
    opponent_note: "",
  });

  const summary = useMemo(() => buildFutSummary(matches), [matches]);
  const visible = compact ? matches.slice(0, 5) : matches;

  useEffect(() => {
    if (!playerId) return;
    if (initialMatches?.length) {
      setMatches(initialMatches);
      return;
    }
    stageClient.entities.FutMatch.filter({ player_id: playerId }, "-played_at", compact ? 10 : 30)
      .then((rows) => setMatches(Array.isArray(rows) ? rows : []))
      .catch(() => {});
  }, [playerId, compact, initialMatches]);

  async function submitMatch(e) {
    e.preventDefault();
    if (!playerId) return;
    setSaving(true);
    setError("");
    try {
      const playedAt = new Date(form.played_at);
      const created = await stageClient.entities.FutMatch.create({
        played_at: playedAt.toISOString(),
        result: form.result,
        goals_for: Number(form.goals_for) || 0,
        goals_against: Number(form.goals_against) || 0,
        mode: form.mode,
        opponent_note: form.opponent_note.trim() || null,
      });
      const next = [created, ...matches];
      setMatches(next);
      onMatchesChange?.(next);
      setForm({
        played_at: toLocalDatetimeInput(),
        result: "win",
        goals_for: "0",
        goals_against: "0",
        mode: "rivals",
        opponent_note: "",
      });
      setOpenForm(false);
    } catch (err) {
      setError(err.message || t("commonPages.dashboardFutSaveError"));
    }
    setSaving(false);
  }

  async function removeMatch(id) {
    setDeletingId(id);
    setError("");
    try {
      await stageClient.entities.FutMatch.delete(id);
      const next = matches.filter((m) => m.id !== id);
      setMatches(next);
      onMatchesChange?.(next);
    } catch (err) {
      setError(err.message || t("commonPages.dashboardFutDeleteError"));
    }
    setDeletingId(null);
  }

  if (!playerId) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">{t("commonPages.dashboardSetupDesc")}</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border border-border bg-card", compact ? "p-4 space-y-3" : "p-5 sm:p-6 space-y-4")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-heading font-black uppercase text-lg text-foreground">
              {t("commonPages.dashboardFutTitle")}
            </h2>
            {!compact && <p className="text-xs text-muted-foreground">{t("commonPages.dashboardFutDesc")}</p>}
          </div>
        </div>
        {!readOnly ? (
          <Button
            type="button"
            size="sm"
            variant={openForm ? "outline" : "default"}
            className="gap-1.5 font-heading uppercase text-xs shrink-0"
            onClick={() => setOpenForm((v) => !v)}
          >
            <Plus className="w-3.5 h-3.5" />
            {t("commonPages.dashboardFutLogMatch")}
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("commonPages.dashboardFutWins")}</p>
          <p className="font-heading font-black text-xl text-emerald-400">{summary.wins}</p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("commonPages.dashboardFutDraws")}</p>
          <p className="font-heading font-black text-xl text-foreground">{summary.draws}</p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("commonPages.dashboardFutLosses")}</p>
          <p className="font-heading font-black text-xl text-destructive">{summary.losses}</p>
        </div>
      </div>

      {openForm && !readOnly ? (
        <form onSubmit={submitMatch} className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("commonPages.dashboardFutPlayedAt")}</label>
              <Input
                type="datetime-local"
                value={form.played_at}
                onChange={(e) => setForm((f) => ({ ...f, played_at: e.target.value }))}
                required
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("commonPages.dashboardFutResult")}</label>
              <Select value={form.result} onValueChange={(v) => setForm((f) => ({ ...f, result: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="win">{t("commonPages.dashboardFutWin")}</SelectItem>
                  <SelectItem value="draw">{t("commonPages.dashboardFutDraw")}</SelectItem>
                  <SelectItem value="loss">{t("commonPages.dashboardFutLoss")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("commonPages.dashboardFutMode")}</label>
              <Select value={form.mode} onValueChange={(v) => setForm((f) => ({ ...f, mode: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rivals">{t("commonPages.dashboardFutRivals")}</SelectItem>
                  <SelectItem value="champions">{t("commonPages.dashboardFutChampions")}</SelectItem>
                  <SelectItem value="friendly">{t("commonPages.dashboardFutFriendly")}</SelectItem>
                  <SelectItem value="squad_battles">{t("commonPages.dashboardFutSquadBattles")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("commonPages.dashboardFutGoalsFor")}</label>
              <Input type="number" min="0" value={form.goals_for} onChange={(e) => setForm((f) => ({ ...f, goals_for: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("commonPages.dashboardFutGoalsAgainst")}</label>
              <Input type="number" min="0" value={form.goals_against} onChange={(e) => setForm((f) => ({ ...f, goals_against: e.target.value }))} className="mt-1" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("commonPages.dashboardFutOpponent")}</label>
              <Input value={form.opponent_note} onChange={(e) => setForm((f) => ({ ...f, opponent_note: e.target.value }))} placeholder={t("commonPages.dashboardFutOpponentPlaceholder")} className="mt-1" />
            </div>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <Button type="submit" size="sm" disabled={saving} className="font-heading uppercase gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {t("commonPages.dashboardFutSave")}
          </Button>
        </form>
      ) : null}

      {!openForm && error ? <p className="text-xs text-destructive">{error}</p> : null}

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("commonPages.dashboardFutEmpty")}</p>
      ) : (
        <div className="space-y-2">
          {visible.map((m) => {
            const r = String(m.result || "").toLowerCase();
            return (
              <div key={m.id} className="rounded-xl border border-border px-3 py-2.5 flex items-center gap-2">
                <span className={cn("text-[10px] font-black uppercase px-2 py-1 rounded border shrink-0", RESULT_STYLE[r] || RESULT_STYLE.draw)}>
                  {r === "win" ? "W" : r === "loss" ? "L" : "D"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {m.goals_for ?? 0}–{m.goals_against ?? 0}
                    {m.opponent_note ? ` · ${m.opponent_note}` : ""}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatPlayedAt(m.played_at)} · {String(m.mode || "rivals").replace(/_/g, " ")}
                  </p>
                </div>
                {!compact && !readOnly ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={deletingId === m.id}
                    onClick={() => removeMatch(m.id)}
                  >
                    {deletingId === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { stageClient } from "@/api/stageClient";
import EmptyState from "@/components/admin/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Mic, Newspaper } from "lucide-react";

function parseJsonField(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function questionText(q) {
  return q?.question || q?.text || "";
}

/** Mis-imported rows store the template question inside `answers` JSON. */
function conferenceEmbeddedQuestion(pc) {
  const answers = parseJsonField(pc.answers);
  if (answers?.question) return answers.question;
  return null;
}

export default function PressConferencesTab({ pressConferences, seedPressQuestions, saving }) {
  const [pressQuestions, setPressQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingQuestions(true);
      try {
        const rows = await stageClient.entities.PressQuestion.list("sort_order", 200);
        if (!cancelled) setPressQuestions(rows || []);
      } catch {
        if (!cancelled) setPressQuestions([]);
      } finally {
        if (!cancelled) setLoadingQuestions(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const questionsById = Object.fromEntries(pressQuestions.map((q) => [q.id, q]));

  function conferenceQuestionLabels(pc) {
    const embedded = conferenceEmbeddedQuestion(pc);
    if (embedded) return [embedded];

    const ids = parseJsonField(pc.selected_question_ids) || pc.selected_question_ids || [];
    const list = Array.isArray(ids) ? ids : [];
    return list
      .map((id) => questionText(questionsById[id]))
      .filter(Boolean);
  }

  const realSessions = pressConferences.filter((pc) => pc.match_id || pc.club_id);
  const legacyMisimported = pressConferences.filter((pc) => !pc.match_id && !pc.club_id);

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-heading text-lg uppercase tracking-tight text-foreground flex items-center gap-2">
              <Mic className="w-4 h-4 text-primary" />
              Press question bank
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Template questions players answer in the Live Match press room. Seed once, then start a conference from a match or tournament.
            </p>
          </div>
          {seedPressQuestions && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={seedPressQuestions}
              disabled={saving}
              className="text-xs h-8"
            >
              Seed default questions
            </Button>
          )}
        </div>

        {loadingQuestions ? (
          <p className="text-sm text-muted-foreground">Loading questions…</p>
        ) : pressQuestions.length === 0 ? (
          <EmptyState icon={Mic} text="No questions in press_questions yet. Click Seed default questions." />
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {pressQuestions.map((q) => (
              <div key={q.id} className="border border-border rounded px-3 py-2 text-sm">
                <p className="text-foreground font-medium">{questionText(q)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {q.category || "general"}
                  {q.answer_a ? ` · A: ${q.answer_a}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded p-5 space-y-3">
        <h3 className="font-heading text-lg uppercase tracking-tight text-foreground">Press conference sessions</h3>
        <p className="text-xs text-muted-foreground">
          One row per match/club press event. Questions are picked from the bank when a manager opens the press room.
        </p>

        {realSessions.length === 0 && legacyMisimported.length === 0 ? (
          <EmptyState icon={Newspaper} text="No press conferences found." />
        ) : (
          <div className="space-y-2">
            {realSessions.map((pc) => {
              const labels = conferenceQuestionLabels(pc);
              return (
                <div key={pc.id} className="border border-border rounded px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground truncate">
                      {pc.match_name || pc.match_id || pc.id}
                    </span>
                    <span className="text-xs text-muted-foreground uppercase shrink-0">{pc.status || "pending"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    club: {pc.club_name || pc.club_id || "n/a"}
                    {pc.player_name ? ` · player: ${pc.player_name}` : ""}
                  </p>
                  {labels.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-foreground/90 list-disc list-inside">
                      {labels.map((label, i) => (
                        <li key={i}>{label}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}

            {legacyMisimported.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-warning mb-2">
                  {legacyMisimported.length} legacy row(s): question templates were imported into press_conferences by mistake (no match/club). Text:
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {legacyMisimported.map((pc) => {
                    const label = conferenceEmbeddedQuestion(pc);
                    const meta = parseJsonField(pc.answers);
                    return (
                      <div key={pc.id} className="border border-border/60 rounded px-3 py-2 text-sm opacity-90">
                        <p className="text-foreground">{label || pc.id}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {meta?.category || "—"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

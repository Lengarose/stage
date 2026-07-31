import { useState, useEffect, useRef, useId } from "react";
import { stageClient } from "@/api/stageClient";
import { Mic, Loader, Lock, CheckCircle2, Upload, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * GameDayPressRoom — one-time per match per club.
 * Selects a player, answers questions, uploads an image, publishes article.
 */
export default function GameDayPressRoom({ game, myClub, myPlayer, user }) {
  const { t } = useTranslation();
  const [step, setStep] = useState("loading"); // loading | locked | select | questions | image | done
  const [existingConf, setExistingConf] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [clubPlayers, setClubPlayers] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pressConf, setPressConf] = useState(null);

  // Image state
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const fileInputRef = useRef(null);
  const fileInputId = useId();

  useEffect(() => {
    async function init() {
      if (!myClub) { setStep("select"); return; }

      const [players, existing] = await Promise.all([
        stageClient.entities.Player.filter({ club_id: myClub.id }),
        stageClient.entities.PressConference.filter({ match_id: game.id, club_id: myClub.id }),
      ]);

      setClubPlayers(players || []);

      if (existing?.length > 0) {
        setExistingConf(existing[0]);
        setStep("locked");
      } else {
        setStep("select");
      }
    }
    init();
  }, [myClub, game.id]);

  async function startPressRoom(playerId) {
    setSelectedPlayer(clubPlayers.find(p => p.id === playerId));
    setLoading(true);
    const allQuestions = await stageClient.entities.PressQuestion.list("-created_date", 100);
    const shuffled = allQuestions.sort(() => Math.random() - 0.5).slice(0, 4);
    setQuestions(shuffled);
    setSelectedAnswers(new Array(4).fill(null));
    setLoading(false);
    setStep("questions");
  }

  function selectAnswer(answerKey) {
    const updated = [...selectedAnswers];
    updated[currentQuestionIndex] = answerKey;
    setSelectedAnswers(updated);
  }

  function nextQuestion() {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      const answered = selectedAnswers.filter(a => a !== null).length;
      if (answered >= 3) submitAnswers();
    }
  }

  async function submitAnswers() {
    setLoading(true);
    const conf = await stageClient.entities.PressConference.create({
      match_id: game.id,
      context: "match",
      club_id: myClub.id,
      club_name: myClub.name,
      club_logo_url: myClub.logo_url || null,
      player_id: selectedPlayer.id,
      player_name: selectedPlayer.gamertag,
      player_avatar_url: selectedPlayer.avatar_url || null,
      opponent_name: game.home_club_id === myClub.id ? game.away_club_name : game.home_club_name,
      match_name: `${game.home_club_name} vs ${game.away_club_name}`,
      status: "completed",
      selected_question_ids: questions.map(q => q.id),
      answers: questions.map((q, i) => ({
        question_id: q.id,
        question_text: q.question,
        selected_answer: selectedAnswers[i],
        answer_text: selectedAnswers[i] ? q[selectedAnswers[i]] : null,
      })),
    });
    setPressConf(conf);
    setLoading(false);
    setStep("image");
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  }

  function removeImage() {
    setImageFile(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function publishArticle() {
    setPublishing(true);
    let photoUrl = null;

    // Upload image if provided
    if (imageFile) {
      setUploading(true);
      const { file_url } = await stageClient.integrations.Core.UploadFile({ file: imageFile });
      photoUrl = file_url;
      setUploading(false);
    }

    // Build quotes from questions + answers
    const quotes = questions.map((q, i) => ({
      question: q.question,
      answer: selectedAnswers[i] ? q[selectedAnswers[i]] : "No comment.",
      reporter_name: "STAGE Reporter",
      outlet: "STAGE Press",
    })).filter((_, i) => selectedAnswers[i] !== null);

    const opponent = game.home_club_id === myClub.id ? game.away_club_name : game.home_club_name;
    const headline = `${selectedPlayer.gamertag} speaks ahead of ${myClub.name} vs ${opponent}`;

    // Create PressArticle (appears in News)
    await stageClient.entities.PressArticle.create({
      press_conference_id: pressConf.id,
      headline,
      player_name: selectedPlayer.gamertag,
      player_avatar_url: selectedPlayer.avatar_url || null,
      club_name: myClub.name,
      club_logo_url: myClub.logo_url || null,
      match_name: `${game.home_club_name} vs ${game.away_club_name}`,
      photo_url: photoUrl,
      photo_position: "50% 50%",
      photo_zoom: 120,
      quotes,
      published_at: new Date().toISOString(),
      visibility: "public",
    });

    setPublishing(false);
    setStep("done");
  }

  // ── LOADING ──────────────────────────────────────────────────────────────────
  if (step === "loading") {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  // ── LOCKED (already done) ─────────────────────────────────────────────────────
  if (step === "locked") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-success/10 border border-success/30">
          <Lock className="w-4 h-4 text-success shrink-0" />
          <div>
            <p className="text-xs font-semibold text-success">{t('commonPages.gdprComplete')}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {t('commonPages.gdprCompleteHint', { name: existingConf?.player_name })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── DONE ──────────────────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-success/10 border border-success/30">
          <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
          <div>
            <p className="text-xs font-semibold text-success">{t('commonPages.gdprArticlePublished')}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {t('commonPages.gdprArticleHint')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── SELECT PLAYER ─────────────────────────────────────────────────────────────
  if (step === "select") {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">{t('commonPages.gdprSelectPlayer')}</p>
        {loading ? (
          <div className="flex justify-center py-4"><Loader className="w-5 h-5 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-2">
            {clubPlayers.map(player => (
              <button type="button" key={player.id} onClick={() => startPressRoom(player.id)}
                className="w-full text-left p-3 rounded-lg bg-secondary/40 border border-border hover:border-primary/30 transition-all flex items-center gap-3">
                {player.avatar_url
                  ? <img src={player.avatar_url} alt={player.gamertag} className="w-8 h-8 rounded-full object-cover border border-border" />
                  : <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">{player.gamertag[0]}</div>
                }
                <div>
                  <p className="text-sm font-semibold text-foreground">{player.gamertag}</p>
                  <p className="text-xs text-muted-foreground">{player.position}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── QUESTIONS ─────────────────────────────────────────────────────────────────
  if (step === "questions") {
    const currentQ = questions[currentQuestionIndex];
    const answered = selectedAnswers.filter(a => a !== null).length;
    const isLast = currentQuestionIndex === questions.length - 1;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectedPlayer?.avatar_url
              ? <img src={selectedPlayer.avatar_url} alt={selectedPlayer.gamertag} className="w-6 h-6 rounded-full object-cover" />
              : null
            }
            <h3 className="text-sm font-bold text-foreground">{selectedPlayer?.gamertag}</h3>
          </div>
          <span className="text-[10px] text-muted-foreground">Q{currentQuestionIndex + 1}/{questions.length}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6"><Loader className="w-5 h-5 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">{currentQ?.question}</p>
            <div className="space-y-2">
              {["answer_a", "answer_b", "answer_c", "answer_d"].map((key, idx) => (
                <button key={key} onClick={() => selectAnswer(key)}
                  className={cn(
                    "w-full text-left p-2.5 rounded-lg border text-xs transition-all",
                    selectedAnswers[currentQuestionIndex] === key
                      ? "bg-primary/15 border-primary/40 text-foreground"
                      : "bg-secondary/40 border-border hover:border-primary/30 text-foreground"
                  )}>
                  <span className="font-bold text-primary">{String.fromCharCode(65 + idx)}.</span>{" "}{currentQ?.[key]}
                </button>
              ))}
            </div>
            <Button onClick={nextQuestion} className="w-full"
              disabled={isLast && answered < 3}>
              {isLast ? (answered >= 3 ? t('commonPages.gdprContinueImage') : t('commonPages.gdprAnswerMore', { n: 3 - answered })) : t('commonPages.gdprNext')}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">{t('commonPages.gdprAnsweredCount', { count: answered, total: 4, min: 3 })}</p>
          </div>
        )}
      </div>
    );
  }

  // ── IMAGE UPLOAD + PREVIEW ────────────────────────────────────────────────────
  if (step === "image") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">{t('commonPages.gdprAddPhoto')}</h3>
          <span className="text-[10px] text-muted-foreground ml-auto">{t('commonPages.gdprOptional')}</span>
        </div>

        {!imagePreviewUrl ? (
          <label htmlFor={fileInputId}
            className="w-full border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-2 hover:border-primary/40 transition-colors cursor-pointer touch-manipulation">
            <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">{t('commonPages.gdprClickUpload')}</p>
            <p className="text-[10px] text-muted-foreground/60">{t('commonPages.gdprFileHint')}</p>
          </label>
        ) : (
          <div className="relative rounded-xl overflow-hidden border border-border">
            <img src={imagePreviewUrl} alt="Preview" className="w-full h-48 object-cover" />
            <button type="button" onClick={removeImage}
              className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
              <p className="text-xs text-white font-semibold">{selectedPlayer?.gamertag}</p>
              <p className="text-[10px] text-white/70">{myClub?.name}</p>
            </div>
          </div>
        )}

        <input id={fileInputId} ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />

        <div className="flex gap-2">
          <Button variant="outline" onClick={publishArticle} disabled={publishing || uploading} className="flex-1">
            {publishing || uploading
              ? <div className="w-4 h-4 border-2 border-border border-t-foreground rounded-full animate-spin" />
              : t('commonPages.gdprSkipPublish')
            }
          </Button>
          <Button onClick={publishArticle} disabled={publishing || uploading} className="flex-1">
            {publishing || uploading
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><Upload className="w-3.5 h-3.5" /> {t('commonPages.gdprPublishArticle')}</>
            }
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          {t('commonPages.gdprPublishHint')}
        </p>
      </div>
    );
  }

  return null;
}
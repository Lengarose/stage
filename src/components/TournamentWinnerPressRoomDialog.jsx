import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Mic, CheckCircle, Newspaper, Camera, Upload, Trophy } from "lucide-react";

const REPORTERS = [
  { name: "Marcus Webb",   outlet: "STAGE Daily",      avatar: "MW", color: "bg-blue-500/20 border-blue-500/40 text-blue-400" },
  { name: "Aria Fontaine", outlet: "Football Voice",   avatar: "AF", color: "bg-purple-500/20 border-purple-500/40 text-purple-400" },
  { name: "Diego Reyes",   outlet: "MatchZone",        avatar: "DR", color: "bg-orange-500/20 border-orange-500/40 text-orange-400" },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateHeadline(clubName, answerText) {
  const quote = answerText.length > 80 ? answerText.slice(0, 77) + "…" : answerText;
  return `${clubName}: "${quote}"`;
}

// ── Press Room Step ───────────────────────────────────────────────────────────
function PressRoomStep({ winnerClub, questions, answers, onAnswer, onLeave }) {
  const [activeIdx, setActiveIdx] = useState(null);
  const MAX_ANSWERS = 3;
  const canAnswerMore = answers.length < MAX_ANSWERS;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-warning/10 border border-warning/30 shrink-0 overflow-hidden flex items-center justify-center">
          {winnerClub.logo_url
            ? <img src={winnerClub.logo_url} alt={winnerClub.name} className="w-full h-full object-cover" />
            : <Trophy className="w-5 h-5 text-warning" />}
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground leading-none">{winnerClub.name}</p>
          <p className="text-[10px] text-muted-foreground">🏆 Champion's Press Conference</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground bg-secondary px-2.5 py-1 rounded-full border border-border">
            {answers.length}/{MAX_ANSWERS} answered
          </span>
          <Button size="sm" variant="outline" onClick={onLeave} disabled={answers.length === 0}
            className="text-xs border-border text-muted-foreground h-7">
            {answers.length > 0 ? "Publish →" : "Answer first"}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {questions.map((q, idx) => {
          const reporter = REPORTERS[idx];
          const answered = answers.find(a => a.question_id === q.id);
          const isActive = activeIdx === idx;

          return (
            <div key={q.id}>
              <button
                onClick={() => !answered && canAnswerMore && setActiveIdx(isActive ? null : idx)}
                className={cn(
                  "w-full flex flex-col items-start gap-2 rounded-xl border p-3 transition-all text-left",
                  answered
                    ? "bg-success/5 border-success/30 opacity-80 cursor-default"
                    : isActive
                    ? "bg-card border-warning/50 shadow-md shadow-warning/10"
                    : canAnswerMore
                    ? `bg-secondary/60 ${reporter.color} hover:opacity-90 cursor-pointer`
                    : "bg-secondary/30 border-border/50 opacity-50 cursor-not-allowed"
                )}
              >
                <div className="flex items-center gap-2 w-full">
                  <div className={cn("w-7 h-7 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0", reporter.color)}>
                    {reporter.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground leading-none truncate">{reporter.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{reporter.outlet}</p>
                  </div>
                  {answered && <CheckCircle className="w-4 h-4 text-success shrink-0" />}
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed">{q.question}</p>
              </button>

              {isActive && !answered && (
                <div className="mt-2 space-y-1.5 pl-2">
                  {[q.answer_a, q.answer_b, q.answer_c].filter(Boolean).map((ans, ai) => (
                    <button key={ai}
                      onClick={() => {
                        onAnswer({ question_id: q.id, question: q.question, answer: ans, reporter_name: reporter.name, outlet: reporter.outlet });
                        setActiveIdx(null);
                      }}
                      className="w-full text-left text-xs bg-secondary hover:bg-warning/10 hover:border-warning/40 border border-border rounded-lg px-3 py-2.5 text-foreground transition-all leading-relaxed">
                      {ans}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {answers.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border/50">
          {answers.map((a, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="text-muted-foreground shrink-0 mt-0.5">{a.reporter_name}:</span>
              <span className="text-foreground/70 italic line-clamp-2">"{a.answer}"</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Photo Upload Step ─────────────────────────────────────────────────────────
function PhotoUploadStep({ winnerClub, tournamentName, headline, onSubmit, onSkip }) {
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [posX, setPosX] = useState(50);
  const [posY, setPosY] = useState(50);
  const [zoom, setZoom] = useState(120);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setPhotoUrl(file_url);
    setUploading(false);
  }

  function handleMouseMove(e) {
    if (!dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setPosX(Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))));
    setPosY(Math.round(Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <h3 className="text-xl font-bold text-foreground font-heading">Champion's Photo</h3>
        <p className="text-muted-foreground text-sm mt-1">Upload a celebration photo, then drag to position it.</p>
      </div>

      <div className="rounded-2xl border border-warning/30 bg-secondary overflow-hidden">
        <div
          className={cn("relative h-52 w-full overflow-hidden select-none",
            photoUrl ? "cursor-grab active:cursor-grabbing" : "bg-muted flex items-center justify-center"
          )}
          style={photoUrl ? { backgroundImage: `url(${photoUrl})`, backgroundSize: `${zoom}%`, backgroundPosition: `${posX}% ${posY}%`, backgroundRepeat: "no-repeat" } : {}}
          onMouseDown={() => photoUrl && setDragging(true)}
          onMouseUp={() => setDragging(false)}
          onMouseLeave={() => setDragging(false)}
          onMouseMove={handleMouseMove}
        >
          {!photoUrl && (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Camera className="w-8 h-8 opacity-30" />
              <span className="text-xs opacity-50">Photo will appear here</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/30 border border-warning/40 text-yellow-300 text-[9px] font-bold uppercase tracking-widest mb-2">
              <Trophy className="w-2 h-2" /> Champion
            </div>
            <p className="text-sm font-bold text-white font-heading leading-tight drop-shadow-lg line-clamp-2">{headline}</p>
          </div>
          {photoUrl && <div className="absolute top-2 right-2 bg-black/60 text-white text-[9px] px-2 py-1 rounded-full pointer-events-none">Drag to reposition</div>}
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border/30">
          {winnerClub.logo_url && <img src={winnerClub.logo_url} alt={winnerClub.name} className="w-6 h-6 rounded object-cover border border-border" />}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground truncate">{winnerClub.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">🏆 {tournamentName}</p>
          </div>
        </div>
      </div>

      <button onClick={() => fileRef.current?.click()} disabled={uploading}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-border hover:border-warning/40 hover:bg-secondary/50 transition-all text-sm text-muted-foreground disabled:opacity-50">
        {uploading
          ? <><div className="w-4 h-4 border-2 border-warning/30 border-t-warning rounded-full animate-spin" /> Uploading...</>
          : <><Upload className="w-4 h-4" /> {photoUrl ? "Change Photo" : "Upload Celebration Photo"}</>}
      </button>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

      {photoUrl && (
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Zoom — {zoom}%</label>
          <input type="range" min={50} max={300} value={zoom} onChange={e => setZoom(Number(e.target.value))} className="w-full accent-primary" />
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onSkip} className="flex-1 border-border text-muted-foreground">Skip Photo</Button>
        <Button onClick={() => onSubmit(photoUrl, `${posX}% ${posY}%`, zoom)} disabled={uploading}
          className="flex-1 bg-warning text-black font-heading font-bold">
          🏆 Publish Article
        </Button>
      </div>
    </div>
  );
}

// ── Main Dialog ───────────────────────────────────────────────────────────────
export default function TournamentWinnerPressRoomDialog({ open, onClose, tournament, winnerClub, user }) {
  const [step, setStep] = useState("press_room");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [pendingAnswers, setPendingAnswers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    base44.entities.PressQuestion.filter({ category: "tournament_winner" }, null, 50)
      .then(qs => {
        setQuestions(shuffle(qs).slice(0, 3));
        setLoading(false);
      });
  }, [open]);

  function handleAnswer(answerObj) {
    setAnswers(prev => [...prev, answerObj]);
  }

  function handleLeave() {
    if (answers.length === 0) return;
    setPendingAnswers(answers);
    setStep("photo_upload");
  }

  async function handlePublish(photoUrl, photoBgPos, photoZoom) {
    setPublishing(true);
    const answersToPublish = pendingAnswers || answers;
    const firstAnswer = answersToPublish[0];
    const headline = generateHeadline(winnerClub.name, firstAnswer.answer);
    const registeredClubs = tournament.registered_clubs || [];

    const quotes = answersToPublish.map(a => ({
      question: a.question,
      answer: a.answer,
      reporter_name: a.reporter_name,
      outlet: a.outlet,
      headline: generateHeadline(winnerClub.name, a.answer),
    }));

    // Create press article with tournament visibility
    const article = await base44.entities.PressArticle.create({
      press_conference_id: "",
      headline,
      player_name: winnerClub.name,
      player_avatar_url: winnerClub.logo_url || "",
      club_name: winnerClub.name,
      club_logo_url: winnerClub.logo_url || "",
      match_name: `🏆 ${tournament.name} Champions`,
      tournament_name: tournament.name,
      tournament_id: tournament.id,
      quotes,
      photo_url: photoUrl || null,
      photo_position: photoBgPos || "50% 50%",
      photo_zoom: photoZoom || 120,
      published_at: new Date().toISOString(),
      visibility: "tournament",
      registered_clubs: registeredClubs,
    });

    // Idempotency record
    await base44.entities.PressConference.create({
      match_id: tournament.id,
      context: "tournament_winner",
      tournament_id: tournament.id,
      club_id: winnerClub.id,
      club_name: winnerClub.name,
      club_logo_url: winnerClub.logo_url || "",
      player_name: winnerClub.name,
      tournament_name: tournament.name,
      status: "completed",
      answers: quotes,
    });

    // Post in Feed — visible to followers of winner club
    await base44.entities.Post.create({
      author_email: user.email,
      author_name: winnerClub.name,
      author_avatar: winnerClub.logo_url || null,
      content: `🏆 ${winnerClub.name} wins ${tournament.name}!\n\n"${firstAnswer.answer.slice(0, 250)}"`,
      club_id: winnerClub.id,
      club_name: winnerClub.name,
      tournament_id: tournament.id,
      tags: ["tournament_winner"],
      media_type: "none",
      likes: [],
      likes_count: 0,
      comments_count: 0,
    });

    setPublishing(false);
    setStep("published");
  }

  function handleClose() {
    setStep("press_room");
    setQuestions([]);
    setAnswers([]);
    setPendingAnswers(null);
    setLoading(true);
    onClose();
  }

  const headline = pendingAnswers?.[0]
    ? generateHeadline(winnerClub?.name || "", pendingAnswers[0].answer)
    : "";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-warning/30 max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-warning via-yellow-300 to-warning" />
        <DialogHeader className="sr-only">
          <DialogTitle>Champion's Press Conference</DialogTitle>
        </DialogHeader>

        <div className="pt-3">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-7 h-7 border-4 border-warning/20 border-t-warning rounded-full animate-spin" />
            </div>
          )}

          {!loading && step === "press_room" && (
            <PressRoomStep
              winnerClub={winnerClub}
              questions={questions}
              answers={answers}
              onAnswer={handleAnswer}
              onLeave={handleLeave}
            />
          )}

          {step === "photo_upload" && (
            <PhotoUploadStep
              winnerClub={winnerClub}
              tournamentName={tournament?.name || ""}
              headline={headline}
              onSubmit={handlePublish}
              onSkip={() => handlePublish(null)}
            />
          )}

          {step === "published" && (
            <div className="flex flex-col items-center gap-5 py-6 text-center">
              <div className="w-14 h-14 rounded-full bg-warning/10 border border-warning/30 flex items-center justify-center">
                <Newspaper className="w-7 h-7 text-warning" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground font-heading">Article Published! 🏆</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  The champion's article is live in the News section and your club's Feed.<br />
                  Visible to all tournament participants and club followers.
                </p>
              </div>
              <Button onClick={handleClose} className="w-full bg-warning text-black font-heading font-bold">Close</Button>
            </div>
          )}

          {publishing && (
            <div className="flex items-center justify-center py-6 gap-3">
              <div className="w-6 h-6 border-4 border-warning/20 border-t-warning rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">Publishing article…</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
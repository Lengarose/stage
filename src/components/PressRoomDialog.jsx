import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Mic, X, ChevronRight, CheckCircle, Newspaper, Clock, Camera, Upload } from "lucide-react";

const REPORTERS = [
  { name: "Marcus Webb",   outlet: "STAGE Daily",      avatar: "MW", color: "bg-blue-500/20 border-blue-500/40 text-blue-400" },
  { name: "Aria Fontaine", outlet: "Football Voice",   avatar: "AF", color: "bg-purple-500/20 border-purple-500/40 text-purple-400" },
  { name: "Diego Reyes",   outlet: "MatchZone",        avatar: "DR", color: "bg-orange-500/20 border-orange-500/40 text-orange-400" },
  { name: "Priya Sharma",  outlet: "Pro Clubs Weekly", avatar: "PS", color: "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateHeadline(playerName, answerText) {
  const quote = answerText.length > 60 ? answerText.slice(0, 57) + "…" : answerText;
  return `${playerName}: "${quote}"`;
}

// ── Step: Manager selects player ──────────────────────────────────────────────
function StepSelectPlayer({ clubPlayers, onSelect }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground font-heading">PRE-MATCH PRESS ROOM</h2>
        <p className="text-xs text-muted-foreground mt-1">Choose who will face the press today</p>
      </div>
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {clubPlayers.map(p => (
          <button key={p.id} onClick={() => onSelect(p)}
            className="w-full flex items-center gap-3 bg-secondary hover:bg-secondary/80 border border-border hover:border-primary/40 rounded-xl p-3 transition-all text-left group">
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 shrink-0 overflow-hidden flex items-center justify-center text-xs font-bold text-primary">
              {p.avatar_url
                ? <img src={p.avatar_url} alt={p.gamertag} className="w-full h-full object-cover" />
                : p.gamertag?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm text-foreground">{p.gamertag}</p>
              <p className="text-xs text-muted-foreground">{p.position} · {p.platform}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto group-hover:text-primary transition-colors" />
          </button>
        ))}
        {clubPlayers.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-6">No players found in your squad.</p>
        )}
      </div>
    </div>
  );
}

// ── Step: Waiting (manager view after sending invite) ─────────────────────────
function StepWaiting({ playerName }) {
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="w-16 h-16 rounded-full bg-warning/10 border border-warning/30 flex items-center justify-center">
        <Clock className="w-8 h-8 text-warning animate-pulse" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-foreground font-heading">Invitation Sent</h2>
        <p className="text-muted-foreground text-sm mt-2">
          <strong className="text-foreground">{playerName}</strong> has been invited to the press room.<br />
          They'll receive a notification and message to answer the questions.
        </p>
      </div>
      <p className="text-xs text-muted-foreground opacity-60">You can close this — the player handles the rest.</p>
    </div>
  );
}

// ── Step: Press Room (player answers questions) ───────────────────────────────
function StepPressRoom({ selectedPlayer, questions, answers, onAnswer, onLeave, maxAnswers }) {
  const [activeIdx, setActiveIdx] = useState(null);
  const [customTexts, setCustomTexts] = useState({});
  const answeredCount = answers.length;
  const canAnswerMore = answeredCount < maxAnswers;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold text-primary">
            {selectedPlayer.avatar_url
              ? <img src={selectedPlayer.avatar_url} alt={selectedPlayer.gamertag} className="w-full h-full object-cover" />
              : selectedPlayer.gamertag?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-bold text-foreground leading-none">{selectedPlayer.gamertag}</p>
            <p className="text-[10px] text-muted-foreground">at the podium</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground bg-secondary px-2.5 py-1 rounded-full border border-border">
            {answeredCount}/{maxAnswers} answered
          </span>
          <Button size="sm" variant="outline" onClick={onLeave} disabled={answeredCount === 0}
            className="text-xs border-border text-muted-foreground h-7">
            {answeredCount > 0 ? "Publish & Leave" : "No answers yet"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {questions.map((q, idx) => {
          const reporter = REPORTERS[idx];
          const answered = answers.find(a => a.question_id === q.id);
          const isActive = activeIdx === idx;

          return (
            <div key={q.id} className="flex flex-col">
              <button
                onClick={() => !answered && canAnswerMore && setActiveIdx(isActive ? null : idx)}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-xl border p-3 transition-all text-left",
                  answered
                    ? "bg-success/5 border-success/30 opacity-80 cursor-default"
                    : isActive
                    ? "bg-card border-primary/50 shadow-md shadow-primary/10"
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
                <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2">{q.question}</p>
              </button>

              {isActive && !answered && (
                <div className="mt-2 space-y-1.5">
                  {[q.answer_a, q.answer_b, q.answer_c, q.answer_d].map((ans, ai) => (
                    <button key={ai}
                      onClick={() => {
                        onAnswer({ question_id: q.id, question: q.question, answer: ans, reporter_name: reporter.name, outlet: reporter.outlet });
                        setActiveIdx(null);
                      }}
                      className="w-full text-left text-xs bg-secondary hover:bg-primary/10 hover:border-primary/40 border border-border rounded-lg px-3 py-2.5 text-foreground transition-all leading-relaxed">
                      {ans}
                    </button>
                  ))}
                  {/* Custom answer */}
                  <div className="flex flex-col gap-1.5 pt-1">
                    <textarea
                      rows={2}
                      value={customTexts[q.id] || ""}
                      onChange={e => setCustomTexts(t => ({ ...t, [q.id]: e.target.value }))}
                      placeholder="Write your own answer…"
                      className="w-full text-xs bg-secondary border border-border rounded-lg px-3 py-2.5 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 resize-none leading-relaxed"
                    />
                    <button
                      disabled={!customTexts[q.id]?.trim()}
                      onClick={() => {
                        const ans = customTexts[q.id].trim();
                        onAnswer({ question_id: q.id, question: q.question, answer: ans, reporter_name: reporter.name, outlet: reporter.outlet });
                        setActiveIdx(null);
                      }}
                      className="w-full text-xs bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary rounded-lg px-3 py-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                      ✏️ Submit my answer
                    </button>
                  </div>
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
              <span className="text-foreground/70 italic">"{a.answer}"</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Step: Photo Upload + Position + Preview ────────────────────────────────
function StepPhotoUpload({ playerName, playerAvatarUrl, clubName, clubLogoUrl, matchName, headline, onSubmit, onSkip }) {
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
    const nx = Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
    const ny = Math.round(Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)));
    setPosX(nx); setPosY(ny);
  }

  function handleTouchMove(e) {
    if (!dragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = Math.round(Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width) * 100)));
    const ny = Math.round(Math.max(0, Math.min(100, ((touch.clientY - rect.top) / rect.height) * 100)));
    setPosX(nx); setPosY(ny);
  }

  const bgPos = `${posX}% ${posY}%`;

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <h3 className="text-xl font-bold text-foreground font-heading">Article Photo</h3>
        <p className="text-muted-foreground text-sm mt-1">Upload a photo, then drag to position it perfectly.</p>
      </div>

      {/* Article preview */}
      <div className="rounded-2xl border border-purple-500/20 bg-secondary overflow-hidden">
        {/* Hero */}
        <div
          className={cn(
            "relative h-52 w-full overflow-hidden select-none",
            photoUrl ? "cursor-grab active:cursor-grabbing" : "bg-muted flex items-center justify-center"
          )}
          style={photoUrl ? {
            backgroundImage: `url(${photoUrl})`,
            backgroundSize: `${zoom}%`,
            backgroundPosition: bgPos,
            backgroundRepeat: "no-repeat",
          } : {}}
          onMouseDown={() => photoUrl && setDragging(true)}
          onMouseUp={() => setDragging(false)}
          onMouseLeave={() => setDragging(false)}
          onMouseMove={handleMouseMove}
          onTouchStart={() => photoUrl && setDragging(true)}
          onTouchEnd={() => setDragging(false)}
          onTouchMove={handleTouchMove}
        >
          {!photoUrl && (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Camera className="w-8 h-8 opacity-30" />
              <span className="text-xs opacity-50">Photo will appear here</span>
            </div>
          )}
          {/* Gradient overlay + title */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/30 border border-purple-500/40 text-purple-300 text-[9px] font-bold uppercase tracking-widest mb-2">
              <Mic className="w-2 h-2" /> Press Conference
            </div>
            <p className="text-sm font-bold text-white font-heading leading-tight drop-shadow-lg line-clamp-2">{headline || `${playerName}: “...”`}</p>
          </div>
          {photoUrl && (
            <div className="absolute top-2 right-2 bg-black/60 text-white text-[9px] px-2 py-1 rounded-full pointer-events-none">
              Drag to reposition
            </div>
          )}
        </div>

        {/* Byline preview */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border/30">
          {playerAvatarUrl && <img src={playerAvatarUrl} alt={playerName} className="w-7 h-7 rounded-full object-cover border border-purple-500/30" />}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground truncate">{playerName}</p>
            <p className="text-[10px] text-muted-foreground truncate">{clubName}{matchName ? ` · ${matchName}` : ""}</p>
          </div>
          {clubLogoUrl && <img src={clubLogoUrl} alt={clubName} className="w-6 h-6 rounded object-cover border border-border" />}
        </div>
      </div>

      {/* Upload button */}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-secondary/50 transition-all text-sm text-muted-foreground disabled:opacity-50"
      >
        {uploading ? (
          <><div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> Uploading...</>
        ) : (
          <><Upload className="w-4 h-4" /> {photoUrl ? "Change Photo" : "Upload Photo"}</>
        )}
      </button>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

      {/* Zoom slider — only shown when photo uploaded */}
      {photoUrl && (
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Zoom — {zoom}%</label>
          <input type="range" min={50} max={300} value={zoom} onChange={e => setZoom(Number(e.target.value))} className="w-full accent-primary" />
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onSkip} className="flex-1 border-border text-muted-foreground">Skip Photo</Button>
        <Button
          onClick={() => onSubmit(photoUrl, bgPos, zoom)}
          disabled={uploading}
          className="flex-1 bg-primary text-primary-foreground font-heading"
        >
          Publish Article
        </Button>
      </div>
    </div>
  );
}

// ── Step: Published ───────────────────────────────────────────────────────────
function StepPublished({ article }) {
  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div className="w-14 h-14 rounded-full bg-success/10 border border-success/30 flex items-center justify-center">
        <Newspaper className="w-7 h-7 text-success" />
      </div>
      <div>
        <h3 className="text-xl font-bold text-foreground font-heading">Article Published!</h3>
        <p className="text-muted-foreground text-sm mt-1">Head to the News section to read it.</p>
      </div>
      {article && (
        <div className="bg-secondary border border-border rounded-xl p-4 w-full text-left space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{article.tournament_name}</p>
          <p className="font-bold text-foreground leading-tight">{article.headline}</p>
          <div className="flex items-center gap-2 pt-1">
            {article.club_logo_url && (
              <img src={article.club_logo_url} alt={article.club_name} className="w-5 h-5 rounded object-cover" />
            )}
            <span className="text-xs text-muted-foreground">{article.club_name} · {article.match_name}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Dialog ───────────────────────────────────────────────────────────────
// Props:
//   mode: "manager" | "player"
//   conference: existing PressConference record (if any)
//   clubPlayers: players in the manager's club
//   matchData: { matchId, matchName, tournamentName, clubId }
//   myClub: club object
//   myPlayer: current user's player
//   open / onClose / onConferenceCreated
export default function PressRoomDialog({ open, onClose, mode, conference, clubPlayers, matchData, myClub, myPlayer, onConferenceCreated }) {
  const [step, setStep] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [pendingAnswers, setPendingAnswers] = useState(null);
  const [published, setPublished] = useState(null);
  const [loading, setLoading] = useState(false);
  const MAX_ANSWERS = 3;

  useEffect(() => {
    if (!open) return;
    if (mode === "self") {
      // PvP: player is themselves, go straight to press room
      loadSelfConference();
    } else if (mode === "manager") {
      if (conference?.status === "pending") {
        setStep("waiting");
      } else {
        setStep("select_player");
      }
    } else if (mode === "player") {
      loadPlayerConference();
    }
  }, [open, mode, conference?.id]);

  async function loadPlayerConference() {
    if (!conference) return;
    setLoading(true);
    const allQs = await base44.entities.PressQuestion.list(null, 200);
    const selectedIds = conference.selected_question_ids || [];
    let picked = allQs.filter(q => selectedIds.includes(q.id));
    if (picked.length < 4) picked = shuffle(allQs).slice(0, 4);
    setQuestions(picked);
    setAnswers([]);
    setLoading(false);
    setStep("press_room");
  }

  async function loadSelfConference() {
    setLoading(true);
    const allQs = await base44.entities.PressQuestion.list(null, 200);
    if (conference?.selected_question_ids?.length >= 4) {
      // Already created, just load it
      const picked = allQs.filter(q => conference.selected_question_ids.includes(q.id));
      setQuestions(picked.length >= 4 ? picked : shuffle(allQs).slice(0, 4));
      setAnswers(conference.answers || []);
    } else {
      // Create conference for this player
      const picked = shuffle(allQs).slice(0, 4);
      const conf = await base44.entities.PressConference.create({
        match_id: matchData.matchId,
        club_id: myPlayer?.club_id || myPlayer?.id || "",
        club_name: "",
        club_logo_url: "",
        player_id: myPlayer?.id,
        player_name: myPlayer?.gamertag || "",
        player_avatar_url: myPlayer?.avatar_url || "",
        opponent_name: matchData.opponentName || "",
        match_name: matchData.matchName || "",
        tournament_name: matchData.tournamentName || "",
        status: "pending",
        selected_question_ids: picked.map(q => q.id),
        answers: [],
      });
      onConferenceCreated?.(conf);
      setQuestions(picked);
      setAnswers([]);
    }
    setLoading(false);
    setStep("press_room");
  }

  // Manager selects a player → create conference + notify player
  async function handleSelectPlayer(player) {
    setLoading(true);
    const allQs = await base44.entities.PressQuestion.list(null, 200);
    const picked = shuffle(allQs).slice(0, 4);
    const questionIds = picked.map(q => q.id);

    const conf = await base44.entities.PressConference.create({
      match_id: matchData.matchId,
      club_id: matchData.clubId,
      club_name: myClub?.name || "",
      club_logo_url: myClub?.logo_url || "",
      player_id: player.id,
      player_name: player.gamertag,
      player_avatar_url: player.avatar_url || "",
      opponent_name: matchData.opponentName || "",
      match_name: matchData.matchName || "",
      tournament_name: matchData.tournamentName || "",
      status: "pending",
      selected_question_ids: questionIds,
      answers: [],
    });

    // Send notification to player
    await base44.entities.Notification.create({
      recipient_email: player.email,
      type: "invite",
      title: "🎤 Press Room Invitation",
      body: `You've been selected to speak at the pre-match press conference for ${matchData.matchName}. Head to the Live Match Room to answer reporters' questions.`,
      link: `/live/${matchData.matchId}`,
      related_id: conf.id,
      read: false,
    });

    // Send DM to player
    const managerEmail = (await base44.auth.me()).email;
    const conversationId = [managerEmail, player.email].sort().join("_");
    await base44.entities.DirectMessage.create({
      conversation_id: conversationId,
      sender_email: managerEmail,
      sender_name: myPlayer?.gamertag || "Manager",
      recipient_email: player.email,
      recipient_name: player.gamertag,
      content: `🎤 You've been selected to attend the pre-match press conference for ${matchData.matchName}. Click here or go to the Live Match Room to answer reporters' questions: /live/${matchData.matchId}`,
      read: false,
    });

    setLoading(false);
    onConferenceCreated?.(conf);
    setStep("waiting");
  }

  // Player answers a question
  function handleAnswer(answerObj) {
    setAnswers(prev => [...prev, answerObj]);
  }

  // Player leaves — go to photo upload step first
  function handleLeave() {
    if (answers.length === 0) { onClose(); return; }
    setPendingAnswers(answers);
    setStep("photo_upload");
  }

  // After photo (or skip), actually publish
  async function handlePublish(photoUrl, photoBgPos, photoZoom) {
    setLoading(true);
    const answersToPublish = pendingAnswers || answers;
    const firstAnswer = answersToPublish[0];
    const headline = generateHeadline(
      conference?.player_name || myPlayer?.gamertag || "Player",
      firstAnswer.answer
    );

    const quotes = answersToPublish.map(a => ({
      question: a.question,
      answer: a.answer,
      reporter_name: a.reporter_name,
      outlet: a.outlet,
      headline: generateHeadline(conference?.player_name || myPlayer?.gamertag, a.answer),
    }));

    const articleData = {
      press_conference_id: conference?.id || "",
      headline,
      player_name: conference?.player_name || myPlayer?.gamertag || "",
      player_avatar_url: conference?.player_avatar_url || myPlayer?.avatar_url || "",
      club_name: conference?.club_name || myClub?.name || "",
      club_logo_url: conference?.club_logo_url || myClub?.logo_url || "",
      match_name: conference?.match_name || matchData?.matchName || "",
      tournament_name: conference?.tournament_name || matchData?.tournamentName || "",
      quotes,
      photo_url: photoUrl || null,
      photo_position: photoBgPos || "50% 50%",
      photo_zoom: photoZoom || 120,
      published_at: new Date().toISOString(),
    };

    const created = await base44.entities.PressArticle.create(articleData);

    if (conference?.id) {
      await base44.entities.PressConference.update(conference.id, {
        status: "completed",
        answers: quotes,
      });
    }

    setPublished(created);
    setLoading(false);
    setStep("published");
  }

  function handleClose() {
    setStep(null);
    setQuestions([]);
    setAnswers([]);
    setPublished(null);
    onClose();
  }

  const playerForRoom = questions.length > 0 ? {
    gamertag: mode === "self" ? (myPlayer?.gamertag || "") : (conference?.player_name || myPlayer?.gamertag || ""),
    avatar_url: mode === "self" ? (myPlayer?.avatar_url || "") : (conference?.player_avatar_url || myPlayer?.avatar_url || ""),
  } : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-lg overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />
        <DialogHeader className="sr-only">
          <DialogTitle>Press Room</DialogTitle>
        </DialogHeader>

        <div className="pt-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-7 h-7 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          )}

          {!loading && step === "select_player" && (
            <div className="flex flex-col gap-4">
              <StepSelectPlayer clubPlayers={clubPlayers} onSelect={handleSelectPlayer} />
              <Button variant="outline" onClick={handleClose} className="border-border text-muted-foreground">
                <X className="w-4 h-4 mr-2" /> Cancel
              </Button>
            </div>
          )}

          {!loading && step === "waiting" && (
            <div className="flex flex-col gap-4">
              <StepWaiting playerName={conference?.player_name || "the player"} />
              <Button onClick={handleClose} className="w-full bg-primary text-primary-foreground">Close</Button>
            </div>
          )}

          {!loading && step === "press_room" && playerForRoom && (
            <StepPressRoom
              selectedPlayer={playerForRoom}
              questions={questions}
              answers={answers}
              onAnswer={handleAnswer}
              onLeave={handleLeave}
              maxAnswers={MAX_ANSWERS}
            />
          )}

          {!loading && step === "photo_upload" && (
            <StepPhotoUpload
              playerName={conference?.player_name || myPlayer?.gamertag}
              playerAvatarUrl={conference?.player_avatar_url || myPlayer?.avatar_url}
              clubName={conference?.club_name || myClub?.name}
              clubLogoUrl={conference?.club_logo_url || myClub?.logo_url}
              matchName={conference?.match_name || matchData?.matchName}
              headline={pendingAnswers?.[0] ? generateHeadline(conference?.player_name || myPlayer?.gamertag, pendingAnswers[0].answer) : ""}
              onSubmit={handlePublish}
              onSkip={() => handlePublish(null)}
            />
          )}

          {!loading && step === "published" && (
            <div className="flex flex-col gap-4">
              <StepPublished article={published} />
              <Button onClick={handleClose} className="w-full bg-primary text-primary-foreground">Close</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
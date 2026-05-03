import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ChevronRight, User, Shield, CalendarDays, Clock, Send, ArrowLeft, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["search", "details", "confirm"];

export default function ArrangeGameDialog({ open, onClose, myPlayer, myClub, onSent }) {
  const [step, setStep] = useState("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("player"); // "club" | "player" — default to player
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [wagerStc, setWagerStc] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState("");

  const MIN_BET = 10_000;
  const MAX_BET = 2_000_000;

  function reset() {
    setStep("search");
    setSearchQuery("");
    setResults([]);
    setSelected(null);
    setDate("");
    setTime("");
    setWagerStc("");
    setSending(false);
    setSent(false);
    setSendError("");
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      if (searchType === "club") {
        const all = await base44.entities.Club.list("-rating", 2000);
        const q = searchQuery.toLowerCase();
        setResults(all.filter(c =>
          c.id !== myClub?.id &&
          (c.name.toLowerCase().includes(q) || c.tag?.toLowerCase().includes(q))
        ).slice(0, 10));
      } else {
        const all = await base44.entities.Player.list("-overall_rating", 2000);
        const q = searchQuery.toLowerCase();
        setResults(all.filter(p =>
          p.id !== myPlayer?.id &&
          (p.gamertag || "").toLowerCase().includes(q)
        ).slice(0, 10));
      }
    } finally {
      setSearching(false);
    }
  }

  async function handleSend() {
    if (!selected || !date || !time) return;
    setSending(true);
    setSendError("");

    try {
      const localDateTime = new Date(`${date}T${time}:00`);
      const scheduledDate = localDateTime.toISOString();

      const senderIsClub   = searchType === "club";
      const recipientIsClub = searchType === "club";

      const senderName   = senderIsClub ? `${myClub?.name} [${myClub?.tag}]` : myPlayer?.gamertag || "Unknown";
      const senderClubId = senderIsClub ? (myClub?.id || null) : null;
      const opponentName = recipientIsClub ? `${selected.name} [${selected.tag}]` : selected.gamertag;
      const invitationType = senderIsClub ? "club_vs_club" : "player_vs_player";

      // Resolve recipient email ───────────────────────────────────
      // For player matches: use the player's own email.
      // For club matches: owner_email is hidden by RLS for non-owners,
      // so fall back to the club president/captain's email via Player entity.
      let recipientEmail = null;

      if (!recipientIsClub) {
        recipientEmail = selected.email || null;
      } else {
        recipientEmail = selected.owner_email || null;
        if (!recipientEmail) {
          const clubPlayers = await base44.entities.Player.filter({ club_id: selected.id });
          const president = clubPlayers.find(p =>
            p.club_roles?.includes("president") ||
            p.club_roles?.includes("captain") ||
            p.role === "captain"
          ) || clubPlayers[0];
          if (president) recipientEmail = president.email || null;
        }
      }

      if (!recipientEmail) {
        setSendError("Could not reach this opponent. They may not have an account yet.");
        return;
      }

      const wagerAmount = wagerStc && Number(wagerStc) >= MIN_BET && Number(wagerStc) <= MAX_BET
        ? Number(wagerStc) : 0;

      const wagerLine = wagerAmount
        ? `\n\n💰 STC Wager: ${wagerAmount.toLocaleString()} STC each side (pot: ${(wagerAmount * 2).toLocaleString()} STC). Funds will be locked from your balance on acceptance.`
        : "";

      await base44.entities.InboxMessage.create({
        recipient_email:     recipientEmail,
        sender_email:        myPlayer?.email || "system@stage.com",
        subject:             `Match Invitation: ${senderName} vs ${opponentName}`,
        body:                `You have received a match invitation from ${senderName}.\n\nProposed date: ${date} at ${time}${wagerLine}\n\nPlease accept, decline, or request a different date.`,
        message_type:        "match_invite",
        action_type:         "accept_decline_date",
        related_entity_id:   selected.id,
        related_entity_type: recipientIsClub ? "club" : "player",
        status:              "pending",
        is_read:             false,
        metadata: {
          invitation_type:      invitationType,
          scheduled_date:       scheduledDate,
          challenger_name:      senderName,
          opponent_name:        opponentName,
          challenger_club_id:   senderClubId,
          challenger_player_id: myPlayer?.id || null,
          opponent_club_id:     recipientIsClub ? selected.id : null,
          opponent_player_id:   !recipientIsClub ? selected.id : null,
          wager_stc:            wagerAmount,
        },
      });

      setSent(true);
      setTimeout(() => { reset(); onSent(); }, 1500);
    } catch (err) {
      console.error("[ArrangeGame] send failed:", err);
      setSendError(err?.response?.data?.error || err?.message || "Failed to send invitation. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => { reset(); onClose(); }}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl uppercase tracking-wide flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Arrange Game
          </DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="py-8 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-3">
              <Send className="w-5 h-5 text-success" />
            </div>
            <p className="text-foreground font-semibold">Invitation Sent!</p>
            <p className="text-xs text-muted-foreground">Waiting for the opponent to respond.</p>
          </div>
        ) : step === "search" ? (
          <div className="space-y-4">
            {/* Type toggle — only show Club tab if user owns a club */}
            {myClub && (
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => { setSearchType("player"); setResults([]); setSearchQuery(""); }}
                  className={cn("flex-1 py-2 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors",
                    searchType === "player" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}
                >
                  <User className="w-3.5 h-3.5" /> Player Match
                </button>
                <button
                  onClick={() => { setSearchType("club"); setResults([]); setSearchQuery(""); }}
                  className={cn("flex-1 py-2 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors",
                    searchType === "club" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}
                >
                  <Shield className="w-3.5 h-3.5" /> Club Match
                </button>
              </div>
            )}

            {/* Context hint */}
            <p className="text-[11px] text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2 border border-border">
              {searchType === "player"
                ? <><span className="text-primary font-semibold">Player match</span> — you play as <span className="text-foreground font-medium">{myPlayer?.gamertag}</span>. The invite goes to the opponent player's personal inbox.</>
                : <><span className="text-primary font-semibold">Club match</span> — <span className="text-foreground font-medium">{myClub?.name}</span> challenges another club. The invite goes to the opponent club's owner inbox.</>
              }
            </p>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  placeholder={searchType === "club" ? "Search clubs..." : "Search players..."}
                  className="pl-9 bg-secondary border-border text-sm"
                />
              </div>
              <Button onClick={handleSearch} disabled={searching} size="sm" className="bg-primary text-primary-foreground">
                {searching ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : "Search"}
              </Button>
            </div>

            {results.length > 0 && (
              <div className="border border-border rounded-lg divide-y divide-border max-h-52 overflow-y-auto">
                {results.map(r => (
                  <button
                    key={r.id}
                    onClick={() => { setSelected(r); setStep("details"); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/60 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0 overflow-hidden">
                      {r.logo_url || r.avatar_url
                        ? <img src={r.logo_url || r.avatar_url} alt={r.name || r.gamertag} className="w-full h-full object-cover" />
                        : searchType === "club" ? <Shield className="w-4 h-4 text-muted-foreground" /> : <User className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {r.name || r.gamertag}
                        {r.tag && <span className="text-primary font-mono text-xs ml-1">[{r.tag}]</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.platform} {r.region ? `· ${r.region}` : ""} {r.position ? `· ${r.position}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : step === "details" ? (
          <div className="space-y-4">
            <button onClick={() => setStep("search")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>

            {/* Selected opponent */}
            <div className="flex items-center gap-3 p-3 bg-secondary/60 rounded-lg border border-border">
              <div className="w-9 h-9 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0 overflow-hidden">
                {selected?.logo_url || selected?.avatar_url
                  ? <img src={selected.logo_url || selected.avatar_url} alt={selected.name || selected.gamertag} className="w-full h-full object-cover" />
                  : searchType === "club" ? <Shield className="w-4 h-4 text-muted-foreground" /> : <User className="w-4 h-4 text-muted-foreground" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{selected?.name || selected?.gamertag}</p>
                <p className="text-xs text-muted-foreground">{selected?.platform}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Date</label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="pl-9 bg-secondary border-border text-sm"
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Time</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="time"
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    className="pl-9 bg-secondary border-border text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Optional wager */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block flex items-center gap-1">
                <Coins className="w-3 h-3 inline" /> STC Wager <span className="normal-case font-normal">(optional)</span>
              </label>
              <div className="relative">
                <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="number"
                  value={wagerStc}
                  onChange={e => setWagerStc(e.target.value)}
                  placeholder={`Min ${(MIN_BET/1_000).toFixed(0)}K — Max ${(MAX_BET/1_000_000).toFixed(1)}M STC`}
                  min={MIN_BET}
                  max={MAX_BET}
                  step={1000}
                  className="w-full pl-9 pr-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-warning"
                />
              </div>
              {wagerStc && (
                <p className="text-[10px] text-warning mt-1">
                  {Number(wagerStc) < MIN_BET ? `⚠️ Minimum bet is ${MIN_BET.toLocaleString()} STC` :
                   Number(wagerStc) > MAX_BET ? `⚠️ Maximum bet is ${MAX_BET.toLocaleString()} STC` :
                   `Pot: ${(Number(wagerStc) * 2).toLocaleString()} STC total — loser forfeits their stake`}
                </p>
              )}
            </div>

            <Button
              onClick={() => setStep("confirm")}
              disabled={!date || !time}
              className="w-full bg-primary text-primary-foreground"
            >
              Continue
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <button onClick={() => setStep("details")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>

            <div className="bg-secondary/60 rounded-lg border border-border p-4 space-y-2 text-sm">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Match type</span>
                <span className={cn("font-semibold", searchType === "player" ? "text-primary" : "text-accent")}>
                  {searchType === "player" ? "Player Match" : "Club Match"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Opponent</span>
                <span className="text-foreground font-medium">{selected?.name || selected?.gamertag}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Date</span>
                <span className="text-foreground font-medium">{date}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Time</span>
                <span className="text-foreground font-medium">{time}</span>
              </div>
              {wagerStc && Number(wagerStc) >= MIN_BET && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">STC Wager</span>
                  <span className="text-warning font-bold">{Number(wagerStc).toLocaleString()} STC each · Pot: {(Number(wagerStc) * 2).toLocaleString()} STC</span>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {searchType === "player"
                ? `A player match invitation will be sent to ${selected?.gamertag}'s personal inbox.`
                : `A club match invitation will be sent to the owner of ${selected?.name}'s inbox.`
              } They can accept, decline, or request a different date.
            </p>

            {sendError && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2 text-xs text-destructive font-medium">
                {sendError}
              </div>
            )}

            <Button
              onClick={handleSend}
              disabled={sending}
              className="w-full bg-primary text-primary-foreground gap-2"
            >
              {sending
                ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                : <Send className="w-4 h-4" />}
              Send Invitation
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
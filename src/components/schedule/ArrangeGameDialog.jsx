import { useEffect, useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ChevronRight, User, Shield, CalendarDays, Clock, Send, ArrowLeft, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { getClubPresidentContactEmail } from "@/lib/clubPresidentAccess";
import { combineDateTimeToMysql } from "@/lib/momentDate";
import { useTranslation } from "@/hooks/useTranslation";

export default function ArrangeGameDialog({ open, onClose, myPlayer, myClub, onSent }) {
  const { t } = useTranslation();
  const accountMode = localStorage.getItem("stage-account-mode") || "player";
  const isPresidentMode = accountMode === "club";
  const forcedSearchType = isPresidentMode ? "club" : "player";
  const [step, setStep] = useState("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState(forcedSearchType); // "club" | "player"
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  /** "club" | "player" — set when picking from search; drives which fields on `selected` are valid */
  const [recipientKind, setRecipientKind] = useState(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [wagerStc, setWagerStc] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState("");

  useEffect(() => {
    if (!open) return;
    setSearchType(forcedSearchType);
    setResults([]);
    setSearchQuery("");
  }, [open, forcedSearchType]);

  const MIN_BET = 10_000;
  const MAX_BET = 2_000_000;
  const matchType = isPresidentMode ? "club" : searchType;
  const activeSearchType = matchType;
  const availableWagerBalance = activeSearchType === "club"
    ? Number(myClub?.stc || 0)
    : Number(myPlayer?.stc || 0);
  const wagerNumber = wagerStc ? Number(wagerStc) : 0;
  const wagerError = wagerStc && (
    wagerNumber < MIN_BET
      ? t("commonPages.agdMinBet", { amount: MIN_BET.toLocaleString() })
      : wagerNumber > MAX_BET
        ? t("commonPages.agdMaxBet", { amount: MAX_BET.toLocaleString() })
        : wagerNumber > availableWagerBalance
          ? t("commonPages.agdInsufficientStc", { amount: availableWagerBalance.toLocaleString() })
          : ""
  );

  function reset() {
    setStep("search");
    setSearchQuery("");
    setSearchType(forcedSearchType);
    setResults([]);
    setSelected(null);
    setRecipientKind(null);
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
      if ((isPresidentMode ? "club" : searchType) === "club") {
        const all = await stageClient.entities.Club.list("-rating", 2000);
        const q = searchQuery.toLowerCase();
        setResults(all.filter(c =>
          c.id !== myClub?.id &&
          (c.name.toLowerCase().includes(q) || c.tag?.toLowerCase().includes(q))
        ).slice(0, 10));
      } else {
        const all = await stageClient.entities.Player.list("-overall_rating", 2000);
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

  function isReachableEmail(email) {
    const t = String(email || "").trim();
    if (!t.includes("@")) return null;
    if (t.toLowerCase().endsWith("@stage.invalid")) return null;
    return t;
  }

  function pickRecipientEmail(...candidates) {
    for (const raw of candidates) {
      const t = isReachableEmail(raw);
      if (t) return t;
    }
    return null;
  }

  async function resolveClubRecipientEmail(club) {
    const localPresidentEmail = isReachableEmail(getClubPresidentContactEmail({ club }));
    if (localPresidentEmail) return localPresidentEmail;

    try {
      const contact = await stageClient.functions.invoke("resolveClubContact", {
        club_id: club.id,
      });
      const fromApi = pickRecipientEmail(
        contact?.data?.recipient_email,
        contact?.recipient_email
      );
      if (fromApi) return fromApi;
    } catch (err) {
      if (!String(err?.message || "").includes("Function 'resolveClubContact' not found")) {
        console.warn("[ArrangeGame] club contact resolver failed, falling back:", err);
      }
    }

    const clubPlayers = await stageClient.entities.Player.filter({ club_id: club.id }).catch(() => []);
    const president = clubPlayers.find((p) =>
      p.club_roles?.includes("president") ||
      p.role === "president" ||
      p.club_roles?.includes("captain") ||
      p.role === "captain"
    ) || clubPlayers[0];
    return pickRecipientEmail(president?.email);
  }

  function selectOpponent(opponent, kind) {
    setRecipientKind(kind);
    setSelected(opponent);
    setStep("details");
  }

  function formatOpponentLabel(opponent, kind) {
    if (kind === "club") {
      const tag = opponent?.tag ? ` [${opponent.tag}]` : "";
      return `${opponent?.name || "Club"}${tag}`;
    }
    return opponent?.gamertag || "Player";
  }

  function opponentImageUrl(opponent, kind) {
    return kind === "club" ? opponent?.logo_url : opponent?.avatar_url;
  }

  async function resolvePlayerRecipientEmail(player) {
    const localEmail = pickRecipientEmail(player?.email);
    if (localEmail) return localEmail;

    try {
      const contact = await stageClient.functions.invoke("resolvePlayerContact", {
        player_id: player.id,
      });
      const fromApi = pickRecipientEmail(
        contact?.data?.recipient_email,
        contact?.recipient_email
      );
      if (fromApi) return fromApi;
    } catch (err) {
      if (!String(err?.message || "").includes("Function 'resolvePlayerContact' not found")) {
        console.warn("[ArrangeGame] player contact resolver failed, falling back:", err);
      }
    }

    return null;
  }

  async function handleSend() {
    if (!selected || !date || !time) return;
    setSending(true);
    setSendError("");

    try {
      const scheduledDate = combineDateTimeToMysql(date, time);

      const senderIsClub = matchType === "club" && Boolean(myClub);
      const recipientIsClub = recipientKind === "club";

      const senderName   = senderIsClub ? `${myClub?.name} [${myClub?.tag}]` : myPlayer?.gamertag || "Unknown";
      const senderClubId = senderIsClub ? (myClub?.id || null) : null;
      const opponentName = formatOpponentLabel(selected, recipientKind);
      const invitationType = matchType === "club" ? "club_vs_club" : "player_vs_player";

      if (!recipientKind) {
        setSendError(t("commonPages.agdChooseOpponent"));
        return;
      }

      // Club rows: owner_email (+ API / staff). Player rows: email (+ users link via API).
      let recipientEmail = recipientIsClub
        ? await resolveClubRecipientEmail(selected)
        : await resolvePlayerRecipientEmail(selected);

      if (!recipientEmail) {
        setSendError(
          recipientIsClub
            ? t("commonPages.agdCannotReachClub")
            : t("commonPages.agdCannotReachPlayer")
        );
        return;
      }

      if (wagerError) {
        setSendError(wagerError);
        return;
      }

      const wagerAmount = wagerStc && Number(wagerStc) >= MIN_BET && Number(wagerStc) <= MAX_BET
        ? Number(wagerStc) : 0;

      const wagerLine = wagerAmount
        ? `\n\n💰 STC Wager: ${wagerAmount.toLocaleString()} STC each side (pot: ${(wagerAmount * 2).toLocaleString()} STC). Funds are locked from both balances when this invite is accepted.`
        : "";

      await stageClient.functions.invoke("sendInboxMessage", {
        recipient_email:      recipientEmail,
        sender_email:         senderIsClub ? (myClub?.owner_email || myPlayer?.email || "system@stage.com") : (myPlayer?.email || "system@stage.com"),
        sender_gamertag:      senderName,
        sender_avatar_url:    senderIsClub ? (myClub?.logo_url || "") : (myPlayer?.avatar_url || ""),
        sender_club_name:     senderIsClub ? myClub?.name : null,
        subject:              `⚽ Match Invitation: ${senderName} vs ${opponentName}`,
        body:                 `You have received a match invitation from ${senderName}.\n\nProposed date: ${date} at ${time}${wagerLine}\n\nPlease accept, decline, or request a different date.`,
        message_type:         "match_invite",
        action_type:          "accept_decline_date",
        related_entity_id:    selected.id,
        related_entity_type:  recipientIsClub ? "club" : "player",
        status:               "pending",
        is_read:              false,
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
        send_notification:    true,
      });

      setSent(true);
      setTimeout(() => { reset(); onSent(); }, 1500);
    } catch (err) {
      console.error("[ArrangeGame] send failed:", err);
      setSendError(err?.response?.data?.error || err?.message || t("commonPages.agdSendFailed"));
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
            {t("commonPages.agdTitle")}
          </DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="py-8 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-3">
              <Send className="w-5 h-5 text-success" />
            </div>
            <p className="text-foreground font-semibold">{t("commonPages.agdInvitationSent")}</p>
            <p className="text-xs text-muted-foreground">{t("commonPages.agdWaitingResponse")}</p>
          </div>
        ) : step === "search" ? (
          <div className="space-y-4">
            {/* Type toggle — only when user can truly switch context */}
            {!isPresidentMode && myClub && (
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setSearchType("player"); setResults([]); setSearchQuery(""); setSelected(null); setRecipientKind(null); }}
                  className={cn("flex-1 py-2 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors",
                    searchType === "player" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}
                >
                  <User className="w-3.5 h-3.5" /> {t("commonPages.agdPlayerMatch")}
                </button>
                <button
                  type="button"
                  onClick={() => { setSearchType("club"); setResults([]); setSearchQuery(""); setSelected(null); setRecipientKind(null); }}
                  className={cn("flex-1 py-2 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors",
                    searchType === "club" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}
                >
                  <Shield className="w-3.5 h-3.5" /> {t("commonPages.agdClubMatch")}
                </button>
              </div>
            )}

            {/* Context hint */}
            <p className="text-[11px] text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2 border border-border">
              {(isPresidentMode ? "club" : searchType) === "player"
                ? <><span className="text-primary font-semibold">{t("commonPages.agdPlayerMatch")}</span> — {t("commonPages.agdPlayerMatchHint", { gamertag: myPlayer?.gamertag })}</>
                : <><span className="text-primary font-semibold">{t("commonPages.agdClubMatch")}</span> — {t("commonPages.agdClubMatchHint", { clubName: myClub?.name })}</>
              }
            </p>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  placeholder={(isPresidentMode ? "club" : searchType) === "club" ? t("commonPages.agdSearchClubs") : t("commonPages.agdSearchPlayers")}
                  className="pl-9 bg-secondary border-border text-sm"
                />
              </div>
              <Button onClick={handleSearch} disabled={searching} size="sm" className="bg-primary text-primary-foreground">
                {searching ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : t("commonPages.searchCta")}
              </Button>
            </div>

            {results.length > 0 && (
              <div className="border border-border rounded-lg divide-y divide-border max-h-52 overflow-y-auto">
                {results.map(r => (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => selectOpponent(r, matchType)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/60 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 overflow-hidden">
                      {r.logo_url || r.avatar_url
                        ? <img src={r.logo_url || r.avatar_url} alt={r.name || r.gamertag} className="w-full h-full object-cover" />
                        : (isPresidentMode ? "club" : searchType) === "club" ? <Shield className="w-4 h-4 text-muted-foreground" /> : <User className="w-4 h-4 text-muted-foreground" />}
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
            <button type="button" onClick={() => setStep("search")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> {t("commonPages.agdBack")}
            </button>

            {/* Selected opponent */}
            <div className="flex items-center gap-3 p-3 bg-secondary/60 rounded-lg border border-border">
              <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 overflow-hidden">
                {opponentImageUrl(selected, recipientKind)
                  ? <img src={opponentImageUrl(selected, recipientKind)} alt={formatOpponentLabel(selected, recipientKind)} className="w-full h-full object-cover" />
                  : recipientKind === "club" ? <Shield className="w-4 h-4 text-muted-foreground" /> : <User className="w-4 h-4 text-muted-foreground" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{formatOpponentLabel(selected, recipientKind)}</p>
                <p className="text-xs text-muted-foreground">
                  {selected?.platform}
                  {recipientKind === "player" && selected?.position ? ` · ${selected.position}` : ""}
                  {recipientKind === "club" && selected?.region ? ` · ${selected.region}` : ""}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">{t("commonPages.agdDate")}</label>
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
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">{t("commonPages.agdTime")}</label>
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
                <Coins className="w-3 h-3 inline" /> {t("commonPages.agdStcWager")} <span className="normal-case font-normal">({t("commonPages.agdOptional")})</span>
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
                <p className={cn("text-[10px] mt-1", wagerError ? "text-destructive" : "text-warning")}>
                  {wagerError || t("commonPages.agdWagerPotHint", { pot: (Number(wagerStc) * 2).toLocaleString(), stake: Number(wagerStc).toLocaleString() })}
                </p>
              )}
            </div>

            <Button
              onClick={() => setStep("confirm")}
              disabled={!date || !time || !!wagerError}
              className="w-full bg-primary text-primary-foreground"
            >
              {t("commonPages.agdContinue")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <button type="button" onClick={() => setStep("details")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> {t("commonPages.agdBack")}
            </button>

            <div className="bg-secondary/60 rounded-lg border border-border p-4 space-y-2 text-sm">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{t("commonPages.agdMatchType")}</span>
                <span className={cn("font-semibold", searchType === "player" ? "text-primary" : "text-accent")}>
                  {searchType === "player" ? t("commonPages.agdPlayerMatch") : t("commonPages.agdClubMatch")}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{t("commonPages.agdOpponent")}</span>
                <span className="text-foreground font-medium">{selected?.name || selected?.gamertag}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{t("commonPages.agdDate")}</span>
                <span className="text-foreground font-medium">{date}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{t("commonPages.agdTime")}</span>
                <span className="text-foreground font-medium">{time}</span>
              </div>
              {wagerStc && Number(wagerStc) >= MIN_BET && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t("commonPages.agdStcWager")}</span>
                  <span className="text-warning font-bold">{t("commonPages.agdWagerSummary", { stake: Number(wagerStc).toLocaleString(), pot: (Number(wagerStc) * 2).toLocaleString() })}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {searchType === "player"
                ? t("commonPages.agdPlayerInviteNote", { gamertag: selected?.gamertag })
                : t("commonPages.agdClubInviteNote", { clubName: selected?.name })
              } {t("commonPages.agdCanRespondNote")}
              {wagerNumber > 0 && !wagerError ? ` ${t("commonPages.agdWagerLockNote")}` : ""}
            </p>

            {sendError && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2 text-xs text-destructive font-medium">
                {sendError}
              </div>
            )}

            <Button
              onClick={handleSend}
              disabled={sending || !!wagerError}
              className="w-full bg-primary text-primary-foreground gap-2"
            >
              {sending
                ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                : <Send className="w-4 h-4" />}
              {t("commonPages.agdSendInvitation")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

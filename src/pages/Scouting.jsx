import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Archive, Binoculars, Handshake, Loader2, Plus, Search, Shield,
  ThumbsDown, ThumbsUp, Trash2, User, Video, Vote, X,
} from "lucide-react";
import VideoEmbed from "@/components/scouting/VideoEmbed";
import OfferContractDialog from "@/components/contracts/OfferContractDialog";
import { isClubPresidentForUser, getClubPresidentContactEmail } from "@/lib/clubPresidentAccess";
import { ensureContractOfferInbox } from "@/lib/contractOfferDelivery";
import { CONTRACT_TYPES } from "@/lib/contractTypes";
import { normalizePlayerContracts } from "@/lib/playerContractFields";
import { useTransferWindowStatus } from "@/lib/useTransferWindowStatus";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Club scouting board.
 *
 * Scouting rights follow the *playing* membership, so this page reads
 * `player.club_id` rather than the resolved `club` from resolveMyPlayerAndClub():
 * that one falls back to a president-owned club, which would wrongly let a
 * president with no player profile scout. The server enforces the same rule, so
 * this is about showing the right screen, not about security.
 */

function formatTargetPositions(report) {
  return [report?.target_position, report?.target_secondary_position].filter(Boolean).join(" / ");
}

export default function Scouting() {
  const { t } = useTranslation();
  const { windowOpen } = useTransferWindowStatus();
  const [offerFor, setOfferFor] = useState(null);
  const [offerTargetContracts, setOfferTargetContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState(null);
  const [club, setClub] = useState(null);
  const [isPresident, setIsPresident] = useState(false);
  const [reports, setReports] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState(null);

  const canScout = Boolean(player?.club_id);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user, player: pl, club: resolvedClub, presidentClub } = await resolveMyPlayerAndClub();
        if (cancelled) return;
        setPlayer(pl || null);
        // Only trust the club when the player is actually attached to it.
        const myClub = pl?.club_id && resolvedClub?.id === pl.club_id ? resolvedClub : null;
        setClub(myClub);
        setIsPresident(isClubPresidentForUser({ user, club: myClub, presidentClub }));
        if (pl?.club_id) {
          const rows = await stageClient.entities.ScoutingReport.filter({}, "-created_date", 100).catch(() => []);
          if (!cancelled) setReports(Array.isArray(rows) ? rows : []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /** Replaces one report in place, so a vote doesn't reshuffle the board. */
  function replaceReport(updated) {
    if (!updated?.id) return;
    setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  async function handleVote(report, vote) {
    try {
      const updated = await stageClient.http.post(`/scouting-reports/${report.id}/vote`, { vote });
      replaceReport(updated);
    } catch (err) {
      showNotice(err?.message || t("commonPages.scoutVoteFailed"), "error");
      // The likeliest failure is that the president closed the vote while this
      // card sat on screen. Refetch so the buttons match reality instead of
      // inviting another doomed click.
      await reloadReports();
    }
  }

  /**
   * Sends a normal contract offer through the existing contract flow, then links
   * the resulting contract back to the report.
   *
   * The offer is deliberately NOT created by the scouting endpoints: transfer
   * window, wage budget and existing-contract rules all live in the contract flow
   * already, and duplicating them here would let the two drift. If those rules
   * refuse, the error surfaces and the report stays exactly where it was.
   */
  async function handleOffer(report, terms) {
    if (!club?.id) {
      showNotice(t("commonPages.scoutNoClubDesc"), "error");
      return;
    }

    const typeMeta = CONTRACT_TYPES[terms.contract_type] || CONTRACT_TYPES.squad;
    let contractId;
    try {
      const result = await stageClient.functions.invoke("contractManagement", {
        action: "offer",
        team_id: club.id,
        target_player_id: report.target_player_id,
        contract_type: terms.contract_type,
        offer_note: terms.offer_note || "",
        max_games: typeMeta.max_games,
        max_days: typeMeta.max_days,
        weekly_salary_stc: terms.weekly_salary_stc || 0,
        signing_bonus_stc: terms.signing_bonus_stc || 0,
        transfer_fee_stc: 0,
        performance_targets: terms.performance_targets || [],
        captaincy_offered: terms.captaincy_offered || false,
        status: "pending",
      });
      contractId = result?.data?.contract?.id || result?.data?.contract_id;
      if (!contractId) throw new Error(t("commonPages.scoutOfferFailed"));
    } catch (err) {
      // The contract rules refused (window closed, wage cap, live contract...).
      // Nothing was created, so the report is untouched and stays actionable —
      // but the president has to be told why, or the button just looks broken.
      showNotice(err?.message || t("commonPages.scoutOfferFailed"), "error");
      return;
    }

    await ensureContractOfferInbox({
      contractId,
      player: { id: report.target_player_id, gamertag: report.target_gamertag },
      club,
      contractType: terms.contract_type,
      maxGames: typeMeta.max_games,
      maxDays: typeMeta.max_days,
      weeklySalary: terms.weekly_salary_stc,
      signingBonus: terms.signing_bonus_stc,
      offerNote: terms.offer_note,
      senderEmail: getClubPresidentContactEmail({ club }),
    }).catch((err) => console.warn("[Scouting] inbox fallback failed:", err?.message || err));

    try {
      const updated = await stageClient.http.post(
        `/scouting-reports/${report.id}/mark-offered`,
        { contract_id: contractId }
      );
      replaceReport(updated);
      setOfferFor(null);
      showNotice(t("commonPages.scoutOfferSent", { name: report.target_gamertag || "" }));
    } catch (err) {
      // The offer itself DID go out — only the bookkeeping failed. Saying
      // "offer failed" here would be a lie that pushes the president to send a
      // second one, which the contract rules would then refuse for the rest of
      // the window. Tell them the truth and refresh instead.
      console.warn("[Scouting] mark-offered failed:", err?.message || err);
      setOfferFor(null);
      showNotice(t("commonPages.scoutOfferSentNotLinked"), "error");
      await reloadReports();
    }
  }

  /**
   * Loads the target's existing contracts before opening the dialog. Without them
   * the dialog's wage-cap and conflict warnings silently evaluate against nothing,
   * so the president would only discover the clash when the server refused.
   */
  async function openOfferDialog(report) {
    setOfferFor(report);
    const rows = await stageClient.entities.PlayerContract
      .filter({ user_id: report.target_player_id })
      .catch(() => []);
    setOfferTargetContracts(Array.isArray(rows) ? rows : []);
  }

  async function handleArchive(report) {
    try {
      const updated = await stageClient.http.post(`/scouting-reports/${report.id}/archive`, {});
      replaceReport(updated);
    } catch (err) {
      showNotice(err?.message || t("commonPages.scoutArchiveFailed"), "error");
      await reloadReports();
    }
  }

  async function handleSetVoteState(report, open) {
    try {
      // Opening/closing a vote is a president-only action, so it goes through its
      // own endpoint rather than a generic entity update (AGENTS.md §3).
      const updated = await stageClient.http.post(
        `/scouting-reports/${report.id}/${open ? "open-vote" : "close-vote"}`,
        {}
      );
      replaceReport(updated);
    } catch (err) {
      showNotice(err?.message || t("commonPages.scoutVoteStateFailed"), "error");
      await reloadReports();
    }
  }

  async function reloadReports() {
    const rows = await stageClient.entities.ScoutingReport.filter({}, "-created_date", 100).catch(() => []);
    setReports(Array.isArray(rows) ? rows : []);
  }

  function showNotice(message, tone = "success") {
    setNotice({ message, tone });
    setTimeout(() => setNotice(null), 4000);
  }

  async function handleDelete(report) {
    try {
      await stageClient.entities.ScoutingReport.delete(report.id);
      setReports((prev) => prev.filter((r) => r.id !== report.id));
    } catch (err) {
      showNotice(err?.message || t("commonPages.scoutDeleteFailed"), "error");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Binoculars className="w-6 h-6 text-primary shrink-0" />
            <div>
              <h1
                className="font-heading font-black text-4xl md:text-5xl text-foreground uppercase"
                style={{ transform: "skewX(-8deg)", letterSpacing: "-0.02em", transformOrigin: "left center" }}
              >
                {t("commonPages.scoutTitle")}
              </h1>
              <p className="text-xs text-muted-foreground mt-1">{t("commonPages.scoutSubtitle")}</p>
            </div>
          </div>
          {canScout && (
            <Button type="button" onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="w-4 h-4" /> {t("commonPages.scoutNewReport")}
            </Button>
          )}
        </div>

        {notice && (
          <div className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            notice.tone === "error"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-success/30 bg-success/10 text-success"
          )}>
            {notice.message}
          </div>
        )}

        {!canScout ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-3">
            <Shield className="w-8 h-8 text-muted-foreground mx-auto" />
            <h2 className="font-bold text-foreground">{t("commonPages.scoutNoClubTitle")}</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">{t("commonPages.scoutNoClubDesc")}</p>
            <Link to="/clubs">
              <Button type="button" variant="outline" className="gap-1.5 mt-1">
                <Search className="w-4 h-4" /> {t("commonPages.scoutBrowseClubs")}
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-3.5 h-3.5 shrink-0" />
              <span>{t("commonPages.scoutClubBoard", { club: club?.name || t("nav.club") })}</span>
            </div>

            {reports.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-2">
                <Video className="w-8 h-8 text-muted-foreground mx-auto" />
                <h2 className="font-bold text-foreground">{t("commonPages.scoutEmptyTitle")}</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">{t("commonPages.scoutEmptyDesc")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => (
                  <ScoutingReportCard
                    key={report.id}
                    report={report}
                    myPlayerId={player?.id}
                    isPresident={isPresident}
                    canDelete={report.scouted_by_player_id === player?.id}
                    onDelete={() => handleDelete(report)}
                    onVote={(vote) => handleVote(report, vote)}
                    onSetVoteState={(open) => handleSetVoteState(report, open)}
                    onOffer={() => openOfferDialog(report)}
                    onArchive={() => handleArchive(report)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* The same offer dialog the rest of the app uses, so scouting offers go
            through one flow and one set of rules. */}
        <OfferContractDialog
          open={!!offerFor}
          onClose={() => { setOfferFor(null); setOfferTargetContracts([]); }}
          player={offerFor ? {
            id: offerFor.target_player_id,
            gamertag: offerFor.target_gamertag,
            position: offerFor.target_position,
            overall_rating: offerFor.target_overall_rating,
          } : null}
          playerContracts={normalizePlayerContracts(offerTargetContracts)}
          existingActiveContract={
            normalizePlayerContracts(offerTargetContracts).find((c) => c.status === "active") || null
          }
          onOffer={(terms) => handleOffer(offerFor, terms)}
          windowOpen={windowOpen}
          club={club}
        />

        <CreateReportDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await reloadReports();
            showNotice(t("commonPages.scoutCreated"));
          }}
        />
      </div>
    </div>
  );
}

function ScoutingReportCard({
  report, myPlayerId, isPresident, canDelete, onDelete, onVote, onSetVoteState, onOffer, onArchive,
}) {
  const { t } = useTranslation();
  const links = Array.isArray(report.video_links) ? report.video_links : [];
  const isDecided = report.status === "offered" || report.status === "archived";

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex items-start gap-3">
        <span className="w-12 h-12 rounded-xl border border-border bg-secondary overflow-hidden shrink-0 flex items-center justify-center">
          {report.target_avatar_url ? (
            <span
              className="w-full h-full block"
              style={{
                backgroundImage: `url(${report.target_avatar_url})`,
                backgroundSize: "cover",
                backgroundPosition: report.target_avatar_position || "50% 50%",
              }}
              aria-hidden
            />
          ) : (
            <User className="w-5 h-5 text-muted-foreground" />
          )}
        </span>

        <div className="flex-1 min-w-0">
          <Link
            to={report.target_player_id ? `/players/${report.target_player_id}` : "#"}
            className="font-bold text-foreground hover:text-primary transition-colors truncate block"
          >
            {report.target_gamertag || t("commonPages.scoutUnknownPlayer")}
          </Link>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {[formatTargetPositions(report), report.target_platform, report.target_club_name].filter(Boolean).join(" · ")}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {t("commonPages.scoutBy", { name: report.scout_gamertag || t("commonPages.scoutUnknownScout") })}
          </p>
        </div>

        {/* Everyone in the club sees where a report ended up, president or not. */}
        {isDecided && (
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider shrink-0",
            report.status === "offered"
              ? "bg-success/15 border-success/30 text-success"
              : "bg-secondary border-border text-muted-foreground"
          )}>
            {report.status === "offered" ? t("commonPages.scoutStatusOffered") : t("commonPages.scoutStatusArchived")}
          </span>
        )}

        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            title={t("commonPages.scoutDelete")}
            className="text-muted-foreground hover:text-destructive transition-colors shrink-0 p-1"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {report.notes && (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{report.notes}</p>
      )}

      {links.length > 0 && (
        // One column on phones, two from sm up: a 16:9 player squeezed into half
        // a phone width is too small to judge a player on.
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {links.map((link, index) => (
            <VideoEmbed key={`${report.id}-${index}`} url={link} />
          ))}
        </div>
      )}

      <ScoutingVoteSection
        report={report}
        myPlayerId={myPlayerId}
        isPresident={isPresident}
        onVote={onVote}
        onSetVoteState={onSetVoteState}
      />

      {/* Decision buttons are the president's, and they are never gated on how
          the squad voted — see ScoutingVoteSection. */}
      {isPresident && !isDecided && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="button" size="sm" onClick={onOffer} className="gap-1.5">
            <Handshake className="w-3.5 h-3.5" /> {t("commonPages.scoutOffer")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onArchive}
            className="gap-1.5 border-border text-muted-foreground"
          >
            <Archive className="w-3.5 h-3.5" /> {t("commonPages.scoutArchive")}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * The squad's opinion on a scouted player.
 *
 * Advisory by construction: this block reports a tally and nothing else. It never
 * disables, hides, or gates any president action — a squad voting "against" is
 * information for the president, not a veto over them.
 */
function ScoutingVoteSection({ report, myPlayerId, isPresident, onVote, onSetVoteState }) {
  const { t } = useTranslation();
  const votes = report.votes && typeof report.votes === "object" ? report.votes : {};
  const values = Object.values(votes);
  const forCount = values.filter((v) => v === "for").length;
  const againstCount = values.filter((v) => v === "against").length;
  const myVote = myPlayerId ? votes[myPlayerId] : undefined;
  const isOpen = report.status === "voting";
  const hasVotes = values.length > 0;

  if (!isOpen && !hasVotes && !isPresident) return null;

  return (
    <div className="border-t border-border pt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      {(isOpen || hasVotes) && (
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1 text-success font-semibold">
            <ThumbsUp className="w-3.5 h-3.5" /> {forCount}
          </span>
          <span className="inline-flex items-center gap-1 text-destructive font-semibold">
            <ThumbsDown className="w-3.5 h-3.5" /> {againstCount}
          </span>
          <span className="text-muted-foreground">
            {isOpen ? t("commonPages.scoutVoteOpen") : t("commonPages.scoutVoteClosed")}
          </span>
        </div>
      )}

      {isOpen && (
        <div className="flex items-center gap-2">
          <VoteButton
            icon={ThumbsUp}
            label={t("commonPages.scoutVoteFor")}
            selected={myVote === "for"}
            selectedClass="border-success bg-success/15 text-success"
            hoverClass="hover:border-success/40"
            onClick={() => onVote?.("for")}
          />
          <VoteButton
            icon={ThumbsDown}
            label={t("commonPages.scoutVoteAgainst")}
            selected={myVote === "against"}
            selectedClass="border-destructive bg-destructive/15 text-destructive"
            hoverClass="hover:border-destructive/40"
            onClick={() => onVote?.("against")}
          />
          {myVote && (
            <span className="text-[11px] text-muted-foreground">{t("commonPages.scoutVoteChangeable")}</span>
          )}
        </div>
      )}

      {isPresident && (
        <button
          type="button"
          onClick={() => onSetVoteState?.(!isOpen)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors ml-auto"
        >
          <Vote className="w-3.5 h-3.5" />
          {isOpen ? t("commonPages.scoutCloseVote") : t("commonPages.scoutOpenVote")}
        </button>
      )}
    </div>
  );
}

function VoteButton({ icon: Icon, label, selected, selectedClass, hoverClass, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
        selected
          ? selectedClass
          : cn("border-border bg-secondary/60 text-muted-foreground hover:text-foreground", hoverClass)
      )}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

function CreateReportDialog({ open, onClose, onCreated }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [target, setTarget] = useState(null);
  const [links, setLinks] = useState([""]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setQuery(""); setTarget(null); setLinks([""]); setNotes(""); setError(null);
    setLoadingPlayers(true);
    stageClient.entities.Player.list("-overall_rating", 200)
      .then((rows) => setPlayers(Array.isArray(rows) ? rows : []))
      .catch(() => setPlayers([]))
      .finally(() => setLoadingPlayers(false));
  }, [open]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return players.slice(0, 8);
    return players
      .filter((p) => String(p.gamertag || "").toLowerCase().includes(needle))
      .slice(0, 8);
  }, [players, query]);

  const cleanLinks = links.map((l) => l.trim()).filter(Boolean);
  const canSubmit = Boolean(target?.id) && cleanLinks.length > 0 && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await stageClient.entities.ScoutingReport.create({
        target_player_id: target.id,
        video_links: cleanLinks,
        notes: notes.trim() || null,
      });
      await onCreated();
    } catch (err) {
      setError(err?.message || t("commonPages.scoutCreateFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Binoculars className="w-5 h-5 text-primary" /> {t("commonPages.scoutNewReport")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
              {t("commonPages.scoutTargetPlayer")}
            </label>
            {target ? (
              <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
                <User className="w-4 h-4 text-primary shrink-0" />
                <span className="font-semibold text-foreground truncate flex-1">{target.gamertag}</span>
                <button
                  type="button"
                  onClick={() => setTarget(null)}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("commonPages.searchPlaceholder")}
                />
                <div className="mt-2 space-y-1 max-h-52 overflow-y-auto">
                  {loadingPlayers ? (
                    <p className="text-xs text-muted-foreground py-2">{t("commonPages.loading")}</p>
                  ) : matches.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">{t("commonPages.scoutNoPlayerFound")}</p>
                  ) : (
                    matches.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setTarget(p)}
                        className="w-full flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-left hover:border-primary/40 transition-colors"
                      >
                        <User className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium text-foreground truncate flex-1">{p.gamertag}</span>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {[p.position, p.platform].filter(Boolean).join(" · ")}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
              {t("commonPages.scoutVideoLinks")}
            </label>
            <div className="space-y-2">
              {links.map((link, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={link}
                    onChange={(e) => setLinks((prev) => prev.map((l, i) => (i === index ? e.target.value : l)))}
                    placeholder="https://..."
                  />
                  {links.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLinks((prev) => prev.filter((_, i) => i !== index))}
                      className="text-muted-foreground hover:text-destructive shrink-0 px-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setLinks((prev) => [...prev, ""])}
              className="mt-2 text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> {t("commonPages.scoutAddLink")}
            </button>
            <p className="text-[11px] text-muted-foreground mt-2">{t("commonPages.scoutVideoHint")}</p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
              {t("commonPages.scoutNotes")}
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={t("commonPages.scoutNotesPlaceholder")}
            />
          </div>

          {error && (
            <p className="text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button type="button" onClick={submit} disabled={!canSubmit} className="w-full gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {t("commonPages.scoutSubmit")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

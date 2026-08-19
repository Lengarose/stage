import EmptyState from "@/components/admin/shared/EmptyState";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Database, Link2, Plus, Search, Trophy, X, Copy, RotateCcw, Ban, Trash2, Wand2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

function EntranceLinksDialog({ open, onOpenChange, tournamentId, tournamentName }) {
  const { t } = useTranslation();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  async function fetchLinks() {
    if (!tournamentId) return;
    setLoading(true);
    try {
      const result = await stageClient.functions.invoke("listTournamentEntranceLinks", { tournament_id: tournamentId });
      setLinks(result?.data?.links || []);
    } catch {
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(v) {
    if (v) fetchLinks();
    onOpenChange(v);
  }

  async function copyLink(token) {
    const url = `${window.location.origin}/tournaments/entrance/${token}/signin`;
    await navigator.clipboard.writeText(url).catch(() => {});
    window.alert(t("admin.tournaments.linkCopied"));
  }

  async function revokeLink(linkId) {
    if (!window.confirm(t("admin.tournaments.revokeLink"))) return;
    setActionLoading(linkId);
    try {
      await stageClient.functions.invoke("revokeTournamentEntranceLink", { link_id: linkId });
      await fetchLinks();
    } catch (err) {
      window.alert(err?.error || err?.message || t("admin.tournaments.revokeFailed"));
    } finally {
      setActionLoading(null);
    }
  }

  async function regenerateLink(linkId) {
    if (!window.confirm(t("admin.tournaments.regenerateLinkConfirm"))) return;
    setActionLoading(linkId);
    try {
      const result = await stageClient.functions.invoke("regenerateTournamentEntranceLink", { link_id: linkId });
      const newLink = result?.data?.new_link || result?.new_link || null;
      if (newLink?.token) {
        const url = `${window.location.origin}/tournaments/entrance/${newLink.token}/signin`;
        await navigator.clipboard.writeText(url).catch(() => {});
        window.alert(t("admin.tournaments.newLinkCopied"));
      }
      await fetchLinks();
    } catch (err) {
      window.alert(err?.error || err?.message || t("admin.tournaments.regenerateFailed"));
    } finally {
      setActionLoading(null);
    }
  }

  async function createNew() {
    setActionLoading("create");
    try {
      const result = await stageClient.functions.invoke("createTournamentEntranceLink", { tournament_id: tournamentId });
      const link = result?.data?.link || result?.link || null;
      if (link?.token) {
        const url = `${window.location.origin}/tournaments/entrance/${link.token}/signin`;
        await navigator.clipboard.writeText(url).catch(() => {});
        window.alert(t("admin.tournaments.entranceLinkCopied"));
      }
      await fetchLinks();
    } catch (err) {
      window.alert(err?.error || err?.message || t("admin.tournaments.createLinkFailed"));
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading uppercase tracking-tight text-sm">
            {t("admin.tournaments.entranceLinksTitle", { name: tournamentName || t("admin.sections.tournaments") })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Button size="sm" onClick={createNew} disabled={actionLoading === "create"} className="gap-1.5 text-xs h-7">
            <Plus className="w-3 h-3" /> {t("admin.tournaments.createNewLink")}
          </Button>
          {loading ? (
            <p className="text-xs text-muted-foreground">{t("admin.tournaments.loadingLinks")}</p>
          ) : links.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("admin.tournaments.noEntranceLinks")}</p>
          ) : (
            <div className="space-y-2">
              {links.map((link) => {
                const isActive = String(link.status || "").toLowerCase() === "active";
                return (
                  <div key={link.id} className="border border-border rounded p-3 bg-secondary/30 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded border uppercase tracking-wider font-bold",
                        isActive
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "bg-destructive/10 text-destructive border-destructive/20"
                      )}>
                        {link.status || "unknown"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {link.created_date ? new Date(link.created_date).toLocaleDateString() : ""}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono break-all">{link.token}</p>
                    {link.expires_at && (
                      <p className="text-[10px] text-muted-foreground">
                        {t("admin.tournaments.expires", { date: new Date(link.expires_at).toLocaleString() })}
                      </p>
                    )}
                    {isActive && (
                      <div className="flex gap-1.5 pt-1">
                        <Button type="button" size="sm" variant="outline" onClick={() => copyLink(link.token)} className="h-6 text-[10px] gap-1 px-2">
                          <Copy className="w-3 h-3" /> {t("admin.tournaments.copy")}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => regenerateLink(link.id)} disabled={actionLoading === link.id} className="h-6 text-[10px] gap-1 px-2">
                          <RotateCcw className="w-3 h-3" /> {t("admin.tournaments.regenerate")}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => revokeLink(link.id)} disabled={actionLoading === link.id} className="h-6 text-[10px] gap-1 px-2 border-destructive/30 text-destructive hover:bg-destructive/10">
                          <Ban className="w-3 h-3" /> {t("admin.tournaments.revoke")}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TournamentsTab({
  setCreateTournamentOpen,
  seedPressQuestions,
  reseedLifestyle,
  saving,
  tournamentSearch,
  setTournamentSearch,
  tournaments,
  cancelTournament,
  deleteTournament,
  onRefresh,
}) {
  const { t } = useTranslation();
  const [entranceDialog, setEntranceDialog] = useState(null);
  const [testPackBusy, setTestPackBusy] = useState(null);
  const [simulatingTournamentId, setSimulatingTournamentId] = useState(null);
  const [deletingTournamentId, setDeletingTournamentId] = useState(null);

  function deleteLockDays(tournament) {
    if (String(tournament.status || "").toLowerCase() !== "completed") return 0;
    if (!tournament.creator_gamertag && !tournament.creator_id) return 0;
    const completedAt = new Date(tournament.end_date || tournament.updated_date || tournament.created_date).getTime();
    if (!Number.isFinite(completedAt)) return 7;
    const waitMs = completedAt + 7 * 24 * 60 * 60 * 1000 - Date.now();
    return waitMs > 0 ? Math.ceil(waitMs / (24 * 60 * 60 * 1000)) : 0;
  }

  async function handleDeleteTournament(tournament) {
    if (!deleteTournament) return;
    setDeletingTournamentId(tournament.id);
    try {
      await deleteTournament(tournament.id);
    } finally {
      setDeletingTournamentId(null);
    }
  }

  async function createEntranceLink(tournamentId) {
    try {
      const result = await stageClient.functions.invoke("createTournamentEntranceLink", { tournament_id: tournamentId });
      const link = result?.data?.link || result?.link || null;
      if (!link?.token) throw new Error(t("admin.tournaments.linkTokenMissing"));
      const url = `${window.location.origin}/tournaments/entrance/${link.token}/signin`;
      await navigator.clipboard.writeText(url).catch(() => {});
      window.alert(t("admin.tournaments.entranceLinkCreated", { url }));
    } catch (err) {
      window.alert(err?.error || err?.message || t("admin.tournaments.createLinkFailed"));
    }
  }

  async function seedTestClubs() {
    if (!window.confirm(t("admin.tournaments.seedTestClubsConfirm"))) return;
    setTestPackBusy("seed");
    try {
      const result = await stageClient.functions.invoke("seedTournamentTestClubs", {});
      const data = result?.data || result || {};
      const createdClubs = Number(data.clubs || 0);
      const expectedClubs = Number(data.expected_clubs || 20);
      if (createdClubs !== expectedClubs) {
        throw new Error(`Test pack backend returned ${createdClubs} clubs, but the current app expects ${expectedClubs}. Restart/deploy the backend so the 20-team seed pack is loaded.`);
      }
      window.alert(t("admin.tournaments.testPackReady", { clubs: createdClubs, players: data.players || 0 }));
      await onRefresh?.();
    } catch (err) {
      window.alert(err?.error || err?.message || t("admin.tournaments.createTestClubsFailed"));
    } finally {
      setTestPackBusy(null);
    }
  }

  async function deleteTestClubs() {
    if (!window.confirm(t("admin.tournaments.deleteTestClubsConfirm"))) return;
    setTestPackBusy("delete");
    try {
      const result = await stageClient.functions.invoke("deleteTournamentTestClubs", {});
      const deleted = result?.data?.deleted || result?.deleted || {};
      window.alert(t("admin.tournaments.testPackDeleted", { clubs: deleted.clubs || 0, players: deleted.players || 0 }));
      await onRefresh?.();
    } catch (err) {
      window.alert(err?.error || err?.message || t("admin.tournaments.deleteTestClubsFailed"));
    } finally {
      setTestPackBusy(null);
    }
  }

  async function simulateNextMatch(tournamentId) {
    setSimulatingTournamentId(tournamentId);
    try {
      const matches = await stageClient.entities.Match.filter({ tournament_id: tournamentId }, "round", 200);
      const match = (matches || []).find((item) => !["completed", "forfeit", "cancelled"].includes(String(item.status || "").toLowerCase()));
      if (!match) {
        window.alert(t("admin.tournaments.noOpenMatch"));
        return;
      }
      await stageClient.functions.invoke("simulateScore", { tournamentId, matchId: match.id });
      window.alert(t("admin.tournaments.matchSimulated"));
      await onRefresh?.();
    } catch (err) {
      window.alert(err?.error || err?.message || t("admin.tournaments.simulateMatchFailed"));
    } finally {
      setSimulatingTournamentId(null);
    }
  }

  return (
    <>
      <div className="mb-4 flex gap-2 flex-wrap">
        <Button onClick={() => setCreateTournamentOpen(true)} className="bg-primary text-primary-foreground gap-2 text-xs h-8 rounded">
          <Plus className="w-3.5 h-3.5" /> {t("admin.tournaments.create")}
        </Button>
        <Button variant="outline" size="sm" onClick={seedPressQuestions} disabled={saving} className="border-border text-muted-foreground hover:text-foreground text-xs h-8 rounded gap-1.5">
          {t("admin.pressConferences.seedQuestions")}
        </Button>
        <Button variant="outline" size="sm" onClick={reseedLifestyle} disabled={saving} className="border-border text-muted-foreground hover:text-foreground text-xs h-8 rounded gap-1.5">
          {t("admin.lifestyles.reseedPrices")}
        </Button>
        <Button variant="outline" size="sm" onClick={seedTestClubs} disabled={!!testPackBusy} className="border-primary/30 text-primary hover:text-primary text-xs h-8 rounded gap-1.5">
          <Database className="w-3.5 h-3.5" /> {t("admin.tournaments.seedTestPack")}
        </Button>
        <Button variant="outline" size="sm" onClick={deleteTestClubs} disabled={!!testPackBusy} className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs h-8 rounded gap-1.5">
          <Trash2 className="w-3.5 h-3.5" /> {t("admin.tournaments.deleteTestPack")}
        </Button>
      </div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={tournamentSearch} onChange={e => setTournamentSearch(e.target.value)}
          className="w-full bg-secondary border border-border rounded pl-9 pr-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
          placeholder={t("admin.tournaments.searchPlaceholder")} />
      </div>
      {tournaments.length === 0 ? (
        <EmptyState icon={Trophy} text={t("admin.tournaments.noActive")} />
      ) : (
        <div className="space-y-3">
          {tournaments.filter((tournament) => tournament.name?.toLowerCase().includes(tournamentSearch.toLowerCase()) && tournament.status !== "archived" && tournament.status !== "cancelled").map((tournament) => {
            const status = String(tournament.status || "").toLowerCase();
            const lockDays = deleteLockDays(tournament);
            const canDeleteNow = ["completed", "registration"].includes(status) && lockDays === 0;
            return (
            <div key={tournament.id} className="bg-card border border-border rounded p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <p className="font-bold text-foreground">{tournament.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tournament.type} · {tournament.platform} · Round {tournament.current_round}/{tournament.total_rounds || "?"} · {(tournament.registered_clubs || []).length} clubs
                </p>
                <span className={cn("text-[10px] px-2 py-0.5 rounded border mt-1 inline-block uppercase tracking-wider font-bold",
                  tournament.status === "registration" ? "bg-primary/10 text-primary border-primary/20" :
                  tournament.status === "in_progress" ? "bg-success/10 text-success border-success/20" :
                  tournament.status === "completed" ? "bg-muted text-muted-foreground border-border" :
                  "bg-destructive/10 text-destructive border-destructive/20"
                )}>{tournament.status}</span>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link to={`/tournaments/${tournament.id}`}><Button size="sm" variant="outline" className="border-border text-muted-foreground text-xs">{t("admin.actions.view")}</Button></Link>
                <Button size="sm" variant="outline" onClick={() => createEntranceLink(tournament.id)} className="border-border text-muted-foreground text-xs gap-1">
                  <Link2 className="w-3.5 h-3.5" /> {t("admin.tournaments.quickLink")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEntranceDialog({ id: tournament.id, name: tournament.name })} className="border-border text-muted-foreground text-xs gap-1">
                  <Link2 className="w-3.5 h-3.5" /> {t("admin.tournaments.manageLinks")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => simulateNextMatch(tournament.id)} disabled={simulatingTournamentId === tournament.id} className="border-primary/30 text-primary hover:text-primary text-xs gap-1">
                  <Wand2 className="w-3.5 h-3.5" /> {t("admin.tournaments.simulateNextMatch")}
                </Button>
                {status === "completed" || status === "registration" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteTournament(tournament)}
                    disabled={!canDeleteNow || deletingTournamentId === tournament.id}
                    title={lockDays > 0 ? t("admin.tournaments.deleteInDays", { days: lockDays }) : t("admin.tournaments.deletePermanently")}
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> {status === "completed" ? t("admin.tournaments.endAndDelete") : t("admin.actions.delete")}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => cancelTournament(tournament.id)} className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs gap-1">
                    <X className="w-3.5 h-3.5" /> {t("admin.tournaments.cancel")}
                  </Button>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}
      <EntranceLinksDialog
        open={!!entranceDialog}
        onOpenChange={(v) => { if (!v) setEntranceDialog(null); }}
        tournamentId={entranceDialog?.id}
        tournamentName={entranceDialog?.name}
      />
    </>
  );
}

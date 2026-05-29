import EmptyState from "@/components/admin/shared/EmptyState";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link2, Plus, Search, Trophy, X, Copy, RotateCcw, Ban } from "lucide-react";

function EntranceLinksDialog({ open, onOpenChange, tournamentId, tournamentName }) {
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
    window.alert("Link copied to clipboard.");
  }

  async function revokeLink(linkId) {
    if (!window.confirm("Revoke this entrance link?")) return;
    setActionLoading(linkId);
    try {
      await stageClient.functions.invoke("revokeTournamentEntranceLink", { link_id: linkId });
      await fetchLinks();
    } catch (err) {
      window.alert(err?.error || err?.message || "Failed to revoke link.");
    } finally {
      setActionLoading(null);
    }
  }

  async function regenerateLink(linkId) {
    if (!window.confirm("Regenerate this entrance link? The old link will be revoked.")) return;
    setActionLoading(linkId);
    try {
      const result = await stageClient.functions.invoke("regenerateTournamentEntranceLink", { link_id: linkId });
      const newLink = result?.data?.new_link || result?.new_link || null;
      if (newLink?.token) {
        const url = `${window.location.origin}/tournaments/entrance/${newLink.token}/signin`;
        await navigator.clipboard.writeText(url).catch(() => {});
        window.alert("New link generated and copied to clipboard.");
      }
      await fetchLinks();
    } catch (err) {
      window.alert(err?.error || err?.message || "Failed to regenerate link.");
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
        window.alert("New entrance link created and copied.");
      }
      await fetchLinks();
    } catch (err) {
      window.alert(err?.error || err?.message || "Failed to create entrance link.");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading uppercase tracking-tight text-sm">
            Entrance Links — {tournamentName || "Tournament"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Button size="sm" onClick={createNew} disabled={actionLoading === "create"} className="gap-1.5 text-xs h-7">
            <Plus className="w-3 h-3" /> Create New Link
          </Button>
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading links...</p>
          ) : links.length === 0 ? (
            <p className="text-xs text-muted-foreground">No entrance links yet.</p>
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
                        Expires: {new Date(link.expires_at).toLocaleString()}
                      </p>
                    )}
                    {isActive && (
                      <div className="flex gap-1.5 pt-1">
                        <Button type="button" size="sm" variant="outline" onClick={() => copyLink(link.token)} className="h-6 text-[10px] gap-1 px-2">
                          <Copy className="w-3 h-3" /> Copy
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => regenerateLink(link.id)} disabled={actionLoading === link.id} className="h-6 text-[10px] gap-1 px-2">
                          <RotateCcw className="w-3 h-3" /> Regenerate
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => revokeLink(link.id)} disabled={actionLoading === link.id} className="h-6 text-[10px] gap-1 px-2 border-destructive/30 text-destructive hover:bg-destructive/10">
                          <Ban className="w-3 h-3" /> Revoke
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
}) {
  const [entranceDialog, setEntranceDialog] = useState(null);

  async function createEntranceLink(tournamentId) {
    try {
      const result = await stageClient.functions.invoke("createTournamentEntranceLink", { tournament_id: tournamentId });
      const link = result?.data?.link || result?.link || null;
      if (!link?.token) throw new Error("Link token missing");
      const url = `${window.location.origin}/tournaments/entrance/${link.token}/signin`;
      await navigator.clipboard.writeText(url).catch(() => {});
      window.alert(`Entrance link created and copied:\n${url}`);
    } catch (err) {
      window.alert(err?.error || err?.message || "Failed to create entrance link.");
    }
  }

  return (
    <>
      <div className="mb-4 flex gap-2 flex-wrap">
        <Button onClick={() => setCreateTournamentOpen(true)} className="bg-primary text-primary-foreground gap-2 text-xs h-8 rounded">
          <Plus className="w-3.5 h-3.5" /> Create Tournament
        </Button>
        <Button variant="outline" size="sm" onClick={seedPressQuestions} disabled={saving} className="border-border text-muted-foreground hover:text-foreground text-xs h-8 rounded gap-1.5">
          Seed Press Questions
        </Button>
        <Button variant="outline" size="sm" onClick={reseedLifestyle} disabled={saving} className="border-border text-muted-foreground hover:text-foreground text-xs h-8 rounded gap-1.5">
          Reseed Lifestyle Prices
        </Button>
      </div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={tournamentSearch} onChange={e => setTournamentSearch(e.target.value)}
          className="w-full bg-secondary border border-border rounded pl-9 pr-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
          placeholder="Search by tournament name..." />
      </div>
      {tournaments.length === 0 ? (
        <EmptyState icon={Trophy} text="No active tournaments." />
      ) : (
        <div className="space-y-3">
          {tournaments.filter(t => t.name?.toLowerCase().includes(tournamentSearch.toLowerCase()) && t.status !== "archived" && t.status !== "cancelled").map(t => (
            <div key={t.id} className="bg-card border border-border rounded p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <p className="font-bold text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t.type} · {t.platform} · Round {t.current_round}/{t.total_rounds || "?"} · {(t.registered_clubs || []).length} clubs
                </p>
                <span className={cn("text-[10px] px-2 py-0.5 rounded border mt-1 inline-block uppercase tracking-wider font-bold",
                  t.status === "registration" ? "bg-primary/10 text-primary border-primary/20" :
                  t.status === "in_progress" ? "bg-success/10 text-success border-success/20" :
                  t.status === "completed" ? "bg-muted text-muted-foreground border-border" :
                  "bg-destructive/10 text-destructive border-destructive/20"
                )}>{t.status}</span>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link to={`/tournaments/${t.id}`}><Button size="sm" variant="outline" className="border-border text-muted-foreground text-xs">View</Button></Link>
                <Button size="sm" variant="outline" onClick={() => createEntranceLink(t.id)} className="border-border text-muted-foreground text-xs gap-1">
                  <Link2 className="w-3.5 h-3.5" /> Entrance Link
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEntranceDialog({ id: t.id, name: t.name })} className="border-border text-muted-foreground text-xs gap-1">
                  <Link2 className="w-3.5 h-3.5" /> Manage Links
                </Button>
                <Button size="sm" variant="outline" onClick={() => cancelTournament(t.id)} className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs gap-1"><X className="w-3.5 h-3.5" /> Cancel</Button>
              </div>
            </div>
          ))}
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

// @ts-nocheck — shadcn/ui primitives are untyped forwardRefs under checkJs.
import { useEffect, useState } from "react";
import BackfillStcButton from "@/components/admin/economy/BackfillStcButton";
import MarketValueConfigPanel from "@/components/admin/economy/MarketValueConfigPanel";
import AdminContractsPanel from "@/components/admin/economy/AdminContractsPanel";
import AdminShirtSalesPanel from "@/components/admin/economy/AdminShirtSalesPanel";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { stageClient } from "@/api/stageClient";
import { useTranslation } from "@/hooks/useTranslation";
import { Search, Coins, Ban, BadgeCheck, Check, X, ExternalLink, Trash2, AlertTriangle, Crown } from "lucide-react";
import { hasStagePlus } from "@/lib/subscriptionUtils";

const ADMIN_PLAYERS_PAGE_SIZE = 12;

export default function PlayersTab({
  players = [],
  identityClaims = [],
  playerSearch,
  setPlayerSearch,
  setCreditsDialog,
  setCreditsAmount,
  openPlayerWallet,
  kickFromClub,
  grantStagePlus,
  removeStagePlus,
  reviewIdentityClaim,
  deleteUserCompletely,
  onPlayerAccountDeleted,
}) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");

  const q = String(playerSearch || "").trim().toLowerCase();
  const filteredPlayers = !q
    ? players
    : players.filter((p) =>
        String(p.gamertag || "").toLowerCase().includes(q)
        || String(p.email || "").toLowerCase().includes(q)
        || String(p.platform || "").toLowerCase().includes(q)
      );
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / ADMIN_PLAYERS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visiblePlayers = filteredPlayers.slice(
    (safePage - 1) * ADMIN_PLAYERS_PAGE_SIZE,
    safePage * ADMIN_PLAYERS_PAGE_SIZE
  );

  useEffect(() => {
    setPage(1);
  }, [q]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  async function handleConfirmDeleteAccount() {
    if (!deleteTarget || deleteConfirm !== "DELETE" || deleting) return;
    setDeleting(true);
    try {
      await stageClient.functions.invoke("adminDeleteUserAccount", { player_id: deleteTarget.id });
      onPlayerAccountDeleted?.(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteConfirm("");
      toast({ title: t("admin.players.accountDeleted"), description: t("admin.players.accountDeletedDesc", { name: deleteTarget.gamertag || deleteTarget.email }) });
    } catch (err) {
      const msg = err?.message || err?.data?.error || t("admin.players.deleteFailed");
      toast({ title: t("admin.players.deleteFailed"), description: String(msg), variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <BackfillStcButton />
      <MarketValueConfigPanel />
      <AdminContractsPanel />
      <AdminShirtSalesPanel />
      <div className="mb-4 rounded border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <BadgeCheck className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">{t("admin.players.identityClaims")}</h2>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("admin.players.pendingCount", { count: identityClaims.length })}</span>
        </div>
        {identityClaims.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("admin.players.identityClaimsEmpty")}
          </p>
        ) : (
          <div className="space-y-2">
            {identityClaims.map(claim => (
              <div key={claim.id} className="rounded border border-border bg-card p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{claim.gamertag || claim.email}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {claim.platform} · {claim.platform_handle}
                    {claim.ea_id ? ` · EA: ${claim.ea_id}` : ""}
                    {claim.discord_handle ? ` · Discord: ${claim.discord_handle}` : ""}
                  </p>
                  {claim.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{claim.notes}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {claim.proof_url && (
                    <a href={claim.proof_url} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline" className="gap-1 text-xs">
                        <ExternalLink className="w-3.5 h-3.5" /> {t("admin.players.proof")}
                      </Button>
                    </a>
                  )}
                  <Button size="sm" onClick={() => reviewIdentityClaim?.(claim, "approved")} className="gap-1 text-xs bg-success text-white hover:bg-success/90">
                    <Check className="w-3.5 h-3.5" /> {t("admin.actions.approve")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => reviewIdentityClaim?.(claim, "rejected")} className="gap-1 text-xs border-destructive/30 text-destructive hover:bg-destructive/10">
                    <X className="w-3.5 h-3.5" /> {t("admin.actions.reject")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={playerSearch} onChange={e => setPlayerSearch(e.target.value)}
          className="w-full bg-secondary border border-border rounded pl-9 pr-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
          placeholder={t("admin.players.searchPlaceholder")} />
      </div>
      <div className="mb-4 rounded border border-destructive/25 bg-destructive/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <h2 className="text-sm font-bold text-foreground">{t("admin.players.deleteUserReset")}</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {t("admin.players.deleteUserResetDesc")}
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={deleteEmail}
            onChange={(e) => setDeleteEmail(e.target.value)}
            className="flex-1 bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-destructive/50"
            placeholder="email@example.com"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!deleteEmail.trim()}
            onClick={() => deleteUserCompletely?.(deleteEmail.trim())}
            className="border-destructive/30 text-destructive hover:bg-destructive/10 gap-1 text-xs"
          >
            <Trash2 className="w-3.5 h-3.5" /> {t("admin.players.deleteUser")}
          </Button>
        </div>
      </div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
          {filteredPlayers.length} players · Page {safePage} of {totalPages}
        </p>
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage === 1}
              className="h-8 min-w-8 border border-white/10 bg-black/30 px-2 text-xs font-black uppercase tracking-wider text-white/55 transition-colors hover:border-cyan-300/40 hover:text-cyan-100 disabled:opacity-30"
              style={{ clipPath: "polygon(18% 0, 100% 0, 82% 100%, 0 100%)" }}
            >
              ‹
            </button>
            {Array.from({ length: Math.min(totalPages, 9) }, (_, i) => {
              const n = totalPages <= 9
                ? i + 1
                : safePage <= 5
                  ? i + 1
                  : safePage >= totalPages - 4
                    ? totalPages - 8 + i
                    : safePage - 4 + i;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`h-8 min-w-8 border px-2 text-xs font-black transition-colors ${
                    n === safePage
                      ? "border-cyan-300 bg-cyan-300 text-black"
                      : "border-white/10 bg-black/30 text-white/55 hover:border-cyan-300/40 hover:text-cyan-100"
                  }`}
                  style={{ clipPath: "polygon(18% 0, 100% 0, 82% 100%, 0 100%)" }}
                >
                  {n}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={safePage === totalPages}
              className="h-8 min-w-8 border border-white/10 bg-black/30 px-2 text-xs font-black uppercase tracking-wider text-white/55 transition-colors hover:border-cyan-300/40 hover:text-cyan-100 disabled:opacity-30"
              style={{ clipPath: "polygon(18% 0, 100% 0, 82% 100%, 0 100%)" }}
            >
              ›
            </button>
          </div>
        )}
      </div>
      <div className="space-y-2">
        {visiblePlayers.map(p => (
          <div key={p.id} className="bg-card border border-border rounded p-4 flex items-center gap-4">
            <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 overflow-hidden">
              {p.avatar_url ? <img src={p.avatar_url} alt={p.gamertag} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-primary">{(p.gamertag || "?")[0].toUpperCase()}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{p.gamertag}</p>
              <p className="text-xs text-muted-foreground truncate">
                {p.email} · {p.platform} · {p.position}
                {Number(p.is_verified) === 1 ? ` · ${t("admin.players.verified")}` : ""}
              </p>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0 text-xs">
              <span className="font-semibold text-success">{((p.stc || 0) / 1000).toFixed(0)}K STC</span>
              {p.market_value_stc > 0 && (
                <span className="text-purple-400 font-medium">{((p.market_value_stc || 0) / 1_000_000).toFixed(1)}M {t("admin.players.val")}</span>
              )}
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              {hasStagePlus(p) ? (
                <Button size="sm" variant="outline" onClick={() => removeStagePlus?.(p)} className="border-primary/30 text-primary hover:bg-primary/10 gap-1 text-xs">
                  <Crown className="w-3.5 h-3.5" /> Plus
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => grantStagePlus?.(p)} className="border-primary/30 text-primary hover:bg-primary/10 gap-1 text-xs">
                  <Crown className="w-3.5 h-3.5" /> {t("admin.players.grantPlus")}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => openPlayerWallet(p)} className="border-success/30 text-success hover:bg-success/10 gap-1 text-xs"><Coins className="w-3.5 h-3.5" /> {t("admin.players.wallet")}</Button>
              <Button size="sm" variant="outline" onClick={() => { setCreditsDialog(p); setCreditsAmount(""); }} className="border-warning/30 text-warning hover:bg-warning/10 gap-1 text-xs"><Coins className="w-3.5 h-3.5" /> {t("admin.players.credits")}</Button>
              <Button size="sm" variant="outline" onClick={() => deleteUserCompletely?.(p)} className="border-destructive/30 text-destructive hover:bg-destructive/10 gap-1 text-xs"><Trash2 className="w-3.5 h-3.5" /> {t("admin.players.deleteUser")}</Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => p.club_id && kickFromClub(p.id)}
                disabled={!p.club_id}
                title={!p.club_id ? t("admin.players.notLinkedToClub") : t("admin.players.removeFromClub")}
                className="border-destructive/30 text-destructive hover:bg-destructive/10 gap-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Ban className="w-3.5 h-3.5" /> {p.club_id ? t("admin.players.kick") : t("admin.players.noClub")}
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                title={t("admin.players.deleteAccountTitle")}
                onClick={() => { setDeleteTarget(p); setDeleteConfirm(""); }}
                className="border-destructive/40 text-destructive hover:bg-destructive/10 gap-1 text-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteConfirm("");
            setDeleting(false);
          }
        }}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> {t("admin.players.deleteAccountDialogTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground space-y-2">
              <span className="block">
                {t("admin.players.deleteAccountDialogDesc", { name: deleteTarget?.gamertag || deleteTarget?.email })}
                <strong className="text-foreground"> {t("admin.players.cannotBeUndone")}</strong>
              </span>
              <span className="block pt-2">{t("admin.players.typeDeleteConfirm")}</span>
              <input
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder={t("admin.players.typeDeletePlaceholder")}
                className="w-full mt-2 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-destructive"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" className="border-border">{t("admin.actions.cancel")}</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteConfirm !== "DELETE" || deleting}
              onClick={() => void handleConfirmDeleteAccount()}
            >
              {deleting ? t("admin.players.deleting") : t("admin.players.deleteAccount")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

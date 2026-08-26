// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

const TYPE_LABELS = {
  tournament: "Tournament",
  regional_league: "Regional league",
  competition_season: "Competition season",
  competition: "Competition",
  competition_instance: "Competition engine",
  match: "Match / fixture",
};

export default function MailMergeDialog({ open, onOpenChange, onApply }) {
  const { t } = useTranslation();
  const [audiences, setAudiences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setSelected(null);
    setPreview(null);
    stageClient.http.get("/admin-mail/audiences")
      .then((res) => setAudiences(Array.isArray(res?.audiences) ? res.audiences : []))
      .catch((err) => setError(err?.message || t("admin.mail.mergeLoadFailed")))
      .finally(() => setLoading(false));
  }, [open, t]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return audiences;
    return audiences.filter((row) =>
      `${row.label} ${row.meta} ${row.type}`.toLowerCase().includes(q));
  }, [audiences, search]);

  async function pickAudience(row) {
    setSelected(row);
    setResolving(true);
    setError(null);
    try {
      const res = await stageClient.http.get("/admin-mail/recipients", { type: row.type, id: row.id });
      setPreview(res);
      if (!res?.emails?.length) {
        setError(t("admin.mail.mergeNoRecipients"));
      }
    } catch (err) {
      setPreview(null);
      setError(err?.message || t("admin.mail.mergeResolveFailed"));
    } finally {
      setResolving(false);
    }
  }

  function applySelection() {
    if (!preview?.emails?.length) return;
    onApply?.({
      bcc: preview.emails.join(", "),
      audience: selected,
      count: preview.emails.length,
      label: preview.label || selected?.label,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("admin.mail.mergeTitle")}</DialogTitle>
          <DialogDescription>{t("admin.mail.mergeDesc")}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("admin.mail.mergeSearch")}
            className="pl-9"
          />
        </div>

        <div className="max-h-[280px] overflow-y-auto rounded border border-border">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("admin.mail.mergeEmpty")}</p>
          ) : (
            filtered.map((row) => (
              <button
                key={`${row.type}-${row.id}`}
                type="button"
                onClick={() => void pickAudience(row)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-border/60 px-3 py-2.5 text-left hover:bg-muted/40",
                  selected?.type === row.type && selected?.id === row.id && "bg-primary/8",
                )}
              >
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {TYPE_LABELS[row.type] || row.type}
                    {row.meta ? ` · ${row.meta}` : ""}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        {resolving && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("admin.mail.mergeResolving")}
          </p>
        )}

        {preview?.emails?.length > 0 && (
          <div className="rounded border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
            {t("admin.mail.mergePreview", { count: preview.emails.length, label: preview.label || selected?.label })}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("admin.actions.cancel")}
          </Button>
          <Button type="button" disabled={!preview?.emails?.length} onClick={applySelection}>
            {t("admin.mail.mergeApply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

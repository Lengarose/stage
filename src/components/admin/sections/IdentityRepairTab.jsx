// @ts-nocheck — admin UI uses project shadcn primitives without full prop inference.
import { useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Search, ShieldCheck, Loader2, UserCog } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/useTranslation";

export default function IdentityRepairTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [clubId, setClubId] = useState("");
  const [scanAll, setScanAll] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [candidates, setCandidates] = useState(null);
  const [lastFilter, setLastFilter] = useState(null);
  const [error, setError] = useState(null);

  function buildFilter() {
    if (scanAll) return { scan_all: true };
    const filter = {};
    if (email.trim()) filter.email = email.trim();
    if (userId.trim()) filter.user_id = userId.trim();
    if (clubId.trim()) filter.club_id = clubId.trim();
    return filter;
  }

  async function runScan() {
    const filter = buildFilter();
    if (!filter.scan_all && !filter.email && !filter.user_id && !filter.club_id) {
      setError(t("admin.identityRepair.errNoFilter"));
      return;
    }
    setError(null);
    setScanning(true);
    setCandidates(null);
    try {
      const res = await stageClient.functions.invoke("repairPlayerPresidentIdentityLinks", {
        ...filter,
        dry_run: true,
      });
      setCandidates(res?.data?.candidates || []);
      setLastFilter(filter);
    } catch (err) {
      setError(err?.message || t("admin.identityRepair.errScanFailed"));
    } finally {
      setScanning(false);
    }
  }

  async function runRepair() {
    if (!lastFilter || !candidates?.length) return;
    setRepairing(true);
    setError(null);
    try {
      const res = await stageClient.functions.invoke("repairPlayerPresidentIdentityLinks", {
        ...lastFilter,
        dry_run: false,
      });
      toast({
        title: t("admin.identityRepair.repaired"),
        description: t("admin.identityRepair.repairedDesc", { count: res?.data?.repaired_count ?? 0 }),
      });
      setCandidates([]);
      setLastFilter(null);
    } catch (err) {
      setError(err?.message || t("admin.identityRepair.errRepairFailed"));
    } finally {
      setRepairing(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded border border-destructive/25 bg-destructive/5 p-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
          <div>
            <h2 className="font-heading text-xl uppercase text-foreground">{t("admin.identityRepair.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("admin.identityRepair.desc")}</p>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded p-4 space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("admin.identityRepair.email")}</label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="player@email.com"
              disabled={scanAll}
              className="bg-secondary border-border"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("admin.identityRepair.userId")}</label>
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="uuid"
              disabled={scanAll}
              className="bg-secondary border-border"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("admin.identityRepair.clubId")}</label>
            <Input
              value={clubId}
              onChange={(e) => setClubId(e.target.value)}
              placeholder="uuid"
              disabled={scanAll}
              className="bg-secondary border-border"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={scanAll}
            onChange={(e) => { setScanAll(e.target.checked); setCandidates(null); }}
            className="w-4 h-4"
          />
          {t("admin.identityRepair.scanAll")}
        </label>

        {error && (
          <p className="text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-2">
          <Button type="button" onClick={runScan} disabled={scanning} variant="outline" className="gap-1.5 border-border">
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {t("admin.identityRepair.scan")}
          </Button>
          {candidates && candidates.length > 0 && (
            <Button type="button" onClick={runRepair} disabled={repairing} className="gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {repairing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCog className="w-4 h-4" />}
              {t("admin.identityRepair.repairCount", { count: candidates.length })}
            </Button>
          )}
        </div>
      </div>

      {candidates && (
        <div className="bg-card border border-border rounded p-4 space-y-3">
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-success" /> {t("admin.identityRepair.noneFound")}
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                {t("admin.identityRepair.foundCount", { count: candidates.length })}
              </p>
              {candidates.map((c) => (
                <div key={c.player_id} className="rounded border border-warning/20 bg-warning/5 p-3 text-sm">
                  <p className="font-bold text-foreground">{c.user_email || c.user_id}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("admin.identityRepair.rowSummary", {
                      role: c.player_role || "—",
                      club: c.club_name || c.club_id || "—",
                      president: c.president_name || t("admin.identityRepair.unknownPresident"),
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

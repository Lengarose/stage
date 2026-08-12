// @ts-nocheck — admin UI uses project shadcn primitives without full prop inference.
import { useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Search, ShieldCheck, Loader2, UserCog } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/useTranslation";

const EMPTY_GROUPS = {
  repairable: [],
  ambiguous: [],
  invalid: [],
  already_ok: [],
};

function normalizeRepairResult(res) {
  const payload = res?.data || res || {};
  const groups = { ...EMPTY_GROUPS, ...(payload.groups || {}) };
  const repairable = payload.candidates || groups.repairable || [];
  return {
    ...payload,
    candidates: repairable,
    groups: {
      ...groups,
      repairable,
    },
  };
}

function CandidateRow({ candidate, tone = "warning" }) {
  const { t } = useTranslation();
  const toneClass = tone === "success"
    ? "border-success/20 bg-success/5"
    : tone === "destructive"
      ? "border-destructive/20 bg-destructive/5"
      : "border-warning/20 bg-warning/5";
  const empty = t("admin.identityRepair.noValue");

  return (
    <div className={`rounded border p-3 text-sm ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-foreground">{candidate.club_name || candidate.club_id || empty}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("admin.identityRepair.club")}: {candidate.club_id || empty}
          </p>
        </div>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {candidate.mapping_status || empty}
        </span>
      </div>
      <div className="grid md:grid-cols-2 gap-2 mt-3 text-xs text-muted-foreground">
        <p>
          <span className="text-foreground">{t("admin.identityRepair.canonicalPlayer")}:</span>{" "}
          {candidate.player_gamertag || candidate.player_email || candidate.player_id || empty}
        </p>
        <p>
          <span className="text-foreground">{t("admin.identityRepair.currentPresidentPlayer")}:</span>{" "}
          {candidate.current_president_player_id || empty}
        </p>
        <p>
          <span className="text-foreground">{t("admin.identityRepair.user")}:</span>{" "}
          {candidate.user_email || candidate.user_id || empty}
        </p>
        <p>
          <span className="text-foreground">{t("admin.identityRepair.legacyPresident")}:</span>{" "}
          {candidate.legacy_president_name || candidate.legacy_president_email || candidate.legacy_president_id || empty}
        </p>
      </div>
      {candidate.mapping_reason && (
        <p className="text-xs text-muted-foreground mt-2">
          <span className="text-foreground">{t("admin.identityRepair.mappingReason")}:</span> {candidate.mapping_reason}
        </p>
      )}
    </div>
  );
}

export default function IdentityRepairTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [clubId, setClubId] = useState("");
  const [scanAll, setScanAll] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState(null);
  const [lastFilter, setLastFilter] = useState(null);
  const [error, setError] = useState(null);
  const groups = repairResult?.groups || EMPTY_GROUPS;
  const candidates = repairResult?.candidates || null;
  const repairableCount = candidates?.length || 0;

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
    setRepairResult(null);
    try {
      const res = await stageClient.functions.invoke("repairPlayerPresidentIdentityLinks", {
        ...filter,
        dry_run: true,
      });
      setRepairResult(normalizeRepairResult(res));
      setLastFilter(filter);
    } catch (err) {
      setError(err?.message || t("admin.identityRepair.errScanFailed"));
    } finally {
      setScanning(false);
    }
  }

  async function runRepair() {
    if (!lastFilter || repairableCount <= 0) return;
    setRepairing(true);
    setError(null);
    try {
      const res = await stageClient.functions.invoke("repairPlayerPresidentIdentityLinks", {
        ...lastFilter,
        dry_run: false,
      });
      const payload = normalizeRepairResult(res);
      toast({
        title: t("admin.identityRepair.repaired"),
        description: t("admin.identityRepair.repairedDesc", { count: payload.repaired_count ?? 0 }),
      });
      setRepairResult(payload);
      setLastFilter(null);
    } catch (err) {
      setError(err?.message || t("admin.identityRepair.errRepairFailed"));
    } finally {
      setRepairing(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded border border-success/25 bg-success/5 p-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-success shrink-0" />
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
            onChange={(e) => { setScanAll(e.target.checked); setRepairResult(null); }}
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
          {lastFilter && repairableCount > 0 && (
            <Button type="button" onClick={runRepair} disabled={repairing} className="gap-1.5">
              {repairing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCog className="w-4 h-4" />}
              {t("admin.identityRepair.repairCount", { count: repairableCount })}
            </Button>
          )}
        </div>
      </div>

      {repairResult && (
        <div className="bg-card border border-border rounded p-4 space-y-3">
          {repairableCount === 0 && groups.ambiguous.length === 0 && groups.invalid.length === 0 ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-success" /> {t("admin.identityRepair.noneFound")}
            </p>
          ) : (
            <div className="space-y-2">
              <div className="grid sm:grid-cols-4 gap-2 text-xs">
                <p className="rounded border border-border bg-secondary/40 px-3 py-2">{t("admin.identityRepair.repairable")}: {repairableCount}</p>
                <p className="rounded border border-border bg-secondary/40 px-3 py-2">{t("admin.identityRepair.ambiguous")}: {groups.ambiguous.length}</p>
                <p className="rounded border border-border bg-secondary/40 px-3 py-2">{t("admin.identityRepair.invalid")}: {groups.invalid.length}</p>
                <p className="rounded border border-border bg-secondary/40 px-3 py-2">{t("admin.identityRepair.alreadyOk")}: {groups.already_ok.length}</p>
              </div>

              {repairableCount > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    {t("admin.identityRepair.foundCount", { count: repairableCount })}
                  </p>
                  {candidates.map((c) => (
                    <CandidateRow key={`${c.club_id}:${c.player_id}:repairable`} candidate={c} />
                  ))}
                </div>
              )}

              {groups.ambiguous.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-warning" /> {t("admin.identityRepair.ambiguous")}
                  </p>
                  {groups.ambiguous.map((c) => (
                    <CandidateRow key={`${c.club_id}:${c.mapping_status}:ambiguous`} candidate={c} />
                  ))}
                </div>
              )}

              {groups.invalid.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive" /> {t("admin.identityRepair.invalid")}
                  </p>
                  {groups.invalid.map((c) => (
                    <CandidateRow key={`${c.club_id}:${c.mapping_status}:invalid`} candidate={c} tone="destructive" />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

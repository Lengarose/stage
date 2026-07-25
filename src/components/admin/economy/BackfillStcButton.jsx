import { useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

export default function BackfillStcButton() {
  const { t } = useTranslation();
  const [phase, setPhase]   = useState('idle');
  const [scan, setScan]     = useState(null);
  const [result, setResult] = useState(null);
  const [errMsg, setErrMsg] = useState('');

  async function runScan() {
    setPhase('scanning');
    setScan(null);
    setResult(null);
    try {
      const res = await stageClient.functions.invoke('backfillPlayerStc', { dry_run: true });
      setScan(res?.data || {});
      setPhase('scanned');
    } catch (err) {
      setErrMsg(err?.message || t("admin.economy.backfill.scanFailed"));
      setPhase('error');
    }
  }

  async function runApply() {
    setPhase('applying');
    try {
      const res = await stageClient.functions.invoke('backfillPlayerStc', { dry_run: false });
      setResult(res?.data || {});
      setPhase('done');
    } catch (err) {
      setErrMsg(err?.message || t("admin.economy.backfill.applyFailed"));
      setPhase('error');
    }
  }

  return (
    <div className="mb-4 p-4 bg-warning/10 border border-warning/30 rounded-xl space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-warning uppercase tracking-wider">{t("admin.economy.backfill.title")}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{t("admin.economy.backfill.description")}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {(phase === 'idle' || phase === 'error' || phase === 'done') && (
            <Button size="sm" onClick={runScan}
              className="bg-warning/20 text-warning border border-warning/40 hover:bg-warning/30 font-bold text-xs h-8 px-3">
              {t("admin.economy.backfill.scan")}
            </Button>
          )}
          {phase === 'scanned' && scan?.total_to_repair > 0 && (
            <>
              <Button size="sm" variant="ghost" onClick={runScan}
                className="text-muted-foreground text-xs h-8 px-3">
                {t("admin.economy.backfill.rescan")}
              </Button>
              <Button size="sm" onClick={runApply}
                className="bg-warning text-black font-bold text-xs h-8 px-4">
                {t("admin.economy.backfill.applyFix")}
              </Button>
            </>
          )}
          {phase === 'scanned' && scan?.total_to_repair === 0 && (
            <Button size="sm" variant="ghost" onClick={runScan}
              className="text-muted-foreground text-xs h-8 px-3">
              {t("admin.economy.backfill.rescan")}
            </Button>
          )}
          {(phase === 'scanning' || phase === 'applying') && (
            <Button size="sm" disabled className="text-xs h-8 px-4">
              <div className="w-3 h-3 border border-current/30 border-t-current rounded-full animate-spin mr-1.5" />
              {phase === 'scanning' ? t("admin.economy.backfill.scanning") : t("admin.economy.backfill.applying")}
            </Button>
          )}
        </div>
      </div>

      {phase === 'scanned' && scan && (
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="bg-black/20 rounded-lg p-2 text-center">
            <p className="text-lg font-black text-warning">{scan.needs_stc ?? 0}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{t("admin.economy.backfill.missingStc")}</p>
          </div>
          <div className="bg-black/20 rounded-lg p-2 text-center">
            <p className="text-lg font-black text-blue-400">{scan.needs_tx_only ?? 0}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{t("admin.economy.backfill.missingTxOnly")}</p>
          </div>
          <div className="bg-black/20 rounded-lg p-2 text-center">
            <p className={`text-lg font-black ${scan.total_to_repair > 0 ? 'text-destructive' : 'text-success'}`}>
              {scan.total_to_repair ?? 0}
            </p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{t("admin.economy.backfill.totalToRepair")}</p>
          </div>
        </div>
      )}
      {phase === 'scanned' && scan?.total_to_repair === 0 && (
        <p className="text-[10px] text-success">{t("admin.economy.backfill.allHealthy")}</p>
      )}

      {phase === 'done' && result && (
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="bg-black/20 rounded-lg p-2 text-center">
            <p className="text-lg font-black text-success">{result.repaired_stc ?? 0}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{t("admin.economy.backfill.stcRepaired")}</p>
          </div>
          <div className="bg-black/20 rounded-lg p-2 text-center">
            <p className="text-lg font-black text-success">{result.repaired_tx ?? 0}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{t("admin.economy.backfill.txCreated")}</p>
          </div>
          <div className="bg-black/20 rounded-lg p-2 text-center">
            <p className={`text-lg font-black ${result.errors > 0 ? 'text-destructive' : 'text-success'}`}>
              {result.errors ?? 0}
            </p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{t("admin.economy.backfill.errors")}</p>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <p className="text-[10px] text-destructive">{errMsg}</p>
      )}
    </div>
  );
}

import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { stageClient } from "@/api/stageClient";
import TransferRoomEditor from "@/components/admin/TransferRoomEditor";
import TransferWindowPanel from "@/components/admin/TransferWindowPanel";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Clock, Loader2, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { normalizeTransferMarketPlayers } from "@/lib/transferMarketEntries";
import { isTransferWindowOpen } from "@/lib/transferWindow";
import { cn } from "@/lib/utils";

function AdminMetricCard({ icon: Icon, label, value, tone = "cyan", detail }) {
  const tones = {
    cyan: "border-cyan-300/18 text-cyan-200 shadow-cyan-500/20",
    green: "border-emerald-300/18 text-emerald-300 shadow-emerald-500/20",
    yellow: "border-[#f5c542]/22 text-[#f5c542] shadow-yellow-500/20",
    red: "border-red-400/18 text-red-300 shadow-red-500/20",
  };

  return (
    <div className={cn("border bg-black/32 p-4 shadow-[0_24px_70px_-54px] backdrop-blur-sm", tones[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/40">{label}</p>
          <p className={cn("mt-2 font-heading text-3xl font-black leading-none", tones[tone].split(" ")[1])}>{value}</p>
          {detail ? <p className="mt-2 text-xs text-white/45">{detail}</p> : null}
        </div>
        <Icon className="h-5 w-5 text-white/38" />
      </div>
    </div>
  );
}

export default function TransfersTab() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [market, setMarket] = useState({ freeAgents: [], expiringPlayers: [] });
  const [pendingContracts, setPendingContracts] = useState([]);
  const [currentWindow, setCurrentWindow] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [marketRes, pendingRows, windowRes] = await Promise.all([
        stageClient.functions.invoke("getTransferMarket", {}).catch(() => ({ data: {} })),
        stageClient.entities.PlayerContract.filter({ status: "pending_window" }).catch(() => []),
        stageClient.functions.invoke("transferWindowActions", { action: "get_current" }).catch(() => ({ data: {} })),
      ]);
      setMarket(normalizeTransferMarketPlayers(marketRes?.data || {}));
      setPendingContracts(Array.isArray(pendingRows) ? pendingRows : []);
      setCurrentWindow(windowRes?.data?.window || null);
    } catch (err) {
      console.error("[TransfersTab] load failed", err);
    } finally {
      setLoading(false);
    }
  }

  const isOpen = isTransferWindowOpen(currentWindow);
  const expiringCount = market.expiringPlayers.length;
  const freeCount = market.freeAgents.length;
  const pendingCount = pendingContracts.length;
  const totalTargets = useMemo(() => freeCount + expiringCount, [freeCount, expiringCount]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.34em] text-cyan-300">Admin</p>
          <h2 className="font-heading text-3xl font-black uppercase text-white">Transfer Room</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Control the public transfer board, transfer window state, pending contracts and the full-room banner.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={load}
            disabled={loading}
            className="gap-2 rounded-none border-0 bg-transparent font-heading text-xs font-black uppercase tracking-[0.16em] text-cyan-100/70 shadow-none hover:bg-transparent hover:text-white"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Button
            asChild
            type="button"
            className="gap-2 rounded-none bg-cyan-300 font-heading text-xs font-black uppercase tracking-[0.16em] text-slate-950 hover:bg-cyan-200"
          >
            <Link to="/transfer-market">
              Open Room
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard icon={Users} label="Visible targets" value={totalTargets} detail="Free agents + final 14 days" />
        <AdminMetricCard icon={ShieldCheck} label="Free agents" value={freeCount} tone="green" detail="Available to sign now" />
        <AdminMetricCard icon={Clock} label="Expiring · 14 days" value={expiringCount} tone="yellow" detail="Current playing agreements only" />
        <AdminMetricCard icon={Clock} label="Pending window" value={pendingCount} tone={pendingCount ? "red" : "cyan"} detail={isOpen ? "Window is open" : "Window is closed"} />
      </div>

      <div className="grid gap-5">
        <div className="border border-white/10 bg-[linear-gradient(145deg,rgba(9,16,28,0.82),rgba(3,8,13,0.92))] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#f5c542]">{t("admin.transfers.windowTitle")}</p>
              <h3 className="font-heading text-xl font-black uppercase text-white">{t("admin.transfers.panelTitle")}</h3>
            </div>
          </div>
          <TransferWindowPanel />
        </div>

      </div>
      <TransferRoomEditor />
    </div>
  );
}

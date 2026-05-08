import { useState, useEffect, useRef, useMemo } from "react";
import TransferWindowPanel from "@/components/admin/TransferWindowPanel";
import RewardConfigPanel from "@/components/rewards/RewardConfigPanel";
import LandingPageEditor from "@/components/admin/LandingPageEditor";
import { base44 } from "@/api/base44Client";
import { stageClient } from "@/api/stageClient";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import TrophyCarousel from "@/components/tournament/TrophyCarousel";
import { cn } from "@/lib/utils";
import {
  Shield, AlertTriangle, Users, Trophy, Check, X,
  ArrowLeft, Gavel, Flag, Ban, RefreshCw, Coins, Plus, Trash2,
  Newspaper, Upload, Building2, LogIn, Search, TrendingUp,
  Pencil, ChevronDown, ShoppingBag, Ticket, Wallet, Activity,
  ClipboardList, Filter, Zap, DollarSign, History
} from "lucide-react";
import { COUNTRIES } from "../lib/countries";
import { REGIONS, LEAGUE_DEFINITIONS } from "../lib/qualificationConfig";
import { forceSchedule, flagForAdminReview, declareForfeit } from "../lib/scheduleEngine";

function BackfillStcButton() {
  const [phase, setPhase]   = useState('idle'); // idle | scanning | scanned | applying | done | error
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
      setErrMsg(err?.message || 'Scan failed');
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
      setErrMsg(err?.message || 'Apply failed');
      setPhase('error');
    }
  }

  return (
    <div className="mb-4 p-4 bg-warning/10 border border-warning/30 rounded-xl space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-warning uppercase tracking-wider">Wallet Backfill — 50K STC</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Detects and repairs players missing their 50,000 STC starting balance or welcome transaction.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {(phase === 'idle' || phase === 'error' || phase === 'done') && (
            <Button size="sm" onClick={runScan}
              className="bg-warning/20 text-warning border border-warning/40 hover:bg-warning/30 font-bold text-xs h-8 px-3">
              Scan
            </Button>
          )}
          {phase === 'scanned' && scan?.total_to_repair > 0 && (
            <>
              <Button size="sm" variant="ghost" onClick={runScan}
                className="text-muted-foreground text-xs h-8 px-3">
                Re-scan
              </Button>
              <Button size="sm" onClick={runApply}
                className="bg-warning text-black font-bold text-xs h-8 px-4">
                Apply Fix
              </Button>
            </>
          )}
          {phase === 'scanned' && scan?.total_to_repair === 0 && (
            <Button size="sm" variant="ghost" onClick={runScan}
              className="text-muted-foreground text-xs h-8 px-3">
              Re-scan
            </Button>
          )}
          {(phase === 'scanning' || phase === 'applying') && (
            <Button size="sm" disabled className="text-xs h-8 px-4">
              <div className="w-3 h-3 border border-current/30 border-t-current rounded-full animate-spin mr-1.5" />
              {phase === 'scanning' ? 'Scanning…' : 'Applying…'}
            </Button>
          )}
        </div>
      </div>

      {phase === 'scanned' && scan && (
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="bg-black/20 rounded-lg p-2 text-center">
            <p className="text-lg font-black text-warning">{scan.needs_stc ?? 0}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Missing STC</p>
          </div>
          <div className="bg-black/20 rounded-lg p-2 text-center">
            <p className="text-lg font-black text-blue-400">{scan.needs_tx_only ?? 0}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Missing TX only</p>
          </div>
          <div className="bg-black/20 rounded-lg p-2 text-center">
            <p className={`text-lg font-black ${scan.total_to_repair > 0 ? 'text-destructive' : 'text-success'}`}>
              {scan.total_to_repair ?? 0}
            </p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Total to repair</p>
          </div>
        </div>
      )}
      {phase === 'scanned' && scan?.total_to_repair === 0 && (
        <p className="text-[10px] text-success">All wallets are healthy — nothing to repair.</p>
      )}

      {phase === 'done' && result && (
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="bg-black/20 rounded-lg p-2 text-center">
            <p className="text-lg font-black text-success">{result.repaired_stc ?? 0}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">STC Repaired</p>
          </div>
          <div className="bg-black/20 rounded-lg p-2 text-center">
            <p className="text-lg font-black text-success">{result.repaired_tx ?? 0}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">TX Created</p>
          </div>
          <div className="bg-black/20 rounded-lg p-2 text-center">
            <p className={`text-lg font-black ${result.errors > 0 ? 'text-destructive' : 'text-success'}`}>
              {result.errors ?? 0}
            </p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Errors</p>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <p className="text-[10px] text-destructive">{errMsg}</p>
      )}
    </div>
  );
}

function MarketValueConfigPanel() {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [recalcBusy, setRecalcBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [open, setOpen] = useState(false);

  async function load() {
    try {
      const res = await stageClient.functions.invoke("playerMarketValue", { action: "get_config" });
      setCfg(res.data || {});
    } catch (err) { setMsg({ type: "error", text: err?.message || "Failed to load config" }); }
  }

  async function save() {
    if (!cfg) return;
    setSaving(true);
    try {
      await stageClient.functions.invoke("playerMarketValue", { action: "set_config", ...cfg });
      setMsg({ type: "success", text: "Config saved ✓" });
    } catch (err) { setMsg({ type: "error", text: err?.message || "Failed" }); }
    setSaving(false);
  }

  async function recalcAll() {
    if (!confirm("Recalculate market value for all players? This may take a moment.")) return;
    setRecalcBusy(true);
    try {
      const res = await stageClient.functions.invoke("playerMarketValue", { action: "recalculate_all" });
      setMsg({ type: "success", text: `✓ Recalculated ${res.data?.updated || 0} players` });
    } catch (err) { setMsg({ type: "error", text: err?.message || "Failed" }); }
    setRecalcBusy(false);
  }

  const fields = [
    { key: "base_per_match",           label: "Base STC per match",           help: "STC added to base for each match played" },
    { key: "max_base",                  label: "Max base (experience cap)",    help: "Maximum base value from experience alone" },
    { key: "goal_rate_bonus",           label: "Goal rate bonus",              help: "Max bonus added per goals-per-match (scaled 0-1)" },
    { key: "assist_rate_bonus",         label: "Assist rate bonus",            help: "Max bonus added per assists-per-match" },
    { key: "clean_sheet_rate_bonus",    label: "Clean sheet rate bonus",       help: "Max bonus per clean-sheets-per-match (GK/DEF)" },
    { key: "motm_bonus",                label: "MOTM bonus (per award)",       help: "Flat STC bonus per Man of the Match award" },
    { key: "consistency_boost",         label: "Consistency boost (0–1)",      help: "% value boost for low rating variance" },
    { key: "form_boost",                label: "Recent form boost (0–1)",      help: "% boost when recent form beats career avg" },
    { key: "form_penalty",              label: "Recent form penalty (0–1)",    help: "% penalty when recent form below career avg" },
    { key: "win_rate_boost",            label: "Win rate boost (0–1)",         help: "% boost for high win rate (>70%)" },
    { key: "ovr_weight",                label: "OVR rating weight (0–1)",      help: "How much overall_rating contributes (keep low)" },
    { key: "spike_cap_up",              label: "Max value increase / recalc",  help: "Max % a value can rise per recalculation (e.g. 0.5 = 50%)" },
    { key: "spike_cap_down",            label: "Max value decrease / recalc",  help: "Max % a value can drop per recalculation (e.g. 0.35 = 35%)" },
  ];

  return (
    <div className="mb-4 bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => { setOpen(o => !o); if (!open && !cfg) load(); }}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
      >
        <span className="text-xs font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-primary" /> Market Value Engine — Config
        </span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-border p-4 space-y-4">
          {msg && (
            <p className={cn("text-xs font-medium", msg.type === "success" ? "text-success" : "text-destructive")}>{msg.text}</p>
          )}
          {!cfg ? (
            <p className="text-xs text-muted-foreground">Loading config…</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {fields.map(f => (
                <div key={f.key}>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">{f.label}</label>
                  <input
                    type="number" step="any"
                    value={cfg[f.key] ?? ""}
                    onChange={e => setCfg(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full bg-secondary border border-border rounded px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/50"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">{f.help}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={save} disabled={saving || !cfg}
              className="bg-primary/20 text-primary hover:bg-primary/30 border border-primary/40 text-xs">
              {saving ? "Saving…" : "Save Config"}
            </Button>
            <Button size="sm" variant="outline" onClick={recalcAll} disabled={recalcBusy}
              className="text-xs border-warning/30 text-warning hover:bg-warning/10">
              {recalcBusy ? "Recalculating…" : "Recalculate All Player Values"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminContractsPanel() {
  const [contracts, setContracts] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [editDialog, setEditDialog] = useState(null);   // contract being edited
  const [corrDialog, setCorrDialog] = useState(null);   // contract for salary correction
  const [editFields, setEditFields] = useState({});
  const [corrAmount, setCorrAmount] = useState("");
  const [corrNote, setCorrNote] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");

  async function load() {
    setLoading(true);
    try {
      const res = await stageClient.functions.invoke("contractManagement", { action: "get_all" });
      setContracts(res?.data?.contracts || []);
    } catch (err) { setMsg({ type: "error", text: err?.message || "Failed to load" }); }
    setLoading(false);
  }

  async function runExpiry() {
    try {
      const res = await stageClient.functions.invoke("contractManagement", { action: "expire_overdue" });
      setMsg({ type: "success", text: `Expired ${res?.data?.expired_count || 0} contracts` });
      load();
    } catch (err) { setMsg({ type: "error", text: err?.message || "Failed" }); }
  }

  async function runSalaries() {
    try {
      const res = await stageClient.functions.invoke("contractManagement", { action: "auto_pay_salaries" });
      setMsg({ type: "success", text: `Paid ${res?.data?.paid || 0} / ${res?.data?.total || 0} salary contracts` });
      load();
    } catch (err) { setMsg({ type: "error", text: err?.message || "Failed" }); }
  }

  async function cancelContract(c) {
    if (!confirm(`Cancel contract for ${c.gamertag || c.full_name}?`)) return;
    try {
      await stageClient.functions.invoke("contractManagement", { action: "admin_cancel", contract_id: c.id });
      setMsg({ type: "success", text: "Contract cancelled" });
      setContracts(prev => prev.map(x => x.id === c.id ? { ...x, status: "terminated" } : x));
    } catch (err) { setMsg({ type: "error", text: err?.message || "Failed" }); }
  }

  async function saveEdit() {
    if (!editDialog) return;
    setSavingEdit(true);
    try {
      await stageClient.functions.invoke("contractManagement", { action: "admin_edit", contract_id: editDialog.id, ...editFields });
      setMsg({ type: "success", text: "Contract updated ✓" });
      setContracts(prev => prev.map(x => x.id === editDialog.id ? { ...x, ...editFields } : x));
      setEditDialog(null);
    } catch (err) { setMsg({ type: "error", text: err?.message || "Failed" }); }
    setSavingEdit(false);
  }

  async function saveCorrection() {
    if (!corrDialog || !corrAmount) return;
    setSavingEdit(true);
    try {
      await stageClient.functions.invoke("contractManagement", {
        action: "admin_correct_salary", contract_id: corrDialog.id,
        amount: Number(corrAmount), note: corrNote || undefined,
      });
      setMsg({ type: "success", text: "Salary correction applied ✓" });
      setCorrDialog(null); setCorrAmount(""); setCorrNote("");
    } catch (err) { setMsg({ type: "error", text: err?.message || "Failed" }); }
    setSavingEdit(false);
  }

  const fmt = (n) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(Math.round(n / 1_000))}K` : `${n}`;
  const filtered = contracts ? contracts.filter(c => filterStatus === "all" || c.status === filterStatus) : [];
  const statusColor = { active: "text-success", pending: "text-warning", terminated: "text-destructive", expired: "text-muted-foreground", rejected: "text-muted-foreground", pending_window: "text-warning" };

  return (
    <div className="mb-4 bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => { setOpen(o => !o); if (!open && !contracts) load(); }}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
      >
        <span className="text-xs font-bold text-foreground flex items-center gap-2">
          <Coins className="w-3.5 h-3.5 text-primary" /> Contracts Management
        </span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-3">
          {msg && (
            <p className={cn("text-xs font-medium", msg.type === "success" ? "text-success" : "text-destructive")}>{msg.text}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={load} disabled={loading} className="text-xs">
              {loading ? "Loading…" : "Refresh"}
            </Button>
            <Button size="sm" variant="outline" onClick={runExpiry} className="text-xs border-warning/30 text-warning hover:bg-warning/10">
              Expire Overdue
            </Button>
            <Button size="sm" variant="outline" onClick={runSalaries} className="text-xs border-success/30 text-success hover:bg-success/10">
              Pay All Salaries
            </Button>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="ml-auto bg-secondary border border-border text-xs text-foreground rounded px-2 py-1.5 outline-none">
              {["all", "active", "pending", "negotiating", "pending_window", "terminated", "expired", "rejected"].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {!contracts ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground">No contracts found.</p>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {filtered.map(c => (
                <div key={c.id} className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg text-xs">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground">{c.gamertag || c.full_name || c.user_id}</span>
                    <span className="text-muted-foreground mx-1.5">→</span>
                    <span className="text-foreground">{c.club_name || c.team_id}</span>
                    <span className="mx-1.5 text-muted-foreground">·</span>
                    <span className={cn("font-medium capitalize", statusColor[c.status] || "text-muted-foreground")}>{c.status}</span>
                    {c.weekly_salary_stc > 0 && (
                      <span className="ml-1.5 text-success">{fmt(c.weekly_salary_stc)}/wk</span>
                    )}
                    {c.end_date && (
                      <span className="ml-1.5 text-muted-foreground">until {c.end_date}</span>
                    )}
                  </div>
                  <button onClick={() => { setEditDialog(c); setEditFields({ weekly_salary_stc: c.weekly_salary_stc, end_date: c.end_date, status: c.status }); }}
                    className="p-1 hover:text-primary text-muted-foreground transition-colors" title="Edit">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={() => { setCorrDialog(c); setCorrAmount(String(c.weekly_salary_stc || "")); setCorrNote(""); }}
                    className="p-1 hover:text-success text-muted-foreground transition-colors" title="Correct salary">
                    <Coins className="w-3 h-3" />
                  </button>
                  {["active", "pending", "negotiating", "pending_window"].includes(c.status) && (
                    <button onClick={() => cancelContract(c)}
                      className="p-1 hover:text-destructive text-muted-foreground transition-colors" title="Cancel">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Contract</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Weekly Salary (STC)</label>
              <Input type="number" value={editFields.weekly_salary_stc ?? ""} onChange={e => setEditFields(p => ({ ...p, weekly_salary_stc: e.target.value }))} className="text-sm" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">End Date</label>
              <Input type="date" value={editFields.end_date ?? ""} onChange={e => setEditFields(p => ({ ...p, end_date: e.target.value }))} className="text-sm" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Status</label>
              <select value={editFields.status ?? ""} onChange={e => setEditFields(p => ({ ...p, status: e.target.value }))}
                className="w-full bg-secondary border border-border text-sm text-foreground rounded px-2.5 py-1.5 outline-none">
                {["active", "pending", "negotiating", "pending_window", "terminated", "expired", "rejected"].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <Button onClick={saveEdit} disabled={savingEdit} className="w-full bg-primary text-primary-foreground text-sm">
              {savingEdit ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Salary correction dialog */}
      <Dialog open={!!corrDialog} onOpenChange={() => setCorrDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Correct Salary Payment</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              This will deduct the amount from the club and credit it to the player as a salary correction.
            </p>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Amount (STC)</label>
              <Input type="number" value={corrAmount} onChange={e => setCorrAmount(e.target.value)} className="text-sm" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Note (optional)</label>
              <Input value={corrNote} onChange={e => setCorrNote(e.target.value)} className="text-sm" placeholder="Reason for correction" />
            </div>
            <Button onClick={saveCorrection} disabled={savingEdit || !corrAmount} className="w-full bg-success/20 text-success border border-success/30 text-sm hover:bg-success/30">
              {savingEdit ? "Applying…" : "Apply Correction"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminShirtSalesPanel() {
  const [open, setOpen]       = useState(false);
  const [cfg, setCfg]         = useState(null);
  const [lb, setLb]           = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState(null);
  const [corrClub, setCorrClub] = useState("");
  const [corrAmt, setCorrAmt]   = useState("");
  const [corrNote, setCorrNote] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [cfgRes, lbRes] = await Promise.all([
        stageClient.functions.invoke("shirtSales", { action: "get_config" }),
        stageClient.functions.invoke("shirtSales", { action: "get_leaderboard", limit: 20 }),
      ]);
      setCfg(cfgRes?.data?.weights || {});
      setLb(lbRes?.data?.leaderboard || []);
    } catch (err) { setMsg({ type: "error", text: err?.message || "Failed" }); }
    setLoading(false);
  }

  async function saveConfig() {
    setSaving(true);
    try {
      await stageClient.functions.invoke("shirtSales", { action: "set_config", weights: cfg });
      setMsg({ type: "success", text: "Config saved ✓" });
    } catch (err) { setMsg({ type: "error", text: err?.message || "Failed" }); }
    setSaving(false);
  }

  async function applyCorrection() {
    if (!corrClub || !corrAmt) return;
    setSaving(true);
    try {
      await stageClient.functions.invoke("shirtSales", {
        action: "correct_revenue", club_id: corrClub, amount: Number(corrAmt), note: corrNote || undefined,
      });
      setMsg({ type: "success", text: "Revenue correction applied ✓" });
      setCorrClub(""); setCorrAmt(""); setCorrNote("");
    } catch (err) { setMsg({ type: "error", text: err?.message || "Failed" }); }
    setSaving(false);
  }

  const fmt = (n) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : `${n}`;

  const cfgFields = [
    { key: "base_per_mv_1m",            label: "Demand per 1M market value",    help: "Shirts generated per 1M STC of market value" },
    { key: "goal_demand",               label: "Demand per goal",               help: "Extra shirts per goal scored in the match" },
    { key: "assist_demand",             label: "Demand per assist",             help: "Extra shirts per assist" },
    { key: "rating_demand_per_point",   label: "Demand per rating point (>6.0)", help: "Extra shirts per rating point above 6.0" },
    { key: "motm_demand",               label: "MOTM bonus demand",             help: "Extra shirts if player is Man of the Match" },
    { key: "clean_sheet_demand",        label: "Clean sheet demand bonus",      help: "Extra shirts if player kept a clean sheet" },
    { key: "form_influence",            label: "Form influence (0–1)",          help: "How much recent form affects demand (capped ±20%)" },
    { key: "contract_boost",            label: "Contract boost (0–1)",          help: "Demand multiplier if player has active contract" },
    { key: "max_per_match",             label: "Max shirts per player per match", help: "Anti-spike cap" },
    { key: "price_base",                label: "Base shirt price (STC)",        help: "Starting shirt price before bonuses" },
    { key: "price_per_ovr_above_70",    label: "Price per OVR above 70",        help: "STC added per OVR rating point above 70" },
    { key: "price_per_goal",            label: "Price per career goal",         help: "STC added per career goal" },
    { key: "price_per_assist",          label: "Price per career assist",       help: "STC added per career assist" },
    { key: "price_per_rating_point",    label: "Price per avg rating point",    help: "STC added per avg_match_rating point above 6.0" },
  ];

  return (
    <div className="mb-4 bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => { setOpen(o => !o); if (!open && !cfg) load(); }}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
      >
        <span className="text-xs font-bold text-foreground flex items-center gap-2">
          <ShoppingBag className="w-3.5 h-3.5 text-primary" /> Shirt Sales — View &amp; Config
        </span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-5">
          {msg && (
            <p className={cn("text-xs font-medium", msg.type === "success" ? "text-success" : "text-destructive")}>{msg.text}</p>
          )}

          {/* Global leaderboard */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Global Top Shirt Sellers</p>
            {loading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : (
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {(lb || []).map((e, i) => (
                  <div key={e.player_id} className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg text-xs">
                    <span className="text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                    <span className="font-medium text-foreground flex-1 truncate">{e.gamertag}</span>
                    {e.shirt_number && <span className="text-muted-foreground font-mono">#{e.shirt_number}</span>}
                    <span className="text-muted-foreground truncate hidden sm:block">{e.club_name}</span>
                    <span className="text-success font-bold shrink-0">{Number(e.total_shirts).toLocaleString()} shirts</span>
                    <span className="text-warning shrink-0">{fmt(Number(e.total_revenue))} STC</span>
                  </div>
                ))}
                {(!lb || lb.length === 0) && <p className="text-xs text-muted-foreground">No data yet.</p>}
              </div>
            )}
          </div>

          {/* Config editor */}
          {cfg && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Adjust Shirt Sales Formula</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {cfgFields.map(f => (
                  <div key={f.key}>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">{f.label}</label>
                    <input
                      type="number" step="any"
                      value={cfg[f.key] ?? ""}
                      onChange={e => setCfg(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full bg-secondary border border-border rounded px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/50"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">{f.help}</p>
                  </div>
                ))}
              </div>
              <Button size="sm" onClick={saveConfig} disabled={saving} className="mt-3 bg-primary/20 text-primary hover:bg-primary/30 border border-primary/40 text-xs">
                {saving ? "Saving…" : "Save Formula Config"}
              </Button>
            </div>
          )}

          {/* Revenue correction */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Correct Club Shirt Revenue</p>
            <div className="flex gap-2 flex-wrap">
              <Input placeholder="Club ID" value={corrClub} onChange={e => setCorrClub(e.target.value)} className="text-xs flex-1 min-w-[180px]" />
              <Input placeholder="Amount (STC, negative to deduct)" type="number" value={corrAmt} onChange={e => setCorrAmt(e.target.value)} className="text-xs w-48" />
              <Input placeholder="Note (optional)" value={corrNote} onChange={e => setCorrNote(e.target.value)} className="text-xs flex-1 min-w-[150px]" />
              <Button size="sm" onClick={applyCorrection} disabled={saving || !corrClub || !corrAmt} className="text-xs bg-success/20 text-success border border-success/30 hover:bg-success/30">
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminWagersPanel() {
  const [open, setOpen]       = useState(false);
  const [wagers, setWagers]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy]       = useState(null);
  const [msg, setMsg]         = useState(null);
  const [settleDialog, setSettleDialog] = useState(null); // { match }
  const [settleWinner, setSettleWinner] = useState('home');
  const [settleNote, setSettleNote]     = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await stageClient.functions.invoke('wagerManagement', { action: 'get_all' });
      setWagers(res?.data?.wagers || []);
    } catch (err) { setMsg({ type: 'error', text: err?.message || 'Failed to load' }); }
    setLoading(false);
  }

  async function cancelAndRefund(matchId) {
    setBusy(matchId + '_cancel');
    try {
      await stageClient.functions.invoke('wagerManagement', { action: 'cancel_and_refund', match_id: matchId });
      setMsg({ type: 'success', text: 'Wager cancelled and refunded ✓' });
      load();
    } catch (err) { setMsg({ type: 'error', text: err?.message || 'Failed' }); }
    setBusy(null);
  }

  async function forceSettle() {
    if (!settleDialog) return;
    setBusy(settleDialog.match.id + '_settle');
    try {
      await stageClient.functions.invoke('wagerManagement', {
        action: 'force_settle', match_id: settleDialog.match.id,
        winner: settleWinner, note: settleNote || undefined,
      });
      setMsg({ type: 'success', text: 'Wager force-settled ✓' });
      setSettleDialog(null);
      setSettleNote('');
      load();
    } catch (err) { setMsg({ type: 'error', text: err?.message || 'Failed' }); }
    setBusy(null);
  }

  const fmt = (n) => Number(n || 0).toLocaleString();

  const STATUS_COLOR = {
    pending_acceptance: 'text-warning',
    active:             'text-success',
    settling:           'text-primary',
    settled:            'text-primary',
    refunded:           'text-muted-foreground',
    declined:           'text-destructive',
    cancelled:          'text-destructive',
  };

  return (
    <div className="mb-4 bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => { setOpen(o => !o); if (!open && !wagers) load(); }}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
      >
        <span className="text-xs font-bold text-foreground flex items-center gap-2">
          <Coins className="w-3.5 h-3.5 text-warning" /> Wager Management
        </span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-4">
          {msg && (
            <p className={cn("text-xs font-medium", msg.type === 'success' ? 'text-success' : 'text-destructive')}>{msg.text}</p>
          )}

          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">All Wagers</p>
            <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="text-xs gap-1 h-7">
              <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} /> Refresh
            </Button>
          </div>

          {loading && !wagers ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : !wagers?.length ? (
            <p className="text-xs text-muted-foreground">No wagers found.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {wagers.map(w => {
                const homeName = w.mode === 'club' ? w.home_club_name : w.home_player_name;
                const awayName = w.mode === 'club' ? w.away_club_name : w.away_player_name;
                const modeLabel = w.mode === 'club' ? 'Club' : 'Player';
                const isBusy = busy?.startsWith(w.id);
                const canAct = w.wager_status === 'active' || w.wager_status === 'settling';
                return (
                  <div key={w.id} className="bg-secondary/40 border border-border rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-foreground truncate">{homeName} vs {awayName}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 uppercase tracking-wider shrink-0">{modeLabel}</span>
                          <span className={cn("text-[9px] font-bold uppercase tracking-wider shrink-0", STATUS_COLOR[w.wager_status] || 'text-muted-foreground')}>
                            {w.wager_status || '—'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                          <span className="text-warning font-semibold">{fmt(w.wager_stc)} STC each</span>
                          <span>Pot: {fmt(Number(w.wager_stc) * 2)} STC</span>
                          {w.home_score != null && <span>Score: {w.home_score}–{w.away_score}</span>}
                          {w.scheduled_date && <span>{new Date(w.scheduled_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                          <span>{w.wager_home_locked ? '🔒 Home locked' : '⚠ Home unlocked'}</span>
                          <span>{w.wager_away_locked ? '🔒 Away locked' : '⚠ Away unlocked'}</span>
                        </div>
                      </div>
                      {canAct && (
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button
                            size="sm"
                            onClick={() => { setSettleDialog({ match: w }); setSettleWinner('home'); setSettleNote(''); }}
                            disabled={isBusy}
                            className="text-[10px] h-7 px-2 bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30"
                          >
                            Force Settle
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => cancelAndRefund(w.id)}
                            disabled={isBusy}
                            className="text-[10px] h-7 px-2 bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20"
                          >
                            {isBusy === w.id + '_cancel' ? 'Refunding…' : 'Cancel & Refund'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Force-settle dialog */}
          {settleDialog && (
            <div className="border border-primary/30 bg-primary/5 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-primary">Force Settle Wager</p>
              <p className="text-[10px] text-muted-foreground">
                {settleDialog.match.mode === 'club'
                  ? `${settleDialog.match.home_club_name} vs ${settleDialog.match.away_club_name}`
                  : `${settleDialog.match.home_player_name} vs ${settleDialog.match.away_player_name}`}
                {' — '}{fmt(settleDialog.match.wager_stc)} STC each (pot: {fmt(Number(settleDialog.match.wager_stc) * 2)} STC)
              </p>
              <div className="flex gap-2">
                {['home', 'away', 'draw'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setSettleWinner(opt)}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all",
                      settleWinner === opt
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    {opt === 'home'
                      ? (settleDialog.match.mode === 'club' ? settleDialog.match.home_club_name : settleDialog.match.home_player_name) || 'Home'
                      : opt === 'away'
                      ? (settleDialog.match.mode === 'club' ? settleDialog.match.away_club_name : settleDialog.match.away_player_name) || 'Away'
                      : 'Draw'}
                  </button>
                ))}
              </div>
              <Input
                placeholder="Admin note (optional)"
                value={settleNote}
                onChange={e => setSettleNote(e.target.value)}
                className="text-xs"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={forceSettle} disabled={!!busy}
                  className="flex-1 bg-primary text-primary-foreground text-xs">
                  {busy ? 'Settling…' : 'Confirm Settle'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSettleDialog(null)} className="text-xs">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── AdminEconomyTestPanel ─────────────────────────────────────────────────────
const SIM_TEST_META = [
  { name: 'wallet_creation',        description: 'New player gets 50,000 STC + initial_grant tx; no duplicates' },
  { name: 'club_default_finances',  description: 'New club has positive stc and non-negative budgets' },
  { name: 'salary_payment',         description: 'Weekly salary: player ↑ salary, club ↓ salary, both have tx records' },
  { name: 'lifestyle_purchase',     description: 'Purchase deducts player balance; tx with correct amount and balance_after' },
  { name: 'lifestyle_rental',       description: 'Rental deducts player balance and creates lifestyle_rental tx' },
  { name: 'lifestyle_investment',   description: 'Investment deducts balance; return credits back; net profit correct' },
  { name: 'wager_block',            description: 'Wager stake reduces both player balances; blocked funds confirmed' },
  { name: 'wager_payout',           description: 'Winner receives full pot; loser gets no refund; payout tx recorded' },
  { name: 'wager_refund',           description: 'Both players refunded to pre-wager balance; refund txs recorded' },
  { name: 'ticket_revenue',         description: 'Home match revenue: attendance formula, club credited, 15% transfer budget, idempotency guard, match fields updated' },
  { name: 'shirt_sales_revenue',    description: 'Shirt sales: club receives revenue, shirt_revenue tx recorded' },
  { name: 'competition_reward',     description: 'Competition reward: correct STC credited, competition_reward tx created' },
  { name: 'transfer_budget_change', description: 'Transfer fee deducted from both STC balance and transfer budget atomically' },
  { name: 'wage_budget_change',     description: 'Wage budget tracks contracted salaries: increases on sign, decreases on expiry' },
];
const VERIFY_TEST_META = [
  { name: 'no_negative_balances',       description: 'No player or club has a negative STC balance' },
  { name: 'no_duplicate_initial_grants',description: 'No player has multiple initial_grant wallet transactions' },
  { name: 'balance_accuracy',           description: 'Spot-check 10 random players: sum(txs) matches stored balance' },
  { name: 'no_duplicate_payments',      description: 'No duplicate same-amount same-category same-minute transactions' },
  { name: 'wager_integrity',            description: 'Active wagers have both locks; settled solo wagers have payout records' },
  { name: 'transaction_completeness',   description: 'Completed matches have ticket revenue; active contracts have salary records' },
  { name: 'club_profile_accuracy',      description: 'Spot-check 5 clubs: sum(txs) ≈ stored balance' },
];

function TestResultBadge({ status }) {
  const cfg = {
    pass:  { label: 'PASS',  cls: 'bg-success/20 text-success border-success/30' },
    fail:  { label: 'FAIL',  cls: 'bg-destructive/20 text-destructive border-destructive/30' },
    warn:  { label: 'WARN',  cls: 'bg-warning/20 text-warning border-warning/30' },
    error: { label: 'ERROR', cls: 'bg-destructive/20 text-destructive border-destructive/30' },
  };
  const c = cfg[status] || { label: '—', cls: 'bg-secondary text-muted-foreground border-border' };
  return <span className={cn('text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border', c.cls)}>{c.label}</span>;
}

function AdminEconomyTestPanel() {
  const [open, setOpen]             = useState(false);
  const [results, setResults]       = useState({});
  const [running, setRunning]       = useState(new Set());
  const [expanded, setExpanded]     = useState(new Set());
  const [msg, setMsg]               = useState(null);

  function flash(type, text) { setMsg({ type, text }); setTimeout(() => setMsg(null), 4000); }
  function setResult(name, r) { setResults(p => ({ ...p, [name]: r })); }
  function startTest(name)    { setRunning(p => { const s = new Set(p); s.add(name);    return s; }); }
  function endTest(name)      { setRunning(p => { const s = new Set(p); s.delete(name); return s; }); }
  function toggleExpand(name) { setExpanded(p => { const s = new Set(p); s.has(name) ? s.delete(name) : s.add(name); return s; }); }
  const anyRunning = running.size > 0;

  async function runSingle(testName) {
    startTest(testName);
    try {
      const res = await stageClient.functions.invoke('economyTests', { action: 'run_test', test_name: testName });
      const r = res?.data?.result;
      setResult(testName, r);
      if (r?.status === 'fail' || r?.status === 'error') setExpanded(p => new Set(p).add(testName));
    } catch (err) {
      setResult(testName, { name: testName, status: 'error', message: err?.message || 'Network error', assertions: [] });
    }
    endTest(testName);
  }

  async function runSuite(suite) {
    const tests = suite === 'sim' ? SIM_TEST_META : suite === 'verify' ? VERIFY_TEST_META : [...SIM_TEST_META, ...VERIFY_TEST_META];
    for (const t of tests) await runSingle(t.name);
    flash('success', `${suite === 'sim' ? 'Simulation' : suite === 'verify' ? 'Verification' : 'Full'} suite complete.`);
  }

  function suiteStats(tests) {
    const pass = tests.filter(t => results[t.name]?.status === 'pass').length;
    const fail = tests.filter(t => ['fail','error'].includes(results[t.name]?.status)).length;
    const warn = tests.filter(t => results[t.name]?.status === 'warn').length;
    return { pass, fail, warn };
  }

  function TestCard({ test }) {
    const r = results[test.name];
    const isRunning = running.has(test.name);
    const isExpanded = expanded.has(test.name);
    return (
      <div className={cn('border rounded-xl p-3 transition-all',
        r?.status === 'pass'  ? 'bg-success/5 border-success/20'
        : (r?.status === 'fail' || r?.status === 'error') ? 'bg-destructive/5 border-destructive/20'
        : r?.status === 'warn' ? 'bg-warning/5 border-warning/20'
        : 'bg-secondary/30 border-border'
      )}>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              {isRunning
                ? <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                : r ? <TestResultBadge status={r.status} /> : null}
              <p className="text-xs font-bold text-foreground">{test.name.replace(/_/g,' ')}</p>
              {r?.duration_ms && <span className="text-[9px] text-muted-foreground">{r.duration_ms}ms</span>}
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">{test.description}</p>
            {r?.message && r.status !== 'pass' && (
              <p className={cn('text-[10px] mt-1 font-medium', r.status === 'warn' ? 'text-warning' : 'text-destructive')}>{r.message}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
            {r?.assertions?.length > 0 && (
              <button onClick={() => toggleExpand(test.name)} className="text-[10px] text-primary hover:underline">
                {isExpanded ? 'hide' : 'details'}
              </button>
            )}
            <Button size="sm" onClick={() => runSingle(test.name)} disabled={isRunning || anyRunning}
              className="text-[10px] h-6 px-2 bg-secondary border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground">
              {isRunning ? '…' : 'Run'}
            </Button>
          </div>
        </div>
        {isExpanded && r?.assertions?.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/50 space-y-0.5">
            {r.assertions.map((a, i) => (
              <p key={i} className={cn('text-[10px]',
                a.startsWith('✓') ? 'text-success'
                : a.startsWith('⚠') ? 'text-warning'
                : 'text-destructive')}>
                {a}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  const simStats    = suiteStats(SIM_TEST_META);
  const verifyStats = suiteStats(VERIFY_TEST_META);

  return (
    <div className="mb-4 bg-card border border-border rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors">
        <span className="text-xs font-bold text-foreground flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-warning" /> Economy Test Suite
        </span>
        <div className="flex items-center gap-3">
          {(simStats.pass + verifyStats.pass) > 0 && (
            <span className="text-[10px] text-success">{simStats.pass + verifyStats.pass}/{SIM_TEST_META.length + VERIFY_TEST_META.length} pass</span>
          )}
          {(simStats.fail + verifyStats.fail) > 0 && (
            <span className="text-[10px] text-destructive">{simStats.fail + verifyStats.fail} fail</span>
          )}
          <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {open && (
        <div className="border-t border-border">
          {/* Safety banner */}
          <div className="px-4 py-2.5 bg-warning/5 border-b border-warning/15">
            <p className="text-[10px] text-warning font-medium">
              ⚠ Simulations create and immediately delete isolated test records in the real database. They are atomic and leave no trace.
              Verifications are read-only and safe to run at any time.
            </p>
          </div>

          <div className="p-4 space-y-6">
            {msg && (
              <p className={cn('text-xs font-medium px-3 py-2 rounded-lg border',
                msg.type === 'success' ? 'text-success bg-success/10 border-success/20'
                : 'text-destructive bg-destructive/10 border-destructive/20'
              )}>{msg.text}</p>
            )}

            {/* Simulation tests */}
            <div>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Simulation Tests ({SIM_TEST_META.length})</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Create isolated records → run logic → verify → clean up automatically</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-success">{simStats.pass}/{SIM_TEST_META.length} pass</span>
                  {simStats.fail > 0 && <span className="text-[10px] text-destructive">{simStats.fail} fail</span>}
                  {simStats.warn > 0 && <span className="text-[10px] text-warning">{simStats.warn} warn</span>}
                  <Button size="sm" onClick={() => runSuite('sim')} disabled={anyRunning}
                    className="text-[10px] h-7 px-2 bg-warning/20 text-warning border border-warning/30 hover:bg-warning/30 gap-1">
                    <Zap className="w-2.5 h-2.5" /> {anyRunning ? `Running…` : 'Run Sims'}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {SIM_TEST_META.map(t => <TestCard key={t.name} test={t} />)}
              </div>
            </div>

            {/* Verification tests */}
            <div>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Verification Tests ({VERIFY_TEST_META.length})</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Read-only checks against live data — safe to run anytime</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-success">{verifyStats.pass}/{VERIFY_TEST_META.length} pass</span>
                  {verifyStats.fail > 0 && <span className="text-[10px] text-destructive">{verifyStats.fail} fail</span>}
                  {verifyStats.warn > 0 && <span className="text-[10px] text-warning">{verifyStats.warn} warn</span>}
                  <Button size="sm" onClick={() => runSuite('verify')} disabled={anyRunning}
                    className="text-[10px] h-7 px-2 bg-success/20 text-success border border-success/30 hover:bg-success/30 gap-1">
                    <Activity className="w-2.5 h-2.5" /> {anyRunning ? `Running…` : 'Run Checks'}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {VERIFY_TEST_META.map(t => <TestCard key={t.name} test={t} />)}
              </div>
            </div>

            {/* Run full suite */}
            <Button onClick={() => runSuite('all')} disabled={anyRunning}
              className="w-full gap-2 text-xs bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30">
              <Zap className="w-3.5 h-3.5" />
              {anyRunning ? `Running (${running.size} active)…` : `Run Full Test Suite (${SIM_TEST_META.length + VERIFY_TEST_META.length} tests)`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminStadiumPanel() {
  const [open, setOpen]         = useState(false);
  const [levels, setLevels]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState(null);
  // per-club editor
  const [clubId, setClubId]     = useState('');
  const [clubName, setClubName] = useState('');
  const [clubLevel, setClubLevel] = useState('');
  const [clubCap, setClubCap]   = useState('');
  // revenue correction
  const [corrClub, setCorrClub] = useState('');
  const [corrMatch, setCorrMatch] = useState('');
  const [corrAmt, setCorrAmt]   = useState('');
  const [corrNote, setCorrNote] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await stageClient.functions.invoke('stadiumManagement', { action: 'get_config' });
      setLevels(res?.data?.levels || []);
    } catch (err) { setMsg({ type: 'error', text: err?.message || 'Failed to load' }); }
    setLoading(false);
  }

  async function saveLevel(i) {
    setSaving(true);
    try {
      await stageClient.functions.invoke('stadiumManagement', {
        action: 'set_level_config',
        level_index: i,
        ...levels[i],
      });
      setMsg({ type: 'success', text: `Level ${i + 1} saved ✓` });
    } catch (err) { setMsg({ type: 'error', text: err?.message || 'Failed' }); }
    setSaving(false);
  }

  function updateLevel(i, key, value) {
    setLevels(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [key]: value };
      return next;
    });
  }

  async function editClubStadium() {
    if (!clubId) return;
    setSaving(true);
    try {
      await stageClient.functions.invoke('stadiumManagement', {
        action: 'edit_club_stadium',
        club_id: clubId,
        stadium_name: clubName || undefined,
        stadium_level: clubLevel !== '' ? Number(clubLevel) : undefined,
        stadium_capacity: clubCap !== '' ? Number(clubCap) : undefined,
      });
      setMsg({ type: 'success', text: 'Club stadium updated ✓' });
      setClubId(''); setClubName(''); setClubLevel(''); setClubCap('');
    } catch (err) { setMsg({ type: 'error', text: err?.message || 'Failed' }); }
    setSaving(false);
  }

  async function applyRevenueCorrection() {
    if (!corrClub || !corrAmt) return;
    setSaving(true);
    try {
      await stageClient.functions.invoke('stadiumManagement', {
        action: 'correct_revenue',
        club_id: corrClub,
        match_id: corrMatch || undefined,
        amount: Number(corrAmt),
        note: corrNote || undefined,
      });
      setMsg({ type: 'success', text: 'Revenue correction applied ✓' });
      setCorrClub(''); setCorrMatch(''); setCorrAmt(''); setCorrNote('');
    } catch (err) { setMsg({ type: 'error', text: err?.message || 'Failed' }); }
    setSaving(false);
  }

  const LEVEL_FIELDS = [
    { key: 'name',              label: 'Name',                type: 'text' },
    { key: 'capacity',          label: 'Capacity',            type: 'number' },
    { key: 'ticket_price_stc',  label: 'Ticket Price (STC)',  type: 'number' },
    { key: 'upgrade_cost_stc',  label: 'Upgrade Cost (STC)',  type: 'number' },
  ];

  return (
    <div className="mb-4 bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => { setOpen(o => !o); if (!open && !levels) load(); }}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
      >
        <span className="text-xs font-bold text-foreground flex items-center gap-2">
          <Ticket className="w-3.5 h-3.5 text-success" /> Stadium Economy — Config &amp; Overrides
        </span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-6">
          {msg && (
            <p className={cn("text-xs font-medium", msg.type === 'success' ? 'text-success' : 'text-destructive')}>{msg.text}</p>
          )}

          {/* Stadium level configs */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Stadium Level Config</p>
              <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="text-xs gap-1 h-7">
                <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} /> Reload
              </Button>
            </div>
            {loading && !levels ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : levels?.length ? (
              <div className="space-y-4">
                {levels.map((lvl, i) => (
                  <div key={i} className="bg-secondary/40 border border-border rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-foreground">Level {i + 1}</p>
                      <Button size="sm" onClick={() => saveLevel(i)} disabled={saving}
                        className="text-[10px] h-6 px-2 bg-success/20 text-success border border-success/30 hover:bg-success/30">
                        Save Level {i + 1}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {LEVEL_FIELDS.map(f => (
                        <div key={f.key}>
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">{f.label}</label>
                          <input
                            type={f.type}
                            value={lvl[f.key] ?? ''}
                            onChange={e => updateLevel(i, f.key, e.target.value)}
                            className="w-full bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground outline-none focus:border-primary/50"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No config loaded.</p>
            )}
          </div>

          {/* Per-club stadium editor */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Edit Club Stadium</p>
            <div className="grid sm:grid-cols-2 gap-2">
              <Input placeholder="Club ID *" value={clubId} onChange={e => setClubId(e.target.value)} className="text-xs" />
              <Input placeholder="Stadium Name" value={clubName} onChange={e => setClubName(e.target.value)} className="text-xs" />
              <Input placeholder="Level (0–3)" type="number" value={clubLevel} onChange={e => setClubLevel(e.target.value)} className="text-xs" />
              <Input placeholder="Capacity override" type="number" value={clubCap} onChange={e => setClubCap(e.target.value)} className="text-xs" />
            </div>
            <Button size="sm" onClick={editClubStadium} disabled={saving || !clubId}
              className="mt-2 text-xs bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30">
              {saving ? 'Saving…' : 'Apply Stadium Override'}
            </Button>
          </div>

          {/* Revenue correction */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Correct Ticket Revenue</p>
            <div className="grid sm:grid-cols-2 gap-2">
              <Input placeholder="Club ID *" value={corrClub} onChange={e => setCorrClub(e.target.value)} className="text-xs" />
              <Input placeholder="Match ID (optional)" value={corrMatch} onChange={e => setCorrMatch(e.target.value)} className="text-xs" />
              <Input placeholder="Amount STC (negative to deduct) *" type="number" value={corrAmt} onChange={e => setCorrAmt(e.target.value)} className="text-xs" />
              <Input placeholder="Note (optional)" value={corrNote} onChange={e => setCorrNote(e.target.value)} className="text-xs" />
            </div>
            <Button size="sm" onClick={applyRevenueCorrection} disabled={saving || !corrClub || !corrAmt}
              className="mt-2 text-xs bg-success/20 text-success border border-success/30 hover:bg-success/30">
              {saving ? 'Applying…' : 'Apply Revenue Correction'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtStc(n) {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ── AdminEconomyPanel ─────────────────────────────────────────────────────────
function AdminEconomyPanel() {
  const [open, setOpen]         = useState(false);
  const [section, setSection]   = useState('health'); // health | player | club | txs | audit
  const [msg, setMsg]           = useState(null);
  const [busy, setBusy]         = useState(false);

  function flash(type, text) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  }

  // ── Health Check state ────────────────────────────────────────────────────
  const [health, setHealth]     = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);

  async function runHealthCheck() {
    setHealthLoading(true);
    try {
      const res = await stageClient.functions.invoke('adminEconomyControl', { action: 'health_check' });
      setHealth(res?.data);
    } catch (err) { flash('error', err?.message || 'Health check failed'); }
    setHealthLoading(false);
  }

  async function fixNullWallets(dry) {
    setBusy(true);
    try {
      const res = await stageClient.functions.invoke('adminEconomyControl', { action: 'backfill_player_wallets', dry_run: dry });
      if (dry) {
        flash('info', `Dry run: would fix ${res?.data?.would_fix || 0} wallets.`);
      } else {
        flash('success', `Fixed ${res?.data?.fixed || 0} null wallets ✓`);
        runHealthCheck();
      }
    } catch (err) { flash('error', err?.message || 'Failed'); }
    setBusy(false);
  }

  async function fixNullClubs() {
    setBusy(true);
    try {
      const res = await stageClient.functions.invoke('adminEconomyControl', { action: 'backfill_club_finances' });
      flash('success', `Fixed ${res?.data?.fixed || 0} club finances ✓`);
      runHealthCheck();
    } catch (err) { flash('error', err?.message || 'Failed'); }
    setBusy(false);
  }

  // ── Player Wallet state ───────────────────────────────────────────────────
  const [pLookup, setPLookup]   = useState('');
  const [pData, setPData]       = useState(null);
  const [pLoading, setPLoading] = useState(false);
  const [pNewBal, setPNewBal]   = useState('');
  const [pTxAmt, setPTxAmt]     = useState('');
  const [pTxCat, setPTxCat]     = useState('admin_correction');
  const [pTxDesc, setPTxDesc]   = useState('');
  const [pReason, setPReason]   = useState('');

  async function lookupPlayer() {
    if (!pLookup.trim()) return;
    setPLoading(true);
    setPData(null);
    try {
      const isId = pLookup.length > 20 && !pLookup.includes('@');
      const res = await stageClient.functions.invoke('adminEconomyControl', {
        action: 'get_player_wallet',
        ...(isId ? { player_id: pLookup } : { player_email: pLookup }),
      });
      setPData(res?.data);
      setPNewBal(String(Number(res?.data?.player?.stc || 0)));
    } catch (err) { flash('error', err?.message || 'Player not found'); }
    setPLoading(false);
  }

  async function setPlayerBalance() {
    if (!pData || pNewBal === '') return;
    setBusy(true);
    try {
      await stageClient.functions.invoke('adminEconomyControl', {
        action: 'set_player_balance', player_id: pData.player.id,
        balance: Number(pNewBal), reason: pReason || undefined,
      });
      flash('success', 'Player balance updated ✓');
      lookupPlayer();
    } catch (err) { flash('error', err?.message || 'Failed'); }
    setBusy(false);
  }

  async function addPlayerTx() {
    if (!pData || !pTxAmt) return;
    setBusy(true);
    try {
      await stageClient.functions.invoke('adminEconomyControl', {
        action: 'add_player_tx', player_id: pData.player.id,
        amount: Number(pTxAmt), category: pTxCat,
        description: pTxDesc || undefined, reason: pReason || undefined,
      });
      flash('success', 'Transaction added ✓');
      setPTxAmt(''); setPTxDesc('');
      lookupPlayer();
    } catch (err) { flash('error', err?.message || 'Failed'); }
    setBusy(false);
  }

  // ── Club Finance state ────────────────────────────────────────────────────
  const [cLookup, setCLookup]   = useState('');
  const [cData, setCData]       = useState(null);
  const [cLoading, setCLoading] = useState(false);
  const [cNewBal, setCNewBal]   = useState('');
  const [cTransfer, setCTransfer] = useState('');
  const [cWage, setCWage]       = useState('');
  const [cTxAmt, setCTxAmt]     = useState('');
  const [cTxCat, setCTxCat]     = useState('admin_correction');
  const [cTxDesc, setCTxDesc]   = useState('');
  const [cReason, setCReason]   = useState('');
  const [compAmt, setCompAmt]   = useState('');
  const [compDesc, setCompDesc] = useState('');

  async function lookupClub() {
    if (!cLookup.trim()) return;
    setCLoading(true);
    setCData(null);
    try {
      const res = await stageClient.functions.invoke('adminEconomyControl', {
        action: 'get_club_finance', club_id: cLookup,
      });
      setCData(res?.data);
      setCNewBal(String(Number(res?.data?.club?.stc || 0)));
      setCTransfer(String(Number(res?.data?.club?.transfer_budget_stc || 0)));
      setCWage(String(Number(res?.data?.club?.wage_budget_stc || 0)));
    } catch (err) { flash('error', err?.message || 'Club not found'); }
    setCLoading(false);
  }

  async function setClubFinance() {
    if (!cData) return;
    setBusy(true);
    try {
      await stageClient.functions.invoke('adminEconomyControl', {
        action: 'set_club_finance', club_id: cData.club.id,
        balance: cNewBal !== '' ? Number(cNewBal) : undefined,
        transfer_budget: cTransfer !== '' ? Number(cTransfer) : undefined,
        wage_budget: cWage !== '' ? Number(cWage) : undefined,
        reason: cReason || undefined,
      });
      flash('success', 'Club finances updated ✓');
      lookupClub();
    } catch (err) { flash('error', err?.message || 'Failed'); }
    setBusy(false);
  }

  async function addClubTx() {
    if (!cData || !cTxAmt) return;
    setBusy(true);
    try {
      await stageClient.functions.invoke('adminEconomyControl', {
        action: 'add_club_tx', club_id: cData.club.id,
        amount: Number(cTxAmt), category: cTxCat,
        description: cTxDesc || undefined, reason: cReason || undefined,
      });
      flash('success', 'Transaction added ✓');
      setCTxAmt(''); setCTxDesc('');
      lookupClub();
    } catch (err) { flash('error', err?.message || 'Failed'); }
    setBusy(false);
  }

  async function distributeCompReward() {
    if (!cData || !compAmt) return;
    setBusy(true);
    try {
      await stageClient.functions.invoke('adminEconomyControl', {
        action: 'distribute_competition_reward', club_id: cData.club.id,
        amount: Number(compAmt), description: compDesc || undefined,
      });
      flash('success', 'Competition reward distributed ✓');
      setCompAmt(''); setCompDesc('');
      lookupClub();
    } catch (err) { flash('error', err?.message || 'Failed'); }
    setBusy(false);
  }

  // ── Transaction Search state ──────────────────────────────────────────────
  const [txMode, setTxMode]     = useState('player'); // player | club
  const [txPId, setTxPId]       = useState('');
  const [txPEmail, setTxPEmail] = useState('');
  const [txCId, setTxCId]       = useState('');
  const [txCat, setTxCat]       = useState('');
  const [txFrom, setTxFrom]     = useState('');
  const [txTo, setTxTo]         = useState('');
  const [txMin, setTxMin]       = useState('');
  const [txMax, setTxMax]       = useState('');
  const [txLimit, setTxLimit]   = useState('100');
  const [txResults, setTxResults] = useState(null);
  const [txLoading, setTxLoading] = useState(false);

  async function searchTxs() {
    setTxLoading(true);
    try {
      const payload = {
        action: txMode === 'player' ? 'search_player_txs' : 'search_club_txs',
        ...(txMode === 'player' ? { player_id: txPId || undefined, player_email: txPEmail || undefined } : { club_id: txCId || undefined }),
        category: txCat || undefined,
        date_from: txFrom || undefined,
        date_to: txTo || undefined,
        min_amount: txMin !== '' ? Number(txMin) : undefined,
        max_amount: txMax !== '' ? Number(txMax) : undefined,
        limit: Number(txLimit) || 100,
      };
      const res = await stageClient.functions.invoke('adminEconomyControl', payload);
      setTxResults(res?.data?.transactions || []);
    } catch (err) { flash('error', err?.message || 'Search failed'); }
    setTxLoading(false);
  }

  // ── Audit Log state ───────────────────────────────────────────────────────
  const [auditLog, setAuditLog] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState('');

  async function loadAuditLog() {
    setAuditLoading(true);
    try {
      const res = await stageClient.functions.invoke('adminEconomyControl', {
        action: 'get_audit_log', limit: 200,
        entity_type: auditFilter || undefined,
      });
      setAuditLog(res?.data?.log || []);
    } catch (err) { flash('error', err?.message || 'Failed'); }
    setAuditLoading(false);
  }

  const SECTION_TABS = [
    { id: 'health', label: 'Health', icon: Activity },
    { id: 'player', label: 'Player', icon: Wallet },
    { id: 'club',   label: 'Club',   icon: Building2 },
    { id: 'txs',    label: 'Transactions', icon: Filter },
    { id: 'audit',  label: 'Audit Log', icon: ClipboardList },
  ];

  const TX_CATEGORIES = [
    'admin_correction','initial_grant','wage_payment','signing_bonus','transfer_fee',
    'ticket_revenue','stadium_upgrade','shirt_revenue','wager_stake','wager_payout',
    'wager_refund','wager_loss','competition_reward','lifestyle_purchase','lifestyle_passive',
  ];

  return (
    <div className="mb-4 bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => { setOpen(o => !o); if (!open && !health) runHealthCheck(); }}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
      >
        <span className="text-xs font-bold text-foreground flex items-center gap-2">
          <DollarSign className="w-3.5 h-3.5 text-primary" /> Economy Control Centre
        </span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border">
          {/* Section nav */}
          <div className="flex gap-1 p-3 pb-0 flex-wrap">
            {SECTION_TABS.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setSection(t.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border",
                    section === t.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}>
                  <Icon className="w-3 h-3" />{t.label}
                </button>
              );
            })}
          </div>

          <div className="p-4 space-y-4">
            {msg && (
              <p className={cn("text-xs font-medium px-3 py-2 rounded-lg border",
                msg.type === 'success' ? 'text-success bg-success/10 border-success/20'
                : msg.type === 'info'    ? 'text-primary bg-primary/10 border-primary/20'
                : 'text-destructive bg-destructive/10 border-destructive/20'
              )}>{msg.text}</p>
            )}

            {/* ── HEALTH ── */}
            {section === 'health' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Economy Health Check</p>
                  <Button size="sm" variant="ghost" onClick={runHealthCheck} disabled={healthLoading} className="text-xs gap-1 h-7">
                    <RefreshCw className={cn("w-3 h-3", healthLoading && "animate-spin")} /> {healthLoading ? 'Checking…' : 'Run Check'}
                  </Button>
                </div>

                {health && (
                  <>
                    <div className={cn("px-4 py-3 rounded-xl border text-sm font-semibold",
                      health.summary?.issues === 0
                        ? "bg-success/10 border-success/20 text-success"
                        : "bg-destructive/10 border-destructive/20 text-destructive"
                    )}>
                      {health.summary?.issues === 0
                        ? `✓ All ${health.summary.checks_run} checks passed — economy looks healthy`
                        : `⚠ ${health.summary.issues} issue${health.summary.issues !== 1 ? 's' : ''} detected across ${health.summary.checks_run} checks`}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      {[
                        { key: 'players_negative_balance', label: 'Players with negative STC', fix: null, color: 'destructive' },
                        { key: 'clubs_negative_balance',   label: 'Clubs with negative STC',   fix: null, color: 'destructive' },
                        { key: 'players_null_wallet',      label: 'Players with null wallet',   fix: () => fixNullWallets(false), fixLabel: 'Fix All', color: 'warning' },
                        { key: 'clubs_null_balance',       label: 'Clubs with null balance',    fix: fixNullClubs, fixLabel: 'Fix All', color: 'warning' },
                        { key: 'clubs_missing_transfer',   label: 'Clubs missing transfer budget', fix: fixNullClubs, fixLabel: 'Fix All', color: 'warning' },
                        { key: 'clubs_missing_wage',       label: 'Clubs missing wage budget',  fix: fixNullClubs, fixLabel: 'Fix All', color: 'warning' },
                        { key: 'wagers_stuck',             label: 'Stuck wagers (active + completed)', fix: null, color: 'destructive' },
                        { key: 'contracts_broken',         label: 'Broken contracts', fix: null, color: 'destructive' },
                      ].map(({ key, label, fix, fixLabel, color }) => {
                        const items = health[key] || [];
                        return (
                          <div key={key} className={cn(
                            "rounded-xl border p-3",
                            items.length > 0
                              ? color === 'destructive' ? "bg-destructive/5 border-destructive/20" : "bg-warning/5 border-warning/20"
                              : "bg-success/5 border-success/20"
                          )}>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">{label}</p>
                              {items.length > 0 && fix && (
                                <Button size="sm" onClick={fix} disabled={busy} className={cn("text-[10px] h-6 px-2", color === 'warning' ? "bg-warning/20 text-warning border border-warning/30" : "bg-destructive/20 text-destructive border border-destructive/30")}>
                                  {fixLabel}
                                </Button>
                              )}
                            </div>
                            <p className={cn("text-xl font-black", items.length > 0 ? (color === 'destructive' ? 'text-destructive' : 'text-warning') : 'text-success')}>
                              {items.length}
                            </p>
                            {items.length > 0 && items.length <= 5 && (
                              <div className="mt-2 space-y-0.5">
                                {items.map((it, i) => (
                                  <p key={i} className="text-[10px] text-muted-foreground truncate">
                                    {it.gamertag || it.name || it.home_club_name || it.id} {it.stc != null ? `· ${fmtStc(it.stc)} STC` : ''}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={() => fixNullWallets(true)} disabled={busy} className="text-xs bg-secondary/60 border border-border text-muted-foreground hover:text-foreground">
                        <Zap className="w-3 h-3 mr-1" /> Dry-run wallet backfill
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── PLAYER WALLET ── */}
            {section === 'player' && (
              <div className="space-y-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Player Wallet</p>

                {/* Lookup */}
                <div className="flex gap-2">
                  <Input placeholder="Player ID or email" value={pLookup} onChange={e => setPLookup(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && lookupPlayer()} className="text-xs flex-1" />
                  <Button size="sm" onClick={lookupPlayer} disabled={pLoading || !pLookup} className="text-xs bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30">
                    {pLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                  </Button>
                </div>

                {pData && (
                  <>
                    {/* Wallet summary */}
                    <div className="bg-secondary/40 border border-border rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-bold text-foreground">{pData.player.gamertag}</p>
                          <p className="text-xs text-muted-foreground">{pData.player.email} · {pData.player.platform}</p>
                        </div>
                        <p className="font-black text-2xl text-success">{fmtStc(pData.player.stc)} STC</p>
                      </div>
                      {pData.contract && (
                        <p className="text-xs text-muted-foreground border-t border-border pt-2">
                          Contract: {pData.contract.club_name || pData.contract.club_id} · {fmtStc(pData.contract.weekly_salary_stc)}/wk
                        </p>
                      )}
                      {pData.lifestyle?.length > 0 && (
                        <p className="text-xs text-muted-foreground">Lifestyle assets: {pData.lifestyle.length} active item{pData.lifestyle.length !== 1 ? 's' : ''}</p>
                      )}
                    </div>

                    {/* Balance correction */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Set Balance Directly</p>
                      <div className="flex gap-2 flex-wrap">
                        <Input type="number" placeholder="New balance (STC)" value={pNewBal} onChange={e => setPNewBal(e.target.value)} className="text-xs w-48" />
                        <Input placeholder="Reason (optional)" value={pReason} onChange={e => setPReason(e.target.value)} className="text-xs flex-1 min-w-[150px]" />
                        <Button size="sm" onClick={setPlayerBalance} disabled={busy || pNewBal === ''} className="text-xs bg-warning/20 text-warning border border-warning/30 hover:bg-warning/30">
                          Set Balance
                        </Button>
                      </div>
                    </div>

                    {/* Manual transaction */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Add Manual Transaction</p>
                      <div className="grid sm:grid-cols-2 gap-2">
                        <Input type="number" placeholder="Amount (negative to deduct)" value={pTxAmt} onChange={e => setPTxAmt(e.target.value)} className="text-xs" />
                        <select value={pTxCat} onChange={e => setPTxCat(e.target.value)}
                          className="bg-secondary border border-border rounded px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/50">
                          {TX_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <Input placeholder="Description" value={pTxDesc} onChange={e => setPTxDesc(e.target.value)} className="text-xs sm:col-span-2" />
                      </div>
                      <Button size="sm" onClick={addPlayerTx} disabled={busy || !pTxAmt} className="mt-2 text-xs bg-success/20 text-success border border-success/30 hover:bg-success/30">
                        Add Transaction
                      </Button>
                    </div>

                    {/* Recent txs */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Recent Transactions</p>
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {(pData.transactions || []).map((t, i) => (
                          <div key={t.id || i} className="flex items-center gap-2 px-3 py-1.5 bg-secondary/40 rounded-lg text-xs">
                            <span className={cn("font-bold w-20 shrink-0", Number(t.amount) >= 0 ? 'text-success' : 'text-destructive')}>
                              {Number(t.amount) >= 0 ? '+' : ''}{fmtStc(t.amount)}
                            </span>
                            <span className="text-muted-foreground flex-1 truncate">{t.category || t.type} — {t.description || t.source || '—'}</span>
                            <span className="text-muted-foreground shrink-0">{fmtDate(t.created_date)}</span>
                          </div>
                        ))}
                        {!pData.transactions?.length && <p className="text-xs text-muted-foreground">No transactions.</p>}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── CLUB FINANCE ── */}
            {section === 'club' && (
              <div className="space-y-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Club Finance</p>

                <div className="flex gap-2">
                  <Input placeholder="Club ID" value={cLookup} onChange={e => setCLookup(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && lookupClub()} className="text-xs flex-1" />
                  <Button size="sm" onClick={lookupClub} disabled={cLoading || !cLookup} className="text-xs bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30">
                    {cLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                  </Button>
                </div>

                {cData && (
                  <>
                    {/* Club summary */}
                    <div className="bg-secondary/40 border border-border rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-bold text-foreground">{cData.club.name} <span className="text-muted-foreground text-xs">[{cData.club.tag}]</span></p>
                          <p className="text-xs text-muted-foreground">{cData.club.platform} · {cData.club.region}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 border-t border-border pt-3">
                        {[
                          { label: 'Balance', value: fmtStc(cData.club.stc), color: 'text-success' },
                          { label: 'Transfer Budget', value: fmtStc(cData.club.transfer_budget_stc), color: 'text-primary' },
                          { label: 'Wage Budget', value: fmtStc(cData.club.wage_budget_stc), color: 'text-warning' },
                        ].map(f => (
                          <div key={f.label}>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{f.label}</p>
                            <p className={cn("font-black text-lg", f.color)}>{f.value}</p>
                          </div>
                        ))}
                      </div>
                      {cData.contracts?.length > 0 && (
                        <p className="text-xs text-muted-foreground border-t border-border pt-2">
                          {cData.contracts.length} active contract{cData.contracts.length !== 1 ? 's' : ''} · total wages: {fmtStc(cData.contracts.reduce((s, c) => s + Number(c.weekly_salary_stc || 0), 0))}/wk
                        </p>
                      )}
                    </div>

                    {/* Set finances */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Update Finances</p>
                      <div className="grid sm:grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-1">Balance (STC)</label>
                          <Input type="number" value={cNewBal} onChange={e => setCNewBal(e.target.value)} className="text-xs" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-1">Transfer Budget</label>
                          <Input type="number" value={cTransfer} onChange={e => setCTransfer(e.target.value)} className="text-xs" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-1">Wage Budget</label>
                          <Input type="number" value={cWage} onChange={e => setCWage(e.target.value)} className="text-xs" />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <Input placeholder="Reason (optional)" value={cReason} onChange={e => setCReason(e.target.value)} className="text-xs flex-1 min-w-[200px]" />
                        <Button size="sm" onClick={setClubFinance} disabled={busy} className="text-xs bg-warning/20 text-warning border border-warning/30 hover:bg-warning/30">
                          Save Club Finances
                        </Button>
                      </div>
                    </div>

                    {/* Manual transaction */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Add Manual Transaction</p>
                      <div className="grid sm:grid-cols-2 gap-2">
                        <Input type="number" placeholder="Amount (negative to deduct)" value={cTxAmt} onChange={e => setCTxAmt(e.target.value)} className="text-xs" />
                        <select value={cTxCat} onChange={e => setCTxCat(e.target.value)}
                          className="bg-secondary border border-border rounded px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/50">
                          {TX_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <Input placeholder="Description" value={cTxDesc} onChange={e => setCTxDesc(e.target.value)} className="text-xs sm:col-span-2" />
                      </div>
                      <Button size="sm" onClick={addClubTx} disabled={busy || !cTxAmt} className="mt-2 text-xs bg-success/20 text-success border border-success/30 hover:bg-success/30">
                        Add Transaction
                      </Button>
                    </div>

                    {/* Competition reward */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Competition Reward</p>
                      <div className="flex gap-2 flex-wrap">
                        <Input type="number" placeholder="Reward amount (STC)" value={compAmt} onChange={e => setCompAmt(e.target.value)} className="text-xs w-48" />
                        <Input placeholder="Description" value={compDesc} onChange={e => setCompDesc(e.target.value)} className="text-xs flex-1 min-w-[150px]" />
                        <Button size="sm" onClick={distributeCompReward} disabled={busy || !compAmt} className="text-xs bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30">
                          Distribute
                        </Button>
                      </div>
                    </div>

                    {/* Recent txs */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Recent Transactions</p>
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {(cData.transactions || []).map((t, i) => (
                          <div key={t.id || i} className="flex items-center gap-2 px-3 py-1.5 bg-secondary/40 rounded-lg text-xs">
                            <span className={cn("font-bold w-20 shrink-0", Number(t.amount) >= 0 ? 'text-success' : 'text-destructive')}>
                              {Number(t.amount) >= 0 ? '+' : ''}{fmtStc(t.amount)}
                            </span>
                            <span className="text-muted-foreground flex-1 truncate">{t.category || t.type} — {t.description || '—'}</span>
                            <span className="text-muted-foreground shrink-0">{fmtDate(t.created_date)}</span>
                          </div>
                        ))}
                        {!cData.transactions?.length && <p className="text-xs text-muted-foreground">No transactions.</p>}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── TRANSACTION SEARCH ── */}
            {section === 'txs' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Transaction Search</p>
                  <div className="flex gap-1">
                    {['player', 'club'].map(m => (
                      <button key={m} onClick={() => setTxMode(m)}
                        className={cn("px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-all",
                          txMode === m ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40")}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-2">
                  {txMode === 'player' ? (
                    <>
                      <Input placeholder="Player ID" value={txPId} onChange={e => setTxPId(e.target.value)} className="text-xs" />
                      <Input placeholder="Player Email" value={txPEmail} onChange={e => setTxPEmail(e.target.value)} className="text-xs" />
                    </>
                  ) : (
                    <Input placeholder="Club ID" value={txCId} onChange={e => setTxCId(e.target.value)} className="text-xs sm:col-span-2" />
                  )}
                  <select value={txCat} onChange={e => setTxCat(e.target.value)}
                    className="bg-secondary border border-border rounded px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/50">
                    <option value="">All categories</option>
                    {TX_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <Input placeholder="Limit (max 500)" type="number" value={txLimit} onChange={e => setTxLimit(e.target.value)} className="text-xs" />
                  <Input type="datetime-local" value={txFrom} onChange={e => setTxFrom(e.target.value)} className="text-xs" title="From date" />
                  <Input type="datetime-local" value={txTo} onChange={e => setTxTo(e.target.value)} className="text-xs" title="To date" />
                  <Input type="number" placeholder="Min amount" value={txMin} onChange={e => setTxMin(e.target.value)} className="text-xs" />
                  <Input type="number" placeholder="Max amount" value={txMax} onChange={e => setTxMax(e.target.value)} className="text-xs" />
                </div>

                <Button size="sm" onClick={searchTxs} disabled={txLoading}
                  className="text-xs bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30 gap-1">
                  <Search className="w-3 h-3" /> {txLoading ? 'Searching…' : 'Search Transactions'}
                </Button>

                {txResults !== null && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-2">{txResults.length} result{txResults.length !== 1 ? 's' : ''}</p>
                    <div className="space-y-1 max-h-96 overflow-y-auto">
                      {txResults.map((t, i) => (
                        <div key={t.id || i} className="flex items-center gap-2 px-3 py-1.5 bg-secondary/40 rounded-lg text-xs">
                          <span className={cn("font-bold w-20 shrink-0", Number(t.amount) >= 0 ? 'text-success' : 'text-destructive')}>
                            {Number(t.amount) >= 0 ? '+' : ''}{fmtStc(t.amount)}
                          </span>
                          <span className="font-medium text-foreground shrink-0">{t.gamertag || t.club_name || '—'}</span>
                          <span className="text-muted-foreground truncate flex-1">{t.category || t.type} — {t.description || t.source || '—'}</span>
                          <span className="text-muted-foreground shrink-0 hidden sm:block">bal: {fmtStc(t.balance_after)}</span>
                          <span className="text-muted-foreground shrink-0">{fmtDate(t.created_date)}</span>
                        </div>
                      ))}
                      {txResults.length === 0 && <p className="text-xs text-muted-foreground">No results.</p>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── AUDIT LOG ── */}
            {section === 'audit' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Admin Audit Log</p>
                  <div className="flex gap-2">
                    <select value={auditFilter} onChange={e => setAuditFilter(e.target.value)}
                      className="bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground outline-none">
                      <option value="">All types</option>
                      {['player','club','wager','lifestyle_purchase','system'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <Button size="sm" variant="ghost" onClick={loadAuditLog} disabled={auditLoading} className="text-xs gap-1 h-7">
                      <RefreshCw className={cn("w-3 h-3", auditLoading && "animate-spin")} /> {auditLog ? 'Refresh' : 'Load Log'}
                    </Button>
                  </div>
                </div>

                {!auditLog && !auditLoading && (
                  <p className="text-xs text-muted-foreground">Click "Load Log" to view admin audit entries.</p>
                )}
                {auditLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
                {auditLog && (
                  <div className="space-y-2 max-h-[32rem] overflow-y-auto">
                    {auditLog.map((entry, i) => (
                      <div key={entry.id || i} className="bg-secondary/40 border border-border rounded-xl p-3">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-foreground">{entry.action}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 uppercase tracking-wider">{entry.entity_type}</span>
                            {entry.entity_name && <span className="text-[10px] text-muted-foreground">{entry.entity_name}</span>}
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">{fmtDate(entry.created_date)}</span>
                        </div>
                        <div className="flex gap-4 text-[10px] text-muted-foreground flex-wrap">
                          <span>Admin: <span className="text-foreground">{entry.admin_email || entry.admin_user_id || '—'}</span></span>
                          {entry.old_value && <span>Before: <span className="text-destructive font-mono">{entry.old_value.length > 40 ? entry.old_value.slice(0, 40) + '…' : entry.old_value}</span></span>}
                          {entry.new_value && <span>After: <span className="text-success font-mono">{entry.new_value.length > 40 ? entry.new_value.slice(0, 40) + '…' : entry.new_value}</span></span>}
                          {entry.reason && <span>Reason: <span className="text-foreground italic">{entry.reason}</span></span>}
                        </div>
                      </div>
                    ))}
                    {auditLog.length === 0 && <p className="text-xs text-muted-foreground">No audit entries yet.</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const ADMIN_SECTION_ALIASES = {
  players: "players",
  clubs: "clubs",
  lifestyles: "lifestyles",
  transfers: "transfers",
  "press-conferences": "press-conferences",
  pressconferences: "press-conferences",
  matches: "disputes",
  notifications: "news",
  inbox: "forfeits",
  disputes: "disputes",
  forfeits: "forfeits",
  tournaments: "tournaments",
  leagues: "leagues",
  news: "news",
  trophies: "trophies",
  rewards: "rewards",
  rankings: "rankings",
  landing: "landing",
};

/** @param {{ forcedSection?: string }} [props] */
export default function Admin(props) {
  const forcedSection = props?.forcedSection;
  const params = useParams();
  /** Static routes like `/admin/players` do not define `:section`; wrappers pass `forcedSection`. */
  const section = params.section ?? forcedSection;
  const [allowed, setAllowed] = useState(null);
  const [disputes, setDisputes] = useState([]);
  const [forfeits, setForfeits] = useState([]);
  const [players, setPlayers] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [clubSearch, setClubSearch] = useState("");
  const [tournamentSearch, setTournamentSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [resolveDialog, setResolveDialog] = useState(null);
  const [selectedWinner, setSelectedWinner] = useState("");
  const [creditsDialog, setCreditsDialog] = useState(null);
  const [creditsAmount, setCreditsAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  function takeControl(club) {
    localStorage.setItem('admin_takeover_club_id', club.id);
    localStorage.setItem('stage_admin_effective_role_id', '1');
    localStorage.setItem('stage-account-mode', 'club');
    navigate(`/clubs/${club.id}`);
  }

  // Tournament creation
  const [createTournamentOpen, setCreateTournamentOpen] = useState(false);
  const [tournamentForm, setTournamentForm] = useState({
    name: "", type: "knockout", participant_type: "club", platform: "PlayStation",
    region: "Global", country_code: "", max_teams: 8, start_date: "", description: "", prize_description: "",
    entry_credits: 50, win_credits: 200, custom_rules: "",
    prize_winner_stc: "", prize_runner_up_stc: "", prize_semi_final_stc: "", prize_participation_stc: "",
  });
  const [rulesFile, setRulesFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerColor, setBannerColor] = useState("#1e2a3a");
  const [adminTrophyFile, setAdminTrophyFile] = useState(null);
  const BANNER_COLORS = ["#1e2a3a","#1a3a1a","#3a1a0a","#3a1a1a","#2a1a3a","#1a253a","#2a2a2a","#2a2a0a","#0a2a2a","#3a0a2a"];

  // Trophy manager
  const [trophyItems, setTrophyItems] = useState([]);
  const [newTrophyName, setNewTrophyName] = useState("");
  const [newTrophyFile, setNewTrophyFile] = useState(null);
  const [newTrophyAdminOnly, setNewTrophyAdminOnly] = useState(false);
  const [uploadingTrophy, setUploadingTrophy] = useState(false);
  const [trophyUploadError, setTrophyUploadError] = useState(null);
  const trophyFileRef = useRef(null);

  // Admin create tournament extras
  const [adminEntryType, setAdminEntryType] = useState("free"); // "free" | "stc"
  const [adminTrophyItemId, setAdminTrophyItemId] = useState("");

  // News creation
  const [newsForm, setNewsForm] = useState({ title: "", body: "", type: "app_update", image_url: "" });
  const [newsImageFile, setNewsImageFile] = useState(null);
  const [uploadingNews, setUploadingNews] = useState(false);

  // Competitions / Leagues tab
  const [competitions, setCompetitions] = useState([]);
  const [compSeasons, setCompSeasons] = useState([]);
  const [qualEntries, setQualEntries] = useState([]);
  const [seedingComps, setSeedingComps] = useState(false);
  const [newSeasonForm, setNewSeasonForm] = useState({ competition_id: "", platform: "Cross-Platform", region: "Global", prize_pool_stc: "" });
  const [expiredFixtures, setExpiredFixtures] = useState([]);
  const [schedulingAdminBusy, setSchedulingAdminBusy] = useState(null);
  const [creatingLeagueSeason, setCreatingLeagueSeason] = useState(false);
  const [regionalLeagues, setRegionalLeagues] = useState([]);
  const [seedingRegionalLeagues, setSeedingRegionalLeagues] = useState(false);
  const [processingLeagueEnd, setProcessingLeagueEnd] = useState(null);

  // Competition & league inline editing
  const [editingComp, setEditingComp]       = useState(null);
  const [compEditForm, setCompEditForm]     = useState({});
  const [savingComp, setSavingComp]         = useState(false);
  const [editingLeague, setEditingLeague]   = useState(null);
  const [leagueEditForm, setLeagueEditForm] = useState({});
  const [savingLeague, setSavingLeague]     = useState(false);

  // Fixtures panel
  const [fixturesOpen, setFixturesOpen]               = useState(false);
  const [fixturesPanel, setFixturesPanel]             = useState(null);
  const [fixturesList, setFixturesList]               = useState([]);
  const [loadingFixtures, setLoadingFixtures]         = useState(false);
  const [selectedFixtureSeason, setSelectedFixtureSeason] = useState("");
  const [selectedFixtureLeague, setSelectedFixtureLeague] = useState("");

  // Standings panel
  const [standingsOpen, setStandingsOpen]                 = useState(false);
  const [standingsPanel, setStandingsPanel]               = useState(null);
  const [standingsList, setStandingsList]                 = useState([]);
  const [loadingStandings, setLoadingStandings]           = useState(false);
  const [selectedStandingsSeason, setSelectedStandingsSeason] = useState("");
  const [selectedStandingsLeague, setSelectedStandingsLeague] = useState("");

  // Result entry dialog
  const [resultDialog, setResultDialog]   = useState(null);
  const [resultForm, setResultForm]       = useState({ home_score: "", away_score: "" });
  const [savingResult, setSavingResult]   = useState(false);

  // Season registration applications
  const [regApplications, setRegApplications]     = useState([]);
  const [regAppFilter,    setRegAppFilter]         = useState("actionable"); // "actionable" | "all"
  const [approveRegDialog, setApproveRegDialog]   = useState(null); // { reg }
  const [approveTargetId,  setApproveTargetId]    = useState("");
  const [rejectNotesDialog, setRejectNotesDialog] = useState(null); // { reg, action: "reject"|"waitlist" }
  const [rejectNotes,       setRejectNotes]       = useState("");
  const [processingReg,     setProcessingReg]     = useState(false);

  const [adminProfile, setAdminProfile] = useState(null);
  const [pressConferences, setPressConferences] = useState([]);
  const [lifestyleItems, setLifestyleItems] = useState([]);

  // Rewards tab
  const [rewardSource, setRewardSource] = useState(null); // { id, type, name, trophy_image_url }

  useEffect(() => {
    (async () => {
      try {
        const u = await stageClient.auth.me();
        const isAdmin = u?.role === "admin" || Number(u?.role_id) === 0;
        if (!isAdmin) { setAllowed(false); return; }
        setAllowed(true);
        setAdminProfile(u);
        await loadAll();
      } catch {
        setAllowed(false);
      }
    })();
  }, []);

  const adminTab = useMemo(
    () => (section && ADMIN_SECTION_ALIASES[section] ? ADMIN_SECTION_ALIASES[section] : null),
    [section]
  );

  async function loadAll() {
    setLoading(true);
    try {
      const [disputedMatches, allPlayers, allTournaments, allClubs, allTrophies, allComps, allCompSeasons, allQual, allRegLeagues, expiredLeagueFixtures, expiredCompFixtures, allRegApps, allPressConferences, allLifestyleItems] = await Promise.all([
        base44.entities.Match.filter({ status: "disputed" }, "-updated_date", 50).catch(() => []),
        base44.entities.Player.list("-created_date", 100).catch(() => []),
        base44.entities.Tournament.list("-created_date", 200).catch(() => []),
        base44.entities.Club.list("-created_date", 100).catch(() => []),
        base44.entities.TrophyItem.list("sort_order", 100).catch(() => []),
        base44.entities.Competition.list("tier", 10).catch(() => []),
        base44.entities.CompetitionSeason.list("-season_number", 30).catch(() => []),
        base44.entities.QualificationEntry.filter({ status: "pending" }, null, 50).catch(() => []),
        base44.entities.RegionalLeague.list("-season_number", 50).catch(() => []),
        (base44.entities.RegionalLeagueFixture?.filter({ scheduling_status: "expired" }, null, 50) ?? Promise.resolve([])).catch(() => []),
        (base44.entities.CompetitionFixture?.filter({ scheduling_status: "expired" }, null, 50) ?? Promise.resolve([])).catch(() => []),
        (base44.entities.SeasonRegistration?.list("-applied_at", 200) ?? Promise.resolve([])).catch(() => []),
        stageClient.entities.PressConference.list("-created_date", 200).catch(() => []),
        stageClient.entities.LifestyleItem.list("sort_order", 300).catch(() => []),
      ]);
      const forfeitMatches = await stageClient.entities.Match.filter({ forfeit_status: "pending" }, "-updated_date", 50).catch(() => []);
      setDisputes(disputedMatches.map(m => ({ ...m, _source: "tournament" })));
      setForfeits(forfeitMatches);
      setPlayers(allPlayers);
      setClubs(allClubs);
      setTournaments(allTournaments);
      setTrophyItems(allTrophies);
      setCompetitions(allComps);
      setCompSeasons(allCompSeasons);
      setQualEntries(allQual);
      setRegionalLeagues(allRegLeagues);
      setRegApplications(allRegApps);
      setPressConferences(allPressConferences);
      setLifestyleItems(allLifestyleItems);
      setExpiredFixtures([
        ...expiredLeagueFixtures.map(f => ({ ...f, _fixtureType: "regional_league" })),
        ...expiredCompFixtures.map(f => ({ ...f, _fixtureType: "competition" })),
      ]);

      // Load ranking config (non-fatal)
      const cfgRows = await (base44.entities.RankingConfig?.list(null, 10) ?? Promise.resolve([])).catch(() => []);
      const activeCfg = cfgRows.find(r => r.is_active) || cfgRows[0];
      if (activeCfg) {
        setRankingConfigId(activeCfg.id);
        setRankingConfig(activeCfg);
      } else {
        const { DEFAULT_CONFIG } = await import("@/lib/rankingEngine");
        setRankingConfig({ ...DEFAULT_CONFIG, label: "Default", is_active: true });
        setRankingConfigId(null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function createTrophyItem() {
    if (!newTrophyName.trim() || !newTrophyFile) return;
    setUploadingTrophy(true);
    setTrophyUploadError(null);
    try {
      const uploadResult = await base44.integrations.Core.UploadFile({ file: newTrophyFile });
      if (!uploadResult?.file_url) throw new Error("Upload succeeded but no URL was returned.");
      await base44.entities.TrophyItem.create({
        name: newTrophyName.trim(),
        image_url: uploadResult.file_url,
        is_official: true,
        admin_only: newTrophyAdminOnly,
        sort_order: trophyItems.length,
      });
      setNewTrophyName("");
      setNewTrophyFile(null);
      setNewTrophyAdminOnly(false);
      if (trophyFileRef.current) trophyFileRef.current.value = "";
      const updated = await base44.entities.TrophyItem.list("sort_order", 100).catch(() => []);
      setTrophyItems(updated);
    } catch (err) {
      setTrophyUploadError(err?.message || JSON.stringify(err) || "Failed to add trophy. Check console.");
      console.error("createTrophyItem error:", err);
    } finally {
      setUploadingTrophy(false);
    }
  }

  async function deleteTrophyItem(id) {
    if (!confirm("Delete this trophy from the library? It will no longer appear in carousels.")) return;
    await base44.entities.TrophyItem.delete(id);
    setTrophyItems(prev => prev.filter(t => t.id !== id));
  }

  async function resolveDispute() {
    if (!resolveDialog || !selectedWinner) return;
    setSaving(true);
    const m = resolveDialog.match;
    try {
      const isHome = selectedWinner === m.home_club_id;
      await stageClient.functions.invoke("matchKickoff", {
        match_id: m.id,
        action: "admin_resolve",
        admin_resolve_winner: isHome ? "home" : "away",
      });
    } catch {
      // Fallback: direct update
      const isHome = selectedWinner === m.home_club_id;
      const winnerName = isHome ? m.home_club_name : m.away_club_name;
      await stageClient.entities.Match.update(m.id, { status: "completed", winner_club_id: selectedWinner, winner_club_name: winnerName });
    }
    setResolveDialog(null); setSelectedWinner(""); setSaving(false);
    await loadAll();
  }

  async function resolveForfeit(matchId, approve) {
    const m = forfeits.find(f => f.id === matchId);
    if (!m) return;
    if (approve) {
      const winnerId = m.forfeit_claimed_by;
      const winnerName = winnerId === m.home_club_id ? m.home_club_name : m.away_club_name;
      await stageClient.entities.Match.update(matchId, { status: "forfeit", forfeit_status: "approved", winner_club_id: winnerId, winner_club_name: winnerName });
    } else {
      await stageClient.entities.Match.update(matchId, { forfeit_status: "rejected" });
    }
    setForfeits(prev => prev.filter(f => f.id !== matchId));
  }

  async function kickFromClub(playerId) {
    await stageClient.entities.Player.update(playerId, { club_id: null, role: "member", club_roles: ["member"], status: "free_agent" });
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, club_id: null, role: "member", club_roles: ["member"], status: "free_agent" } : p));
  }

  async function deleteClub(clubId) {
    if (!confirm("Are you sure you want to delete this club? This cannot be undone.")) return;
    await stageClient.entities.Club.delete(clubId);
    setClubs(prev => prev.filter(c => c.id !== clubId));
  }

  async function cancelTournament(tournamentId) {
    await stageClient.entities.Tournament.update(tournamentId, { status: "cancelled" });
    setTournaments(prev => prev.filter(t => t.id !== tournamentId));
  }

  async function createTournament() {
    setSaving(true);
    const user = adminProfile;
    let rules_file_url = "";
    let banner_url = "";
    if (rulesFile) {
      const res = await stageClient.integrations.Core.UploadFile({ file: rulesFile });
      rules_file_url = res.file_url;
    }
    if (bannerFile) {
      const res = await stageClient.integrations.Core.UploadFile({ file: bannerFile });
      banner_url = res.file_url;
    }
    let trophy_url = "";
    if (adminTrophyFile) {
      const res = await stageClient.integrations.Core.UploadFile({ file: adminTrophyFile });
      trophy_url = res.file_url;
      // Auto-create TrophyItem in library from uploaded file
      if (!adminTrophyItemId && tournamentForm.name) {
        const created = await base44.entities.TrophyItem.create({
          name: `By STAGE · ${tournamentForm.name}`,
          image_url: trophy_url,
          is_official: true,
          sort_order: trophyItems.length,
        }).catch(() => null);
        if (created?.id) setAdminTrophyItemId(created.id);
      }
    }
    const resolvedTrophyItemId = adminTrophyItemId || null;
    const resolvedTrophyUrl = trophy_url || trophyItems.find(t => t.id === resolvedTrophyItemId)?.image_url || "";
    
    await base44.entities.Tournament.create({
      ...tournamentForm,
      max_teams: Number(tournamentForm.max_teams),
      entry_credits: 0,
      entry_fee_stc: adminEntryType === "stc" ? (Number(tournamentForm.entry_fee_stc) || 0) : 0,
      prize_winner_stc: Number(tournamentForm.prize_winner_stc) || 0,
      prize_runner_up_stc: Number(tournamentForm.prize_runner_up_stc) || 0,
      prize_semi_final_stc: Number(tournamentForm.prize_semi_final_stc) || 0,
      prize_participation_stc: Number(tournamentForm.prize_participation_stc) || 0,
      start_date: new Date(tournamentForm.start_date).toISOString(),
      organizer_email: user.email,
      creator_email: user.email,
      status: "registration",
      current_round: 1,
      registered_clubs: [],
      registered_players: [],
      rules_file_url,
      banner_url: banner_url || "",
      banner_color: !banner_url ? bannerColor : "",
      trophy_url: resolvedTrophyUrl,
      trophy_item_id: resolvedTrophyItemId,
    });
    setCreateTournamentOpen(false);
    setTournamentForm({ name: "", type: "knockout", participant_type: "club", platform: "PlayStation", region: "Global", country_code: "", max_teams: 8, start_date: "", description: "", prize_description: "", entry_fee_stc: 0, custom_rules: "", prize_winner_stc: "", prize_runner_up_stc: "", prize_semi_final_stc: "", prize_participation_stc: "" });
    setRulesFile(null); setBannerFile(null); setBannerColor("#1e2a3a"); setAdminTrophyFile(null);
    setAdminTrophyItemId(""); setAdminEntryType("free");
    setSaving(false);
    await loadAll();
  }

  async function seedCompetitions() {
    if (competitions.length >= 3) { alert("Competitions already seeded."); return; }
    setSeedingComps(true);
    try {
      const defs = [
        { name: "STAGE Supreme League",    slug: "supreme",    tier: 1, primary_color: "#FFD700", description: "The pinnacle of STAGE competition. Only the elite qualify.",          max_clubs_per_season: 16, promotion_spots: 0, relegation_spots: 2, playoff_spots: 4, qualification_spots_per_region: 2, current_season: 1, is_active: true, platform: "Cross-Platform", region: "Global" },
        { name: "STAGE Elite League",      slug: "elite",      tier: 2, primary_color: "#00E5BD", description: "The proving ground. Earn your place in the Supreme League.",           max_clubs_per_season: 16, promotion_spots: 2, relegation_spots: 2, playoff_spots: 4, qualification_spots_per_region: 2, current_season: 1, is_active: true, platform: "Cross-Platform", region: "Global" },
        { name: "STAGE Challenger League", slug: "challenger", tier: 3, primary_color: "#A78BFA", description: "Where every STAGE career begins. Rise through the ranks.",             max_clubs_per_season: 16, promotion_spots: 2, relegation_spots: 0, playoff_spots: 4, qualification_spots_per_region: 3, current_season: 1, is_active: true, platform: "Cross-Platform", region: "Global" },
      ];
      const existing = new Set(competitions.map(c => c.slug));
      const toCreate = defs.filter(d => !existing.has(d.slug));
      await Promise.all(toCreate.map(d => base44.entities.Competition.create(d)));
      await loadAll();
      alert(`Competitions seeded! (${toCreate.length} created)`);
    } catch (err) {
      const msg = err?.message || "";
      if (msg.includes("not found in app") || msg.includes("schema")) {
        alert(
          "⚠️ Competition entity not published yet.\n\n" +
          "To fix this:\n" +
          "1. Go to app.base44.com\n" +
          "2. Open your app → Entities\n" +
          "3. Find Competition and click Publish\n\n" +
          "Once published, come back and click Seed Competitions again."
        );
      } else {
        alert(`Seed failed: ${msg || "Unknown error."}`);
      }
    } finally {
      setSeedingComps(false);
    }
  }

  async function createCompetitionSeason() {
    if (!newSeasonForm.competition_id) { alert("Select a competition."); return; }
    setCreatingLeagueSeason(true);
    const comp = competitions.find(c => c.id === newSeasonForm.competition_id);
    if (!comp) { setCreatingLeagueSeason(false); return; }
    const existingSeasons = compSeasons.filter(s => s.competition_id === comp.id);
    const nextSeason = existingSeasons.length > 0 ? Math.max(...existingSeasons.map(s => s.season_number)) + 1 : 1;
    await base44.entities.CompetitionSeason.create({
      competition_id: comp.id,
      competition_name: comp.name,
      competition_tier: comp.tier,
      competition_slug: comp.slug,
      season_number: nextSeason,
      season_label: `Season ${nextSeason}`,
      platform: newSeasonForm.platform,
      region: newSeasonForm.region,
      status: "draft",
      format: "league_36_8md",
      playoff_format: "9_24_bracket",
      num_league_matchdays: 8,
      league_matchday_total: 8,
      fixtures_generated: false,
      registered_club_ids: [],
      num_clubs: 0,
      current_matchday: 1,
      prize_pool_stc: parseInt(newSeasonForm.prize_pool_stc) || 0,
    });
    await base44.entities.Competition.update(comp.id, { current_season: nextSeason });
    setNewSeasonForm(f => ({ ...f, competition_id: "" }));
    await loadAll();
    setCreatingLeagueSeason(false);
    alert(`Season ${nextSeason} created for ${comp.name}!`);
  }

  async function confirmQualEntry(entry) {
    const season = compSeasons.find(s => s.competition_id === entry.target_competition_id && s.status === "registration");
    if (!season) { alert("No open registration season found for this competition. Create a season first."); return; }
    const { confirmQualificationEntry } = await import("@/lib/competitionUtils");
    await confirmQualificationEntry(entry, season, adminProfile.email);
    setQualEntries(prev => prev.filter(e => e.id !== entry.id));
    alert(`${entry.club_name} confirmed for ${entry.target_competition_name}`);
  }

  async function rejectQualEntry(entry) {
    await base44.entities.QualificationEntry.update(entry.id, { status: "rejected", confirmed_by: adminProfile.email, confirmed_at: new Date().toISOString() });
    setQualEntries(prev => prev.filter(e => e.id !== entry.id));
  }

  async function seedRegionalLeagues() {
    setSeedingRegionalLeagues(true);
    try {
      const existing = new Set(regionalLeagues.map(l => l.slug));
      // Strip fields that require schema publishing so the seed always succeeds
      // with the base schema. Re-seed after publishing to persist extended fields.
      const toCreate = LEAGUE_DEFINITIONS
        .filter(d => !existing.has(d.slug))
        .map(({ linked_league_slug: _lls, ...d }) => ({
          ...d,
          platform: "Cross-Platform",
          season_number: 1,
          status: "registration",
          max_clubs: 16,
          promoted_slots: d.division === 1 ? 6 : 2,
        }));
      await Promise.all(toCreate.map(d => base44.entities.RegionalLeague.create(d)));
      await loadAll();
      alert(`Regional leagues seeded! (${toCreate.length} created)`);
    } catch (err) {
      const msg = err?.message || "";
      if (msg.includes("not found in app") || msg.includes("schema")) {
        alert(
          "⚠️ RegionalLeague entity not published yet.\n\n" +
          "To fix this:\n" +
          "1. Go to app.base44.com\n" +
          "2. Open your app → Entities\n" +
          "3. Find RegionalLeague and click Publish\n\n" +
          "Once published, come back and click Seed All Leagues again."
        );
      } else {
        alert(`Seed failed: ${msg || "Unknown error."}`);
      }
    } finally {
      setSeedingRegionalLeagues(false);
    }
  }

  async function processLeagueEnd(league) {
    setProcessingLeagueEnd(league.id);
    try {
      const standings = await base44.entities.RegionalLeagueStanding.filter({ league_id: league.id }, null, 50).catch(() => []);
      if (!standings.length) {
        alert("No standings found. Add clubs and record results before processing season end.");
        return;
      }
      const { processLeagueSeasonEnd } = await import("@/lib/regionalLeagueEngine");
      const result = await processLeagueSeasonEnd(league, standings, competitions, regionalLeagues);
      await loadAll();
      if (result.type === "div1") {
        alert(`Season processed! ${result.qualified} qualification entries created for STAGE competitions. ${result.relegated} clubs relegated.`);
      } else {
        alert(`Season processed! ${result.promoted} clubs promoted to Division 1.`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setProcessingLeagueEnd(null);
    }
  }

  async function leagueLifecycleAction(league, action) {
    try {
      if (action === "open_registration") {
        const { openLeagueRegistration } = await import("@/lib/seasonLifecycle");
        await openLeagueRegistration(league);
        await loadAll();
      } else if (action === "archive") {
        if (!confirm(`Archive ${league.name} Season ${league.season_number}? This will lock final standings and award the winner achievement. Make sure "End Season" has been run first.`)) return;
        const { archiveLeague } = await import("@/lib/seasonLifecycle");
        await archiveLeague(league);
        await loadAll();
        alert(`Season ${league.season_number} archived.`);
      } else if (action === "create_next") {
        const { createNextLeagueSeason } = await import("@/lib/seasonLifecycle");
        const next = await createNextLeagueSeason(league);
        await loadAll();
        alert(`${next.name} Season ${next.season_number} created as Draft. Open Registration when ready.`);
      }
    } catch (err) {
      alert(`Error: ${err?.message || "Unknown error."}`);
    }
  }

  async function handleApproveReg() {
    if (!approveRegDialog || !approveTargetId) return;
    setProcessingReg(true);
    try {
      const league = regionalLeagues.find(l => l.id === approveTargetId);
      if (!league) throw new Error("Selected league not found.");
      const { approveRegistration } = await import("@/lib/registrationEngine");
      await approveRegistration(approveRegDialog, league, adminProfile?.email || "admin");
      setApproveRegDialog(null);
      setApproveTargetId("");
      await loadAll();
    } catch (err) {
      alert(`Error: ${err?.message || "Unknown error."}`);
    } finally {
      setProcessingReg(false);
    }
  }

  async function handleRejectOrWaitlistReg() {
    if (!rejectNotesDialog) return;
    setProcessingReg(true);
    try {
      const { rejectRegistration, waitlistRegistration } = await import("@/lib/registrationEngine");
      if (rejectNotesDialog.action === "reject") {
        await rejectRegistration(rejectNotesDialog.reg, rejectNotes, adminProfile?.email || "admin");
      } else {
        await waitlistRegistration(rejectNotesDialog.reg, rejectNotes, adminProfile?.email || "admin");
      }
      setRejectNotesDialog(null);
      setRejectNotes("");
      await loadAll();
    } catch (err) {
      alert(`Error: ${err?.message || "Unknown error."}`);
    } finally {
      setProcessingReg(false);
    }
  }

  async function saveCompRules() {
    if (!editingComp) return;
    setSavingComp(true);
    try {
      await base44.entities.Competition.update(editingComp, {
        max_clubs_per_season:           Number(compEditForm.max_clubs_per_season) || 16,
        qualification_spots_per_region: Number(compEditForm.qualification_spots_per_region) || 2,
        promotion_spots:                Number(compEditForm.promotion_spots) || 0,
        relegation_spots:               Number(compEditForm.relegation_spots) || 0,
        playoff_spots:                  Number(compEditForm.playoff_spots) || 4,
        trophy_image_url:               compEditForm.trophy_image_url || "",
      });
      await loadAll();
      setEditingComp(null);
    } catch (err) {
      alert(`Save failed: ${err?.message || "Unknown error."}`);
    } finally {
      setSavingComp(false);
    }
  }

  async function saveLeagueRules() {
    if (!editingLeague) return;
    setSavingLeague(true);
    try {
      await base44.entities.RegionalLeague.update(editingLeague, {
        max_clubs:        Number(leagueEditForm.max_clubs) || 16,
        promoted_slots:   Number(leagueEditForm.promoted_slots) || 2,
        trophy_image_url: leagueEditForm.trophy_image_url || "",
      });
      await loadAll();
      setEditingLeague(null);
    } catch (err) {
      alert(`Save failed: ${err?.message || "Unknown error."}`);
    } finally {
      setSavingLeague(false);
    }
  }

  async function loadFixturesForPanel(panel) {
    setFixturesPanel(panel);
    setFixturesList([]);
    setLoadingFixtures(true);
    try {
      let list = [];
      if (panel.type === "competition") {
        list = await (base44.entities.CompetitionFixture?.filter({ season_id: panel.id }, null, 200) ?? Promise.resolve([])).catch(() => []);
      } else {
        list = await (base44.entities.RegionalLeagueFixture?.filter({ league_id: panel.id }, null, 200) ?? Promise.resolve([])).catch(() => []);
      }
      setFixturesList(list.sort((a, b) => (a.matchday || 0) - (b.matchday || 0)));
    } finally {
      setLoadingFixtures(false);
    }
  }

  async function loadStandingsForPanel(panel) {
    setStandingsPanel(panel);
    setStandingsList([]);
    setLoadingStandings(true);
    try {
      let list = [];
      if (panel.type === "competition") {
        list = await (base44.entities.CompetitionStanding?.filter({ season_id: panel.id }, null, 50) ?? Promise.resolve([])).catch(() => []);
      } else {
        list = await (base44.entities.RegionalLeagueStanding?.filter({ league_id: panel.id }, null, 50) ?? Promise.resolve([])).catch(() => []);
      }
      setStandingsList(list.sort((a, b) => (a.position || 99) - (b.position || 99)));
    } finally {
      setLoadingStandings(false);
    }
  }

  async function processAdminResult() {
    if (!resultDialog) return;
    const { fixture, fixtureType } = resultDialog;
    const home = parseInt(resultForm.home_score);
    const away = parseInt(resultForm.away_score);
    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
      alert("Enter valid scores (0 or above).");
      return;
    }
    setSavingResult(true);
    try {
      if (fixtureType === "competition") {
        await base44.entities.CompetitionFixture.update(fixture.id, {
          home_score: home, away_score: away, status: "completed", stats_processed: false,
        });
        const { processFixtureResult } = await import("@/lib/competitionUtils");
        await processFixtureResult({ ...fixture, home_score: home, away_score: away, stats_processed: false });
      } else {
        // Regional league — update fixture + standings + ranking
        const isDraw = home === away;
        const homeWin = home > away;
        await (base44.entities.RegionalLeagueFixture?.update(fixture.id, {
          home_score: home, away_score: away, status: "completed", stats_processed: true,
        }) ?? Promise.resolve());
        const [[homeRow], [awayRow]] = await Promise.all([
          (base44.entities.RegionalLeagueStanding?.filter({ league_id: fixture.league_id, club_id: fixture.home_club_id }, null, 1) ?? Promise.resolve([])).catch(() => []),
          (base44.entities.RegionalLeagueStanding?.filter({ league_id: fixture.league_id, club_id: fixture.away_club_id }, null, 1) ?? Promise.resolve([])).catch(() => []),
        ]);
        const updates = [];
        if (homeRow) {
          const u = {
            played: (homeRow.played||0)+1, wins: (homeRow.wins||0)+(homeWin?1:0),
            draws: (homeRow.draws||0)+(isDraw?1:0), losses: (homeRow.losses||0)+(!homeWin&&!isDraw?1:0),
            goals_for: (homeRow.goals_for||0)+home, goals_against: (homeRow.goals_against||0)+away,
            points: (homeRow.points||0)+(homeWin?3:isDraw?1:0),
          };
          u.goal_difference = u.goals_for - u.goals_against;
          updates.push(base44.entities.RegionalLeagueStanding.update(homeRow.id, u));
        }
        if (awayRow) {
          const u = {
            played: (awayRow.played||0)+1, wins: (awayRow.wins||0)+(!homeWin&&!isDraw?1:0),
            draws: (awayRow.draws||0)+(isDraw?1:0), losses: (awayRow.losses||0)+(homeWin?1:0),
            goals_for: (awayRow.goals_for||0)+away, goals_against: (awayRow.goals_against||0)+home,
            points: (awayRow.points||0)+(!homeWin&&!isDraw?3:isDraw?1:0),
          };
          u.goal_difference = u.goals_for - u.goals_against;
          updates.push(base44.entities.RegionalLeagueStanding.update(awayRow.id, u));
        }
        await Promise.all(updates);
        // Non-fatal ranking update
        try {
          const { updateClubRankingAfterMatch } = await import("@/lib/rankingEngine");
          const [[hc],[ac]] = await Promise.all([
            base44.entities.Club.filter({ id: fixture.home_club_id }, null, 1).catch(()=>[]),
            base44.entities.Club.filter({ id: fixture.away_club_id }, null, 1).catch(()=>[]),
          ]);
          if (hc && ac) {
            await updateClubRankingAfterMatch({
              homeClub: hc, awayClub: ac, homeScore: home, awayScore: away,
              competitionType: "regional_league", division: fixture.division || 1,
              phase: "league", matchId: fixture.id,
            });
          }
        } catch { /* non-fatal */ }
      }
      setResultDialog(null);
      setResultForm({ home_score: "", away_score: "" });
      if (fixturesPanel) await loadFixturesForPanel(fixturesPanel);
    } catch (err) {
      alert(`Error: ${err?.message || "Failed."}`);
    } finally {
      setSavingResult(false);
    }
  }

  async function postNews() {
    setUploadingNews(true);
    let image_url = newsForm.image_url;
    if (newsImageFile) {
      const res = await stageClient.integrations.Core.UploadFile({ file: newsImageFile });
      image_url = res.file_url;
    }
    await stageClient.entities.NewsItem.create({
      title: newsForm.title,
      body: newsForm.body,
      type: newsForm.type,
      image_url,
      published_at: new Date().toISOString(),
      is_featured: false,
    });
    setNewsForm({ title: "", body: "", type: "app_update", image_url: "" });
    setNewsImageFile(null);
    setUploadingNews(false);
    alert("News posted successfully!");
  }

  async function seedPressQuestions() {
    setSaving(true);
    const existing = await stageClient.entities.PressQuestion.list(null, 1);
    if (existing.length > 0) { alert("Press questions already seeded!"); setSaving(false); return; }
    const questions = [
      { question: "How do you rate your team's performance today?", answer_a: "Outstanding — we gave 100%", answer_b: "Decent, but we can improve", answer_c: "Disappointing overall", answer_d: "The result doesn't reflect the game", category: "performance" },
      { question: "What was the key moment of the match?", answer_a: "Our first goal changed everything", answer_b: "A great defensive block in the second half", answer_c: "The red card shifted the momentum", answer_d: "The penalty decision was crucial", category: "match" },
      { question: "How do you assess your opponent?", answer_a: "Very tough and well-organized", answer_b: "We expected more from them", answer_c: "They surprised us with their tactics", answer_d: "Respect to them — fair game", category: "opponent" },
      { question: "What's the message to your fans?", answer_a: "We play for you — thank you!", answer_b: "We'll work harder next time", answer_c: "Keep believing in us", answer_d: "Your support makes the difference", category: "fans" },
      { question: "How are you preparing for the next match?", answer_a: "Full focus on recovery and analysis", answer_b: "We'll fix the tactical issues we saw today", answer_c: "Confidence is high after this result", answer_d: "One game at a time — that's our motto", category: "preparation" },
      { question: "How would you describe the atmosphere in the dressing room?", answer_a: "Buzzing — everyone is pumped!", answer_b: "Calm and focused", answer_c: "Disappointed but determined", answer_d: "United — we face it together", category: "team" },
    ];
    await stageClient.entities.PressQuestion.bulkCreate(questions);
    alert("Press questions seeded successfully!");
    setSaving(false);
  }

  async function grantCredits() {
    if (!creditsDialog) return;
    setSaving(true);
    await stageClient.entities.Player.update(creditsDialog.id, { credits: (creditsDialog.credits || 0) + Number(creditsAmount) });
    setCreditsDialog(null); setCreditsAmount(0); setSaving(false);
    await loadAll();
  }

  // Lifestyle admin state
  const [lifestyleDialog, setLifestyleDialog] = useState(null); // null | 'add' | item (for edit)
  const [lifestyleForm, setLifestyleForm] = useState({});
  const [lifestyleSaving, setLifestyleSaving] = useState(false);
  const [lifestyleImageFile, setLifestyleImageFile] = useState(null);
  const [lifestyleImageUploading, setLifestyleImageUploading] = useState(false);

  function openAddAsset() {
    setLifestyleForm({
      name: '', category: 'houses', subcategory: '', tier: 'standard', description: '',
      image_url: '', sort_order: 0,
      price_stc: 0, rent_price_stc: 0, rent_duration_days: 30,
      invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 30,
      passive_income_stc: 0, passive_income_interval_days: 7,
      weekly_maintenance_stc: 0,
      can_buy: true, can_rent: false, can_invest: false, can_sell: true,
      sell_value_percent: 60, allows_multiple: true, is_active: true,
    });
    setLifestyleImageFile(null);
    setLifestyleDialog('add');
  }

  function openEditAsset(item) {
    setLifestyleForm({ ...item });
    setLifestyleImageFile(null);
    setLifestyleDialog(item);
  }

  async function uploadLifestyleImage() {
    if (!lifestyleImageFile) return null;
    setLifestyleImageUploading(true);
    try {
      const form = new FormData();
      form.append('file', lifestyleImageFile);
      const res = await stageClient.integrations.Core.UploadFile({ file: lifestyleImageFile });
      setLifestyleForm(prev => ({ ...prev, image_url: res.file_url }));
      return res.file_url;
    } catch { return null; }
    finally { setLifestyleImageUploading(false); }
  }

  async function saveLifestyleAsset() {
    if (!lifestyleForm.name) return;
    setLifestyleSaving(true);
    try {
      let imgUrl = lifestyleForm.image_url;
      if (lifestyleImageFile) {
        const uploaded = await uploadLifestyleImage();
        if (uploaded) imgUrl = uploaded;
      }
      const payload = { ...lifestyleForm, image_url: imgUrl };
      if (lifestyleDialog === 'add') {
        await stageClient.functions.invoke('lifestyleAdmin', { action: 'add', ...payload });
      } else {
        await stageClient.functions.invoke('lifestyleAdmin', { action: 'edit', asset_id: lifestyleDialog.id, ...payload });
      }
      setLifestyleDialog(null);
      const fresh = await stageClient.entities.LifestyleItem.list('sort_order', 300).catch(() => []);
      setLifestyleItems(fresh);
    } catch (e) { alert(e.message); }
    setLifestyleSaving(false);
  }

  async function deleteLifestyleAsset(item) {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    await stageClient.functions.invoke('lifestyleAdmin', { action: 'delete', asset_id: item.id }).catch(() => {});
    setLifestyleItems(prev => prev.filter(i => i.id !== item.id));
  }

  async function toggleLifestyleAsset(item) {
    await stageClient.functions.invoke('lifestyleAdmin', { action: 'toggle', asset_id: item.id }).catch(() => {});
    setLifestyleItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i));
  }

  const [playerWalletDialog, setPlayerWalletDialog] = useState(null);
  const [walletAdjustAmount, setWalletAdjustAmount] = useState("");
  const [walletAdjustNote,   setWalletAdjustNote]   = useState("");
  const [walletTxns, setWalletTxns] = useState([]);
  const [walletLoading, setWalletLoading] = useState(false);

  async function openPlayerWallet(p) {
    setPlayerWalletDialog(p);
    setWalletAdjustAmount("");
    setWalletAdjustNote("");
    setWalletLoading(true);
    try {
      const txns = await stageClient.entities.PlayerStcTransaction.filter({ player_id: p.id }, "-created_date", 30);
      setWalletTxns(txns || []);
    } catch { setWalletTxns([]); }
    setWalletLoading(false);
  }

  async function applyWalletAdjust() {
    if (!playerWalletDialog || walletAdjustAmount === "") return;
    setSaving(true);
    try {
      await stageClient.functions.invoke("playerWallet", {
        action: "admin_adjust",
        player_id: playerWalletDialog.id,
        amount: Number(walletAdjustAmount),
        description: walletAdjustNote || undefined,
      });
      // Refresh player list and wallet
      const fresh = await stageClient.entities.Player.filter({ id: playerWalletDialog.id }, null, 1);
      if (fresh[0]) setPlayerWalletDialog(fresh[0]);
      setPlayers(prev => prev.map(p => p.id === playerWalletDialog.id ? { ...p, stc: fresh[0]?.stc ?? p.stc } : p));
      await openPlayerWallet(fresh[0] || playerWalletDialog);
      setWalletAdjustAmount("");
      setWalletAdjustNote("");
    } catch (err) {
      alert(err?.message || "Failed");
    }
    setSaving(false);
  }

  const [clubStcDialog, setClubStcDialog] = useState(null);
  const [clubStcAmount, setClubStcAmount] = useState("");
  const [clubStcNote, setClubStcNote] = useState("");
  const [clubWageBudget, setClubWageBudget] = useState("");
  const [clubTransferBudget, setClubTransferBudget] = useState("");

  async function saveClubFinance() {
    if (!clubStcDialog) return;
    setSaving(true);
    try {
      await stageClient.functions.invoke("clubFinance", {
        action: "admin_adjust",
        club_id: clubStcDialog.id,
        ...(clubStcAmount !== "" ? { balance_delta: Number(clubStcAmount) } : {}),
        ...(clubWageBudget !== "" ? { set_wage_budget: Number(clubWageBudget) } : {}),
        ...(clubTransferBudget !== "" ? { set_transfer_budget: Number(clubTransferBudget) } : {}),
        ...(clubStcNote ? { note: clubStcNote } : {}),
      });
    } catch (err) {
      alert(err?.message || "Failed to save club finance");
      setSaving(false);
      return;
    }
    setClubStcDialog(null);
    setClubStcAmount(""); setClubStcNote(""); setClubWageBudget(""); setClubTransferBudget("");
    setSaving(false);
    await loadAll();
  }

  async function reseedLifestyle() {
    setSaving(true);
    await stageClient.functions.invoke("seedLifestyleItems", { force: true });
    setSaving(false);
    alert("Lifestyle items reseeded with correct pricing!");
  }

  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState(null);
  const [resettingRankings, setResettingRankings] = useState(false);

  // Rankings tab
  const [rankingConfig, setRankingConfig]     = useState(null);
  const [rankingConfigId, setRankingConfigId] = useState(null);
  const [savingConfig, setSavingConfig]       = useState(false);
  const [recalcBusy, setRecalcBusy]           = useState(false);
  const [recalcMsg,  setRecalcMsg]            = useState("");

  async function resetAllRankings() {
    if (!confirm("This will zero out all club ranking data (ranking points, global/regional rank, form, win/loss streak) for ALL clubs. This cannot be undone. Continue?")) return;
    setResettingRankings(true);
    try {
      const allClubs = await base44.entities.Club.list(null, 500);
      await Promise.all(allClubs.map(c =>
        base44.entities.Club.update(c.id, {
          ranking_points:   0,
          global_rank:      0,
          regional_rank:    0,
          form:             [],
          win_streak:       0,
          loss_streak:      0,
        })
      ));
      alert(`Rankings reset for ${allClubs.length} club${allClubs.length !== 1 ? "s" : ""}.`);
    } catch (err) {
      alert(`Reset failed: ${err?.message || "Unknown error."}`);
    } finally {
      setResettingRankings(false);
    }
  }

  async function saveRankingConfig() {
    if (!rankingConfig) return;
    setSavingConfig(true);
    try {
      const { DEFAULT_CONFIG } = await import("@/lib/rankingEngine");
      const payload = {};
      for (const key of Object.keys(DEFAULT_CONFIG)) {
        if (rankingConfig[key] !== undefined) payload[key] = Number(rankingConfig[key]);
      }
      payload.label     = rankingConfig.label || "Default";
      payload.is_active = true;

      if (!base44.entities.RankingConfig) {
        alert("⚠️ RankingConfig entity not published yet.\n\nPublish it on app.base44.com, then come back to save.");
        return;
      }
      if (rankingConfigId) {
        await base44.entities.RankingConfig.update(rankingConfigId, payload);
      } else {
        const created = await base44.entities.RankingConfig.create(payload);
        setRankingConfigId(created.id);
      }
      alert("Ranking config saved.");
    } catch (err) {
      alert(`Save failed: ${err?.message || "Unknown error."}`);
    } finally {
      setSavingConfig(false);
    }
  }

  async function recalculateRanks(type) {
    setRecalcBusy(true);
    setRecalcMsg("");
    try {
      const { recalculateGlobalRanks, recalculateRegionalRanks } = await import("@/lib/rankingEngine");
      if (type === "global") {
        const n = await recalculateGlobalRanks();
        setRecalcMsg(`✓ Global ranks recalculated for ${n} clubs.`);
      } else {
        const n = await recalculateRegionalRanks();
        setRecalcMsg(`✓ Regional ranks recalculated across ${n} regions.`);
      }
    } catch (err) {
      setRecalcMsg(`✗ ${err?.message || "Failed."}`);
    } finally {
      setRecalcBusy(false);
    }
  }

  async function migrateClubBalances() {
    if (!confirm("This will add +20M STC, +5M transfer budget, and +4M wage budget to ALL existing clubs. Continue?")) return;
    setMigrating(true);
    setMigrateResult(null);
    try {
      const allClubs = await stageClient.entities.Club.list(null, 500);
      let updated = 0;
      for (const club of allClubs) {
        await stageClient.entities.Club.update(club.id, {
          stc: (club.stc || 0) + 20_000_000,
          transfer_budget_stc: (club.transfer_budget_stc || 0) + 5_000_000,
          wage_budget_stc: (club.wage_budget_stc || 0) + 4_000_000,
        });
        updated++;
      }
      setMigrateResult({ success: true, count: updated });
    } catch (err) {
      setMigrateResult({ success: false, error: err?.message });
    } finally {
      setMigrating(false);
    }
  }

  if (allowed === null) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );
  if (!allowed) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
      <Shield className="w-12 h-12 text-destructive" />
      <p className="text-sm text-muted-foreground uppercase tracking-widest">Admin access required.</p>
      <Link to="/"><Button variant="outline" className="rounded">Go Home</Button></Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-8">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors mt-1">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1
              className="font-heading font-black text-5xl md:text-6xl text-foreground uppercase"
              style={{ transform: "skewX(-8deg)", letterSpacing: "-0.02em", transformOrigin: "left center" }}
            >
              ADMIN
            </h1>
            <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest">STAGE Control Panel</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-destructive border border-destructive/30 bg-destructive/5 px-2.5 py-1 rounded uppercase tracking-widest font-bold">
            {adminProfile?.email}
          </span>
          <Button variant="outline" size="sm" onClick={loadAll} className="border-border h-8 gap-1.5 rounded text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <AdminStat icon={AlertTriangle} label="Disputes" value={disputes.length} color="text-destructive" accent="border-l-destructive/50" />
        <AdminStat icon={Flag} label="Forfeits" value={forfeits.length} color="text-warning" accent="border-l-warning/50" />
        <AdminStat icon={Users} label="Players" value={players.length} color="text-primary" accent="border-l-primary/50" />
        <AdminStat icon={Trophy} label="Tournaments" value={tournaments.filter(t => t.status !== "archived" && t.status !== "cancelled").length} color="text-success" accent="border-l-success/50" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : adminTab === null ? (
        <div className="border border-dashed border-border rounded-lg p-10 text-center space-y-3 bg-card/30">
          <p className="text-sm text-muted-foreground uppercase tracking-widest font-bold">
            Choose a section
          </p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Use the <span className="text-foreground font-semibold">Admin</span> and{" "}
            <span className="text-foreground font-semibold">Operations</span> menus in the header to open disputes, players, landing page, and other tools. This dashboard shows live counts only.
          </p>
        </div>
      ) : (
        <Tabs value={adminTab}>
          {/* Disputes */}
          <TabsContent value="disputes">
            <AdminEconomyTestPanel />
            <AdminEconomyPanel />
            <AdminWagersPanel />
            {disputes.length === 0 ? (
              <EmptyState icon={AlertTriangle} text="No disputed matches." />
            ) : (
              <div className="space-y-3">
                {disputes.map(m => {
                  const parseSub = (raw) => { try { return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null; } catch { return null; } };
                  const hs = parseSub(m.home_submission);
                  const as_ = parseSub(m.away_submission);
                  const homeLbl = (m.home_club_name || m.home_player_name) ?? "Home";
                  const awayLbl = (m.away_club_name || m.away_player_name) ?? "Away";
                  const hScore = hs ? `${hs.home_score}–${hs.away_score}` : "?";
                  const aScore = as_ ? `${as_.home_score}–${as_.away_score}` : "?";
                  return (
                    <div key={m.id} className="bg-card border border-destructive/20 rounded p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] px-2 py-0.5 rounded border border-destructive/30 bg-destructive/10 text-destructive font-bold uppercase tracking-wider">DISPUTED</span>
                        </div>
                        <p className="font-bold text-foreground">{homeLbl} vs {awayLbl}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {homeLbl} says <strong className="text-foreground">{hScore}</strong>
                          {" · "}
                          {awayLbl} says <strong className="text-foreground">{aScore}</strong>
                        </p>
                      </div>
                      <Button onClick={() => { setResolveDialog({ match: m, type: m._source }); setSelectedWinner(""); }} className="bg-primary text-primary-foreground shrink-0 gap-2" size="sm">
                        <Gavel className="w-4 h-4" /> Resolve
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Forfeits */}
          <TabsContent value="forfeits">
            {forfeits.length === 0 ? (
              <EmptyState icon={Flag} text="No pending forfeit requests." />
            ) : (
              <div className="space-y-3">
                {forfeits.map(m => {
                  const claimerName = m.forfeit_claimed_by === m.home_club_id ? m.home_club_name : m.away_club_name;
                  return (
                    <div key={m.id} className="bg-card border border-warning/20 rounded p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1">
                        <p className="font-bold text-foreground">{m.home_club_name} vs {m.away_club_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Claimed by: <strong className="text-foreground">{claimerName}</strong></p>
                        {m.forfeit_proof_url && <a href={m.forfeit_proof_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline mt-1 block">View Proof</a>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" onClick={() => resolveForfeit(m.id, true)} className="bg-success/20 text-success hover:bg-success/30 border-0 gap-1"><Check className="w-4 h-4" /> Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => resolveForfeit(m.id, false)} className="border-destructive/30 text-destructive hover:bg-destructive/10 gap-1"><X className="w-4 h-4" /> Reject</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Players */}
          <TabsContent value="players">
            <BackfillStcButton />
            <MarketValueConfigPanel />
            <AdminContractsPanel />
            <AdminShirtSalesPanel />
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={playerSearch} onChange={e => setPlayerSearch(e.target.value)}
                className="w-full bg-secondary border border-border rounded pl-9 pr-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                placeholder="Search by gamertag..." />
            </div>
            <div className="space-y-2">
              {players.filter(p => p.gamertag?.toLowerCase().includes(playerSearch.toLowerCase())).map(p => (
                <div key={p.id} className="bg-card border border-border rounded p-4 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 overflow-hidden">
                    {p.avatar_url ? <img src={p.avatar_url} alt={p.gamertag} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-primary">{(p.gamertag || "?")[0].toUpperCase()}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{p.gamertag}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.email} · {p.platform} · {p.position}</p>
                  </div>
                  <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0 text-xs">
                    <span className="font-semibold text-success">{((p.stc || 0) / 1000).toFixed(0)}K STC</span>
                    {p.market_value_stc > 0 && (
                      <span className="text-purple-400 font-medium">{((p.market_value_stc || 0) / 1_000_000).toFixed(1)}M val</span>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => openPlayerWallet(p)} className="border-success/30 text-success hover:bg-success/10 gap-1 text-xs"><Coins className="w-3.5 h-3.5" /> Wallet</Button>
                    <Button size="sm" variant="outline" onClick={() => { setCreditsDialog(p); setCreditsAmount(0); }} className="border-warning/30 text-warning hover:bg-warning/10 gap-1 text-xs"><Coins className="w-3.5 h-3.5" /> Credits</Button>
                    {p.club_id && <Button size="sm" variant="outline" onClick={() => kickFromClub(p.id)} className="border-destructive/30 text-destructive hover:bg-destructive/10 gap-1 text-xs"><Ban className="w-3.5 h-3.5" /> Kick</Button>}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Clubs */}
          <TabsContent value="clubs">
            <AdminStadiumPanel />
            <div className="mb-4 flex gap-2 flex-wrap items-center">
              <Button
                variant="outline" size="sm" onClick={migrateClubBalances} disabled={migrating}
                className="border-border text-muted-foreground hover:text-foreground text-xs h-8 rounded gap-1.5"
              >
                {migrating ? <><span className="w-3 h-3 border-2 border-primary/20 border-t-primary rounded-full animate-spin inline-block" /> Migrating...</> : "Migrate All Clubs (+20M STC)"}
              </Button>
              <Button
                variant="outline" size="sm" onClick={resetAllRankings} disabled={resettingRankings}
                className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs h-8 rounded gap-1.5"
              >
                {resettingRankings ? <><span className="w-3 h-3 border-2 border-destructive/20 border-t-destructive rounded-full animate-spin inline-block" /> Resetting...</> : "Reset All Club Rankings"}
              </Button>
              {migrateResult && (
                <span className={cn("text-xs font-medium", migrateResult.success ? "text-success" : "text-destructive")}>
                  {migrateResult.success ? `✓ Updated ${migrateResult.count} clubs` : `✗ ${migrateResult.error}`}
                </span>
              )}
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={clubSearch} onChange={e => setClubSearch(e.target.value)}
                className="w-full bg-secondary border border-border rounded pl-9 pr-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                placeholder="Search by club name..." />
            </div>
            {clubs.length === 0 ? (
              <EmptyState icon={Building2} text="No clubs found." />
            ) : (
              <div className="space-y-2">
                {clubs.filter(c => c.name?.toLowerCase().includes(clubSearch.toLowerCase())).map(c => (
                  <div key={c.id} className="bg-card border border-border rounded p-4 flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 overflow-hidden">
                      {c.logo_url ? <img src={c.logo_url} alt={c.name} className="w-full h-full object-cover" /> : <Shield className="w-4 h-4 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{c.name} <span className="text-muted-foreground text-xs">[{c.tag}]</span></p>
                      <p className="text-xs text-muted-foreground truncate">{c.platform} · {c.region} · Owner: {c.owner_email}</p>
                    </div>
                    <div className="flex gap-2 shrink-0 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => takeControl(c)} className="border-warning/30 text-warning hover:bg-warning/10 gap-1 text-xs"><LogIn className="w-3.5 h-3.5" /> Take Control</Button>
                      <Button size="sm" variant="outline" onClick={() => { setClubStcDialog(c); setClubStcAmount(""); setClubWageBudget(c.wage_budget_stc || ""); setClubTransferBudget(c.transfer_budget_stc || ""); }} className="border-success/30 text-success hover:bg-success/10 gap-1 text-xs"><Coins className="w-3.5 h-3.5" /> Finance</Button>
                      <Link to={`/clubs/${c.id}`}><Button size="sm" variant="outline" className="border-border text-xs">View</Button></Link>
                      <Button size="sm" variant="outline" onClick={() => deleteClub(c.id)} className="border-destructive/30 text-destructive hover:bg-destructive/10 gap-1 text-xs"><Trash2 className="w-3.5 h-3.5" /> Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Rankings ──────────────────────────────────────── */}
          <TabsContent value="rankings">
            <div className="max-w-3xl space-y-6">

              {/* Recalculate buttons */}
              <div className="bg-card border border-border rounded p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" /> Rank Recalculation
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Reorders all clubs by ranking points and writes their position numbers.
                    Run after bulk resets or manual point adjustments.
                  </p>
                  <div className="flex gap-2 flex-wrap items-center">
                    <Button size="sm" onClick={() => recalculateRanks("global")} disabled={recalcBusy}
                      className="bg-primary text-primary-foreground h-8 text-xs gap-1.5">
                      {recalcBusy ? <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin inline-block" /> : <TrendingUp className="w-3.5 h-3.5" />}
                      Recalculate Global Ranks
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => recalculateRanks("regional")} disabled={recalcBusy}
                      className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
                      {recalcBusy ? <span className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin inline-block" /> : null}
                      Recalculate Regional Ranks
                    </Button>
                    {recalcMsg && (
                      <span className={cn("text-xs font-medium", recalcMsg.startsWith("✓") ? "text-success" : "text-destructive")}>
                        {recalcMsg}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Point config editor */}
              {rankingConfig && (
                <div className="bg-card border border-border rounded p-5 space-y-5">
                  <div>
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-0.5 flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-primary" /> Ranking Point Rules
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Changes are saved to the database and applied to all future matches.
                    </p>
                  </div>

                  {/* Base result points */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Base Result Points</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { key: "win_points",  label: "Win",  color: "text-success" },
                        { key: "draw_points", label: "Draw", color: "text-warning" },
                        { key: "loss_points", label: "Loss", color: "text-destructive" },
                      ].map(({ key, label, color }) => (
                        <div key={key}>
                          <label className={cn("text-xs font-semibold mb-1 block", color)}>{label}</label>
                          <Input type="number" min={0} value={rankingConfig[key] ?? ""}
                            onChange={e => setRankingConfig(c => ({ ...c, [key]: e.target.value }))}
                            className="bg-secondary border-border text-xs h-8" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Opponent strength */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Opponent Strength Multipliers</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { key: "opp_top10",  label: "vs Top 10%" },
                        { key: "opp_top25",  label: "vs Top 25%" },
                        { key: "opp_top50",  label: "vs Top 50%" },
                        { key: "opp_bot50",  label: "vs Bottom 50%" },
                        { key: "opp_bot25",  label: "vs Bottom 25%" },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
                          <Input type="number" min={0} step={0.1} value={rankingConfig[key] ?? ""}
                            onChange={e => setRankingConfig(c => ({ ...c, [key]: e.target.value }))}
                            className="bg-secondary border-border text-xs h-8" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Competition level */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Competition Level Multipliers</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { key: "comp_regional_div2", label: "Regional Div 2" },
                        { key: "comp_regional_div1", label: "Regional Div 1" },
                        { key: "comp_challenger",    label: "Challenger" },
                        { key: "comp_elite",         label: "Elite" },
                        { key: "comp_supreme",       label: "Supreme" },
                        { key: "comp_tournament",    label: "Open Tournament" },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
                          <Input type="number" min={0} step={0.1} value={rankingConfig[key] ?? ""}
                            onChange={e => setRankingConfig(c => ({ ...c, [key]: e.target.value }))}
                            className="bg-secondary border-border text-xs h-8" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Stage / round multipliers */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tournament Stage Multipliers</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { key: "stage_group",   label: "Group / League Phase" },
                        { key: "stage_playoff", label: "Playoff Round" },
                        { key: "stage_r16",     label: "Round of 16" },
                        { key: "stage_qf",      label: "Quarter-final" },
                        { key: "stage_sf",      label: "Semi-final" },
                        { key: "stage_final",   label: "Final" },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
                          <Input type="number" min={0} step={0.1} value={rankingConfig[key] ?? ""}
                            onChange={e => setRankingConfig(c => ({ ...c, [key]: e.target.value }))}
                            className="bg-secondary border-border text-xs h-8" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-1 border-t border-border">
                    <Input
                      value={rankingConfig.label || ""}
                      onChange={e => setRankingConfig(c => ({ ...c, label: e.target.value }))}
                      placeholder="Config label (e.g. Season 1 Rules)"
                      className="bg-secondary border-border text-xs h-8 max-w-[200px]"
                    />
                    <Button size="sm" onClick={saveRankingConfig} disabled={savingConfig}
                      className="bg-primary text-primary-foreground h-8 text-xs gap-1.5">
                      {savingConfig ? <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin inline-block" /> : <Check className="w-3.5 h-3.5" />}
                      {savingConfig ? "Saving…" : "Save Config"}
                    </Button>
                  </div>
                </div>
              )}

            </div>
          </TabsContent>

          {/* ── Leagues / Competitions ──────────────────────── */}
          <TabsContent value="leagues">
            <div className="max-w-3xl space-y-6">

              {/* STAGE Competitions — editable rules */}
              <div className="bg-card border border-border rounded p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-base uppercase tracking-tight text-foreground">STAGE Competitions</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">3 permanent competitions. Click Edit Rules to adjust spots, club limits and playoff format.</p>
                  </div>
                  <Button onClick={seedCompetitions} disabled={seedingComps || competitions.length >= 3} className="bg-primary text-primary-foreground h-8 text-xs rounded gap-1.5">
                    {seedingComps ? "Seeding..." : competitions.length >= 3 ? "✓ Seeded" : "Seed Competitions"}
                  </Button>
                </div>
                <div className="space-y-3">
                  {[{slug:"supreme",color:"#FFD700"},{slug:"elite",color:"#00E5BD"},{slug:"challenger",color:"#A78BFA"}].map(t => {
                    const comp = competitions.find(c => c.slug === t.slug);
                    if (!comp) return (
                      <div key={t.slug} className="border border-dashed border-border rounded p-3 opacity-40">
                        <p className="text-xs text-muted-foreground capitalize">{t.slug} — not seeded</p>
                      </div>
                    );
                    const seasons = compSeasons.filter(s => s.competition_id === comp.id);
                    const isEditing = editingComp === comp.id;
                    return (
                      <div key={t.slug} className="border border-border rounded p-3 space-y-2" style={{ borderLeftColor: t.color, borderLeftWidth: 2 }}>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <p className="text-xs font-bold text-foreground">{comp.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Tier {comp.tier} · {seasons.length} season{seasons.length !== 1 ? "s" : ""} · Max {comp.max_clubs_per_season || 16} clubs · {comp.qualification_spots_per_region || 2} spots/region
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              ↑ {comp.promotion_spots || 0} promoted · ↓ {comp.relegation_spots || 0} relegated · {comp.playoff_spots || 4} playoff spots
                            </p>
                          </div>
                          <Button size="sm" variant="outline"
                            className={cn("h-7 text-xs rounded gap-1.5 shrink-0", isEditing ? "border-destructive/30 text-destructive" : "border-border text-muted-foreground hover:text-foreground")}
                            onClick={() => {
                              if (isEditing) { setEditingComp(null); }
                              else { setEditingComp(comp.id); setCompEditForm({ max_clubs_per_season: comp.max_clubs_per_season ?? 16, qualification_spots_per_region: comp.qualification_spots_per_region ?? 2, promotion_spots: comp.promotion_spots ?? 0, relegation_spots: comp.relegation_spots ?? 0, playoff_spots: comp.playoff_spots ?? 4, trophy_image_url: comp.trophy_image_url || "" }); }
                            }}>
                            {isEditing ? <X className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                            {isEditing ? "Cancel" : "Edit Rules"}
                          </Button>
                        </div>
                        {isEditing && (
                          <div className="pt-2 border-t border-border/50 space-y-3">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {[
                                { key: "max_clubs_per_season",           label: "Max Clubs/Season" },
                                { key: "qualification_spots_per_region", label: "Qual. Spots/Region" },
                                { key: "promotion_spots",                label: "Promotion Spots" },
                                { key: "relegation_spots",               label: "Relegation Spots" },
                                { key: "playoff_spots",                  label: "Playoff Spots" },
                              ].map(({ key, label }) => (
                                <div key={key}>
                                  <label className="text-[10px] text-muted-foreground mb-1 block">{label}</label>
                                  <Input type="number" min={0} value={compEditForm[key] ?? ""}
                                    onChange={e => setCompEditForm(f => ({ ...f, [key]: e.target.value }))}
                                    className="bg-secondary border-border text-xs h-8" />
                                </div>
                              ))}
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground mb-1 block">Trophy Image URL</label>
                              <Input value={compEditForm.trophy_image_url ?? ""}
                                onChange={e => setCompEditForm(f => ({ ...f, trophy_image_url: e.target.value }))}
                                placeholder="https://… trophy PNG"
                                className="bg-secondary border-border text-xs h-8" />
                            </div>
                            <Button size="sm" onClick={saveCompRules} disabled={savingComp}
                              className="bg-primary text-primary-foreground h-8 text-xs gap-1.5">
                              {savingComp ? <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin inline-block" /> : <Check className="w-3.5 h-3.5" />}
                              {savingComp ? "Saving…" : "Save Rules"}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Start New Season */}
              {competitions.length > 0 && (
                <div className="bg-card border border-border rounded p-5 space-y-4">
                  <h3 className="font-heading text-base uppercase tracking-tight text-foreground">Start New Season</h3>
                  <div>
                    <label className="label-xs">Competition</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {competitions.map(c => (
                        <button key={c.id} type="button"
                          onClick={() => setNewSeasonForm(f => ({ ...f, competition_id: c.id }))}
                          className={cn("rounded border px-3 py-2 text-left text-xs font-bold transition-all",
                            newSeasonForm.competition_id === c.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                          )}>
                          {c.name.replace("STAGE ", "")}
                          <span className="block text-[9px] font-normal mt-0.5 opacity-60">
                            Season {compSeasons.filter(s => s.competition_id === c.id).length > 0
                              ? Math.max(...compSeasons.filter(s => s.competition_id === c.id).map(s => s.season_number)) + 1
                              : 1} next
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-xs">Platform</label>
                      <select value={newSeasonForm.platform} onChange={e => setNewSeasonForm(f => ({ ...f, platform: e.target.value }))}
                        className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50">
                        {["Cross-Platform","PlayStation","Xbox","PC"].map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label-xs">Region</label>
                      <select value={newSeasonForm.region} onChange={e => setNewSeasonForm(f => ({ ...f, region: e.target.value }))}
                        className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50">
                        {["Global","Europe","North America"].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label-xs">Prize Pool (STC) — optional</label>
                    <input type="number" min="0" value={newSeasonForm.prize_pool_stc}
                      onChange={e => setNewSeasonForm(f => ({ ...f, prize_pool_stc: e.target.value }))}
                      className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                      placeholder="e.g. 5000000" />
                  </div>
                  <Button onClick={createCompetitionSeason} disabled={creatingLeagueSeason || !newSeasonForm.competition_id}
                    className="w-full bg-primary text-primary-foreground h-9 text-xs rounded font-bold gap-2">
                    {creatingLeagueSeason ? "Creating..." : "Create Season"}
                  </Button>
                </div>
              )}

              {/* ── Registration Applications ── */}
              <div>
                {(() => {
                  const actionable = regApplications.filter(r => r.status === "pending" || r.status === "waitlisted");
                  const displayApps = regAppFilter === "actionable" ? actionable : regApplications;
                  const pendingCount = regApplications.filter(r => r.status === "pending").length;
                  const waitlistCount = regApplications.filter(r => r.status === "waitlisted").length;
                  return (
                    <>
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <h3 className="font-heading text-base uppercase tracking-tight text-foreground">
                          Registration Applications
                          {actionable.length > 0 && (
                            <span className="ml-2 text-[10px] text-warning border border-warning/30 bg-warning/5 px-1.5 py-0.5 rounded font-bold">
                              {actionable.length}
                            </span>
                          )}
                        </h3>
                        <div className="flex gap-1">
                          {[["actionable","Needs Action"],["all","All"]].map(([v, label]) => (
                            <button key={v} onClick={() => setRegAppFilter(v)}
                              className={cn("text-[10px] px-2 py-1 rounded border font-bold uppercase tracking-wider transition-colors",
                                regAppFilter === v
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "border-border text-muted-foreground hover:text-foreground")}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {pendingCount > 0 || waitlistCount > 0 ? (
                        <p className="text-[10px] text-muted-foreground mb-3">
                          {pendingCount > 0 && `${pendingCount} pending`}
                          {pendingCount > 0 && waitlistCount > 0 && " · "}
                          {waitlistCount > 0 && `${waitlistCount} waitlisted`}
                        </p>
                      ) : null}
                      {displayApps.length === 0 ? (
                        <div className="border border-dashed border-border rounded p-8 text-center">
                          <p className="text-xs text-muted-foreground uppercase tracking-widest">
                            {regAppFilter === "actionable" ? "No applications need action" : "No registration applications yet"}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {displayApps.map(reg => {
                            const statusCls = {
                              pending:    "text-warning border-warning/30 bg-warning/5",
                              approved:   "text-success border-success/30 bg-success/5",
                              rejected:   "text-destructive border-destructive/30 bg-destructive/5",
                              waitlisted: "text-muted-foreground border-border bg-secondary",
                            }[reg.status] || "text-muted-foreground border-border";
                            // Open leagues in the same region for approve target
                            const candidateLeagues = regionalLeagues.filter(
                              l => l.region_slug === reg.region_slug
                                && l.status === "registration"
                                && (l.platform === reg.platform || l.platform === "Cross-Platform" || reg.platform === "Cross-Platform")
                            ).sort((a, b) => (a.division || 1) - (b.division || 1));
                            return (
                              <div key={reg.id} className="bg-card border border-border rounded p-3">
                                <div className="flex items-center gap-3">
                                  {reg.club_logo_url
                                    ? <img src={reg.club_logo_url} alt={reg.club_name} className="w-8 h-8 object-contain rounded shrink-0" />
                                    : <Shield className="w-6 h-6 text-muted-foreground/30 shrink-0" />}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-foreground truncate">{reg.club_name}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                      {reg.region_name || reg.region_slug} · {reg.platform}
                                      {reg.preferred_division ? ` · Prefers Div ${reg.preferred_division}` : ""}
                                      {reg.applied_at ? ` · ${new Date(reg.applied_at).toLocaleDateString()}` : ""}
                                    </p>
                                    {reg.note_from_club && (
                                      <p className="text-[10px] text-muted-foreground italic mt-0.5">"{reg.note_from_club}"</p>
                                    )}
                                    {reg.assigned_league_name && (
                                      <p className="text-[10px] text-success mt-0.5">→ {reg.assigned_league_name}</p>
                                    )}
                                    {reg.admin_notes && (
                                      <p className="text-[10px] text-muted-foreground mt-0.5">Note: {reg.admin_notes}</p>
                                    )}
                                  </div>
                                  <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0", statusCls)}>
                                    {reg.status}
                                  </span>
                                </div>
                                {(reg.status === "pending" || reg.status === "waitlisted") && (
                                  <div className="flex gap-2 mt-2.5 pl-11">
                                    <Button size="sm"
                                      onClick={() => { setApproveRegDialog(reg); setApproveTargetId(candidateLeagues[0]?.id || ""); }}
                                      className="bg-success/20 text-success hover:bg-success/30 border-0 h-7 text-xs rounded gap-1">
                                      <Check className="w-3 h-3" />
                                      {reg.status === "waitlisted" ? "Promote" : "Approve"}
                                    </Button>
                                    <Button size="sm" variant="outline"
                                      onClick={() => { setRejectNotesDialog({ reg, action: "waitlist" }); setRejectNotes(""); }}
                                      className="border-border text-muted-foreground hover:text-foreground h-7 text-xs rounded gap-1"
                                      disabled={reg.status === "waitlisted"}>
                                      Waitlist
                                    </Button>
                                    <Button size="sm" variant="outline"
                                      onClick={() => { setRejectNotesDialog({ reg, action: "reject" }); setRejectNotes(""); }}
                                      className="border-destructive/30 text-destructive hover:bg-destructive/10 h-7 text-xs rounded gap-1">
                                      <X className="w-3 h-3" /> Reject
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Pending qualification entries */}
              <div>
                <h3 className="font-heading text-base uppercase tracking-tight text-foreground mb-3">
                  Pending Qualification Entries
                  {qualEntries.length > 0 && <span className="ml-2 text-[10px] text-primary border border-primary/30 bg-primary/5 px-1.5 py-0.5 rounded font-bold">{qualEntries.length}</span>}
                </h3>
                {qualEntries.length === 0 ? (
                  <div className="border border-dashed border-border rounded p-8 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest">No pending entries</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {qualEntries.map(e => (
                      <div key={e.id} className="bg-card border border-border rounded p-3 flex items-center gap-3">
                        {e.club_logo_url
                          ? <img src={e.club_logo_url} alt={e.club_name} className="w-8 h-8 object-contain shrink-0" />
                          : <Shield className="w-6 h-6 text-muted-foreground/30 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{e.club_name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {e.regional_league_name || e.source_type} · Pos. {e.regional_finish_position || "—"} → {e.target_competition_name}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" onClick={() => confirmQualEntry(e)} className="bg-success/20 text-success hover:bg-success/30 border-0 h-7 text-xs rounded gap-1">
                            <Check className="w-3 h-3" /> Confirm
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => rejectQualEntry(e)} className="border-destructive/30 text-destructive hover:bg-destructive/10 h-7 text-xs rounded gap-1">
                            <X className="w-3 h-3" /> Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* All Seasons */}
              {compSeasons.length > 0 && (
                <div>
                  <h3 className="font-heading text-base uppercase tracking-tight text-foreground mb-3">All Seasons</h3>
                  <div className="space-y-2">
                    {compSeasons.map(s => (
                      <SeasonCard key={s.id} season={s} onRefresh={loadAll} />
                    ))}
                  </div>
                </div>
              )}

              {/* Fixtures & Results — accordion */}
              <div className="bg-card border border-border rounded overflow-hidden">
                <button className="w-full flex items-center justify-between px-5 py-4 text-left"
                  onClick={() => setFixturesOpen(v => !v)}>
                  <h3 className="font-heading text-base uppercase tracking-tight text-foreground">Fixtures & Results</h3>
                  <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", fixturesOpen && "rotate-180")} />
                </button>
                {fixturesOpen && (
                  <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Competition Season</label>
                        <select value={selectedFixtureSeason} onChange={e => setSelectedFixtureSeason(e.target.value)}
                          className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50">
                          <option value="">— Select season —</option>
                          {compSeasons.map(s => (
                            <option key={s.id} value={s.id}>{s.competition_name} — {s.season_label || `S${s.season_number}`} ({s.status})</option>
                          ))}
                        </select>
                        <Button size="sm" disabled={!selectedFixtureSeason || loadingFixtures}
                          onClick={() => { const s = compSeasons.find(x => x.id === selectedFixtureSeason); if (s) loadFixturesForPanel({ type: "competition", id: s.id, name: `${s.competition_name} ${s.season_label || ""}` }); }}
                          className="h-7 text-xs bg-primary text-primary-foreground rounded gap-1.5">
                          {loadingFixtures && fixturesPanel?.type === "competition" ? "Loading…" : "Load Fixtures"}
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Regional League</label>
                        <select value={selectedFixtureLeague} onChange={e => setSelectedFixtureLeague(e.target.value)}
                          className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50">
                          <option value="">— Select league —</option>
                          {regionalLeagues.map(l => (
                            <option key={l.id} value={l.id}>{l.name} (D{l.division || 1} · S{l.season_number})</option>
                          ))}
                        </select>
                        <Button size="sm" disabled={!selectedFixtureLeague || loadingFixtures}
                          onClick={() => { const l = regionalLeagues.find(x => x.id === selectedFixtureLeague); if (l) loadFixturesForPanel({ type: "league", id: l.id, name: l.name }); }}
                          className="h-7 text-xs bg-primary text-primary-foreground rounded gap-1.5">
                          {loadingFixtures && fixturesPanel?.type === "league" ? "Loading…" : "Load Fixtures"}
                        </Button>
                      </div>
                    </div>
                    {fixturesPanel && (
                      <div>
                        <p className="text-xs font-bold text-foreground mb-2">
                          {fixturesPanel.name}
                          <span className="ml-2 text-[10px] text-muted-foreground font-normal">({fixturesList.length} fixtures)</span>
                        </p>
                        {loadingFixtures ? (
                          <div className="flex justify-center py-6"><div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
                        ) : fixturesList.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-4 text-center">No fixtures found. Generate fixtures first via the season card above.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                            {fixturesList.map(f => (
                              <div key={f.id} className="border border-border rounded p-2.5 flex items-center gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-foreground truncate">
                                    {f.home_club_name} <span className="text-muted-foreground text-[10px]">vs</span> {f.away_club_name}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {f.matchday ? `MD ${f.matchday}` : f.phase || "—"} · {f.status || "scheduled"}
                                  </p>
                                </div>
                                {(f.status === "completed" || f.stats_processed) ? (
                                  <span className="text-xs font-bold text-success shrink-0">{f.home_score ?? "?"} – {f.away_score ?? "?"}</span>
                                ) : (
                                  <Button size="sm" variant="outline"
                                    onClick={() => { setResultDialog({ fixture: f, fixtureType: fixturesPanel.type === "competition" ? "competition" : "league" }); setResultForm({ home_score: "", away_score: "" }); }}
                                    className="h-6 text-[10px] rounded border-primary/30 text-primary hover:bg-primary/10 shrink-0">
                                    Enter Result
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Standings — accordion */}
              <div className="bg-card border border-border rounded overflow-hidden">
                <button className="w-full flex items-center justify-between px-5 py-4 text-left"
                  onClick={() => setStandingsOpen(v => !v)}>
                  <h3 className="font-heading text-base uppercase tracking-tight text-foreground">Standings</h3>
                  <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", standingsOpen && "rotate-180")} />
                </button>
                {standingsOpen && (
                  <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Competition Season</label>
                        <select value={selectedStandingsSeason} onChange={e => setSelectedStandingsSeason(e.target.value)}
                          className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50">
                          <option value="">— Select season —</option>
                          {compSeasons.map(s => <option key={s.id} value={s.id}>{s.competition_name} — {s.season_label || `S${s.season_number}`}</option>)}
                        </select>
                        <Button size="sm" disabled={!selectedStandingsSeason || loadingStandings}
                          onClick={() => { const s = compSeasons.find(x => x.id === selectedStandingsSeason); if (s) loadStandingsForPanel({ type: "competition", id: s.id, name: `${s.competition_name} ${s.season_label || ""}` }); }}
                          className="h-7 text-xs bg-primary text-primary-foreground rounded gap-1.5">
                          {loadingStandings && standingsPanel?.type === "competition" ? "Loading…" : "Load Standings"}
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Regional League</label>
                        <select value={selectedStandingsLeague} onChange={e => setSelectedStandingsLeague(e.target.value)}
                          className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50">
                          <option value="">— Select league —</option>
                          {regionalLeagues.map(l => <option key={l.id} value={l.id}>{l.name} (D{l.division || 1} · S{l.season_number})</option>)}
                        </select>
                        <Button size="sm" disabled={!selectedStandingsLeague || loadingStandings}
                          onClick={() => { const l = regionalLeagues.find(x => x.id === selectedStandingsLeague); if (l) loadStandingsForPanel({ type: "league", id: l.id, name: l.name }); }}
                          className="h-7 text-xs bg-primary text-primary-foreground rounded gap-1.5">
                          {loadingStandings && standingsPanel?.type === "league" ? "Loading…" : "Load Standings"}
                        </Button>
                      </div>
                    </div>
                    {standingsPanel && (
                      <div>
                        <p className="text-xs font-bold text-foreground mb-2">{standingsPanel.name}</p>
                        {loadingStandings ? (
                          <div className="flex justify-center py-6"><div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
                        ) : standingsList.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-4 text-center">No standings found. Confirm clubs and generate fixtures first.</p>
                        ) : (
                          <div className="border border-border rounded overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-border bg-secondary/50">
                                  <th className="px-2 py-2 text-left text-[10px] text-muted-foreground uppercase w-8">#</th>
                                  <th className="px-2 py-2 text-left text-[10px] text-muted-foreground uppercase">Club</th>
                                  <th className="px-2 py-2 text-center text-[10px] text-muted-foreground uppercase w-8">P</th>
                                  <th className="px-2 py-2 text-center text-[10px] text-success uppercase w-8">W</th>
                                  <th className="px-2 py-2 text-center text-[10px] text-muted-foreground uppercase w-8">D</th>
                                  <th className="px-2 py-2 text-center text-[10px] text-destructive uppercase w-8">L</th>
                                  <th className="px-2 py-2 text-center text-[10px] text-muted-foreground uppercase w-10">GD</th>
                                  <th className="px-2 py-2 text-center text-[10px] text-foreground font-bold uppercase w-10">Pts</th>
                                </tr>
                              </thead>
                              <tbody>
                                {standingsList.map((s, i) => (
                                  <tr key={s.id} className={cn("border-b border-border/40", i % 2 === 0 ? "" : "bg-secondary/20")}>
                                    <td className="px-2 py-2 text-center text-muted-foreground font-bold">{s.position || i + 1}</td>
                                    <td className="px-2 py-2 font-medium text-foreground truncate max-w-[110px]">{s.club_name}</td>
                                    <td className="px-2 py-2 text-center text-muted-foreground">{s.played || 0}</td>
                                    <td className="px-2 py-2 text-center text-success">{s.wins || 0}</td>
                                    <td className="px-2 py-2 text-center text-muted-foreground">{s.draws || 0}</td>
                                    <td className="px-2 py-2 text-center text-destructive">{s.losses || 0}</td>
                                    <td className="px-2 py-2 text-center text-muted-foreground">{(s.goal_difference || 0) > 0 ? `+${s.goal_difference}` : (s.goal_difference || 0)}</td>
                                    <td className="px-2 py-2 text-center font-bold text-foreground">{s.points || 0}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Regional Leagues — editable rules */}
              <div className="bg-card border border-border rounded p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-base uppercase tracking-tight text-foreground">Regional Leagues</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{REGIONS.length} regions · 2 divisions each. Click the edit icon to change max clubs or promoted slots.</p>
                  </div>
                  <Button onClick={seedRegionalLeagues}
                    disabled={seedingRegionalLeagues || regionalLeagues.length >= LEAGUE_DEFINITIONS.length}
                    className="bg-primary text-primary-foreground h-8 text-xs rounded gap-1.5 shrink-0">
                    {seedingRegionalLeagues ? "Seeding..." : regionalLeagues.length >= LEAGUE_DEFINITIONS.length ? "✓ Seeded" : "Seed All Leagues"}
                  </Button>
                </div>

                {regionalLeagues.length > 0 && (
                  <div className="space-y-4">
                    {REGIONS.map(region => {
                      const div1 = regionalLeagues.find(l => l.region_slug === region.slug && (l.division || 1) === 1);
                      const div2 = regionalLeagues.find(l => l.region_slug === region.slug && l.division === 2);
                      if (!div1 && !div2) return null;
                      return (
                        <div key={region.slug}>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">{region.name}</p>
                          <div className="space-y-1.5">
                            {[div1, div2].filter(Boolean).map(league => {
                              const isEditingL = editingLeague === league.id;
                              return (
                                <div key={league.id} className="border border-border rounded p-3 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider shrink-0">D{league.division || 1}</span>
                                        <p className="text-sm font-bold text-foreground truncate">{league.name}</p>
                                      </div>
                                      <p className="text-[10px] text-muted-foreground mt-0.5">
                                        Season {league.season_number} · {league.num_clubs || 0}/{league.max_clubs || 16} clubs · {league.promoted_slots || 2} promoted
                                      </p>
                                    </div>
                                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0",
                                      league.status === "in_progress" ? "text-success border-success/30 bg-success/5" :
                                      league.status === "registration" ? "text-primary border-primary/30 bg-primary/5" :
                                      league.status === "completed" ? "text-muted-foreground border-border" :
                                      "text-warning border-warning/30 bg-warning/5"
                                    )}>{league.status.replace("_", " ")}</span>
                                    <Button size="sm" variant="outline"
                                      className={cn("h-7 w-7 p-0 rounded shrink-0", isEditingL ? "border-destructive/30 text-destructive" : "border-border text-muted-foreground hover:text-foreground")}
                                      onClick={() => {
                                        if (isEditingL) { setEditingLeague(null); }
                                        else { setEditingLeague(league.id); setLeagueEditForm({ max_clubs: league.max_clubs ?? 16, promoted_slots: league.promoted_slots ?? 2, trophy_image_url: league.trophy_image_url || "" }); }
                                      }}>
                                      {isEditingL ? <X className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                                    </Button>
                                    <Link to={`/leagues/${league.slug}`}>
                                      <Button size="sm" variant="outline" className="h-7 text-xs rounded border-border text-muted-foreground hover:text-foreground shrink-0">View</Button>
                                    </Link>
                                    {league.status === "draft" && (
                                      <Button size="sm" onClick={() => leagueLifecycleAction(league, "open_registration")}
                                        className="h-7 text-xs rounded bg-primary text-primary-foreground shrink-0">
                                        Open Registration
                                      </Button>
                                    )}
                                    {league.status === "in_progress" && (
                                      <Button size="sm" variant="outline" disabled={processingLeagueEnd === league.id}
                                        onClick={() => processLeagueEnd(league)}
                                        className="h-7 text-xs rounded border-warning/40 text-warning hover:bg-warning/10 shrink-0">
                                        {processingLeagueEnd === league.id ? "Processing..." : "End Season"}
                                      </Button>
                                    )}
                                    {league.status === "completed" && (
                                      <>
                                        <Button size="sm" variant="outline" onClick={() => leagueLifecycleAction(league, "archive")}
                                          className="h-7 text-xs rounded border-muted-foreground/30 text-muted-foreground hover:text-foreground shrink-0">
                                          Archive
                                        </Button>
                                        <Button size="sm" onClick={() => leagueLifecycleAction(league, "create_next")}
                                          className="h-7 text-xs rounded bg-success/20 text-success hover:bg-success/30 border-0 shrink-0">
                                          New Season
                                        </Button>
                                      </>
                                    )}
                                    {league.status === "archived" && (
                                      <Button size="sm" onClick={() => leagueLifecycleAction(league, "create_next")}
                                        className="h-7 text-xs rounded bg-success/20 text-success hover:bg-success/30 border-0 shrink-0">
                                        New Season
                                      </Button>
                                    )}
                                  </div>
                                  {isEditingL && (
                                    <div className="pt-2 border-t border-border/50 space-y-3">
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <label className="text-[10px] text-muted-foreground mb-1 block">Max Clubs</label>
                                          <Input type="number" min={1} value={leagueEditForm.max_clubs ?? ""}
                                            onChange={e => setLeagueEditForm(f => ({ ...f, max_clubs: e.target.value }))}
                                            className="bg-secondary border-border text-xs h-8" />
                                        </div>
                                        <div>
                                          <label className="text-[10px] text-muted-foreground mb-1 block">Promoted Slots</label>
                                          <Input type="number" min={0} value={leagueEditForm.promoted_slots ?? ""}
                                            onChange={e => setLeagueEditForm(f => ({ ...f, promoted_slots: e.target.value }))}
                                            className="bg-secondary border-border text-xs h-8" />
                                        </div>
                                      </div>
                                      <div className="col-span-2">
                                        <label className="text-[10px] text-muted-foreground mb-1 block">Trophy Image URL</label>
                                        <Input value={leagueEditForm.trophy_image_url ?? ""}
                                          onChange={e => setLeagueEditForm(f => ({ ...f, trophy_image_url: e.target.value }))}
                                          placeholder="https://… trophy PNG"
                                          className="bg-secondary border-border text-xs h-8" />
                                      </div>
                                      <Button size="sm" onClick={saveLeagueRules} disabled={savingLeague}
                                        className="bg-primary text-primary-foreground h-8 text-xs gap-1.5">
                                        {savingLeague ? <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin inline-block" /> : <Check className="w-3.5 h-3.5" />}
                                        {savingLeague ? "Saving…" : "Save Rules"}
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Qualification info — live from competition records */}
                <div className="bg-muted/20 border border-border/40 rounded p-3 space-y-1">
                  <p className="text-[10px] font-bold text-foreground uppercase tracking-wider">Division 1 qualification (live from competition rules)</p>
                  {competitions.length > 0 ? (
                    [{slug:"supreme",label:"STAGE Supreme"},{slug:"elite",label:"STAGE Elite"},{slug:"challenger",label:"STAGE Challenger"}].map(({ slug, label }) => {
                      const comp = competitions.find(c => c.slug === slug);
                      return comp ? (
                        <p key={slug} className="text-[10px] text-muted-foreground">
                          {label}: <strong className="text-foreground">{comp.qualification_spots_per_region || 2}</strong> spot{(comp.qualification_spots_per_region || 2) !== 1 ? "s" : ""}/region
                        </p>
                      ) : null;
                    })
                  ) : (
                    <p className="text-[10px] text-muted-foreground">Seed competitions first to see qualification rules here.</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Promotion/relegation spots are editable per league row above. Edit competition rules to adjust qualification spots.
                  </p>
                </div>
              </div>

              {/* Scheduling — expired fixtures */}
              {expiredFixtures.length > 0 && (
                <div className="bg-card border border-destructive/30 rounded p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <h3 className="font-heading text-base uppercase tracking-tight text-foreground">
                      Scheduling Disputes ({expiredFixtures.length})
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    These fixtures expired without both teams agreeing on a time. Resolve each one below.
                  </p>
                  <div className="space-y-2">
                    {expiredFixtures.map(f => (
                      <ExpiredFixtureRow key={f.id} fixture={f} onResolved={loadAll} busy={schedulingAdminBusy} setBusy={setSchedulingAdminBusy} />
                    ))}
                  </div>
                </div>
              )}

            </div>
          </TabsContent>

          {/* Tournaments */}
          <TabsContent value="tournaments">
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
                      <Button size="sm" variant="outline" onClick={() => cancelTournament(t.id)} className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs gap-1"><X className="w-3.5 h-3.5" /> Cancel</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Post News */}
          <TabsContent value="news">
            <div className="bg-card border border-border rounded p-6 max-w-2xl space-y-4">
              <h3 className="font-heading text-lg uppercase tracking-tight text-foreground flex items-center gap-2"><Newspaper className="w-4 h-4 text-primary" /> Post News</h3>
              <div>
                <label className="label-xs">Category</label>
                <Select value={newsForm.type} onValueChange={v => setNewsForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="app_update">App Update</SelectItem>
                    <SelectItem value="announcement">Announcement</SelectItem>
                    <SelectItem value="tournament">Tournament</SelectItem>
                    <SelectItem value="achievement">Achievement</SelectItem>
                    <SelectItem value="ranking">Rankings</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="label-xs">Title</label>
                <input value={newsForm.title} onChange={e => setNewsForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                  placeholder="News headline..." />
              </div>
              <div>
                <label className="label-xs">Body</label>
                <Textarea value={newsForm.body} onChange={e => setNewsForm(f => ({ ...f, body: e.target.value }))}
                  className="bg-secondary border-border min-h-[80px]" placeholder="News body text..." />
              </div>
              <div>
                <label className="label-xs">Image (optional)</label>
                <input type="file" accept="image/*" onChange={e => setNewsImageFile(e.target.files[0])} className="text-xs text-muted-foreground" />
                {newsImageFile && <p className="text-xs text-primary mt-1">Selected: {newsImageFile.name}</p>}
              </div>
              <Button onClick={postNews} disabled={!newsForm.title || uploadingNews} className="bg-primary text-primary-foreground gap-2">
                <Upload className="w-4 h-4" /> {uploadingNews ? "Posting..." : "Post News"}
              </Button>
            </div>
          </TabsContent>

          {/* Press conferences */}
          <TabsContent value="press-conferences">
            <div className="bg-card border border-border rounded p-5 space-y-3">
              <h3 className="font-heading text-lg uppercase tracking-tight text-foreground">Press Conferences</h3>
              {pressConferences.length === 0 ? (
                <EmptyState icon={Newspaper} text="No press conferences found." />
              ) : (
                <div className="space-y-2">
                  {pressConferences.map((pc) => (
                    <div key={pc.id} className="border border-border rounded px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground truncate">{pc.id}</span>
                        <span className="text-xs text-muted-foreground uppercase">{pc.status || "pending"}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        match: {pc.match_id || "n/a"} · club: {pc.club_id || "n/a"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Lifestyle Assets Admin */}
          <TabsContent value="lifestyles">
            <div className="space-y-4">
              {/* Header row */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-heading text-lg uppercase tracking-tight text-foreground">Lifestyle Assets</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={reseedLifestyle} disabled={saving}
                    className="border-border text-muted-foreground hover:text-foreground text-xs h-8 gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" /> Reseed Defaults
                  </Button>
                  <Button size="sm" onClick={openAddAsset}
                    className="bg-primary text-primary-foreground text-xs h-8 gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Add Asset
                  </Button>
                </div>
              </div>

              {/* Asset list */}
              {lifestyleItems.length === 0 ? (
                <EmptyState icon={Building2} text="No lifestyle assets found. Add one or reseed defaults." />
              ) : (
                <div className="space-y-2">
                  {lifestyleItems.map(item => (
                    <div key={item.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                      {/* Image thumbnail */}
                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-secondary">
                        {item.image_url
                          ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-xl">{item.category === 'houses' ? '🏠' : item.category === 'cars' ? '🚗' : item.category === 'watches' ? '⌚' : item.category === 'fashion' ? '👔' : item.category === 'vip_experiences' ? '🌟' : '💼'}</div>}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground text-sm truncate">{item.name}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground capitalize">{item.category}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground capitalize">{item.tier}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap text-[11px] text-muted-foreground">
                          {item.price_stc > 0 && <span>Buy: {Number(item.price_stc).toLocaleString()}</span>}
                          {item.can_rent && item.rent_price_stc > 0 && <span>Rent: {Number(item.rent_price_stc).toLocaleString()}</span>}
                          {item.can_invest && item.invest_price_stc > 0 && <span>Invest: {Number(item.invest_return_rate)}% in {item.invest_duration_days}d</span>}
                        </div>
                      </div>
                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => toggleLifestyleAsset(item)}
                          className={cn("text-[10px] px-2 py-1 rounded border uppercase font-bold transition-colors",
                            item.is_active ? "text-success border-success/30 bg-success/10 hover:bg-success/20" : "text-muted-foreground border-border bg-secondary hover:text-foreground")}>
                          {item.is_active ? 'Active' : 'Inactive'}
                        </button>
                        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1.5" onClick={() => openEditAsset(item)}>
                          <Pencil className="w-3 h-3" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => deleteLifestyleAsset(item)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add/Edit Asset Dialog */}
            <Dialog open={!!lifestyleDialog} onOpenChange={v => !v && setLifestyleDialog(null)}>
              <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-heading uppercase tracking-tight">
                    {lifestyleDialog === 'add' ? 'Add New Asset' : `Edit: ${lifestyleForm.name}`}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  {/* Basic info */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground uppercase tracking-wider">Asset Name *</label>
                      <Input value={lifestyleForm.name || ''} onChange={e => setLifestyleForm(p => ({ ...p, name: e.target.value }))}
                        className="bg-secondary border-border mt-1" placeholder="e.g. Luxury Villa" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground uppercase tracking-wider">Category</label>
                      <select value={lifestyleForm.category || 'houses'}
                        onChange={e => setLifestyleForm(p => ({ ...p, category: e.target.value }))}
                        className="w-full mt-1 h-9 rounded-md border border-border bg-secondary text-foreground text-sm px-2">
                        {[
                          ['houses','Houses & Apartments'],['cars','Cars'],['watches','Watches'],
                          ['fashion','Fashion'],['vip_experiences','VIP Experiences'],['personal_services','Personal Services'],
                        ].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground uppercase tracking-wider">Tier</label>
                      <select value={lifestyleForm.tier || 'standard'}
                        onChange={e => setLifestyleForm(p => ({ ...p, tier: e.target.value }))}
                        className="w-full mt-1 h-9 rounded-md border border-border bg-secondary text-foreground text-sm px-2">
                        {['standard','mid','premium','luxury','elite','legendary'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground uppercase tracking-wider">Description</label>
                      <Textarea value={lifestyleForm.description || ''} onChange={e => setLifestyleForm(p => ({ ...p, description: e.target.value }))}
                        className="bg-secondary border-border mt-1 text-sm" rows={2} placeholder="Short description" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground uppercase tracking-wider">Image</label>
                      <div className="flex gap-2 mt-1">
                        <Input value={lifestyleForm.image_url || ''} onChange={e => setLifestyleForm(p => ({ ...p, image_url: e.target.value }))}
                          className="bg-secondary border-border text-xs" placeholder="https://..." />
                        <label className="shrink-0 cursor-pointer">
                          <input type="file" accept="image/*" className="hidden" onChange={e => {
                            const f = e.target.files[0]; if (!f) return;
                            setLifestyleImageFile(f);
                            setLifestyleForm(prev => ({ ...prev, _imgPreview: URL.createObjectURL(f) }));
                          }} />
                          <div className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border bg-secondary text-xs text-muted-foreground hover:text-foreground cursor-pointer h-9">
                            <Upload className="w-3 h-3" /> Upload
                          </div>
                        </label>
                      </div>
                      {(lifestyleForm._imgPreview || lifestyleForm.image_url) && (
                        <img src={lifestyleForm._imgPreview || lifestyleForm.image_url} alt="preview"
                          className="mt-2 h-24 rounded-lg object-cover border border-border" />
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground uppercase tracking-wider">Sort Order</label>
                      <Input type="number" value={lifestyleForm.sort_order ?? 0} onChange={e => setLifestyleForm(p => ({ ...p, sort_order: Number(e.target.value) }))}
                        className="bg-secondary border-border mt-1" />
                    </div>
                  </div>

                  {/* Pricing section */}
                  <div className="border border-border rounded-lg p-3 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-foreground">Pricing & Options</p>
                    {/* Buy */}
                    <div className="flex items-center gap-3">
                      <input type="checkbox" id="can_buy" checked={!!lifestyleForm.can_buy}
                        onChange={e => setLifestyleForm(p => ({ ...p, can_buy: e.target.checked }))} className="rounded" />
                      <label htmlFor="can_buy" className="text-xs text-foreground">Can Buy</label>
                      {lifestyleForm.can_buy && (
                        <Input type="number" value={lifestyleForm.price_stc ?? 0}
                          onChange={e => setLifestyleForm(p => ({ ...p, price_stc: Number(e.target.value) }))}
                          className="bg-secondary border-border text-xs h-7 ml-auto w-40" placeholder="Buy price STC" />
                      )}
                    </div>
                    {/* Sell */}
                    <div className="flex items-center gap-3">
                      <input type="checkbox" id="can_sell" checked={!!lifestyleForm.can_sell}
                        onChange={e => setLifestyleForm(p => ({ ...p, can_sell: e.target.checked }))} className="rounded" />
                      <label htmlFor="can_sell" className="text-xs text-foreground">Can Sell</label>
                      {lifestyleForm.can_sell && (
                        <div className="ml-auto flex items-center gap-1.5">
                          <Input type="number" value={lifestyleForm.sell_value_percent ?? 60}
                            onChange={e => setLifestyleForm(p => ({ ...p, sell_value_percent: Number(e.target.value) }))}
                            className="bg-secondary border-border text-xs h-7 w-20" placeholder="%" />
                          <span className="text-xs text-muted-foreground">% of buy</span>
                        </div>
                      )}
                    </div>
                    {/* Rent */}
                    <div className="flex items-center gap-3">
                      <input type="checkbox" id="can_rent" checked={!!lifestyleForm.can_rent}
                        onChange={e => setLifestyleForm(p => ({ ...p, can_rent: e.target.checked }))} className="rounded" />
                      <label htmlFor="can_rent" className="text-xs text-foreground">Can Rent</label>
                      {lifestyleForm.can_rent && (
                        <div className="ml-auto flex items-center gap-1.5">
                          <Input type="number" value={lifestyleForm.rent_price_stc ?? 0}
                            onChange={e => setLifestyleForm(p => ({ ...p, rent_price_stc: Number(e.target.value) }))}
                            className="bg-secondary border-border text-xs h-7 w-32" placeholder="Rent STC" />
                          <Input type="number" value={lifestyleForm.rent_duration_days ?? 30}
                            onChange={e => setLifestyleForm(p => ({ ...p, rent_duration_days: Number(e.target.value) }))}
                            className="bg-secondary border-border text-xs h-7 w-20" placeholder="days" />
                          <span className="text-xs text-muted-foreground">days</span>
                        </div>
                      )}
                    </div>
                    {/* Invest */}
                    <div className="flex items-center gap-3">
                      <input type="checkbox" id="can_invest" checked={!!lifestyleForm.can_invest}
                        onChange={e => setLifestyleForm(p => ({ ...p, can_invest: e.target.checked }))} className="rounded" />
                      <label htmlFor="can_invest" className="text-xs text-foreground">Can Invest</label>
                      {lifestyleForm.can_invest && (
                        <div className="ml-auto flex items-center gap-1.5 flex-wrap justify-end">
                          <Input type="number" value={lifestyleForm.invest_price_stc ?? 0}
                            onChange={e => setLifestyleForm(p => ({ ...p, invest_price_stc: Number(e.target.value) }))}
                            className="bg-secondary border-border text-xs h-7 w-28" placeholder="Invest STC" />
                          <Input type="number" value={lifestyleForm.invest_return_rate ?? 0}
                            onChange={e => setLifestyleForm(p => ({ ...p, invest_return_rate: Number(e.target.value) }))}
                            className="bg-secondary border-border text-xs h-7 w-20" placeholder="Rate %" />
                          <span className="text-xs text-muted-foreground">%</span>
                          <Input type="number" value={lifestyleForm.invest_duration_days ?? 30}
                            onChange={e => setLifestyleForm(p => ({ ...p, invest_duration_days: Number(e.target.value) }))}
                            className="bg-secondary border-border text-xs h-7 w-16" placeholder="days" />
                          <span className="text-xs text-muted-foreground">days</span>
                        </div>
                      )}
                    </div>
                    {/* Passive income */}
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-foreground shrink-0">Passive Income</label>
                      <Input type="number" value={lifestyleForm.passive_income_stc ?? 0}
                        onChange={e => setLifestyleForm(p => ({ ...p, passive_income_stc: Number(e.target.value) }))}
                        className="bg-secondary border-border text-xs h-7 w-32" placeholder="STC amount" />
                      <span className="text-xs text-muted-foreground">every</span>
                      <Input type="number" value={lifestyleForm.passive_income_interval_days ?? 7}
                        onChange={e => setLifestyleForm(p => ({ ...p, passive_income_interval_days: Number(e.target.value) }))}
                        className="bg-secondary border-border text-xs h-7 w-20" placeholder="days" />
                      <span className="text-xs text-muted-foreground">days</span>
                    </div>
                    {/* Upkeep */}
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-foreground shrink-0">Weekly Upkeep</label>
                      <Input type="number" value={lifestyleForm.weekly_maintenance_stc ?? 0}
                        onChange={e => setLifestyleForm(p => ({ ...p, weekly_maintenance_stc: Number(e.target.value) }))}
                        className="bg-secondary border-border text-xs h-7 ml-auto w-32" placeholder="STC/week" />
                    </div>
                    {/* Allows multiple */}
                    <div className="flex items-center gap-3">
                      <input type="checkbox" id="allows_multiple" checked={!!lifestyleForm.allows_multiple}
                        onChange={e => setLifestyleForm(p => ({ ...p, allows_multiple: e.target.checked }))} className="rounded" />
                      <label htmlFor="allows_multiple" className="text-xs text-foreground">Allow multiple purchases per player</label>
                    </div>
                    {/* Is active */}
                    <div className="flex items-center gap-3">
                      <input type="checkbox" id="ls_is_active" checked={!!lifestyleForm.is_active}
                        onChange={e => setLifestyleForm(p => ({ ...p, is_active: e.target.checked }))} className="rounded" />
                      <label htmlFor="ls_is_active" className="text-xs text-foreground">Active (visible in store)</label>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" className="flex-1 border-border text-muted-foreground"
                      onClick={() => setLifestyleDialog(null)} disabled={lifestyleSaving}>Cancel</Button>
                    <Button className="flex-1 bg-primary text-primary-foreground font-bold gap-2"
                      onClick={saveLifestyleAsset} disabled={lifestyleSaving || !lifestyleForm.name}>
                      {lifestyleSaving
                        ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        : <Check className="w-4 h-4" />}
                      {lifestyleDialog === 'add' ? 'Create Asset' : 'Save Changes'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>


          {/* Transfer Window */}
          <TabsContent value="transfers">
            <div className="max-w-2xl">
              <h3 className="font-heading text-lg uppercase tracking-tight text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" /> Transfer Window
              </h3>
              <TransferWindowPanel />
            </div>
          </TabsContent>

          {/* ── Trophy Manager ─────────────────────────────── */}
          <TabsContent value="trophies">
            <div className="max-w-2xl space-y-6">
              <h3 className="font-heading text-lg uppercase tracking-tight text-foreground flex items-center gap-2">
                <Trophy className="w-5 h-5 text-warning" /> Trophy Library
              </h3>

              {/* Add new trophy */}
              <div className="bg-card border border-border rounded p-5 space-y-4">
                <p className="text-sm font-bold text-foreground">Add New Trophy</p>
                <div>
                  <label className="label-xs">Trophy Name</label>
                  <Input
                    value={newTrophyName}
                    onChange={e => setNewTrophyName(e.target.value)}
                    className="bg-secondary border-border"
                    placeholder="e.g. STAGE Champions Cup"
                  />
                </div>
                <div>
                  <label className="label-xs">Trophy Image (PNG)</label>
                  {newTrophyFile ? (
                    <div className="flex items-center gap-3 bg-warning/5 border border-warning/20 rounded p-3">
                      <img src={URL.createObjectURL(newTrophyFile)} alt="preview" className="w-14 h-14 object-contain drop-shadow-lg" />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-foreground">{newTrophyFile.name}</p>
                        <p className="text-[10px] text-muted-foreground">{(newTrophyFile.size / 1024).toFixed(0)} KB</p>
                      </div>
                      <button onClick={() => setNewTrophyFile(null)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => trophyFileRef.current?.click()}
                      className="w-full h-16 rounded border-2 border-dashed border-warning/30 hover:border-warning/60 flex items-center justify-center gap-2 text-warning/60 hover:text-warning transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      <span className="text-xs">Upload PNG trophy image</span>
                    </button>
                  )}
                  <input ref={trophyFileRef} type="file" accept="image/png,image/*" className="hidden"
                    onChange={e => e.target.files[0] && setNewTrophyFile(e.target.files[0])} />
                </div>
                <div className="flex items-center gap-2 px-1">
                  <input
                    id="trophy-admin-only"
                    type="checkbox"
                    checked={newTrophyAdminOnly}
                    onChange={e => setNewTrophyAdminOnly(e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-secondary text-warning focus:ring-warning"
                  />
                  <label htmlFor="trophy-admin-only" className="text-xs text-muted-foreground cursor-pointer select-none">
                    Admin-Only — only selectable for STAGE tournaments
                  </label>
                </div>
                <Button
                  onClick={createTrophyItem}
                  disabled={uploadingTrophy || !newTrophyName.trim() || !newTrophyFile}
                  className="w-full bg-warning text-black font-bold gap-2"
                >
                  <Trophy className="w-4 h-4" />
                  {uploadingTrophy ? "Uploading..." : "Add to Library"}
                </Button>
                {trophyUploadError && (
                  <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">
                    {trophyUploadError}
                  </p>
                )}

              </div>

              {/* Trophy list */}
              {trophyItems.length === 0 ? (
                <div className="border border-dashed border-border rounded p-10 text-center">
                  <Trophy className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No trophies in library yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">{trophyItems.length} trophy{trophyItems.length !== 1 ? "ies" : ""} in library</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {trophyItems.map(trophy => (
                      <div key={trophy.id} className="bg-card border border-border rounded p-3 flex flex-col items-center gap-2 relative group">
                        <button
                          onClick={() => deleteTrophyItem(trophy.id)}
                          className="absolute top-2 right-2 w-6 h-6 rounded border border-destructive/30 flex items-center justify-center text-destructive/50 hover:text-destructive hover:border-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        {trophy.image_url ? (
                          <img src={trophy.image_url} alt={trophy.name} className="w-16 h-16 object-contain drop-shadow-xl" />
                        ) : (
                          <div className="w-16 h-16 flex items-center justify-center text-warning/20">
                            <Trophy className="w-8 h-8" />
                          </div>
                        )}
                        <p className="text-xs font-bold text-foreground text-center line-clamp-1">{trophy.name}</p>
                        <div className="flex flex-wrap justify-center gap-1">
                          {trophy.is_official && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded border border-warning/30 text-warning bg-warning/5 font-bold uppercase tracking-wider">Official</span>
                          )}
                          {trophy.admin_only && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded border border-destructive/30 text-destructive bg-destructive/5 font-bold uppercase tracking-wider">Admin Only</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Rewards / Prizes ───────────────────────────── */}
          <TabsContent value="rewards">
            <div className="max-w-2xl space-y-5">
              <h3 className="font-heading text-lg uppercase tracking-tight text-foreground flex items-center gap-2">
                <Coins className="w-5 h-5 text-warning" /> Season Rewards
              </h3>
              <p className="text-xs text-muted-foreground">
                Configure STC prize distribution and trophy images per competition or league.
                Rewards are distributed automatically when a season is archived.
              </p>

              {/* Source selector */}
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Select Competition or League</p>
                <div className="space-y-1.5">
                  {[{slug:"supreme",color:"#FFD700"},{slug:"elite",color:"#00E5BD"},{slug:"challenger",color:"#A78BFA"}].map(t => {
                    const comp = competitions.find(c => c.slug === t.slug);
                    if (!comp) return null;
                    const active = rewardSource?.id === comp.id;
                    return (
                      <button key={t.slug} onClick={() => setRewardSource({ id: comp.id, type: "competition", name: comp.name, trophy_image_url: comp.trophy_image_url || "" })}
                        className={cn("w-full text-left p-3 rounded border text-xs font-bold transition-all",
                          active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        )} style={{ borderLeftColor: active ? undefined : t.color, borderLeftWidth: 2 }}>
                        {comp.name}
                        <span className="block text-[10px] font-normal mt-0.5 opacity-60">Competition · {comp.platform}</span>
                      </button>
                    );
                  })}
                  {regionalLeagues.filter(l => l.status !== "archived").slice(0, 12).map(league => {
                    const active = rewardSource?.id === league.id;
                    return (
                      <button key={league.id} onClick={() => setRewardSource({ id: league.id, type: "regional_league", name: league.name, trophy_image_url: league.trophy_image_url || "" })}
                        className={cn("w-full text-left p-3 rounded border text-xs font-bold transition-all",
                          active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        )}>
                        {league.name}
                        <span className="block text-[10px] font-normal mt-0.5 opacity-60">
                          Regional League · Div {league.division || 1} · S{league.season_number}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reward config panel for selected source */}
              {rewardSource && (
                <div className="bg-card border border-border rounded p-5 space-y-4">
                  <p className="text-sm font-bold text-foreground">{rewardSource.name}</p>
                  <RewardConfigPanel
                    key={rewardSource.id}
                    sourceId={rewardSource.id}
                    sourceType={rewardSource.type}
                    sourceName={rewardSource.name}
                    trophyImageUrl={rewardSource.trophy_image_url}
                    onTrophyUrlChange={async (url) => {
                      setRewardSource(s => s ? { ...s, trophy_image_url: url } : s);
                      const entity = rewardSource.type === "competition"
                        ? base44.entities.Competition
                        : base44.entities.RegionalLeague;
                      await entity?.update(rewardSource.id, { trophy_image_url: url }).catch(() => {});
                    }}
                  />
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Landing Page ─────────────────────────────── */}
          <TabsContent value="landing">
            <LandingPageEditor />
          </TabsContent>

        </Tabs>
      )}

      {/* Create Tournament Dialog */}
      <Dialog open={createTournamentOpen} onOpenChange={setCreateTournamentOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader><DialogTitle className="font-heading text-xl uppercase tracking-tight flex items-center gap-2"><Trophy className="w-5 h-5 text-primary" /> Create Tournament</DialogTitle></DialogHeader>
          <div className="space-y-5 mt-2">

            {/* Tournament For */}
            <div>
              <label className="label-xs">Tournament For</label>
              <div className="grid grid-cols-2 gap-3">
                {[{v:"club",icon:"🏟️",label:"Club Tournament",sub:"Clubs register & compete"},{v:"player",icon:"👤",label:"Player Tournament",sub:"Individual players register"}].map(opt => (
                  <button key={opt.v} onClick={() => setTournamentForm(f => ({ ...f, participant_type: opt.v }))}
                    className={cn("rounded border p-3 text-left transition-all",
                      tournamentForm.participant_type === opt.v ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 bg-secondary"
                    )}>
                    <p className={cn("font-bold text-sm", tournamentForm.participant_type === opt.v ? "text-primary" : "text-foreground")}>{opt.icon} {opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="label-xs">Name</label>
              <input value={tournamentForm.name} onChange={e => setTournamentForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder="Tournament name..." />
            </div>

            {/* Description */}
            <div>
              <label className="label-xs">Description</label>
              <Textarea value={tournamentForm.description} onChange={e => setTournamentForm(f => ({ ...f, description: e.target.value }))}
                className="bg-secondary border-border" placeholder="Tournament details..." />
            </div>

            {/* Type + Max Teams */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-xs">Type</label>
                <Select value={tournamentForm.type} onValueChange={v => {
                  const updates = { type: v };
                  if (v === 'swiss_ucl') updates.max_teams = 36;
                  setTournamentForm(f => ({ ...f, ...updates }));
                }}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="knockout">Knockout</SelectItem>
                    <SelectItem value="league">League</SelectItem>
                    <SelectItem value="group_stage">Group Stage</SelectItem>
                    <SelectItem value="double_elimination">Double Elimination</SelectItem>
                    <SelectItem value="swiss_ucl">⭐ Swiss System: UCL Version</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="label-xs">Max Teams</label>
                <Select value={String(tournamentForm.max_teams)} onValueChange={v => setTournamentForm(f => ({ ...f, max_teams: Number(v) }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[4, 8, 16, 20, 32, 36, 64].map(n => <SelectItem key={n} value={String(n)}>{n} Teams</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Platform + Start Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-xs">Platform</label>
                <Select value={tournamentForm.platform} onValueChange={v => setTournamentForm(f => ({ ...f, platform: v }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PlayStation">PlayStation</SelectItem>
                    <SelectItem value="Xbox">Xbox</SelectItem>
                    <SelectItem value="PC">PC</SelectItem>
                    <SelectItem value="Cross-Platform">Cross-Platform</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="label-xs">Start Date</label>
                <input type="datetime-local" value={tournamentForm.start_date} onChange={e => setTournamentForm(f => ({ ...f, start_date: e.target.value }))}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" />
              </div>
            </div>

            {/* Entry Fee (STC only) */}
            <div>
              <label className="label-xs">Entry Fee</label>
              <div className="flex gap-2 mb-2">
                {[["free","Free"],["stc","STC Fee"]].map(([v,label]) => (
                  <button key={v} type="button" onClick={() => setAdminEntryType(v)}
                    className={cn("flex-1 py-2 rounded-lg border text-sm font-bold transition-all",
                      adminEntryType === v ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground hover:border-primary/40"
                    )}>
                    {label}
                  </button>
                ))}
              </div>
              {adminEntryType === "stc" && (
                <input type="number" min="0" value={tournamentForm.entry_fee_stc || ""} onChange={e => setTournamentForm(f => ({ ...f, entry_fee_stc: e.target.value }))}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder="STC per entry" />
              )}
            </div>

            {/* Region */}
            <div>
              <label className="label-xs">Region</label>
              <Select value={tournamentForm.region} onValueChange={v => setTournamentForm(f => ({ ...f, region: v }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Global","Europe","North America"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Country Restriction */}
            <div>
              <label className="label-xs">Country Restriction <span className="text-muted-foreground normal-case font-normal">(optional)</span></label>
              <Select value={tournamentForm.country_code || "none"} onValueChange={v => setTournamentForm(f => ({ ...f, country_code: v === "none" ? "" : v }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="All countries" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">🌍 All countries (open)</SelectItem>
                  {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {tournamentForm.country_code && <p className="text-xs text-warning mt-1">⚠️ Only clubs from this country can register.</p>}
            </div>

            {/* Custom Rules */}
            <div>
              <label className="label-xs">📋 Custom Rules (optional)</label>
              <Textarea value={tournamentForm.custom_rules} onChange={e => setTournamentForm(f => ({ ...f, custom_rules: e.target.value }))}
                className="bg-secondary border-border min-h-[80px]" placeholder="Enter your tournament-specific rules here..." />
              <p className="text-xs text-muted-foreground mt-2 mb-1">Or upload a rules document (PDF or image):</p>
              <label className="flex flex-col items-center justify-center border border-dashed border-border rounded p-4 cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">{rulesFile ? rulesFile.name : "Drop or click to upload rules file (PDF / image)"}</span>
                <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => setRulesFile(e.target.files[0])} />
              </label>
            </div>

            {/* Prize */}
            <div>
              <label className="label-xs">Prize Description (optional)</label>
              <input value={tournamentForm.prize_description} onChange={e => setTournamentForm(f => ({ ...f, prize_description: e.target.value }))}
                className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder="e.g. Bragging rights + custom badge" />
            </div>

            {/* Prize Pool STC */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground uppercase tracking-wider block">🏆 Prize Pool (STC) — paid automatically on completion</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "prize_winner_stc",        label: "🥇 Winner",       placeholder: "5000000" },
                  { key: "prize_runner_up_stc",      label: "🥈 Runner-Up",    placeholder: "2000000" },
                  { key: "prize_semi_final_stc",     label: "🥉 Semi-Final",   placeholder: "500000"  },
                  { key: "prize_participation_stc",  label: "🎖️ Participation", placeholder: "100000" },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">{f.label}</label>
                    <input type="number" min="0" value={tournamentForm[f.key] || ""}
                      onChange={e => setTournamentForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                      placeholder={f.placeholder} />
                  </div>
                ))}
              </div>
            </div>

            {/* Tournament Banner */}
            <div>
              <label className="label-xs">Tournament Banner</label>
              <label className="flex flex-col items-center justify-center border border-dashed border-border rounded p-5 cursor-pointer hover:border-primary/50 transition-colors mb-3">
                <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">{bannerFile ? bannerFile.name : "Upload custom banner"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => setBannerFile(e.target.files[0])} />
              </label>
              {!bannerFile && (
                <>
                  <p className="text-xs text-muted-foreground mb-2">Or pick a color banner:</p>
                  <div className="flex flex-wrap gap-2">
                    {BANNER_COLORS.map(color => (
                      <button key={color} onClick={() => setBannerColor(color)}
                        style={{ background: color }}
                        className={cn("w-9 h-9 rounded-lg border-2 transition-all",
                          bannerColor === color ? "border-primary scale-110" : "border-transparent hover:border-primary/50"
                        )}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Trophy Selection */}
            <div>
              <label className="label-xs">🏆 Trophy</label>
              <p className="text-[10px] text-muted-foreground mb-2">Select from library — awarded to winner's cabinet on completion.</p>
              {trophyItems.length > 0 ? (
                <TrophyCarousel trophies={trophyItems} selected={adminTrophyItemId}
                  onSelect={id => { setAdminTrophyItemId(id || ""); setAdminTrophyFile(null); }} />
              ) : (
                <p className="text-xs text-muted-foreground italic mb-2">No trophies in library yet — or upload a new one below.</p>
              )}
              <div className="mt-3">
                <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Or upload new trophy (auto-adds to library):</p>
                {adminTrophyFile ? (
                  <div className="flex items-center gap-3 bg-warning/10 border border-warning/20 rounded-lg p-3">
                    <img src={URL.createObjectURL(adminTrophyFile)} alt="trophy" className="w-10 h-10 object-contain" />
                    <span className="text-xs text-warning flex-1 truncate">{adminTrophyFile.name}</span>
                    <button onClick={() => setAdminTrophyFile(null)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <label className="w-full h-14 rounded-lg border-2 border-dashed border-warning/30 hover:border-warning/60 flex items-center justify-center gap-2 text-warning/60 hover:text-warning transition-colors cursor-pointer">
                    <Upload className="w-4 h-4" />
                    <span className="text-xs">Upload trophy PNG (auto-creates new entry in library)</span>
                    <input type="file" accept="image/png,image/*" className="hidden" onChange={e => { if (e.target.files[0]) { setAdminTrophyFile(e.target.files[0]); setAdminTrophyItemId(""); } }} />
                  </label>
                )}
              </div>
              {(adminTrophyItemId || adminTrophyFile) && (
                <p className="text-[10px] text-warning mt-1.5">✓ Trophy selected — will be awarded to the winner</p>
              )}
            </div>

            <Button onClick={createTournament} disabled={!tournamentForm.name || !tournamentForm.start_date || saving}
              className="w-full bg-primary text-primary-foreground gap-2 py-3">
              <Trophy className="w-4 h-4" /> {saving ? "Creating..." : "Create Tournament"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resolve Dispute Dialog */}
      <Dialog open={!!resolveDialog} onOpenChange={() => { setResolveDialog(null); setSelectedWinner(""); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-heading text-xl uppercase tracking-tight flex items-center gap-2"><Gavel className="w-5 h-5 text-primary" /> Resolve Dispute</DialogTitle></DialogHeader>
          {resolveDialog && (() => {
            const m = resolveDialog.match;
            const parseSub = (raw) => { try { return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null; } catch { return null; } };
            const homeSub = parseSub(m.home_submission);
            const awaySub = parseSub(m.away_submission);
            const homeScore = homeSub ? `${homeSub.home_score} – ${homeSub.away_score}` : "Not submitted";
            const awayScore = awaySub ? `${awaySub.home_score} – ${awaySub.away_score}` : "Not submitted";
            const homeProof = homeSub?.proof_url;
            const awayProof = awaySub?.proof_url;
            return (
              <div className="space-y-4 mt-2">
                <p className="text-sm text-muted-foreground"><strong className="text-foreground">{m.home_club_name || m.home_player_name}</strong> vs <strong className="text-foreground">{m.away_club_name || m.away_player_name}</strong></p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-secondary rounded-lg p-3 text-center">
                    <p className="text-muted-foreground text-xs mb-1">{m.home_club_name || m.home_player_name} submitted</p>
                    <p className="font-bold text-foreground text-lg">{homeScore}</p>
                    {homeProof && <a href={homeProof} target="_blank" rel="noreferrer" className="text-[10px] text-primary underline block mt-1">📎 Proof</a>}
                  </div>
                  <div className="bg-secondary rounded-lg p-3 text-center">
                    <p className="text-muted-foreground text-xs mb-1">{m.away_club_name || m.away_player_name} submitted</p>
                    <p className="font-bold text-foreground text-lg">{awayScore}</p>
                    {awayProof && <a href={awayProof} target="_blank" rel="noreferrer" className="text-[10px] text-primary underline block mt-1">📎 Proof</a>}
                  </div>
                </div>
                <div>
                  <label className="label-xs">Accept submission from</label>
                  <Select value={selectedWinner} onValueChange={setSelectedWinner}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select which result to accept..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={m.home_club_id || "home"}>{m.home_club_name || m.home_player_name} (Home) — {homeScore}</SelectItem>
                      <SelectItem value={m.away_club_id || "away"}>{m.away_club_name || m.away_player_name} (Away) — {awayScore}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={resolveDispute} disabled={!selectedWinner || saving} className="w-full bg-primary text-primary-foreground leading-relaxed gap-2">
                  <Gavel className="w-4 h-4" /> {saving ? "Saving..." : "Confirm Resolution"}
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Player Wallet Dialog */}
      <Dialog open={!!playerWalletDialog} onOpenChange={() => setPlayerWalletDialog(null)}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl uppercase tracking-tight flex items-center gap-2">
              <Coins className="w-5 h-5 text-success" /> Player Wallet — {playerWalletDialog?.gamertag}
            </DialogTitle>
          </DialogHeader>
          {playerWalletDialog && (
            <div className="space-y-5 mt-2">
              {/* Balance */}
              <div className="bg-gradient-to-br from-success/10 to-card rounded-2xl border border-success/20 p-5 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">STC Balance</p>
                <p className="font-heading font-black text-4xl text-success">{(playerWalletDialog.stc || 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Stage Coin</p>
              </div>

              {/* Adjust balance */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Adjust Balance</p>
                <p className="text-[10px] text-muted-foreground">Use positive amounts to credit, negative to debit. Creates a transaction record.</p>
                <input
                  type="number"
                  value={walletAdjustAmount}
                  onChange={e => setWalletAdjustAmount(e.target.value)}
                  placeholder="e.g. 5000 or -2000"
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                />
                <input
                  type="text"
                  value={walletAdjustNote}
                  onChange={e => setWalletAdjustNote(e.target.value)}
                  placeholder="Note (optional)"
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                />
                <Button onClick={applyWalletAdjust} disabled={walletAdjustAmount === "" || saving}
                  className="w-full bg-primary text-primary-foreground gap-2">
                  <Coins className="w-4 h-4" /> {saving ? "Applying…" : "Apply Adjustment"}
                </Button>
              </div>

              {/* Transaction history */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Recent Transactions</p>
                {walletLoading ? (
                  <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
                ) : walletTxns.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No transactions yet.</p>
                ) : (
                  <div className="rounded-xl border border-border overflow-hidden">
                    {walletTxns.map(tx => {
                      const isPos = Number(tx.amount) > 0;
                      return (
                        <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40 last:border-0 hover:bg-secondary/30">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{tx.description || tx.category}</p>
                            <p className="text-[10px] text-muted-foreground">{tx.source || "—"} · {new Date(tx.created_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}</p>
                          </div>
                          <span className={cn("text-xs font-bold shrink-0", isPos ? "text-success" : "text-destructive")}>
                            {isPos ? "+" : ""}{Number(tx.amount).toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Club Finance Dialog */}
      <Dialog open={!!clubStcDialog} onOpenChange={() => setClubStcDialog(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-heading text-xl uppercase tracking-tight flex items-center gap-2"><Coins className="w-5 h-5 text-success" /> Club Finance — {clubStcDialog?.name}</DialogTitle></DialogHeader>
          {clubStcDialog && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-secondary rounded-lg p-2">
                  <p className="text-muted-foreground">Balance</p>
                  <p className="font-bold text-success">{((clubStcDialog.stc||0)/1_000_000).toFixed(2)}M</p>
                </div>
                <div className="bg-secondary rounded-lg p-2">
                  <p className="text-muted-foreground">Wage Budget</p>
                  <p className="font-bold text-warning">{((clubStcDialog.wage_budget_stc||0)/1_000_000).toFixed(2)}M</p>
                </div>
                <div className="bg-secondary rounded-lg p-2">
                  <p className="text-muted-foreground">Transfer Budget</p>
                  <p className="font-bold text-primary">{((clubStcDialog.transfer_budget_stc||0)/1_000_000).toFixed(2)}M</p>
                </div>
              </div>
              <div>
                <label className="label-xs">Adjust Balance — Delta STC (e.g. +5000000 or -2000000)</label>
                <input type="number" value={clubStcAmount} onChange={e => setClubStcAmount(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder="e.g. 10000000 or -5000000" />
                <p className="text-[10px] text-muted-foreground mt-1">Amount is added/subtracted from current balance and logged as a transaction</p>
              </div>
              <div>
                <label className="label-xs">Set Weekly Wage Budget (STC)</label>
                <input type="number" value={clubWageBudget} onChange={e => setClubWageBudget(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder="e.g. 2000000" />
                <p className="text-[10px] text-muted-foreground mt-1">Recommended: 1M–5M/wk for a standard club</p>
              </div>
              <div>
                <label className="label-xs">Set Transfer Budget (STC)</label>
                <input type="number" value={clubTransferBudget} onChange={e => setClubTransferBudget(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder="e.g. 20000000" />
                <p className="text-[10px] text-muted-foreground mt-1">Recommended: 5M–50M for a standard club</p>
              </div>
              <div>
                <label className="label-xs">Note / Reason (optional)</label>
                <input type="text" value={clubStcNote} onChange={e => setClubStcNote(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder="e.g. Competition prize, correction..." />
              </div>
              <Button onClick={saveClubFinance} disabled={saving || (clubStcAmount === "" && clubWageBudget === "" && clubTransferBudget === "")} className="w-full bg-success/20 text-success hover:bg-success/30 border border-success/40">
                {saving ? "Saving..." : "Save Club Finance"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Enter Result Dialog */}
      <Dialog open={!!resultDialog} onOpenChange={() => { setResultDialog(null); setResultForm({ home_score: "", away_score: "" }); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl uppercase tracking-tight flex items-center gap-2">
              <Check className="w-5 h-5 text-success" /> Enter Result
            </DialogTitle>
          </DialogHeader>
          {resultDialog && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{resultDialog.fixture.home_club_name}</strong>
                <span className="mx-2 text-muted-foreground">vs</span>
                <strong className="text-foreground">{resultDialog.fixture.away_club_name}</strong>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-xs">{resultDialog.fixture.home_club_name} (Home)</label>
                  <input type="number" min="0" value={resultForm.home_score}
                    onChange={e => setResultForm(f => ({ ...f, home_score: e.target.value }))}
                    className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                    placeholder="0" />
                </div>
                <div>
                  <label className="label-xs">{resultDialog.fixture.away_club_name} (Away)</label>
                  <input type="number" min="0" value={resultForm.away_score}
                    onChange={e => setResultForm(f => ({ ...f, away_score: e.target.value }))}
                    className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                    placeholder="0" />
                </div>
              </div>
              <Button onClick={processAdminResult}
                disabled={savingResult || resultForm.home_score === "" || resultForm.away_score === ""}
                className="w-full bg-success/20 text-success hover:bg-success/30 border border-success/40 leading-relaxed">
                {savingResult
                  ? "Processing..."
                  : `Confirm: ${resultForm.home_score || "?"} – ${resultForm.away_score || "?"}`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Registration Dialog */}
      <Dialog open={!!approveRegDialog} onOpenChange={() => { setApproveRegDialog(null); setApproveTargetId(""); }}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading uppercase tracking-tight flex items-center gap-2">
              <Check className="w-4 h-4 text-success" /> Approve Registration
            </DialogTitle>
          </DialogHeader>
          {approveRegDialog && (
            <div className="space-y-4 mt-2">
              <div className="bg-secondary/40 border border-border rounded-lg p-3 flex items-center gap-3">
                {approveRegDialog.club_logo_url
                  ? <img src={approveRegDialog.club_logo_url} alt={approveRegDialog.club_name} className="w-8 h-8 object-contain rounded shrink-0" />
                  : <Shield className="w-6 h-6 text-muted-foreground/30 shrink-0" />}
                <div>
                  <p className="text-sm font-bold text-foreground">{approveRegDialog.club_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {approveRegDialog.region_name || approveRegDialog.region_slug}
                    {approveRegDialog.preferred_division ? ` · Prefers Div ${approveRegDialog.preferred_division}` : ""}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Assign to League
                </label>
                {(() => {
                  const candidates = regionalLeagues.filter(
                    l => l.region_slug === approveRegDialog.region_slug
                      && l.status === "registration"
                      && (l.platform === approveRegDialog.platform || l.platform === "Cross-Platform" || approveRegDialog.platform === "Cross-Platform")
                  ).sort((a, b) => (a.division || 1) - (b.division || 1));
                  if (candidates.length === 0) {
                    return (
                      <div className="bg-warning/10 border border-warning/30 rounded p-3 text-xs text-warning">
                        No open leagues found for {approveRegDialog.region_name || approveRegDialog.region_slug} in {approveRegDialog.platform}.
                        Open a league&apos;s registration first.
                      </div>
                    );
                  }
                  return (
                    <select value={approveTargetId} onChange={e => setApproveTargetId(e.target.value)}
                      className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50">
                      <option value="">— Select a league —</option>
                      {candidates.map(l => {
                        const max = l.max_clubs || 16;
                        const taken = l.num_clubs || 0;
                        const full = taken >= max;
                        return (
                          <option key={l.id} value={l.id} disabled={full}>
                            {l.name} (Div {l.division || 1}) — {taken}/{max}{full ? " FULL" : ""}
                          </option>
                        );
                      })}
                    </select>
                  );
                })()}
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1 border-border h-9 text-sm"
                  onClick={() => { setApproveRegDialog(null); setApproveTargetId(""); }}>
                  Cancel
                </Button>
                <Button disabled={!approveTargetId || processingReg} onClick={handleApproveReg}
                  className="flex-1 bg-success/20 text-success hover:bg-success/30 border border-success/30 h-9 text-sm font-bold">
                  {processingReg ? "Approving…" : "Confirm & Assign"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject / Waitlist Registration Dialog */}
      <Dialog open={!!rejectNotesDialog} onOpenChange={() => { setRejectNotesDialog(null); setRejectNotes(""); }}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading uppercase tracking-tight flex items-center gap-2">
              {rejectNotesDialog?.action === "reject"
                ? <><X className="w-4 h-4 text-destructive" /> Reject Application</>
                : <><Flag className="w-4 h-4 text-muted-foreground" /> Add to Waitlist</>}
            </DialogTitle>
          </DialogHeader>
          {rejectNotesDialog && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">
                {rejectNotesDialog.action === "reject"
                  ? `Reject ${rejectNotesDialog.reg.club_name}'s application for ${rejectNotesDialog.reg.region_name || rejectNotesDialog.reg.region_slug}?`
                  : `Add ${rejectNotesDialog.reg.club_name} to the waitlist for ${rejectNotesDialog.reg.region_name || rejectNotesDialog.reg.region_slug}.`}
              </p>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Note to club (optional)
                </label>
                <Textarea value={rejectNotes} onChange={e => setRejectNotes(e.target.value)}
                  placeholder="Reason for rejection / waitlist position, etc."
                  className="bg-secondary border-border text-foreground text-sm resize-none h-20" maxLength={300} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1 border-border h-9 text-sm"
                  onClick={() => { setRejectNotesDialog(null); setRejectNotes(""); }}>
                  Cancel
                </Button>
                <Button disabled={processingReg} onClick={handleRejectOrWaitlistReg}
                  className={cn("flex-1 h-9 text-sm font-bold",
                    rejectNotesDialog.action === "reject"
                      ? "bg-destructive/20 text-destructive hover:bg-destructive/30 border border-destructive/30"
                      : "bg-secondary text-foreground border border-border hover:bg-secondary/80")}>
                  {processingReg ? "Saving…" : rejectNotesDialog.action === "reject" ? "Reject" : "Waitlist"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Grant Credits Dialog */}
      <Dialog open={!!creditsDialog} onOpenChange={() => setCreditsDialog(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-heading text-xl uppercase tracking-tight flex items-center gap-2"><Coins className="w-5 h-5 text-warning" /> Grant Credits</DialogTitle></DialogHeader>
          {creditsDialog && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">Player: <strong className="text-foreground">{creditsDialog.gamertag}</strong></p>
              <p className="text-sm text-muted-foreground">Current balance: <strong className="text-warning">{(creditsDialog.credits || 0).toLocaleString()} credits</strong></p>
              <div>
                <label className="label-xs">Amount to Add</label>
                <input type="number" value={creditsAmount} onChange={e => setCreditsAmount(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" placeholder="e.g. 500" />
              </div>
              <Button onClick={grantCredits} disabled={!creditsAmount || saving} className="w-full bg-warning/20 text-warning hover:bg-warning/30 border border-warning/40 leading-relaxed">
                {saving ? "Saving..." : `Add ${Number(creditsAmount).toLocaleString()} Credits`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

const SEASON_STATUS_LABEL = {
  draft: "Draft",
  registration: "Registration",
  league_phase: "League Phase",
  playoff_round: "Playoff Round",
  knockout_r16: "Round of 16",
  knockout_qf: "Quarter-Finals",
  knockout_sf: "Semi-Finals",
  knockout_final: "Final",
  completed: "Completed",
  archived: "Archived",
};

function SeasonCard({ season: s, onRefresh }) {
  const [busy, setBusy] = useState(false);

  async function advance(action) {
    setBusy(true);
    try {
      const { generateLeaguePhaseFixtures, generatePlayoffRound, generateKnockoutR16, generateNextKnockoutRound } = await import("@/lib/competitionUtils");

      if (action === "generate_fixtures") {
        const standings = await base44.entities.CompetitionStanding.filter({ season_id: s.id }, null, 50).catch(() => []);
        if (!standings.length) { alert("No clubs registered yet. Confirm qualification entries first."); return; }
        await generateLeaguePhaseFixtures(s, standings);
        alert(`League phase fixtures generated! ${standings.length} clubs, 8 matchdays.`);

      } else if (action === "playoff_round") {
        const standings = await base44.entities.CompetitionStanding.filter({ season_id: s.id }, null, 50).catch(() => []);
        await generatePlayoffRound(s, standings);
        alert("Playoff round generated! Positions 9-24 play off. Positions 25-36 eliminated.");

      } else if (action === "knockout_r16") {
        const [standings, fixtures] = await Promise.all([
          base44.entities.CompetitionStanding.filter({ season_id: s.id }, null, 50).catch(() => []),
          base44.entities.CompetitionFixture.filter({ season_id: s.id, phase: "playoff_round" }, null, 30).catch(() => []),
        ]);
        await generateKnockoutR16(s, standings, fixtures);
        alert("Round of 16 generated!");

      } else if (["knockout_qf", "knockout_sf", "knockout_final"].includes(action)) {
        const prevPhase = { knockout_qf: "knockout_r16", knockout_sf: "knockout_qf", knockout_final: "knockout_sf" }[action];
        const fixtures = await base44.entities.CompetitionFixture.filter({ season_id: s.id, phase: prevPhase }, null, 30).catch(() => []);
        await generateNextKnockoutRound(s, fixtures, prevPhase);
        alert(`${SEASON_STATUS_LABEL[action]} fixtures generated!`);

      } else if (action === "complete") {
        await base44.entities.CompetitionSeason.update(s.id, { status: "completed" });
        alert("Season marked as completed.");

      } else if (action === "open_registration") {
        await base44.entities.CompetitionSeason.update(s.id, { status: "registration" });
        alert("Registration is now open.");

      } else if (action === "archive") {
        const { archiveCompetitionSeason } = await import("@/lib/seasonLifecycle");
        const comps = await base44.entities.Competition.filter({ id: s.competition_id }, null, 1).catch(() => []);
        await archiveCompetitionSeason(s, comps[0] || null);
        alert(`Season ${s.season_number} archived. Standings and winner locked.`);

      } else if (action === "create_next") {
        const { createNextCompetitionSeason } = await import("@/lib/seasonLifecycle");
        const comps = await base44.entities.Competition.filter({ id: s.competition_id }, null, 1).catch(() => []);
        const next = await createNextCompetitionSeason(s, comps[0] || null);
        alert(`Season ${next.season_number} created as Draft. Open Registration when ready.`);
      }

      await onRefresh();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  const statusColor = {
    draft: "text-muted-foreground border-muted-foreground/30 bg-muted/20",
    registration: "text-primary border-primary/30 bg-primary/5",
    league_phase: "text-success border-success/30 bg-success/5",
    completed: "text-warning border-warning/30 bg-warning/5",
    archived: "text-muted-foreground border-border bg-transparent",
  }[s.status] || "text-warning border-warning/30 bg-warning/5";

  return (
    <div className="bg-card border border-border rounded p-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">{s.competition_name} — {s.season_label || `Season ${s.season_number}`}</p>
          <p className="text-[10px] text-muted-foreground">{s.num_clubs || 0} clubs · {s.platform} · {s.region}</p>
        </div>
        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0", statusColor)}>
          {SEASON_STATUS_LABEL[s.status] || s.status}
        </span>
        <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
          {s.status === "draft" && (
            <Button size="sm" disabled={busy} onClick={() => advance("open_registration")}
              className="h-7 text-[10px] rounded bg-primary text-primary-foreground gap-1">
              {busy ? "..." : "Open Registration"}
            </Button>
          )}
          {s.status === "registration" && !s.fixtures_generated && (
            <Button size="sm" disabled={busy} onClick={() => advance("generate_fixtures")}
              className="h-7 text-[10px] rounded bg-success/20 text-success border-0 hover:bg-success/30 gap-1">
              {busy ? "..." : "Generate Fixtures"}
            </Button>
          )}
          {s.status === "league_phase" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => advance("playoff_round")}
              className="h-7 text-[10px] rounded border-warning/40 text-warning hover:bg-warning/10">
              {busy ? "..." : "→ Playoff Round"}
            </Button>
          )}
          {s.status === "playoff_round" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => advance("knockout_r16")}
              className="h-7 text-[10px] rounded border-border">
              {busy ? "..." : "→ Round of 16"}
            </Button>
          )}
          {s.status === "knockout_r16" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => advance("knockout_qf")}
              className="h-7 text-[10px] rounded border-border">
              {busy ? "..." : "→ Quarter-Finals"}
            </Button>
          )}
          {s.status === "knockout_qf" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => advance("knockout_sf")}
              className="h-7 text-[10px] rounded border-border">
              {busy ? "..." : "→ Semi-Finals"}
            </Button>
          )}
          {s.status === "knockout_sf" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => advance("knockout_final")}
              className="h-7 text-[10px] rounded border-border">
              {busy ? "..." : "→ Final"}
            </Button>
          )}
          {s.status === "knockout_final" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => advance("complete")}
              className="h-7 text-[10px] rounded border-border">
              {busy ? "..." : "Complete Season"}
            </Button>
          )}
          {s.status === "completed" && (
            <>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => advance("archive")}
                className="h-7 text-[10px] rounded border-muted-foreground/30 text-muted-foreground hover:text-foreground">
                {busy ? "..." : "Archive Season"}
              </Button>
              <Button size="sm" disabled={busy} onClick={() => advance("create_next")}
                className="h-7 text-[10px] rounded bg-success/20 text-success border-0 hover:bg-success/30">
                {busy ? "..." : "Create Next Season"}
              </Button>
            </>
          )}
          {s.status === "archived" && (
            <Button size="sm" disabled={busy} onClick={() => advance("create_next")}
              className="h-7 text-[10px] rounded bg-success/20 text-success border-0 hover:bg-success/30">
              {busy ? "..." : "Create Next Season"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminStat({ icon: Icon, label, value, color, accent }) {
  return (
    <div className={cn("bg-card border border-border border-l-2 rounded p-4", accent)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{label}</span>
        <Icon className={cn("w-3.5 h-3.5", color)} />
      </div>
      <p className={cn("font-heading font-black text-4xl leading-none", color)}>{value}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="border border-dashed border-border rounded p-12 text-center">
      <Icon className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
      <p className="text-muted-foreground text-sm uppercase tracking-widest">{text}</p>
    </div>
  );
}

function ExpiredFixtureRow({ fixture, onResolved, busy, setBusy }) {
  const [forceDate, setForceDate] = useState("");
  const [forceTime, setForceTime] = useState("");
  const [showForce, setShowForce] = useState(false);
  const id = fixture.id;

  async function handleForce() {
    if (!forceDate || !forceTime) return;
    setBusy(id);
    try {
      const date = new Date(`${forceDate}T${forceTime}:00`).toISOString();
      await forceSchedule({ fixture, fixtureType: fixture._fixtureType, date, adminNote: "Admin override after deadline." });
      onResolved();
    } finally { setBusy(null); }
  }

  async function handleForfeit(side) {
    if (!confirm(`Declare ${side === "home" ? fixture.home_club_name : fixture.away_club_name} as forfeiting?`)) return;
    setBusy(id);
    try {
      const forfeitingClubId = side === "home" ? fixture.home_club_id : fixture.away_club_id;
      await declareForfeit({ fixture, fixtureType: fixture._fixtureType, forfeitingClubId });
      onResolved();
    } finally { setBusy(null); }
  }

  async function handleFlag() {
    setBusy(id);
    try {
      await flagForAdminReview(fixture, fixture._fixtureType);
      onResolved();
    } finally { setBusy(null); }
  }

  const isBusy = busy === id;
  const context = fixture._fixtureType === "regional_league"
    ? `${fixture.league_name} · Matchday ${fixture.matchday}`
    : `${fixture.competition_name}`;

  return (
    <div className="border border-destructive/20 rounded p-3 space-y-2 bg-destructive/5">
      <div>
        <p className="text-xs font-bold text-foreground">{fixture.home_club_name} vs {fixture.away_club_name}</p>
        <p className="text-[10px] text-muted-foreground">{context}</p>
      </div>
      {!showForce ? (
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => setShowForce(true)} disabled={isBusy}
            className="h-6 text-[10px] bg-primary text-primary-foreground px-2">Force Schedule</Button>
          <Button size="sm" variant="outline" onClick={() => handleForfeit("home")} disabled={isBusy}
            className="h-6 text-[10px] border-destructive/30 text-destructive hover:bg-destructive/10 px-2">
            {fixture.home_club_name} forfeit</Button>
          <Button size="sm" variant="outline" onClick={() => handleForfeit("away")} disabled={isBusy}
            className="h-6 text-[10px] border-destructive/30 text-destructive hover:bg-destructive/10 px-2">
            {fixture.away_club_name} forfeit</Button>
          <Button size="sm" variant="outline" onClick={handleFlag} disabled={isBusy}
            className="h-6 text-[10px] border-border text-muted-foreground px-2">Flag review</Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <Input type="date" value={forceDate} onChange={e => setForceDate(e.target.value)}
            className="h-6 text-[10px] bg-secondary border-border w-32 px-2" />
          <Input type="time" value={forceTime} onChange={e => setForceTime(e.target.value)}
            className="h-6 text-[10px] bg-secondary border-border w-24 px-2" />
          <Button size="sm" onClick={handleForce} disabled={isBusy || !forceDate || !forceTime}
            className="h-6 text-[10px] bg-primary text-primary-foreground px-2">
            {isBusy ? "Saving…" : "Confirm"}</Button>
          <Button size="sm" variant="ghost" onClick={() => setShowForce(false)} disabled={isBusy}
            className="h-6 text-[10px] px-2">Cancel</Button>
        </div>
      )}
    </div>
  );
}
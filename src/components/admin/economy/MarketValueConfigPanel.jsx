import { useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { TrendingUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { swalConfirm } from "@/lib/swal";

export default function MarketValueConfigPanel() {
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
    if (!(await swalConfirm("Recalculate market value for all players? This may take a moment."))) return;
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

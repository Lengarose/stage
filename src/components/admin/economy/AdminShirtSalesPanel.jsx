import { useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShoppingBag, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminShirtSalesPanel() {
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

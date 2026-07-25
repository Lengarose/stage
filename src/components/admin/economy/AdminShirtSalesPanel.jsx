import { useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShoppingBag, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

export default function AdminShirtSalesPanel() {
  const { t } = useTranslation();
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
    } catch (err) { setMsg({ type: "error", text: err?.message || t("admin.economy.failed") }); }
    setLoading(false);
  }

  async function saveConfig() {
    setSaving(true);
    try {
      await stageClient.functions.invoke("shirtSales", { action: "set_config", weights: cfg });
      setMsg({ type: "success", text: t("admin.economy.configSaved") });
    } catch (err) { setMsg({ type: "error", text: err?.message || t("admin.economy.failed") }); }
    setSaving(false);
  }

  async function applyCorrection() {
    if (!corrClub || !corrAmt) return;
    setSaving(true);
    try {
      await stageClient.functions.invoke("shirtSales", {
        action: "correct_revenue", club_id: corrClub, amount: Number(corrAmt), note: corrNote || undefined,
      });
      setMsg({ type: "success", text: t("admin.economy.revenueCorrectionApplied") });
      setCorrClub(""); setCorrAmt(""); setCorrNote("");
    } catch (err) { setMsg({ type: "error", text: err?.message || t("admin.economy.failed") }); }
    setSaving(false);
  }

  const fmt = (n) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : `${n}`;

  const cfgFieldKeys = [
    "base_per_mv_1m", "goal_demand", "assist_demand", "rating_demand_per_point",
    "motm_demand", "clean_sheet_demand", "form_influence", "contract_boost",
    "max_per_match", "price_base", "price_per_ovr_above_70", "price_per_goal",
    "price_per_assist", "price_per_rating_point",
  ];
  const cfgFields = cfgFieldKeys.map((key) => ({
    key,
    label: t(`admin.economy.shirtSalesFields.${key}.label`),
    help: t(`admin.economy.shirtSalesFields.${key}.help`),
  }));

  return (
    <div className="mb-4 bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => { setOpen(o => !o); if (!open && !cfg) load(); }}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
      >
        <span className="text-xs font-bold text-foreground flex items-center gap-2">
          <ShoppingBag className="w-3.5 h-3.5 text-primary" /> {t("admin.economy.shirtSales")}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-5">
          {msg && (
            <p className={cn("text-xs font-medium", msg.type === "success" ? "text-success" : "text-destructive")}>{msg.text}</p>
          )}

          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">{t("admin.economy.globalTopShirtSellers")}</p>
            {loading ? (
              <p className="text-xs text-muted-foreground">{t("admin.actions.loading")}</p>
            ) : (
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {(lb || []).map((e, i) => (
                  <div key={e.player_id} className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg text-xs">
                    <span className="text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                    <span className="font-medium text-foreground flex-1 truncate">{e.gamertag}</span>
                    {e.shirt_number && <span className="text-muted-foreground font-mono">#{e.shirt_number}</span>}
                    <span className="text-muted-foreground truncate hidden sm:block">{e.club_name}</span>
                    <span className="text-success font-bold shrink-0">{Number(e.total_shirts).toLocaleString()} {t("admin.economy.shirts")}</span>
                    <span className="text-warning shrink-0">{fmt(Number(e.total_revenue))} STC</span>
                  </div>
                ))}
                {(!lb || lb.length === 0) && <p className="text-xs text-muted-foreground">{t("admin.economy.noDataYet")}</p>}
              </div>
            )}
          </div>

          {cfg && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">{t("admin.economy.adjustShirtSalesFormula")}</p>
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
                {saving ? t("admin.actions.saving") : t("admin.economy.saveConfig")}
              </Button>
            </div>
          )}

          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">{t("admin.economy.correctClubShirtRevenue")}</p>
            <div className="flex gap-2 flex-wrap">
              <Input placeholder={t("admin.economy.clubId")} value={corrClub} onChange={e => setCorrClub(e.target.value)} className="text-xs flex-1 min-w-[180px]" />
              <Input placeholder={t("admin.economy.amountNegative")} type="number" value={corrAmt} onChange={e => setCorrAmt(e.target.value)} className="text-xs w-48" />
              <Input placeholder={t("admin.economy.noteOptional")} value={corrNote} onChange={e => setCorrNote(e.target.value)} className="text-xs flex-1 min-w-[150px]" />
              <Button size="sm" onClick={applyCorrection} disabled={saving || !corrClub || !corrAmt} className="text-xs bg-success/20 text-success border border-success/30 hover:bg-success/30">
                {t("admin.economy.apply")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

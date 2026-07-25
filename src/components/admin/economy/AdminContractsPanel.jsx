import { useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Coins, Pencil, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { swalConfirm } from "@/lib/swal";
import { useTranslation } from "@/hooks/useTranslation";

export default function AdminContractsPanel() {
  const { t } = useTranslation();
  const [contracts, setContracts] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [editDialog, setEditDialog] = useState(null);
  const [corrDialog, setCorrDialog] = useState(null);
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
    } catch (err) { setMsg({ type: "error", text: err?.message || t("admin.economy.failedToLoad") }); }
    setLoading(false);
  }

  async function runExpiry() {
    try {
      const res = await stageClient.functions.invoke("contractManagement", { action: "expire_overdue" });
      setMsg({ type: "success", text: t("admin.economy.expiredCount", { count: res?.data?.expired_count || 0 }) });
      load();
    } catch (err) { setMsg({ type: "error", text: err?.message || t("admin.economy.failed") }); }
  }

  async function runSalaries() {
    try {
      const res = await stageClient.functions.invoke("contractManagement", { action: "auto_pay_salaries" });
      setMsg({ type: "success", text: t("admin.economy.paidSalaries", { paid: res?.data?.paid || 0, total: res?.data?.total || 0 }) });
      load();
    } catch (err) { setMsg({ type: "error", text: err?.message || t("admin.economy.failed") }); }
  }

  async function cancelContract(c) {
    if (!(await swalConfirm(t("admin.economy.cancelContractConfirm", { name: c.gamertag || c.full_name })))) return;
    try {
      await stageClient.functions.invoke("contractManagement", { action: "admin_cancel", contract_id: c.id });
      setMsg({ type: "success", text: t("admin.economy.contractCancelled") });
      setContracts(prev => prev.map(x => x.id === c.id ? { ...x, status: "terminated" } : x));
    } catch (err) { setMsg({ type: "error", text: err?.message || t("admin.economy.failed") }); }
  }

  async function saveEdit() {
    if (!editDialog) return;
    setSavingEdit(true);
    try {
      await stageClient.functions.invoke("contractManagement", { action: "admin_edit", contract_id: editDialog.id, ...editFields });
      setMsg({ type: "success", text: t("admin.economy.contractUpdated") });
      setContracts(prev => prev.map(x => x.id === editDialog.id ? { ...x, ...editFields } : x));
      setEditDialog(null);
    } catch (err) { setMsg({ type: "error", text: err?.message || t("admin.economy.failed") }); }
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
      setMsg({ type: "success", text: t("admin.economy.salaryCorrectionApplied") });
      setCorrDialog(null); setCorrAmount(""); setCorrNote("");
    } catch (err) { setMsg({ type: "error", text: err?.message || t("admin.economy.failed") }); }
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
          <Coins className="w-3.5 h-3.5 text-primary" /> {t("admin.economy.contractsManagement")}
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
              {loading ? t("admin.actions.loading") : t("admin.actions.refresh")}
            </Button>
            <Button size="sm" variant="outline" onClick={runExpiry} className="text-xs border-warning/30 text-warning hover:bg-warning/10">
              {t("admin.economy.expireOverdue")}
            </Button>
            <Button size="sm" variant="outline" onClick={runSalaries} className="text-xs border-success/30 text-success hover:bg-success/10">
              {t("admin.economy.payAllSalaries")}
            </Button>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="ml-auto bg-secondary border border-border text-xs text-foreground rounded px-2 py-1.5 outline-none">
              {["all", "active", "pending", "negotiating", "pending_window", "terminated", "expired", "rejected"].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {!contracts ? (
            <p className="text-xs text-muted-foreground">{t("admin.actions.loading")}</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("admin.economy.noContractsFound")}</p>
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
                      <span className="ml-1.5 text-muted-foreground">{t("admin.economy.untilDate", { date: c.end_date })}</span>
                    )}
                  </div>
                  <button onClick={() => { setEditDialog(c); setEditFields({ weekly_salary_stc: c.weekly_salary_stc, end_date: c.end_date, status: c.status }); }}
                    className="p-1 hover:text-primary text-muted-foreground transition-colors" title={t("admin.actions.edit")}>
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={() => { setCorrDialog(c); setCorrAmount(String(c.weekly_salary_stc || "")); setCorrNote(""); }}
                    className="p-1 hover:text-success text-muted-foreground transition-colors" title={t("admin.economy.correctSalaryPayment")}>
                    <Coins className="w-3 h-3" />
                  </button>
                  {["active", "pending", "negotiating", "pending_window"].includes(c.status) && (
                    <button onClick={() => cancelContract(c)}
                      className="p-1 hover:text-destructive text-muted-foreground transition-colors" title={t("admin.actions.cancel")}>
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("admin.economy.editContract")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">{t("admin.economy.weeklySalary")}</label>
              <Input type="number" value={editFields.weekly_salary_stc ?? ""} onChange={e => setEditFields(p => ({ ...p, weekly_salary_stc: e.target.value }))} className="text-sm" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">{t("admin.economy.endDate")}</label>
              <Input type="date" value={editFields.end_date ?? ""} onChange={e => setEditFields(p => ({ ...p, end_date: e.target.value }))} className="text-sm" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">{t("admin.economy.statusLabel")}</label>
              <select value={editFields.status ?? ""} onChange={e => setEditFields(p => ({ ...p, status: e.target.value }))}
                className="w-full bg-secondary border border-border text-sm text-foreground rounded px-2.5 py-1.5 outline-none">
                {["active", "pending", "negotiating", "pending_window", "terminated", "expired", "rejected"].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <Button onClick={saveEdit} disabled={savingEdit} className="w-full bg-primary text-primary-foreground text-sm">
              {savingEdit ? t("admin.actions.saving") : t("admin.economy.saveChanges")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!corrDialog} onOpenChange={() => setCorrDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("admin.economy.correctSalaryPayment")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              {t("admin.economy.correctSalaryHint")}
            </p>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">{t("admin.economy.amountStcRequired").replace(" *", "")}</label>
              <Input type="number" value={corrAmount} onChange={e => setCorrAmount(e.target.value)} className="text-sm" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">{t("admin.economy.noteOptional")}</label>
              <Input value={corrNote} onChange={e => setCorrNote(e.target.value)} className="text-sm" placeholder={t("admin.economy.reasonCorrectionPlaceholder")} />
            </div>
            <Button onClick={saveCorrection} disabled={savingEdit || !corrAmount} className="w-full bg-success/20 text-success border border-success/30 text-sm hover:bg-success/30">
              {savingEdit ? t("admin.actions.applying") : t("admin.economy.applyCorrection")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

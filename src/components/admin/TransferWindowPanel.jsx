/**
 * TransferWindowPanel — admin UI for managing the global transfer window.
 * Embed this inside the Admin page.
 */
import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { CalendarDays, CheckCircle, XCircle, Play, Loader2, AlertCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { swalAlert, swalConfirm } from "@/lib/swal";

export default function TransferWindowPanel() {
  const [currentWindow, setCurrentWindow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const [form, setForm] = useState({
    label: "",
    start_date: "",
    end_date: "",
    notes: "",
  });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [winRes, pendingContracts] = await Promise.all([
      stageClient.functions.invoke("transferWindowActions", { action: "get_current" }),
      stageClient.entities.PlayerContract.filter({ status: "pending_window" }),
    ]);
    setCurrentWindow(winRes.data.window || null);
    setPendingCount(pendingContracts.length);
    setLoading(false);
  }

  async function openWindow() {
    setSaving(true);
    const res = await stageClient.functions.invoke("transferWindowActions", {
      action: "open_window",
      label: form.label || `Transfer Window ${new Date().toLocaleDateString()}`,
      start_date: form.start_date || new Date().toISOString(),
      end_date: form.end_date || null,
      notes: form.notes,
    });
    setCurrentWindow(res.data.window);
    setForm({ label: "", start_date: "", end_date: "", notes: "" });
    await load();
    setSaving(false);
  }

  async function closeWindow() {
    if (!currentWindow) return;
    if (!(await swalConfirm("Close the transfer window? Players will no longer transfer until the next window."))) return;
    setSaving(true);
    await stageClient.functions.invoke("transferWindowActions", {
      action: "close_window",
      window_id: currentWindow.id,
    });
    await load();
    setSaving(false);
  }

  async function executePending() {
    setSaving(true);
    const res = await stageClient.functions.invoke("transferWindowActions", { action: "execute_pending" });
    await swalAlert(`Executed ${res.data.transfers_executed} pending transfer(s).`);
    await load();
    setSaving(false);
  }

  const isOpen = currentWindow?.status === "open";

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Current window status */}
      <div className={cn(
        "rounded-xl border p-5 flex items-start gap-4",
        isOpen ? "bg-success/10 border-success/30" : "bg-muted/50 border-border"
      )}>
        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5", isOpen ? "bg-success/20" : "bg-muted")}>
          {isOpen
            ? <CheckCircle className="w-5 h-5 text-success" />
            : <XCircle className="w-5 h-5 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("font-bold", isOpen ? "text-success" : "text-foreground")}>
            Transfer Window: {isOpen ? "OPEN" : "CLOSED"}
          </p>
          {currentWindow ? (
            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
              {currentWindow.label && <p className="font-medium text-foreground/80">{currentWindow.label}</p>}
              {currentWindow.start_date && <p>Opened: {new Date(currentWindow.start_date).toLocaleString()}</p>}
              {currentWindow.end_date && <p>Closes: {new Date(currentWindow.end_date).toLocaleString()}</p>}
              <p>Transfers executed this window: <strong>{currentWindow.transfers_executed || 0}</strong></p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">No window has been created yet.</p>
          )}
        </div>
        {isOpen && (
          <Button
            size="sm"
            variant="outline"
            className="border-destructive/30 text-destructive hover:bg-destructive/10 shrink-0"
            onClick={closeWindow}
            disabled={saving}
          >
            <XCircle className="w-3.5 h-3.5 mr-1" /> Close Window
          </Button>
        )}
      </div>

      {/* Pending transfers */}
      {pendingCount > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-warning shrink-0" />
            <div>
              <p className="font-semibold text-warning text-sm">{pendingCount} transfer{pendingCount !== 1 ? "s" : ""} awaiting window</p>
              <p className="text-xs text-muted-foreground">These will auto-execute when the window opens.</p>
            </div>
          </div>
          {isOpen && (
            <Button size="sm" onClick={executePending} disabled={saving}
              className="bg-warning/10 text-warning border border-warning/30 hover:bg-warning/20 shrink-0">
              <Zap className="w-3.5 h-3.5 mr-1" /> Execute Now
            </Button>
          )}
        </div>
      )}

      {/* Open new window form */}
      {!isOpen && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h4 className="font-bold text-foreground text-sm uppercase tracking-wider">Open New Transfer Window</h4>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Window Label</label>
              <Input
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Summer 2026"
                className="bg-secondary border-border text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Close Date (optional)</label>
              <Input
                type="datetime-local"
                value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="bg-secondary border-border text-sm"
              />
            </div>
          </div>
          <Button
            onClick={openWindow}
            disabled={saving}
            className="w-full sm:w-auto bg-success/10 text-success border border-success/30 hover:bg-success/20"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            Open Transfer Window
          </Button>
        </div>
      )}
    </div>
  );
}
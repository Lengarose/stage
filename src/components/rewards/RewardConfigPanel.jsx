import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { saveRewardConfigs, defaultPositionLabel, defaultBadgeType, BADGE_STYLE } from "@/lib/rewardsEngine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Plus, Trash2, Check, Trophy, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { swalAlert } from "@/lib/swal";

const BADGE_OPTIONS = [
  { value: "winner",        label: "Winner (Gold)"      },
  { value: "finalist",      label: "Runner-Up (Silver)" },
  { value: "semi_finalist", label: "Semi-Final (Bronze)"},
  { value: "top_4",         label: "Top 4"              },
  { value: "participant",   label: "Participant"        },
];

function newRow(pos) {
  return {
    _key:           Date.now() + pos,
    position:       pos,
    position_label: defaultPositionLabel(pos),
    badge_type:     defaultBadgeType(pos),
    stc_amount:     0,
  };
}

export default function RewardConfigPanel({ sourceId, sourceType, sourceName, trophyImageUrl, onTrophyUrlChange }) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [dirty, setDirty]     = useState(false);
  const [trophyUrl, setTrophyUrl] = useState(trophyImageUrl || "");
  const [uploading, setUploading] = useState(false);
  const trophyFileRef = { current: null };

  useEffect(() => {
    setTrophyUrl(trophyImageUrl || "");
  }, [trophyImageUrl]);

  useEffect(() => {
    if (!sourceId) { setLoading(false); return; }
    setLoading(true);
    (stageClient.entities.RewardConfig?.filter({ source_id: sourceId }, null, 20) ?? Promise.resolve([]))
      .catch(() => [])
      .then(configs => {
        const sorted = configs.slice().sort((a, b) => a.position - b.position);
        setRows(sorted.map(c => ({ ...c, _key: c.id })));
        setLoading(false);
        setDirty(false);
      });
  }, [sourceId]);

  function addRow() {
    const maxPos = rows.reduce((m, r) => Math.max(m, Number(r.position) || 0), 0);
    setRows(prev => [...prev, newRow(maxPos + 1)]);
    setDirty(true);
  }

  function removeRow(key) {
    setRows(prev => prev.filter(r => r._key !== key));
    setDirty(true);
  }

  function updateRow(key, field, value) {
    setRows(prev => prev.map(r => {
      if (r._key !== key) return r;
      const updated = { ...r, [field]: value };
      if (field === "position") {
        updated.position_label = defaultPositionLabel(Number(value));
        updated.badge_type     = defaultBadgeType(Number(value));
      }
      return updated;
    }));
    setDirty(true);
  }

  async function handleSave() {
    if (!sourceId) return;
    setSaving(true);
    try {
      const cleaned = rows
        .filter(r => Number(r.position) > 0)
        .sort((a, b) => Number(a.position) - Number(b.position));
      await saveRewardConfigs(sourceId, sourceType, sourceName, cleaned);
      setDirty(false);
    } catch (err) {
      await swalAlert(`Save failed: ${err?.message || "Unknown error."}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleTrophyUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await stageClient.integrations.Core.UploadFile({ file });
      setTrophyUrl(file_url);
      if (onTrophyUrlChange) onTrophyUrlChange(file_url);
    } catch {
      await swalAlert("Upload failed. Paste the URL manually.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  if (!sourceId) {
    return <p className="text-xs text-muted-foreground py-4">Select a competition or league to configure rewards.</p>;
  }

  if (loading) {
    return <div className="text-xs text-muted-foreground py-4">Loading reward config…</div>;
  }

  return (
    <div className="space-y-5">
      {/* Trophy image */}
      <div className="bg-secondary/40 border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-accent shrink-0" />
          <p className="text-xs font-bold uppercase tracking-wider text-foreground">Trophy Image</p>
        </div>
        <div className="flex items-center gap-3">
          {trophyUrl ? (
            <img src={trophyUrl} alt="Trophy" className="w-12 h-12 object-contain rounded bg-secondary border border-border shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded bg-secondary border border-dashed border-border shrink-0 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-muted-foreground/30" />
            </div>
          )}
          <div className="flex-1 space-y-1.5">
            <Input
              value={trophyUrl}
              onChange={e => { setTrophyUrl(e.target.value); if (onTrophyUrlChange) onTrophyUrlChange(e.target.value); }}
              placeholder="https://… trophy image URL"
              className="h-8 text-xs bg-background border-border"
            />
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={handleTrophyUpload} ref={r => { trophyFileRef.current = r; }} />
              <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1.5 border-border" onClick={() => trophyFileRef.current?.click()} disabled={uploading} type="button">
                <Upload className="w-3 h-3" />
                {uploading ? "Uploading…" : "Upload PNG"}
              </Button>
            </label>
          </div>
        </div>
      </div>

      {/* STC reward table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-foreground">STC Prize Distribution</p>
          <Button size="sm" variant="outline" onClick={addRow}
            className="h-7 text-[10px] gap-1 border-border text-muted-foreground hover:text-foreground">
            <Plus className="w-3 h-3" /> Add Position
          </Button>
        </div>

        {rows.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-6 text-center">
            <p className="text-xs text-muted-foreground">No reward tiers configured. Add positions to set STC prizes.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {rows.map(row => {
              const style = BADGE_STYLE[row.badge_type] || BADGE_STYLE.participant;
              return (
                <div key={row._key} className="grid grid-cols-[40px_1fr_150px_100px_32px] gap-2 items-center bg-secondary/30 border border-border rounded px-2 py-1.5">
                  {/* Position */}
                  <Input
                    type="number" min={1} max={32}
                    value={row.position}
                    onChange={e => updateRow(row._key, "position", e.target.value)}
                    className="h-7 text-center text-xs bg-background border-border p-1"
                  />
                  {/* Label */}
                  <Input
                    value={row.position_label}
                    onChange={e => updateRow(row._key, "position_label", e.target.value)}
                    placeholder="e.g. Winner"
                    className="h-7 text-xs bg-background border-border"
                  />
                  {/* Badge */}
                  <Select value={row.badge_type} onValueChange={v => updateRow(row._key, "badge_type", v)}>
                    <SelectTrigger className="h-7 text-[10px] bg-background border-border">
                      <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold border", style.bg, style.text, style.border)}>
                        {style.label}
                      </span>
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      {BADGE_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* STC */}
                  <div className="relative">
                    <Input
                      type="number" min={0}
                      value={row.stc_amount}
                      onChange={e => updateRow(row._key, "stc_amount", e.target.value)}
                      className="h-7 text-xs bg-background border-border pr-8"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground font-bold">STC</span>
                  </div>
                  {/* Delete */}
                  <button onClick={() => removeRow(row._key)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {dirty && (
          <Button size="sm" onClick={handleSave} disabled={saving}
            className="h-8 text-xs bg-primary text-primary-foreground gap-1.5 w-full sm:w-auto">
            {saving
              ? <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin inline-block" />
              : <Check className="w-3.5 h-3.5" />
            }
            {saving ? "Saving…" : "Save Reward Config"}
          </Button>
        )}
      </div>
    </div>
  );
}

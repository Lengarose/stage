import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trophy, Upload, X, Trash2, Pencil, Check, Link2, Unlink } from "lucide-react";
import { cn } from "@/lib/utils";

const COMP_SLUGS = ["supreme", "elite", "challenger"];

function SourcePicker({ value, onChange, competitions, regionalLeagues }) {
  const type = value?.type || "";
  const id   = value?.id   || "";

  function setType(t) {
    onChange(t ? { type: t, id: "", name: "" } : null);
  }

  function setSource(sourceId) {
    if (!sourceId) { onChange({ type, id: "", name: "" }); return; }
    if (type === "competition") {
      const c = competitions.find(c => c.id === sourceId);
      onChange({ type, id: sourceId, name: c?.name || "" });
    } else {
      const l = regionalLeagues.find(l => l.id === sourceId);
      onChange({ type, id: sourceId, name: l?.name || "" });
    }
  }

  const officialComps = competitions.filter(c => COMP_SLUGS.includes(c.slug));

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {[
          { v: "",               label: "No Link" },
          { v: "competition",    label: "STAGE Competition" },
          { v: "regional_league", label: "Regional League" },
        ].map(opt => (
          <button key={opt.v} type="button"
            onClick={() => setType(opt.v)}
            className={cn(
              "flex-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1.5 rounded border transition-colors",
              type === opt.v
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40"
            )}>
            {opt.label}
          </button>
        ))}
      </div>
      {type === "competition" && officialComps.length > 0 && (
        <select value={id}
          onChange={e => setSource(e.target.value)}
          className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50">
          <option value="">— select competition —</option>
          {officialComps.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      {type === "regional_league" && regionalLeagues.length > 0 && (
        <select value={id}
          onChange={e => setSource(e.target.value)}
          className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50">
          <option value="">— select league —</option>
          {regionalLeagues
            .slice()
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
            .map(l => <option key={l.id} value={l.id}>{l.name}{l.division ? ` (Div ${l.division})` : ""}</option>)}
        </select>
      )}
    </div>
  );
}

export default function TrophiesTab({
  newTrophyName,
  setNewTrophyName,
  newTrophyFile,
  setNewTrophyFile,
  newTrophyAdminOnly,
  setNewTrophyAdminOnly,
  newTrophyLinkedSource,
  setNewTrophyLinkedSource,
  uploadingTrophy,
  trophyUploadError,
  trophyFileRef,
  createTrophyItem,
  deleteTrophyItem,
  updateTrophyItem,
  trophyItems,
  competitions,
  regionalLeagues,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [replaceFile, setReplaceFile] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [previewTrophy, setPreviewTrophy] = useState(null);
  const replaceFileRef = useRef(null);

  function openEdit(trophy) {
    setEditingId(trophy.id);
    setReplaceFile(null);
    setEditForm({
      name: trophy.name || "",
      description: trophy.description || "",
      admin_only: !!trophy.admin_only,
      source: trophy.linked_source_id
        ? { type: trophy.linked_source_type || "", id: trophy.linked_source_id, name: trophy.linked_source_name || "" }
        : null,
    });
  }

  async function saveEdit(trophy) {
    setSavingEdit(true);
    try {
      await updateTrophyItem(trophy.id, editForm, replaceFile);
      setEditingId(null);
      setReplaceFile(null);
    } finally {
      setSavingEdit(false);
    }
  }

  const linked = trophyItems.filter(t => t.linked_source_id);
  const unlinked = trophyItems.filter(t => !t.linked_source_id);

  return (
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
              <button type="button" onClick={() => setNewTrophyFile(null)} className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button type="button"
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

        <div>
          <label className="label-xs">Link to Competition or League</label>
          <SourcePicker
            value={newTrophyLinkedSource}
            onChange={setNewTrophyLinkedSource}
            competitions={competitions}
            regionalLeagues={regionalLeagues}
          />
          {newTrophyLinkedSource?.id && (
            <p className="text-[10px] text-primary mt-1">
              Linked to: {newTrophyLinkedSource.name} — trophy image will auto-sync
            </p>
          )}
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
            Admin-Only — only for STAGE competitions/leagues, not user tournaments
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
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">{trophyItems.length} trophy{trophyItems.length !== 1 ? "ies" : ""} in library</p>

          {/* Linked trophies */}
          {linked.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Link2 className="w-3 h-3" /> Linked to Competition / League
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {linked.map(trophy => (
                  <TrophyCard
                    key={trophy.id}
                    trophy={trophy}
                    isEditing={editingId === trophy.id}
                    editForm={editForm}
                    setEditForm={setEditForm}
                    replaceFile={replaceFile}
                    setReplaceFile={setReplaceFile}
                    replaceFileRef={replaceFileRef}
                    savingEdit={savingEdit}
                    onEdit={() => openEdit(trophy)}
                    onCancelEdit={() => { setEditingId(null); setReplaceFile(null); }}
                    onSaveEdit={() => saveEdit(trophy)}
                    onDelete={() => deleteTrophyItem(trophy.id)}
                    onPreview={() => setPreviewTrophy(trophy)}
                    competitions={competitions}
                    regionalLeagues={regionalLeagues}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Unlinked trophies */}
          {unlinked.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Unlink className="w-3 h-3" /> Not Linked
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {unlinked.map(trophy => (
                  <TrophyCard
                    key={trophy.id}
                    trophy={trophy}
                    isEditing={editingId === trophy.id}
                    editForm={editForm}
                    setEditForm={setEditForm}
                    replaceFile={replaceFile}
                    setReplaceFile={setReplaceFile}
                    replaceFileRef={replaceFileRef}
                    savingEdit={savingEdit}
                    onEdit={() => openEdit(trophy)}
                    onCancelEdit={() => { setEditingId(null); setReplaceFile(null); }}
                    onSaveEdit={() => saveEdit(trophy)}
                    onDelete={() => deleteTrophyItem(trophy.id)}
                    onPreview={() => setPreviewTrophy(trophy)}
                    competitions={competitions}
                    regionalLeagues={regionalLeagues}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Image preview lightbox */}
      {previewTrophy && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setPreviewTrophy(null)}
        >
          <div className="relative bg-card border border-border rounded-xl p-6 flex flex-col items-center gap-4 max-w-xs w-full mx-4" onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setPreviewTrophy(null)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
            {previewTrophy.image_url
              ? <img src={previewTrophy.image_url} alt={previewTrophy.name} className="w-40 h-40 object-contain drop-shadow-2xl" />
              : <Trophy className="w-20 h-20 text-warning/20" />}
            <p className="text-sm font-bold text-foreground text-center">{previewTrophy.name}</p>
            {previewTrophy.linked_source_name && (
              <p className="text-[10px] text-primary text-center">{previewTrophy.linked_source_name}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TrophyCard({
  trophy, isEditing, editForm, setEditForm,
  replaceFile, setReplaceFile, replaceFileRef,
  savingEdit, onEdit, onCancelEdit, onSaveEdit, onDelete, onPreview,
  competitions, regionalLeagues,
}) {
  const imagePreview = replaceFile ? URL.createObjectURL(replaceFile) : trophy.image_url;

  return (
    <div className={cn(
      "bg-card border border-border rounded p-3 flex flex-col gap-2 relative",
      isEditing && "border-primary/40 bg-primary/5"
    )}>
      {/* Header actions */}
      {!isEditing && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ opacity: undefined }}>
        </div>
      )}

      {/* Image */}
      <div className="flex justify-center">
        <button type="button" onClick={onPreview} className="relative group/img">
          {imagePreview ? (
            <img src={imagePreview} alt={trophy.name} className="w-16 h-16 object-contain drop-shadow-xl hover:scale-110 transition-transform" />
          ) : (
            <div className="w-16 h-16 flex items-center justify-center text-warning/20">
              <Trophy className="w-8 h-8" />
            </div>
          )}
          <span className="absolute inset-0 flex items-end justify-center pb-0.5 opacity-0 group-hover/img:opacity-100 transition-opacity">
            <span className="text-[8px] bg-black/70 text-white px-1 rounded">preview</span>
          </span>
        </button>
      </div>

      {!isEditing ? (
        <>
          <p className="text-xs font-bold text-foreground text-center line-clamp-1">{trophy.name}</p>
          <div className="flex flex-wrap justify-center gap-1">
            {trophy.is_official && (
              <span className="text-[8px] px-1.5 py-0.5 rounded border border-warning/30 text-warning bg-warning/5 font-bold uppercase tracking-wider">Official</span>
            )}
            {trophy.admin_only ? (
              <span className="text-[8px] px-1.5 py-0.5 rounded border border-destructive/30 text-destructive bg-destructive/5 font-bold uppercase tracking-wider">Admin Only</span>
            ) : (
              <span className="text-[8px] px-1.5 py-0.5 rounded border border-success/30 text-success bg-success/5 font-bold uppercase tracking-wider">User</span>
            )}
            {trophy.linked_source_name && (
              <span className="text-[8px] px-1.5 py-0.5 rounded border border-primary/30 text-primary bg-primary/5 font-bold uppercase tracking-wider truncate max-w-full">{trophy.linked_source_name}</span>
            )}
          </div>
          <div className="flex gap-1 mt-auto">
            <Button size="sm" variant="outline" onClick={onEdit}
              className="flex-1 h-6 text-[9px] rounded border-border text-muted-foreground hover:text-foreground gap-1">
              <Pencil className="w-2.5 h-2.5" /> Edit
            </Button>
            <button type="button" onClick={onDelete}
              className="w-6 h-6 rounded border border-destructive/30 flex items-center justify-center text-destructive/50 hover:text-destructive hover:border-destructive hover:bg-destructive/10 transition-all">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-2 pt-1">
          <div>
            <label className="text-[10px] text-muted-foreground block mb-0.5">Name</label>
            <Input value={editForm.name || ""}
              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              className="bg-secondary border-border text-xs h-7" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-0.5">Replace Image</label>
            {replaceFile ? (
              <div className="flex items-center gap-2">
                <img src={URL.createObjectURL(replaceFile)} alt="new" className="w-8 h-8 object-contain" />
                <span className="text-[10px] text-warning flex-1 truncate">{replaceFile.name}</span>
                <button type="button" onClick={() => setReplaceFile(null)}><X className="w-3 h-3 text-muted-foreground" /></button>
              </div>
            ) : (
              <button type="button" onClick={() => replaceFileRef.current?.click()}
                className="w-full h-8 rounded border border-dashed border-warning/30 hover:border-warning/50 flex items-center justify-center gap-1 text-warning/60 hover:text-warning text-[10px] transition-colors">
                <Upload className="w-3 h-3" /> Upload new PNG
              </button>
            )}
            <input ref={replaceFileRef} type="file" accept="image/png,image/*" className="hidden"
              onChange={e => e.target.files[0] && setReplaceFile(e.target.files[0])} />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-0.5">Link Source</label>
            <SourcePicker
              value={editForm.source}
              onChange={src => setEditForm(f => ({ ...f, source: src }))}
              competitions={competitions}
              regionalLeagues={regionalLeagues}
            />
          </div>
          <div className="flex items-center gap-2 px-0.5">
            <input id={`ao-${trophy.id}`} type="checkbox"
              checked={editForm.admin_only || false}
              onChange={e => setEditForm(f => ({ ...f, admin_only: e.target.checked }))}
              className="w-3.5 h-3.5 rounded border-border bg-secondary text-warning" />
            <label htmlFor={`ao-${trophy.id}`} className="text-[10px] text-muted-foreground cursor-pointer">Admin Only</label>
          </div>
          <div className="flex gap-1 pt-1">
            <Button size="sm" onClick={onSaveEdit} disabled={savingEdit}
              className="flex-1 h-7 text-[10px] bg-primary text-primary-foreground rounded gap-1">
              {savingEdit ? <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin inline-block" /> : <Check className="w-3 h-3" />}
              {savingEdit ? "Saving…" : "Save"}
            </Button>
            <button type="button" onClick={onCancelEdit}
              className="w-7 h-7 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

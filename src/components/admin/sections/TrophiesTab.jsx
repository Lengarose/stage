import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trophy, Upload, X, Trash2 } from "lucide-react";

export default function TrophiesTab({
  newTrophyName,
  setNewTrophyName,
  newTrophyFile,
  setNewTrophyFile,
  newTrophyAdminOnly,
  setNewTrophyAdminOnly,
  uploadingTrophy,
  trophyUploadError,
  trophyFileRef,
  createTrophyItem,
  deleteTrophyItem,
  trophyItems,
}) {
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
  );
}

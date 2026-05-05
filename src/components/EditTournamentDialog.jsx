import { useState, useRef } from "react";
import { stageClient } from "@/api/stageClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, Trophy } from "lucide-react";
import ImagePositionEditor from "./ImagePositionEditor";

const NEUTRAL_COLORS = [
  "#1a2a4a", "#0d2d1a", "#2d1a0d", "#2d0d1a", "#1a0d2d",
  "#0d1a2d", "#1a1a1a", "#2d2200", "#002d2d", "#1a001a",
];

export default function EditTournamentDialog({ tournament, open, onClose, onSave }) {
  const [form, setForm] = useState({
    name: tournament.name || "",
    description: tournament.description || "",
    prize_description: tournament.prize_description || "",
    start_date: tournament.start_date ? new Date(tournament.start_date).toISOString().slice(0, 16) : "",
    entry_credits: tournament.entry_credits?.toString() || "50",
    banner_url: tournament.banner_url || "",
    banner_color: tournament.banner_color || "#1a2a4a",
    banner_position: tournament.banner_position || "50% 50%",
  });
  const [bannerPreview, setBannerPreview] = useState(tournament.banner_url || null);
  const [bannerFile, setBannerFile] = useState(null);
  const [posEditorOpen, setPosEditorOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [trophyFile, setTrophyFile] = useState(null);
  const [trophyPreview, setTrophyPreview] = useState(tournament.trophy_url || null);
  const bannerInputRef = useRef(null);
  const trophyInputRef = useRef(null);

  async function handleBannerFile(file) {
    if (!file) return;
    setBannerFile(file);
    const url = URL.createObjectURL(file);
    setBannerPreview(url);
    setPosEditorOpen(true);
  }

  async function handleBannerPositionSave(imageUrl, position) {
    setPosEditorOpen(false);
    setForm(f => ({ ...f, banner_position: position }));
    setUploading(true);
    const { file_url } = await stageClient.integrations.Core.UploadFile({ file: bannerFile });
    setForm(f => ({ ...f, banner_url: file_url }));
    setBannerPreview(file_url);
    setBannerFile(null);
    setUploading(false);
  }

  async function handleSave() {
    setSaving(true);
    let trophy_url = trophyPreview || tournament.trophy_url || "";
    if (trophyFile) {
      const res = await stageClient.integrations.Core.UploadFile({ file: trophyFile });
      trophy_url = res.file_url;
    }
    const updates = {
      name: form.name,
      description: form.description,
      prize_description: form.prize_description,
      start_date: form.start_date ? new Date(form.start_date).toISOString() : "",
      entry_credits: parseInt(form.entry_credits) || 50,
      banner_url: form.banner_url,
      banner_color: form.banner_color,
      banner_position: form.banner_position,
      trophy_url,
    };
    await stageClient.entities.Tournament.update(tournament.id, updates);
    setSaving(false);
    onSave(updates);
    onClose();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Edit Tournament</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Name</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Description</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-secondary border-border" rows={3} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Prize Description</label>
              <Input value={form.prize_description} onChange={e => setForm(f => ({ ...f, prize_description: e.target.value }))} className="bg-secondary border-border" placeholder="e.g. Custom badge + credits" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Start Date</label>
                <Input type="datetime-local" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="bg-secondary border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Entry Credits</label>
                <Input type="number" min="0" value={form.entry_credits} onChange={e => setForm(f => ({ ...f, entry_credits: e.target.value }))} className="bg-secondary border-border" />
              </div>
            </div>

            {/* Banner */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Tournament Banner</label>
              {bannerPreview || form.banner_url ? (
                <div className="relative rounded-xl overflow-hidden mb-2" style={{ height: 220 }}>
                  <div className="w-full h-full" style={{
                    backgroundImage: `url(${bannerPreview || form.banner_url})`,
                    backgroundSize: "cover",
                    backgroundPosition: form.banner_position,
                  }} />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
                  {(trophyFile || trophyPreview) && (
                    <div className="absolute bottom-4 right-4 flex flex-col items-center gap-0.5 pointer-events-none">
                      <img src={trophyFile ? URL.createObjectURL(trophyFile) : trophyPreview} alt="trophy"
                        className="w-20 h-20 object-contain drop-shadow-[0_0_20px_rgba(251,191,36,0.7)]" />
                      <span className="text-[8px] text-warning/70 uppercase tracking-widest bg-black/40 px-1.5 py-0.5 rounded-full">{form.name} Trophy</span>
                    </div>
                  )}
                  <button onClick={() => { setBannerPreview(null); setBannerFile(null); setForm(f => ({ ...f, banner_url: "", banner_position: "50% 50%" })); }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80">
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {uploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <button onClick={() => bannerInputRef.current?.click()}
                    className="w-full h-20 rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-3">
                    <Upload className="w-5 h-5" />
                    <span className="text-xs">Upload custom banner</span>
                  </button>
                  <input ref={bannerInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => e.target.files[0] && handleBannerFile(e.target.files[0])} />
                  <p className="text-xs text-muted-foreground mb-2">Or pick a color:</p>
                  <div className="flex flex-wrap gap-2">
                    {NEUTRAL_COLORS.map(color => (
                      <button key={color} onClick={() => setForm(f => ({ ...f, banner_color: color, banner_url: "" }))}
                        className="w-8 h-8 rounded-lg border-2 transition-all"
                        style={{ background: color, borderColor: form.banner_color === color && !form.banner_url ? "white" : "transparent" }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Trophy Upload */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">🏆 Tournament Trophy (PNG only)</label>
              {trophyFile || trophyPreview ? (
                <div className="flex items-center gap-3 bg-warning/10 border border-warning/20 rounded-xl p-3">
                  <img src={trophyFile ? URL.createObjectURL(trophyFile) : trophyPreview} alt="trophy" className="w-12 h-12 object-contain" />
                  <span className="text-xs text-warning flex-1 truncate">{trophyFile ? trophyFile.name : "Current trophy"}</span>
                  <button onClick={() => { setTrophyFile(null); setTrophyPreview(null); }} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <button onClick={() => trophyInputRef.current?.click()}
                  className="w-full h-20 rounded-xl border-2 border-dashed border-warning/30 hover:border-warning/60 flex flex-col items-center justify-center gap-1 text-warning/60 hover:text-warning transition-colors">
                  <Trophy className="w-6 h-6" />
                  <span className="text-xs">Upload trophy image (PNG)</span>
                </button>
              )}
              <input ref={trophyInputRef} type="file" accept="image/png" className="hidden"
                onChange={e => { if (e.target.files[0]) { setTrophyFile(e.target.files[0]); setTrophyPreview(null); } }} />
            </div>

            <Button onClick={handleSave} disabled={saving || !form.name} className="w-full bg-primary text-primary-foreground">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {posEditorOpen && bannerPreview && (
        <ImagePositionEditor
          open={posEditorOpen}
          onClose={() => setPosEditorOpen(false)}
          imageUrl={bannerPreview}
          aspect="banner"
          onConfirm={handleBannerPositionSave}
        />
      )}
    </>
  );
}
import { useState, useRef } from "react";
import BannerPreviewEditor from "./BannerPreviewEditor";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Move } from "lucide-react";

export default function BannerSelector({ open, onClose, currentBannerId, onSelect, previewData, currentBannerPosition, currentBannerZoom }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [pendingUrl, setPendingUrl] = useState(null);
  const [repositioning, setRepositioning] = useState(false);
  const fileRef = useRef();

  const currentIsUrl = typeof currentBannerId === "string" && currentBannerId.startsWith("http");

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Upload timed out. Please try again.")), 30000)
      );
      const { file_url } = await Promise.race([
        base44.integrations.Core.UploadFile({ file }),
        timeout,
      ]);
      setPendingUrl(file_url);
    } catch (err) {
      setUploadError(err?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function handleReposition() {
    setRepositioning(true);
    onClose();
  }

  return (<>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl">Change Banner</DialogTitle>
        </DialogHeader>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />

        <div className="space-y-3 pt-1">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-3 w-full border border-dashed border-border rounded-xl p-4 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
          >
            {uploading
              ? <><div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> Uploading...</>
              : <><Upload className="w-4 h-4" /> Upload a banner image</>}
          </button>
          {uploadError && (
            <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {uploadError}
            </p>
          )}

          {currentIsUrl && (
            <button
              onClick={handleReposition}
              className="flex items-center gap-3 w-full border border-border rounded-xl p-4 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
            >
              <Move className="w-4 h-4" />
              Reposition current banner
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Editor for newly uploaded image */}
    <BannerPreviewEditor
      open={!!pendingUrl}
      onClose={() => setPendingUrl(null)}
      imageUrl={pendingUrl}
      previewData={previewData}
      onConfirm={(url, position, zoom) => {
        setPendingUrl(null);
        onSelect(url, position, zoom);
      }}
    />

    {/* Editor for repositioning existing banner */}
    <BannerPreviewEditor
      open={repositioning}
      onClose={() => setRepositioning(false)}
      imageUrl={currentIsUrl ? currentBannerId : null}
      previewData={previewData}
      initialPosition={currentBannerPosition}
      initialZoom={currentBannerZoom}
      onConfirm={(url, position, zoom) => {
        setRepositioning(false);
        onSelect(url, position, zoom);
      }}
    />
  </>);
}

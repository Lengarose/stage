import { useState, useRef, useEffect } from "react";
import BannerPreviewEditor from "./BannerPreviewEditor";
import { stageClient } from "@/api/stageClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Move } from "lucide-react";

export default function BannerSelector({ open, onClose, currentBannerId, onSelect, previewData, currentBannerPosition, currentBannerZoom }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [pendingUrl, setPendingUrl] = useState(null);
  const [repositioning, setRepositioning] = useState(false);
  const fileRef = useRef();

  // Reset state every time the dialog opens so stale uploading/error state never shows
  useEffect(() => {
    if (open) {
      setUploading(false);
      setUploadError(null);
      setPendingUrl(null);
    }
  }, [open]);

  const currentIsUrl = typeof currentBannerId === "string" && currentBannerId.startsWith("http");

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clear the input immediately — before any await — so we never hit
    // "can't set value on detached element" in the finally block
    e.target.value = "";

    setUploading(true);
    setUploadError(null);

    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Upload timed out. Please try again.")), 20000)
      );
      const result = await Promise.race([
        stageClient.integrations.Core.UploadFile({ file }),
        timeout,
      ]);
      if (!result?.file_url) throw new Error("Upload failed — no URL returned.");
      setPendingUrl(result.file_url);
    } catch (err) {
      setUploadError(err?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleReposition() {
    setRepositioning(true);
    onClose();
  }

  return (<>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="bg-card border-border max-w-sm"
        // Prevent the dialog from closing when the OS file-picker opens.
        // Without this, Radix fires onInteractOutside the moment the browser
        // hands focus to the OS file dialog, closing our dialog mid-upload.
        onInteractOutside={e => e.preventDefault()}
        onPointerDownOutside={e => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">Change Banner</DialogTitle>
        </DialogHeader>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />

        <div className="space-y-3 pt-1">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-3 w-full border border-dashed border-border rounded-xl p-4 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors disabled:opacity-60"
          >
            {uploading
              ? <><div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" /> Uploading…</>
              : <><Upload className="w-4 h-4 shrink-0" /> Upload a banner image</>}
          </button>
          {uploadError && (
            <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {uploadError}
            </p>
          )}

          {currentIsUrl && !uploading && (
            <button
              onClick={handleReposition}
              className="flex items-center gap-3 w-full border border-border rounded-xl p-4 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
            >
              <Move className="w-4 h-4 shrink-0" />
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

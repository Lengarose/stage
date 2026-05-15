import { useRef, useState, useCallback } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Upload, Image } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Image field: paste a URL, click/drop on the preview zone, or use Upload.
 */
export default function ImageUploadField({
  value,
  onChange,
  label,
  preview = "landscape",
  placeholder = "https://…",
}) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const previewHeight = preview === "landscape" ? "h-36" : preview === "hero" ? "h-40" : "h-20";

  const uploadFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith("image/")) {
      setUploadError("Please choose an image file.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const result = await stageClient.integrations.Core.UploadFile({ file });
      if (!result?.file_url) throw new Error("Upload failed — no URL returned.");
      onChange(result.file_url);
    } catch (err) {
      const msg = err?.message || err?.data?.error || "Upload failed. Paste a URL instead.";
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  }, [onChange]);

  function handleFileInput(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) uploadFile(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  function openFilePicker() {
    if (!uploading) fileRef.current?.click();
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          {label}
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInput}
      />

      {/* Dropzone + preview */}
      <button
        type="button"
        disabled={uploading}
        onClick={openFilePicker}
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
        onDrop={handleDrop}
        className={cn(
          "group relative w-full rounded-xl border border-dashed mb-2 overflow-hidden transition-colors text-left",
          previewHeight,
          dragOver
            ? "border-primary bg-primary/10"
            : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50",
          uploading && "opacity-60 cursor-wait"
        )}
      >
        {value ? (
          <>
            <img src={value} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <p className="text-[10px] uppercase tracking-widest text-white font-semibold">
                {uploading ? "Uploading…" : "Click or drop to replace"}
              </p>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground/50 px-4">
            <Image className="w-7 h-7" />
            <p className="text-[10px] uppercase tracking-widest font-semibold text-center">
              {uploading ? "Uploading…" : dragOver ? "Drop image here" : "Drop image or click to browse"}
            </p>
          </div>
        )}
      </button>

      {/* URL + upload button */}
      <div className="flex gap-2 items-center">
        <Input
          value={value}
          onChange={(e) => {
            setUploadError(null);
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          className="h-8 text-xs flex-1"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-[10px] gap-1.5 px-3 shrink-0"
          onClick={openFilePicker}
          disabled={uploading}
        >
          <Upload className="w-3 h-3" />
          {uploading ? "…" : "Upload"}
        </Button>
        {value && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => { setUploadError(null); onChange(""); }}
            disabled={uploading}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {uploadError && (
        <p className="text-[10px] text-destructive">{uploadError}</p>
      )}
    </div>
  );
}

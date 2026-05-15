import { useRef, useState, useCallback } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Upload, Image } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Image field: paste a URL, click/drop on the preview zone, or use Upload.
 */
const glassInputCls =
  "w-full bg-white/10 border border-white/20 text-white placeholder-white/35 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-white/55 focus:bg-white/15 transition-all h-9";

export default function ImageUploadField({
  value,
  onChange,
  label,
  preview = "landscape",
  placeholder = "https://…",
  variant = "default",
}) {
  const isGlass = variant === "glass";
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
        <p className={cn(
          "text-[10px] uppercase tracking-widest font-semibold",
          isGlass ? "text-white/45" : "text-muted-foreground"
        )}>
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
            ? isGlass ? "border-white/60 bg-white/15" : "border-primary bg-primary/10"
            : isGlass
              ? "border-white/25 bg-white/5 hover:border-white/40 hover:bg-white/10"
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
          <div className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-4",
            isGlass ? "text-white/40" : "text-muted-foreground/50"
          )}>
            <Image className="w-7 h-7" />
            <p className="text-[10px] uppercase tracking-widest font-semibold text-center">
              {uploading ? "Uploading…" : dragOver ? "Drop image here" : "Drop image or click to browse"}
            </p>
          </div>
        )}
      </button>

      {/* URL + upload button */}
      <div className="flex gap-2 items-center">
        {isGlass ? (
          <input
            type="text"
            value={value}
            onChange={(e) => {
              setUploadError(null);
              onChange(e.target.value);
            }}
            placeholder={placeholder}
            className={`${glassInputCls} flex-1 min-w-0`}
          />
        ) : (
          <Input
            value={value}
            onChange={(e) => {
              setUploadError(null);
              onChange(e.target.value);
            }}
            placeholder={placeholder}
            className="h-8 text-xs flex-1"
          />
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(
            "h-8 text-[10px] gap-1.5 px-3 shrink-0",
            isGlass && "border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
          )}
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
            className={cn(
              "h-8 px-2 shrink-0",
              isGlass ? "text-white/50 hover:text-red-300 hover:bg-white/10" : "text-muted-foreground hover:text-destructive"
            )}
            onClick={() => { setUploadError(null); onChange(""); }}
            disabled={uploading}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {uploadError && (
        <p className={cn("text-[10px]", isGlass ? "text-red-300" : "text-destructive")}>{uploadError}</p>
      )}
    </div>
  );
}

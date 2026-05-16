import { useState } from "react";
import { Move } from "lucide-react";
import ImagePositionEditor from "@/components/ImagePositionEditor";
import ImageUploadField from "@/components/admin/shared/ImageUploadField";
import { Button } from "@/components/ui/button";

export default function PositionedImageUploadField({
  label,
  value,
  onChange,
  position,
  onPositionChange,
  zoom,
  onZoomChange,
  preview = "landscape",
  placeholder = "https://... or drop image above",
  title = "STAGE",
  subtitle = "Preview",
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const aspect = preview === "hero" ? "banner" : "banner";
  const previewClass = preview === "hero" ? "aspect-[21/9]" : "aspect-[16/10]";
  const previewStyle = value
    ? {
      backgroundImage: `url(${value})`,
      backgroundSize: zoom ? `${zoom}%` : "cover",
      backgroundPosition: position || "50% 50%",
      backgroundRepeat: "no-repeat",
    }
    : {};

  return (
    <div className="space-y-3">
      <ImageUploadField
        label={label}
        value={value}
        onChange={onChange}
        preview={preview}
        placeholder={placeholder}
      />

      {value && (
        <div className="space-y-2">
          <div className={`${previewClass} relative overflow-hidden rounded-xl border border-border bg-secondary`} style={previewStyle}>
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
            <div className="absolute left-4 bottom-4 right-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-white/50 font-bold">{subtitle}</p>
              <p className="font-heading text-2xl uppercase text-white leading-none mt-1">{title}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground">
              Position: <span className="text-foreground">{position || "50% 50%"}</span>
              {zoom ? <> | Zoom: <span className="text-foreground">{zoom}%</span></> : null}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setEditorOpen(true)}
              className="h-7 text-[10px] gap-1.5"
            >
              <Move className="w-3 h-3" /> Reposition
            </Button>
          </div>
        </div>
      )}

      <ImagePositionEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        imageUrl={value}
        aspect={aspect}
        initialPosition={position || "50% 50%"}
        initialZoom={zoom || (preview === "hero" ? 120 : 100)}
        onConfirm={(_, nextPosition, nextZoom) => {
          onPositionChange(nextPosition);
          onZoomChange(nextZoom);
          setEditorOpen(false);
        }}
      />
    </div>
  );
}

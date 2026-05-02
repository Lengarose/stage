import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Move, User, Shield, Monitor, Tablet, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Full-featured banner position + zoom editor with multi-size preview.
 *
 * Props:
 *  open, onClose
 *  imageUrl              – uploaded image URL
 *  initialPosition       – "50% 50%" string to pre-load
 *  initialZoom           – number to pre-load
 *  onConfirm(url, position, zoom)
 *  previewData: { name, subtitle, avatarUrl, type: "player"|"club" }
 */
export default function BannerPreviewEditor({
  open,
  onClose,
  imageUrl,
  onConfirm,
  previewData = {},
  initialPosition,
  initialZoom,
}) {
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [zoom, setZoom] = useState(120);
  const [previewSize, setPreviewSize] = useState("desktop");
  const dragRef = useRef(null);

  // Sync initial values every time dialog opens
  useEffect(() => {
    if (!open) return;
    if (initialPosition) {
      const parts = initialPosition.split(" ");
      setX(parseFloat(parts[0]) || 50);
      setY(parseFloat(parts[1]) || 50);
    } else {
      setX(50);
      setY(50);
    }
    setZoom(initialZoom || 120);
  }, [open, initialPosition, initialZoom]);

  const position = `${x}% ${y}%`;
  const bgSize = `${zoom}%`;

  function startDrag(clientX, clientY) {
    dragRef.current = { startX: clientX, startY: clientY, startBgX: x, startBgY: y };
  }

  function moveDrag(clientX, clientY, rect) {
    if (!dragRef.current) return;
    const { startX, startY, startBgX, startBgY } = dragRef.current;
    const dx = ((clientX - startX) / rect.width) * 100;
    const dy = ((clientY - startY) / rect.height) * 100;
    setX(Math.round(Math.max(0, Math.min(100, startBgX - dx))));
    setY(Math.round(Math.max(0, Math.min(100, startBgY - dy))));
  }

  function endDrag() { dragRef.current = null; }

  const bannerStyle = {
    backgroundImage: `url(${imageUrl})`,
    backgroundSize: bgSize,
    backgroundPosition: position,
    backgroundRepeat: "no-repeat",
    backgroundColor: "hsl(var(--secondary))",
  };

  const PREVIEW_SIZES = {
    desktop: { label: "Desktop", icon: Monitor, bannerH: "h-44", containerW: "w-full" },
    tablet:  { label: "Tablet",  icon: Tablet,  bannerH: "h-36", containerW: "max-w-sm mx-auto" },
    mobile:  { label: "Mobile",  icon: Smartphone, bannerH: "h-28", containerW: "max-w-[280px] mx-auto" },
  };

  const currentSize = PREVIEW_SIZES[previewSize];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="bg-card border-border max-w-2xl p-0 overflow-hidden"
        onPointerDownOutside={e => e.preventDefault()}
        onInteractOutside={e => e.preventDefault()}
      >
        <div className="p-5 border-b border-border">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <Move className="w-4 h-4 text-primary" /> Position Your Banner
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mt-1">
            Drag the banner area to reposition. Switch preview sizes to see how it looks on different screens.
          </p>
        </div>

        {/* Size switcher */}
        <div className="flex gap-1 px-5 pt-4">
          {Object.entries(PREVIEW_SIZES).map(([key, cfg]) => {
            const Icon = cfg.icon;
            return (
              <button
                key={key}
                onClick={() => setPreviewSize(key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  previewSize === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Preview */}
        <div className="px-5 pt-3 pb-4 bg-secondary/30">
          <div className={cn("transition-all duration-300", currentSize.containerW)}>
            {/* Draggable banner */}
            <div
              className={cn("relative w-full overflow-hidden cursor-grab active:cursor-grabbing select-none rounded-t-xl", currentSize.bannerH)}
              style={bannerStyle}
              onMouseDown={e => { e.preventDefault(); startDrag(e.clientX, e.clientY); }}
              onMouseMove={e => { if (dragRef.current) moveDrag(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect()); }}
              onMouseUp={endDrag}
              onMouseLeave={endDrag}
              onTouchStart={e => { const t = e.touches[0]; startDrag(t.clientX, t.clientY); }}
              onTouchMove={e => { if (!dragRef.current) return; e.preventDefault(); const t = e.touches[0]; moveDrag(t.clientX, t.clientY, e.currentTarget.getBoundingClientRect()); }}
              onTouchEnd={endDrag}
            >
              <div className="absolute top-2 right-2 bg-black/60 text-white text-[9px] px-2 py-1 rounded-full pointer-events-none">
                Drag to reposition
              </div>
            </div>

            {/* Profile info snippet */}
            <div className="bg-card rounded-b-xl px-4 pb-3 border border-t-0 border-border">
              <div className="flex items-end gap-3 -mt-7 mb-2">
                <div className={cn(
                  "border-4 border-card bg-secondary flex items-center justify-center overflow-hidden shrink-0 shadow-lg",
                  previewSize === "mobile" ? "w-12 h-12 rounded-xl" : "w-16 h-16 rounded-2xl"
                )}>
                  {previewData.avatarUrl
                    ? <img src={previewData.avatarUrl} alt="" className="w-full h-full object-cover" />
                    : previewData.type === "club"
                      ? <Shield className="w-6 h-6 text-primary" />
                      : <User className="w-6 h-6 text-muted-foreground" />
                  }
                </div>
                <div className="pb-1">
                  <p className="font-bold text-foreground text-base leading-tight">{previewData.name || "Your Name"}</p>
                  {previewData.subtitle && <p className="text-xs text-muted-foreground">{previewData.subtitle}</p>}
                </div>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/50 italic mt-2 text-center">↑ {currentSize.label} preview</p>
        </div>

        {/* Controls */}
        <div className="p-5 space-y-3 border-t border-border">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex justify-between">
              <span>Zoom</span><span>{zoom}%</span>
            </label>
            <input type="range" min={50} max={500} value={zoom} onChange={e => setZoom(Number(e.target.value))} className="w-full accent-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex justify-between">
                <span>Horizontal</span><span>{x}%</span>
              </label>
              <input type="range" min={0} max={100} value={x} onChange={e => setX(Number(e.target.value))} className="w-full accent-primary" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex justify-between">
                <span>Vertical</span><span>{y}%</span>
              </label>
              <input type="range" min={0} max={100} value={y} onChange={e => setY(Number(e.target.value))} className="w-full accent-primary" />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1 border-border">Cancel</Button>
            <Button onClick={() => onConfirm(imageUrl, position, Number(zoom))} className="flex-1 bg-primary text-primary-foreground">
              Save Banner
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
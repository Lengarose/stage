import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Move } from "lucide-react";

export default function ImagePositionEditor({
  open,
  onClose,
  imageUrl,
  aspect = "avatar",
  initialPosition,
  initialZoom,
  onConfirm,
}) {
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [zoom, setZoom] = useState(150);
  const dragRef = useRef(null);

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
    setZoom(initialZoom || (aspect === "banner" ? 120 : 150));
  }, [open, initialPosition, initialZoom, aspect]);

  const position = `${x}% ${y}%`;
  const bgSize   = `${zoom}%`;

  function startDrag(clientX, clientY) {
    dragRef.current = { startX: clientX, startY: clientY, startBgX: x, startBgY: y };
  }
  function moveDrag(clientX, clientY, rect) {
    if (!dragRef.current) return;
    const { startX, startY, startBgX, startBgY } = dragRef.current;
    const dx = ((clientX - startX) / rect.width)  * 100;
    const dy = ((clientY - startY) / rect.height) * 100;
    setX(Math.round(Math.max(0, Math.min(100, startBgX - dx))));
    setY(Math.round(Math.max(0, Math.min(100, startBgY - dy))));
  }
  function endDrag() { dragRef.current = null; }

  const previewStyle = {
    backgroundImage: `url(${imageUrl})`,
    backgroundSize: bgSize,
    backgroundPosition: position,
    backgroundRepeat: "no-repeat",
    backgroundColor: "rgba(255,255,255,0.05)",
  };

  const isAvatar = aspect === "avatar";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="bg-[#06091a]/95 backdrop-blur-xl border border-white/20 text-white rounded-2xl max-w-sm p-0 shadow-2xl"
        onPointerDownOutside={e => e.preventDefault()}
        onInteractOutside={e => e.preventDefault()}
      >
        <div className="p-6 space-y-5">

          {/* Header */}
          <div>
            <h2
              style={{ fontFamily: "'Anton', sans-serif" }}
              className="text-xl italic uppercase tracking-tight text-white"
            >
              {isAvatar ? "Position Profile Photo" : "Position Banner"}
            </h2>
            <p className="text-white/35 text-[11px] flex items-center gap-1.5 mt-1">
              <Move className="w-3 h-3" />
              Drag to reposition · sliders for fine control
            </p>
          </div>

          {/* Preview */}
          {isAvatar ? (
            <div className="flex flex-col items-center gap-4">
              {/* Large circular preview */}
              <div
                className="w-36 h-36 rounded-full cursor-grab active:cursor-grabbing select-none border-2 border-white/20 shadow-xl"
                style={previewStyle}
                onMouseDown={e => { e.preventDefault(); startDrag(e.clientX, e.clientY); }}
                onMouseMove={e => { if (dragRef.current) moveDrag(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect()); }}
                onMouseUp={endDrag}
                onMouseLeave={endDrag}
                onTouchStart={e => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
                onTouchMove={e => { e.preventDefault(); moveDrag(e.touches[0].clientX, e.touches[0].clientY, e.currentTarget.getBoundingClientRect()); }}
                onTouchEnd={endDrag}
              />
              <p className="text-white/25 text-[10px] uppercase tracking-widest">Preview</p>

              {/* Small previews */}
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 w-full">
                <div className="w-9 h-9 rounded-full shrink-0 border border-white/20" style={previewStyle} />
                <div className="w-16 h-9 rounded-lg shrink-0 border border-white/20" style={previewStyle} />
                <p className="text-white/30 text-[10px] uppercase tracking-wider">Avatar · Card</p>
              </div>
            </div>
          ) : (
            <div
              className="w-full h-28 rounded-xl cursor-grab active:cursor-grabbing select-none border border-white/20"
              style={previewStyle}
              onMouseDown={e => { e.preventDefault(); startDrag(e.clientX, e.clientY); }}
              onMouseMove={e => { if (dragRef.current) moveDrag(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect()); }}
              onMouseUp={endDrag}
              onMouseLeave={endDrag}
              onTouchStart={e => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
              onTouchMove={e => { e.preventDefault(); moveDrag(e.touches[0].clientX, e.touches[0].clientY, e.currentTarget.getBoundingClientRect()); }}
              onTouchEnd={endDrag}
            />
          )}

          {/* Sliders */}
          <div className="space-y-3">
            <SliderRow label="Zoom" value={zoom} min={100} max={500} onChange={setZoom} />
            <div className="grid grid-cols-2 gap-3">
              <SliderRow label="Horizontal" value={x} min={0} max={100} onChange={setX} />
              <SliderRow label="Vertical"   value={y} min={0} max={100} onChange={setY} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 bg-white/10 border border-white/20 text-white/70 hover:text-white hover:border-white/35 font-bold uppercase tracking-widest text-xs py-3 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(imageUrl, position, Number(zoom))}
              className="flex-1 bg-white text-[#0d2461] font-black uppercase tracking-widest text-xs py-3 rounded-xl hover:bg-gray-100 transition-all shadow-lg"
            >
              Save
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SliderRow({ label, value, min, max, onChange }) {
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="text-white/40 text-[10px] uppercase tracking-widest">{label}</span>
        <span className="text-white/40 text-[10px] tabular-nums">{value}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer accent-blue-500"
        style={{ background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.1) ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.1) 100%)` }}
      />
    </div>
  );
}

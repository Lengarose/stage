/**
 * PlacedTrophy — a trophy placed on the cabinet.
 * In edit mode: draggable (pointer events), resizable.
 * In view mode: click to see details.
 *
 * Size is fully responsive:
 *   pixelSize = BASE_SIZE_RATIO * cabinetWidth * scale
 * where BASE_SIZE_RATIO = 0.12 means scale=1 is 12% of cabinet width.
 * Because cabinetWidth changes on resize, the trophy scales with the cabinet.
 */
import { useState, useRef, useEffect } from "react";
import { Move, Trophy, X, ZoomIn, ZoomOut } from "lucide-react";
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Link} from 'react-router-dom';

// scale=1 → 12% of cabinet width
const BASE_SIZE_RATIO = 0.12;

export default function PlacedTrophy({ placement, editMode, cabinetRef, cabinetSize, onMove, onMoveSave, onRemove }) {
  const [tooltip, setTooltip] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [draftPosition, setDraftPosition] = useState(null);
  const [draftScale, setDraftScale] = useState(null);
  const dragStart = useRef(null);
  const dragCleanup = useRef(null);
  const scaleDraftRef = useRef(null);
  const frameRef = useRef(null);
  const detailsRef = useRef(null);

  const xPercent = draftPosition?.x_percent ?? placement.x_percent;
  const yPercent = draftPosition?.y_percent ?? placement.y_percent;
  const scale = draftScale ?? placement.scale ?? 1;

  useEffect(() => () => dragCleanup.current?.(), []);

  function handlePointerDown(e) {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    dragCleanup.current?.();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const rect = cabinetRef.current.getBoundingClientRect();
    const pointerId = e.pointerId;
    dragStart.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: xPercent,
      origY: yPercent,
      rectW: rect.width,
      rectH: rect.height,
      lastX: xPercent,
      lastY: yPercent,
    };
    setDraftPosition({ x_percent: xPercent, y_percent: yPercent });
    setDragging(true);

    function handlePointerMove(event) {
      if (pointerId != null && event.pointerId !== pointerId) return;
      if (!dragStart.current) return;
      const { startX, startY, origX, origY, rectW, rectH } = dragStart.current;
      const dx = ((event.clientX - startX) / rectW) * 100;
      const dy = ((event.clientY - startY) / rectH) * 100;
      const newX = Math.max(5, Math.min(95, origX + dx));
      const newY = Math.max(5, Math.min(95, origY + dy));
      dragStart.current.lastX = newX;
      dragStart.current.lastY = newY;
      if (frameRef.current) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        setDraftPosition({
          x_percent: dragStart.current?.lastX ?? newX,
          y_percent: dragStart.current?.lastY ?? newY,
        });
      });
    }

    function cleanupDragListeners() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      dragCleanup.current = null;
    }

    function handlePointerUp(event) {
      if (pointerId != null && event.pointerId !== pointerId) return;
      cleanupDragListeners();
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      if (dragStart.current) {
        const next = {
          x_percent: dragStart.current.lastX,
          y_percent: dragStart.current.lastY,
        };
        onMove(placement.id, next);
        onMoveSave(placement.id, {
          x_percent: next.x_percent,
          y_percent: next.y_percent,
        });
      }
      setDragging(false);
      setDraftPosition(null);
      dragStart.current = null;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    dragCleanup.current = cleanupDragListeners;
  }

  function commitScale(nextScale) {
    const safeScale = Math.max(0.3, Math.min(3, Number(nextScale) || 1));
    scaleDraftRef.current = safeScale;
    setDraftScale(safeScale);
    onMove(placement.id, { scale: safeScale });
    onMoveSave(placement.id, { scale: safeScale });
    setDraftScale(null);
  }

  function handleScaleChange(e) {
    const nextScale = Math.max(0.3, Math.min(3, Number(e.target.value) || 1));
    scaleDraftRef.current = nextScale;
    setDraftScale(nextScale);
    onMove(placement.id, { scale: nextScale });
  }

  function handleScaleCommit() {
    const nextScale = scaleDraftRef.current ?? scale;
    onMoveSave(placement.id, { scale: nextScale });
    setDraftScale(null);
  }

  function scaleBy(delta) {
    commitScale(scale + delta);
  }

  // Responsive size: always proportional to current cabinet width
  const cabinetWidth = cabinetSize?.width || 400;
  const size = Math.round(cabinetWidth * BASE_SIZE_RATIO * scale);
  const award=placement.award||{};
  const details=[award.competition_name,award.edition_label,award.winning_name,award.format,`${award.participant_count??'Unknown'} ${award.participant_type||'participants'}`,award.completed_at?new Date(award.completed_at).toLocaleDateString():'Completion date unavailable'].filter(Boolean).join('\n');

  return (
    <div
      role={editMode?'group':'button'}
      tabIndex={0}
      aria-label={placement.trophy_name||'Earned trophy details'}
      title={details}
      onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(!editMode&&['Enter',' '].includes(e.key)){e.preventDefault();setTooltip(true);}if(editMode&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();onMoveSave(placement.id,{x_percent:Math.max(5,Math.min(95,Number(xPercent)+(e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0))),y_percent:Math.max(5,Math.min(95,Number(yPercent)+(e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0)))});}}}
      className="absolute group"
      style={{
        left: `${xPercent}%`,
        top: `${yPercent}%`,
        transform: "translate(-50%, -50%)",
        zIndex: dragging ? 50 : editMode ? 20 : 10,
        cursor: editMode ? (dragging ? "grabbing" : "grab") : "pointer",
        touchAction: "none",
        userSelect: "none",
      }}
      onPointerDown={handlePointerDown}
      onClick={() => !editMode && setTooltip(t => !t)}
    >
      {/* Trophy image */}
      <div style={{ width: size, height: size }} className="relative select-none pointer-events-none">
        {placement.trophy_image_url ? (
          <img
            src={placement.trophy_image_url}
            alt={placement.trophy_name}
            className="w-full h-full object-contain drop-shadow-2xl"
            draggable={false}
          />
        ) : (
          <Trophy className="w-full h-full text-amber-400 drop-shadow-lg" />
        )}

        {/* Win count badge */}
        {(placement.win_count || 1) > 1 && (
          <div
            className="absolute bg-amber-500 text-black font-black rounded-full flex items-center justify-center shadow-lg"
            style={{
              width: Math.max(14, size * 0.28),
              height: Math.max(14, size * 0.28),
              fontSize: Math.max(7, size * 0.13),
              top: -Math.max(4, size * 0.07),
              right: -Math.max(4, size * 0.07),
            }}
          >
            ×{placement.win_count}
          </div>
        )}
      </div>

      {/* Edit controls */}
      {editMode && (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/85 border border-white/10 rounded-full px-2 py-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shadow-xl"
          style={{ top: -Math.max(20, size * 0.35), pointerEvents: "all" }}
          onPointerDown={e => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label="Move trophy"
            onPointerDown={handlePointerDown}
            className="cursor-grab p-0.5 text-white/70 hover:text-cyan-200 active:cursor-grabbing"
          >
            <Move className="w-3.5 h-3.5" />
          </button>
          <button type="button" aria-label="Shrink trophy" title="Shrink trophy" onClick={(e) => { e.stopPropagation(); scaleBy(-0.15); }} className="text-white hover:text-primary p-0.5"><ZoomOut className="w-3.5 h-3.5" /></button>
          <input
            aria-label="Resize trophy"
            type="range"
            min="0.3"
            max="3"
            step="0.05"
            value={scale}
            onChange={handleScaleChange}
            onPointerUp={handleScaleCommit}
            onBlur={handleScaleCommit}
            className="w-24 accent-cyan-300"
          />
          <button type="button" aria-label="Enlarge trophy" title="Enlarge trophy" onClick={(e) => { e.stopPropagation(); scaleBy(0.15); }} className="text-white hover:text-primary p-0.5"><ZoomIn className="w-3.5 h-3.5" /></button>
          <span className="min-w-9 text-center text-[10px] font-bold text-white/70">{Math.round(scale * 100)}%</span>
          <button type="button" aria-label="Remove draft trophy" title="Remove draft trophy" onClick={(e) => { e.stopPropagation(); onRemove(placement.id); }} className="text-white hover:text-destructive p-0.5"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <Dialog open={tooltip&&!editMode} onOpenChange={setTooltip}>
        <DialogContent ref={detailsRef} onOpenAutoFocus={e=>{e.preventDefault();detailsRef.current?.focus();}} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setTooltip(false);}}} onClick={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()} className="max-h-[80vh] overflow-y-auto rounded-none">
          <DialogHeader><DialogTitle>{placement.trophy_name||'Earned Trophy'}</DialogTitle></DialogHeader>
          <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 text-sm">
            {[['Competition',award.competition_name],['Edition',award.edition_label],['Winner',award.winning_name],['Format',award.format],['Participants',award.participant_count==null?'Unavailable':award.participant_count+' '+award.participant_type],['Completed',award.completed_at?new Date(award.completed_at).toLocaleDateString():'Completion date unavailable'],['Placement',placement.locked_at?'Permanent':'Draft']].map(([label,value])=><div key={label} className="min-w-0 break-words"><dt className="text-muted-foreground">{label}</dt><dd>{value||'Unavailable'}</dd></div>)}
          </dl>
          {award.archive_path&&<Link to={award.archive_path} className="text-primary">View competition history</Link>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * TrophyCabinetCanvas — cabinet image with placed trophies.
 * Supports HTML5 drop from the collection and pointer rearrange of drafts.
 */
import { useRef, useState, useEffect } from 'react';
import PlacedTrophy from './PlacedTrophy';
import CabinetImg from '@/assets/Trophy Cabinet.PNG';
import {
  CABINET_ASPECT_RATIO,
  clientPointToCabinetPercent,
  normalizePlacementCoords,
} from '@/lib/trophyCabinetLayout';

export default function TrophyCabinetCanvas({
  placements,
  editMode,
  onDrop,
  onMovePlaced,
  onMovePlacedSave,
  onRemovePlaced,
  wonTournamentsMap,
  dropActive = false,
}) {
  const cabinetRef = useRef(null);
  const [cabinetSize, setCabinetSize] = useState({ width: 400, height: 300 });
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    const el = cabinetRef.current;
    if (!el) return undefined;
    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0) setCabinetSize({ width, height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function getPercentFromClient(clientX, clientY) {
    return clientPointToCabinetPercent(cabinetRef.current?.getBoundingClientRect(), clientX, clientY);
  }

  function handleDragOver(e) {
    if (!editMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }

  function handleDragLeave(e) {
    if (!cabinetRef.current?.contains(e.relatedTarget)) setIsDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    if (!editMode) return;
    const pos = getPercentFromClient(e.clientX, e.clientY);

    const coords = normalizePlacementCoords({ x_percent: pos.x, y_percent: pos.y });
    const placedId = e.dataTransfer.getData('placed-id');
    if (placedId) {
      onMovePlaced?.(placedId, coords);
      onMovePlacedSave?.(placedId, coords);
      return;
    }

    const trophyJson = e.dataTransfer.getData('trophy');
    if (trophyJson) {
      try {
        onDrop?.(JSON.parse(trophyJson), { x: coords.x_percent, y: coords.y_percent });
      } catch {
        // ignore malformed drag payloads
      }
    }
  }

  function handlePointerUp(e) {
    // Pointer-based collection drag (touch / devices without HTML5 DnD).
    const payload = window.__stageTrophyPointerDrag;
    if (!payload || !editMode || !cabinetRef.current) return;
    const rect = cabinetRef.current.getBoundingClientRect();
    if (
      e.clientX < rect.left || e.clientX > rect.right
      || e.clientY < rect.top || e.clientY > rect.bottom
    ) return;
    const pos = getPercentFromClient(e.clientX, e.clientY);
    const coords = normalizePlacementCoords({ x_percent: pos.x, y_percent: pos.y });
    window.__stageTrophyPointerDrag = null;
    window.dispatchEvent(new CustomEvent('stage-trophy-pointer-drag-end'));
    onDrop?.(payload, { x: coords.x_percent, y: coords.y_percent });
  }

  const highlight = editMode && (isDragOver || dropActive);

  return (
    <div
      ref={cabinetRef}
      className={`relative mx-auto w-[min(100%,1100px)] select-none overflow-hidden rounded-2xl transition-shadow ${highlight ? 'ring-2 ring-amber-300/70 shadow-[0_0_0_4px_rgba(251,191,36,0.15)]' : ''}`}
      style={{ aspectRatio: `${CABINET_ASPECT_RATIO}` }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPointerUp={handlePointerUp}
    >
      <img
        src={CabinetImg}
        alt="Trophy Cabinet"
        className="pointer-events-none absolute inset-0 h-full w-full object-fill"
        draggable={false}
      />

      {placements.map((p) => (
        <PlacedTrophy
          key={p.id}
          placement={p}
          editMode={editMode && !p.locked_at && !!p.award_id}
          cabinetRef={cabinetRef}
          cabinetSize={cabinetSize}
          onMove={onMovePlaced}
          onMoveSave={onMovePlacedSave}
          onRemove={onRemovePlaced}
          wonTournaments={wonTournamentsMap[p.trophy_item_id] || []}
        />
      ))}

      {editMode && placements.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl bg-black/60 px-4 py-2 text-xs font-medium text-amber-300">
            Drag a trophy from below and drop it here
          </div>
        </div>
      )}
      {editMode && placements.some((p) => !p.locked_at && p.award_id) && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-[10px] font-semibold text-amber-200/90">
          Drag draft trophies to rearrange · Done locks them permanently
        </div>
      )}
    </div>
  );
}

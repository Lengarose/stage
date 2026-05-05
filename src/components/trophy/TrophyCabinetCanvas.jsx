/**
 * TrophyCabinetCanvas — the cabinet image with placed trophies on top.
 * Handles drop events to place new trophies or move existing ones.
 *
 * Trophies are positioned using % relative to the cabinet container.
 * Trophy size is stored as a scale factor where scale=1 means
 * BASE_SIZE_RATIO * cabinetWidth pixels — so size scales with the cabinet.
 */
import { useRef, useState, useEffect } from "react";
import PlacedTrophy from "./PlacedTrophy";

const CABINET_IMAGE = "https://media.stageClient.com/images/public/69d77ebfc021efa72e236f84/87227ed51_IMG_6919.png";

export default function TrophyCabinetCanvas({
  placements,
  editMode,
  onDrop,
  onMovePlaced,
  onMovePlacedSave,
  onRemovePlaced,
  wonTournamentsMap,
}) {
  const cabinetRef = useRef(null);
  const [cabinetSize, setCabinetSize] = useState({ width: 400, height: 300 });

  // Track cabinet dimensions with ResizeObserver so trophies scale responsively
  useEffect(() => {
    const el = cabinetRef.current;
    if (!el) return;
    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0) setCabinetSize({ width, height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function getPercent(e) {
    const rect = cabinetRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.max(5, Math.min(95, x)),
      y: Math.max(5, Math.min(95, y)),
    };
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  function handleDrop(e) {
    e.preventDefault();
    const pos = getPercent(e);

    // Moving an already-placed trophy?
    const placedId = e.dataTransfer.getData("placed-id");
    if (placedId) {
      const rect = cabinetRef.current.getBoundingClientRect();
      let offsetPos = pos;
      try {
        const { dx, dy } = JSON.parse(e.dataTransfer.getData("placed-offset") || "{}");
        if (dx !== undefined) {
          const x = Math.max(5, Math.min(95, ((e.clientX - dx - rect.left) / rect.width) * 100));
          const y = Math.max(5, Math.min(95, ((e.clientY - dy - rect.top) / rect.height) * 100));
          offsetPos = { x, y };
        }
      } catch {}
      onMovePlaced(placedId, { x_percent: offsetPos.x, y_percent: offsetPos.y });
      return;
    }

    // New trophy from scroll bar
    const trophyJson = e.dataTransfer.getData("trophy");
    if (trophyJson) {
      const trophy = JSON.parse(trophyJson);
      onDrop(trophy, pos);
    }
  }

  return (
    <div
      ref={cabinetRef}
      className="relative w-full rounded-2xl overflow-hidden border border-border/50 select-none"
      style={{ aspectRatio: "4/3" }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Cabinet image */}
      <img
        src={CABINET_IMAGE}
        alt="Trophy Cabinet"
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />

      {/* Placed trophies */}
      {placements.map(p => (
        <PlacedTrophy
          key={p.id}
          placement={p}
          editMode={editMode}
          cabinetRef={cabinetRef}
          cabinetSize={cabinetSize}
          onMove={onMovePlaced}
          onMoveSave={onMovePlacedSave}
          onRemove={onRemovePlaced}
          wonTournaments={wonTournamentsMap[p.trophy_item_id] || []}
        />
      ))}

      {/* Edit mode hint */}
      {editMode && placements.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/60 rounded-xl px-4 py-2 text-xs text-amber-300 font-medium">
            Drag a trophy from below and drop it here
          </div>
        </div>
      )}
    </div>
  );
}
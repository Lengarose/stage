/**
 * TrophyCabinetSystem — main entry point.
 * Used by both Club Profile and Player Profile.
 *
 * Props:
 *   ownerId    — club.id or player.id
 *   ownerType  — "club" | "player"
 *   canEdit    — true if current user owns this profile
 *   wonTournaments — array of Tournament records the owner has won
 */
import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Pencil, Check, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import TrophyCabinetCanvas from "./TrophyCabinetCanvas";
import TrophyScrollBar from "./TrophyScrollBar";

export default function TrophyCabinetSystem({ ownerId, ownerType, canEdit, wonTournaments = [] }) {
  const [allTrophies, setAllTrophies] = useState([]);  // TrophyItem library
  const [placements, setPlacements] = useState([]);    // TrophyPlacement records
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load trophy library + existing placements
  useEffect(() => {
    if (!ownerId) return;
    async function load() {
      const [lib, placed] = await Promise.all([
        base44.entities.TrophyItem.list("sort_order", 200),
        base44.entities.TrophyPlacement.filter({ owner_id: ownerId, owner_type: ownerType }),
      ]);
      setAllTrophies(lib);
      setPlacements(placed);
      setLoading(false);
    }
    load();
  }, [ownerId, ownerType]);

  // Determine which trophy_item_ids are unlocked (won via tournaments)
  const unlockedMap = buildUnlockedMap(wonTournaments, allTrophies);
  const unlockedIds = new Set(Object.keys(unlockedMap));

  // Map trophy_item_id → array of won tournaments (for tooltip)
  const wonTournamentsMap = {};
  for (const [trophyItemId, tournaments] of Object.entries(unlockedMap)) {
    wonTournamentsMap[trophyItemId] = tournaments;
  }

  // Drag start from scroll bar
  function handleDragStart(e, trophy) {
    e.dataTransfer.setData("trophy", JSON.stringify(trophy));
    e.dataTransfer.effectAllowed = "copy";
  }

  // Drop new trophy onto cabinet
  async function handleDrop(trophy, pos) {
    if (!editMode) return;
    setSaving(true);

    // Check if already placed — if so, just update position
    const existing = placements.find(p => p.trophy_item_id === trophy.id);
    if (existing) {
      const updated = await base44.entities.TrophyPlacement.update(existing.id, {
        x_percent: pos.x,
        y_percent: pos.y,
      });
      setPlacements(prev => prev.map(p => p.id === existing.id ? { ...p, x_percent: pos.x, y_percent: pos.y } : p));
      setSaving(false);
      return;
    }

    // Create new placement
    const winCount = unlockedMap[trophy.id]?.length || 1;
    const wonIds = (unlockedMap[trophy.id] || []).map(t => t.id);
    const newPlacement = await base44.entities.TrophyPlacement.create({
      owner_id: ownerId,
      owner_type: ownerType,
      trophy_item_id: trophy.id,
      trophy_image_url: trophy.image_url,
      trophy_name: trophy.name,
      x_percent: pos.x,
      y_percent: pos.y,
      scale: 1,
      win_count: winCount,
      won_tournament_ids: wonIds,
    });
    setPlacements(prev => [...prev, newPlacement]);
    setSaving(false);
  }

  // Move during drag — local state only, no DB call
  function handleMovePlacedLocal(placementId, changes) {
    setPlacements(prev => prev.map(p => p.id === placementId ? { ...p, ...changes } : p));
  }

  // Save to DB only when drag ends or scale buttons clicked
  async function handleMovePlacedSave(placementId, changes) {
    setPlacements(prev => prev.map(p => p.id === placementId ? { ...p, ...changes } : p));
    await base44.entities.TrophyPlacement.update(placementId, changes);
  }

  // Remove a placed trophy
  async function handleRemovePlaced(placementId) {
    setPlacements(prev => prev.filter(p => p.id !== placementId));
    await base44.entities.TrophyPlacement.delete(placementId);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span className="font-heading text-base font-black text-amber-300 uppercase tracking-widest">
            Trophy Cabinet
          </span>
          <span className="text-xs text-amber-300/60 font-medium">
            {placements.length} placed
          </span>
        </div>
        {canEdit && (
          <Button
            size="sm"
            variant={editMode ? "default" : "outline"}
            className="h-7 px-3 text-xs gap-1"
            onClick={() => setEditMode(m => !m)}
            disabled={saving}
          >
            {editMode ? <><Check className="w-3 h-3" /> Done</> : <><Pencil className="w-3 h-3" /> Edit</>}
          </Button>
        )}
      </div>

      {/* Cabinet canvas */}
      <TrophyCabinetCanvas
        placements={placements}
        editMode={editMode}
        onDrop={handleDrop}
        onMovePlaced={handleMovePlacedLocal}
        onMovePlacedSave={handleMovePlacedSave}
        onRemovePlaced={handleRemovePlaced}
        wonTournamentsMap={wonTournamentsMap}
      />

      {/* Trophy scroll bar */}
      {(editMode || allTrophies.length > 0) && (
        <TrophyScrollBar
          allTrophies={allTrophies}
          unlockedIds={unlockedIds}
          onDragStart={handleDragStart}
        />
      )}

      {editMode && (
        <p className="text-[10px] text-muted-foreground">
          Drag an unlocked trophy onto the cabinet to place it. Use the controls to resize or remove.
        </p>
      )}
    </div>
  );
}

/**
 * Build a map: trophy_item_id → Tournament[]
 * A trophy is unlocked ONLY if:
 *   1. trophy.tournament_id matches the specific tournament id, OR
 *   2. trophy.competition_name matches the tournament name exactly (case-insensitive)
 *
 * Type-based matching is intentionally removed to prevent wrong trophies
 * from unlocking for custom tournaments.
 */
function buildUnlockedMap(wonTournaments, allTrophies) {
  const map = {};
  for (const tournament of wonTournaments) {
    for (const trophy of allTrophies) {
      const matchesTournamentId = trophy.tournament_id && trophy.tournament_id === tournament.id;
      const matchesCompetitionName = trophy.competition_name &&
        trophy.competition_name.trim().toLowerCase() === (tournament.name || "").trim().toLowerCase();
      if (matchesTournamentId || matchesCompetitionName) {
        if (!map[trophy.id]) map[trophy.id] = [];
        map[trophy.id].push(tournament);
      }
    }
  }
  return map;
}
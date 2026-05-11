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
import { stageClient } from "@/api/stageClient";
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

  // Load trophy library + existing placements. Each call is independent so a
  // failure in one (e.g. legacy schema, 404) does NOT wipe out the other.
  useEffect(() => {
    if (!ownerId) return;
    async function load() {
      const [libRes, placedRes] = await Promise.allSettled([
        stageClient.entities.TrophyItem.list("sort_order", 200),
        stageClient.entities.TrophyPlacement.filter({ owner_id: ownerId, owner_type: ownerType }),
      ]);
      if (libRes.status === "fulfilled") {
        setAllTrophies(libRes.value || []);
      } else {
        console.error("[TrophyCabinet] failed to load trophy library:", libRes.reason);
        setAllTrophies([]);
      }
      if (placedRes.status === "fulfilled") {
        setPlacements(placedRes.value || []);
      } else {
        console.error("[TrophyCabinet] failed to load placements:", placedRes.reason);
        setPlacements([]);
      }
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
      const updated = await stageClient.entities.TrophyPlacement.update(existing.id, {
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
    const newPlacement = await stageClient.entities.TrophyPlacement.create({
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
    await stageClient.entities.TrophyPlacement.update(placementId, changes);
  }

  // Remove a placed trophy
  async function handleRemovePlaced(placementId) {
    setPlacements(prev => prev.filter(p => p.id !== placementId));
    await stageClient.entities.TrophyPlacement.delete(placementId);
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

      {/* Trophy scroll bar — always rendered so visitors see the collection
          section, even when no trophies are unlocked yet. */}
      <TrophyScrollBar
        allTrophies={allTrophies}
        unlockedIds={unlockedIds}
        onDragStart={handleDragStart}
      />


      {editMode && (
        <p className="text-[10px] text-muted-foreground">
          Drag an unlocked trophy onto the cabinet to place it. Use the controls to resize or remove.
        </p>
      )}
    </div>
  );
}

function buildUnlockedMap(wonTournaments, allTrophies) {
  const map = {};
  for (const win of wonTournaments) {
    for (const trophy of allTrophies) {
      // Primary: win record directly references this trophy
      const matchesTrophyItemId = win.trophy_item_id && win.trophy_item_id === trophy.id;
      // Legacy: trophy back-references the win
      const matchesTournamentId = trophy.tournament_id && trophy.tournament_id === win.id;
      // Legacy: name match
      const matchesCompetitionName = trophy.competition_name &&
        trophy.competition_name.trim().toLowerCase() === (win.name || "").trim().toLowerCase();
      // New: linked_source_id — competition trophy links via win.competition_id, league trophy via win.id
      const matchesLinkedSource = trophy.linked_source_id && (
        (trophy.linked_source_type === "competition" && win.competition_id && win.competition_id === trophy.linked_source_id) ||
        (trophy.linked_source_type === "regional_league" && win.id === trophy.linked_source_id)
      );
      if (matchesTrophyItemId || matchesTournamentId || matchesCompetitionName || matchesLinkedSource) {
        if (!map[trophy.id]) map[trophy.id] = [];
        map[trophy.id].push(win);
      }
    }
  }
  return map;
}
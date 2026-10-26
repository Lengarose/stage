import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Pencil, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import { stageClient } from '@/api/stageClient';
import { swalConfirm } from '@/lib/swal';
import { useTranslation } from '@/hooks/useTranslation';
import {
  awardEditionLabel,
  awardLabel,
  buildCollectionEntries,
  buildUnlockedMap,
  findOpenSpot,
} from '@/lib/trophyCollection';
import { normalizePlacementCoords } from '@/lib/trophyCabinetLayout';
import TrophyCabinetCanvas from './TrophyCabinetCanvas';
import TrophyScrollBar from './TrophyScrollBar';

const CATALOGUE_PAGE = 100;

function emptyReport() {
  return { awards: [], placements: [], discrepancies: [], titles: { all_time: 0, official_ranking: 0 } };
}

export default function TrophyCabinetSystem({ ownerId, ownerType, canEdit }) {
  const { t } = useTranslation();
  const [report, setReport] = useState(emptyReport);
  const [catalogue, setCatalogue] = useState([]);
  const [catalogueError, setCatalogueError] = useState('');
  const [entitlementError, setEntitlementError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(0);
  const [hasMoreCatalogue, setHasMoreCatalogue] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [catalogueOffset, setCatalogueOffset] = useState(0);
  const [copyPicker, setCopyPicker] = useState(null);
  const [pointerDrag, setPointerDrag] = useState(null);
  const identity = `${ownerType}:${ownerId}`;
  const active = useRef(identity);
  active.current = identity;
  const pendingRef = useRef(0);

  const loadCataloguePage = useCallback(async (offset = 0, append = false) => {
    const rows = await stageClient.entities.TrophyItem.filter({ offset }, 'sort_order', CATALOGUE_PAGE);
    const page = Array.isArray(rows) ? rows : [];
    const visible = page.filter((item) => !item.admin_only);
    if (active.current !== identity) return page;
    setCatalogue((prev) => {
      if (!append) return visible;
      const seen = new Set(prev.map((item) => item.id));
      return [...prev, ...visible.filter((item) => !seen.has(item.id))];
    });
    setCatalogueOffset(offset + page.length);
    setHasMoreCatalogue(page.length >= CATALOGUE_PAGE);
    setCatalogueError('');
    return page;
  }, [identity]);

  const loadEntitlements = useCallback(async () => {
    const data = await stageClient.http.get(
      `/trophy-placements/entitlements?${new URLSearchParams({ owner_id: ownerId, owner_type: ownerType })}`,
    );
    if (active.current !== identity) return data;
    setReport(data || emptyReport());
    setEntitlementError('');
    return data;
  }, [ownerId, ownerType, identity]);

  const reload = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    setEditMode(false);
    setReport(emptyReport());
    setCatalogue([]);
    setCatalogueOffset(0);
    setCatalogueError('');
    setEntitlementError('');
    setCopyPicker(null);

    const [catResult, entResult] = await Promise.allSettled([
      loadCataloguePage(0, false),
      loadEntitlements(),
    ]);

    if (active.current !== identity) return;

    if (catResult.status === 'rejected') {
      setCatalogue([]);
      setCatalogueError(catResult.reason?.message || 'Could not load the trophy catalogue.');
    }
    if (entResult.status === 'rejected') {
      setReport(emptyReport());
      setEntitlementError(entResult.reason?.message || 'Could not load earned trophies for this cabinet.');
    }
    setLoading(false);
  }, [ownerId, identity, loadCataloguePage, loadEntitlements]);

  useEffect(() => {
    let stopped = false;
    (async () => {
      if (stopped) return;
      await reload();
    })();
    return () => { stopped = true; };
  }, [reload]);

  async function mutate(action, { refresh = true } = {}) {
    pendingRef.current += 1;
    setPending((n) => n + 1);
    try {
      const result = await action();
      if (refresh && active.current === identity) {
        await loadEntitlements();
      }
      return result;
    } catch (err) {
      toast.error(err?.message || 'Cabinet change failed');
      if (refresh && active.current === identity) {
        try { await loadEntitlements(); } catch { /* keep previous report */ }
      }
      throw err;
    } finally {
      pendingRef.current = Math.max(0, pendingRef.current - 1);
      setPending((n) => Math.max(0, n - 1));
    }
  }

  async function waitForPending() {
    while (pendingRef.current > 0) {
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  }

  const awards = report.awards || [];
  const placements = useMemo(() => (report.placements || []).map((p) => {
    const award = awards.find((a) => (p.award_id ? a.id === p.award_id : a.trophy_item_id === p.trophy_item_id));
    return {
      ...p,
      award,
      trophy_name: award?.display_name || award?.name || p.trophy_name,
      trophy_image_url: award?.image_url || p.trophy_image_url,
      win_count: 1,
    };
  }), [report.placements, awards]);

  const collection = useMemo(
    () => buildCollectionEntries(catalogue, awards, report.placements || []),
    [catalogue, awards, report.placements],
  );

  const wonTournamentsMap = useMemo(() => {
    const map = {};
    for (const award of awards) {
      if (!award.trophy_item_id) continue;
      if (!map[award.trophy_item_id]) map[award.trophy_item_id] = [];
      map[award.trophy_item_id].push(award);
    }
    return map;
  }, [awards]);

  function resolveAwardFromPayload(payload) {
    if (payload?.id && payload.trophy_item_id && awards.some((a) => a.id === payload.id)) {
      return awards.find((a) => a.id === payload.id);
    }
    const entry = collection.find((row) => row.id === (payload?.id || payload?.trophy_item_id));
    if (!entry) return null;
    if (entry.availableAwards.length === 1) return entry.availableAwards[0];
    if (entry.availableAwards.length > 1) {
      setCopyPicker({ entry, position: null });
      return null;
    }
    return null;
  }

  async function placeAward(award, pos) {
    if (!editMode || !canEdit || !award?.id) return;
    const already = (report.placements || []).some((p) => p.award_id === award.id);
    if (already) {
      toast.error('That earned copy is already in the cabinet.');
      return;
    }
    const spot = pos || findOpenSpot(placements);
    const coords = normalizePlacementCoords({
      x_percent: spot.x,
      y_percent: spot.y,
      scale: 1,
    });
    await mutate(() => stageClient.entities.TrophyPlacement.create({
      owner_id: ownerId,
      owner_type: ownerType,
      award_id: award.id,
      ...coords,
    }));
  }

  async function placeEntry(entry, pos) {
    if (!entry || entry.state !== 'available') return;
    if (entry.availableAwards.length > 1) {
      setCopyPicker({ entry, position: pos || null });
      return;
    }
    if (entry.availableAwards[0]) await placeAward(entry.availableAwards[0], pos);
  }

  function dragPayloadForEntry(entry) {
    if (entry.availableAwards.length === 1) return entry.availableAwards[0];
    return { id: entry.id, trophy_item_id: entry.id, needs_copy_pick: true };
  }

  function handleDragStart(e, entry) {
    if (entry.state !== 'available' || !editMode) return;
    const payload = dragPayloadForEntry(entry);
    e.dataTransfer.setData('trophy', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copy';
    try {
      e.dataTransfer.setDragImage(e.currentTarget, 40, 40);
    } catch {
      // Optional visual; browsers may reject custom drag images.
    }
  }

  function handlePointerDragStart(e, entry) {
    if (entry.state !== 'available' || !editMode || !canEdit) return;
    e.preventDefault();
    e.stopPropagation();
    const payload = dragPayloadForEntry(entry);
    window.__stageTrophyPointerDrag = payload;
    setPointerDrag({
      payload,
      entry,
      x: e.clientX,
      y: e.clientY,
    });

    const onMove = (event) => {
      setPointerDrag((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev));
    };
    const onEnd = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      window.removeEventListener('stage-trophy-pointer-drag-end', onEnd);
      window.__stageTrophyPointerDrag = null;
      setPointerDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    window.addEventListener('stage-trophy-pointer-drag-end', onEnd);
  }

  async function handleDrop(payload, pos) {
    if (!editMode || !canEdit) return;
    if (payload?.needs_copy_pick || (payload?.id && !payload.award_role && !awards.some((a) => a.id === payload.id))) {
      await placeEntry(collection.find((row) => row.id === payload.id) || collection.find((row) => row.id === payload.trophy_item_id), pos);
      return;
    }
    const award = resolveAwardFromPayload(payload);
    if (award) await placeAward(award, pos);
  }

  function handleMoveLocal(id, changes) {
    const normalized = normalizePlacementCoords(changes);
    setReport((prev) => ({
      ...prev,
      placements: (prev.placements || []).map((p) => (p.id === id ? { ...p, ...normalized } : p)),
    }));
  }

  async function handleMoveSave(id, changes) {
    const normalized = normalizePlacementCoords(changes);
    handleMoveLocal(id, normalized);
    try {
      await mutate(() => stageClient.entities.TrophyPlacement.update(id, normalized), { refresh: true });
    } catch {
      // mutate already toasts + reloads last persisted entitlements
    }
  }

  async function handleRemove(id) {
    await mutate(() => stageClient.entities.TrophyPlacement.delete(id));
  }

  async function done() {
    if (pendingRef.current > 0 || pending > 0) await waitForPending();
    let latest = report;
    try {
      latest = await loadEntitlements() || report;
    } catch {
      toast.error('Could not refresh drafts before confirmation.');
      return;
    }
    const drafts = (latest.placements || []).filter((p) => p.award_id && !p.locked_at);
    if (!drafts.length) {
      setEditMode(false);
      return;
    }
    const ok = await swalConfirm(
      t(
        'trophy.confirmPermanent',
        'Once confirmed, these trophies cannot be moved, resized, removed, or replaced.\n\nConfirm permanent placement for {count} draft {noun}? Previously locked trophies are unchanged.',
        { count: drafts.length, noun: drafts.length === 1 ? 'trophy' : 'trophies' },
      ),
    );
    if (!ok) return;
    try {
      await mutate(async () => {
        await stageClient.http.post(
          `/trophy-placements/confirm/${ownerType}/${ownerId}`,
          { placement_ids: drafts.map((p) => p.id) },
        );
      });
      if (active.current === identity) setEditMode(false);
    } catch {
      // stay in edit mode; drafts remain editable
    }
  }

  async function loadMoreCatalogue() {
    setLoadingMore(true);
    try {
      await loadCataloguePage(catalogueOffset, true);
    } catch (err) {
      setCatalogueError(err?.message || 'Could not load more trophy designs.');
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) {
    return <p role="status" className="py-8 text-sm text-muted-foreground">Loading trophy history…</p>;
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Trophy size={18} className="text-amber-400" />
          <h3 className="font-heading">{t('trophy.cabinet', 'Trophy Cabinet')}</h3>
          <span className="text-xs text-muted-foreground">
            {report.titles?.all_time || 0} all-time honours · {report.titles?.official_ranking || 0} official titles
          </span>
        </div>
        {canEdit ? (
          <button
            type="button"
            disabled={pending > 0}
            onClick={() => (editMode ? done() : setEditMode(true))}
            className="inline-flex items-center gap-2 text-primary disabled:opacity-40"
          >
            {editMode ? <Check size={16} /> : <Pencil size={16} />}
            {editMode ? t('trophy.done', 'Done') : t('trophy.edit', 'Edit')}
          </button>
        ) : null}
      </header>

      {entitlementError ? (
        <p role="alert" className="text-sm text-destructive">
          {entitlementError}{' '}
          <button type="button" className="underline" onClick={reload}>Retry</button>
        </p>
      ) : null}

      {!!report.discrepancies?.length && (
        <p role="status" className="text-xs text-amber-300/90">
          Some legacy records need admin review before permanent placement. Historical evidence is preserved.
        </p>
      )}

      <TrophyCabinetCanvas
        placements={placements}
        editMode={editMode && canEdit}
        onDrop={handleDrop}
        onMovePlaced={handleMoveLocal}
        onMovePlacedSave={handleMoveSave}
        onRemovePlaced={handleRemove}
        wonTournamentsMap={wonTournamentsMap}
        dropActive={Boolean(pointerDrag)}
      />

      <TrophyScrollBar
        entries={collection}
        editMode={editMode}
        canEdit={canEdit}
        busy={pending > 0}
        error={catalogueError}
        onRetry={() => loadCataloguePage(0, false).catch((err) => {
          setCatalogueError(err?.message || 'Could not load the trophy catalogue.');
        })}
        onLoadMore={loadMoreCatalogue}
        hasMore={hasMoreCatalogue}
        loadingMore={loadingMore}
        onDragStart={handleDragStart}
        onPointerDragStart={handlePointerDragStart}
        onPlace={(entry) => placeEntry(entry)}
        onSelect={(entry) => setCopyPicker({ entry, position: null })}
      />

      {editMode ? (
        <p className="text-[10px] text-muted-foreground">
          Drag an available copy onto the cabinet, then drag draft trophies around inside it. Use Place if drag is unavailable. Done permanently locks drafts after confirmation.
        </p>
      ) : canEdit ? (
        <p className="text-[10px] text-muted-foreground">
          Tap Edit to place unlocked trophies and rearrange drafts inside the cabinet.
        </p>
      ) : null}

      {pointerDrag ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[80] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-amber-300/40 bg-black/70 p-2 shadow-2xl"
          style={{ left: pointerDrag.x, top: pointerDrag.y }}
        >
          {pointerDrag.entry.image_url ? (
            <img src={pointerDrag.entry.image_url} alt="" className="h-14 w-14 object-contain" />
          ) : (
            <Trophy className="h-14 w-14 text-amber-300" />
          )}
        </div>
      ) : null}

      {copyPicker ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose earned trophy copy"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 sm:items-center"
          onClick={() => setCopyPicker(null)}
        >
          <div
            className="w-full max-w-md space-y-3 border border-border bg-[#0b1524] p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="font-heading text-sm text-amber-200">Choose which copy to place</h4>
            <p className="text-xs text-muted-foreground">
              Each copy belongs to a specific competition edition. Selecting places that exact earned award.
            </p>
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {copyPicker.entry.availableAwards.map((award) => (
                <li key={award.id}>
                  <button
                    type="button"
                    className="w-full border border-border/70 px-3 py-2 text-left hover:border-amber-400/50 hover:bg-amber-400/5"
                    onClick={async () => {
                      const pos = copyPicker.position;
                      setCopyPicker(null);
                      await placeAward(award, pos);
                    }}
                  >
                    <span className="block text-sm font-semibold text-foreground">{awardLabel(award)}</span>
                    <span className="block text-xs text-muted-foreground">{awardEditionLabel(award)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setCopyPicker(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export { buildUnlockedMap, buildCollectionEntries };

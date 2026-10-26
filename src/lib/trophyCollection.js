/**
 * Derive trophy-collection display rows from the catalogue + owner entitlements.
 * Availability = earned, non-revoked awards with a design, minus draft/permanent placements.
 */

export function awardLabel(award) {
  return award?.display_name || award?.name || award?.competition_name || 'Earned trophy';
}

export function awardEditionLabel(award) {
  const parts = [award?.competition_name, award?.edition_label].filter(Boolean);
  return parts.length ? parts.join(' · ') : awardLabel(award);
}

/**
 * @param {object[]} catalogue TrophyItem rows (designs)
 * @param {object[]} awards Entitlement awards (earned copies)
 * @param {object[]} placements Cabinet placements for this owner
 */
export function buildCollectionEntries(catalogue = [], awards = [], placements = []) {
  const earned = (Array.isArray(awards) ? awards : []).filter(
    (a) => a?.id && a.persisted === true && a.trophy_item_id && a.status !== 'revoked',
  );

  const byDesign = new Map();
  for (const design of Array.isArray(catalogue) ? catalogue : []) {
    if (!design?.id) continue;
    byDesign.set(String(design.id), {
      design,
      awards: [],
      placements: [],
    });
  }

  for (const award of earned) {
    const key = String(award.trophy_item_id);
    if (!byDesign.has(key)) {
      byDesign.set(key, {
        design: {
          id: award.trophy_item_id,
          name: award.name || award.display_name,
          image_url: award.image_url,
          rarity: 'common',
        },
        awards: [],
        placements: [],
      });
    }
    byDesign.get(key).awards.push(award);
  }

  for (const placement of Array.isArray(placements) ? placements : []) {
    const key = String(placement.trophy_item_id || '');
    if (!key) continue;
    if (!byDesign.has(key)) {
      byDesign.set(key, {
        design: {
          id: placement.trophy_item_id,
          name: placement.trophy_name,
          image_url: placement.trophy_image_url,
          rarity: 'common',
        },
        awards: [],
        placements: [],
      });
    }
    byDesign.get(key).placements.push(placement);
  }

  return [...byDesign.values()].map(({ design, awards: designAwards, placements: designPlacements }) => {
    const draftPlacements = designPlacements.filter((p) => p.award_id && !p.locked_at);
    const permanentPlacements = designPlacements.filter((p) => p.award_id && p.locked_at);
    const placedAwardIds = new Set(
      designPlacements.filter((p) => p.award_id).map((p) => String(p.award_id)),
    );
    const availableAwards = designAwards.filter((a) => !placedAwardIds.has(String(a.id)));
    const availableCount = availableAwards.length;
    const draftCount = draftPlacements.length;
    const permanentCount = permanentPlacements.length;

    let state = 'locked';
    let statusLabel = 'Win to unlock.';
    if (availableCount > 0) {
      state = 'available';
      statusLabel = availableCount === 1
        ? '1 copy available.'
        : `${availableCount} copies available.`;
    } else if (draftCount > 0) {
      state = 'draft';
      statusLabel = 'Draft in cabinet.';
    } else if (permanentCount > 0 || designAwards.length > 0) {
      state = 'placed';
      statusLabel = 'Placed — win again to unlock another copy.';
    }

    return {
      id: design.id,
      name: design.name,
      image_url: design.image_url,
      rarity: design.rarity || 'common',
      design,
      state,
      statusLabel,
      availableCount,
      draftCount,
      permanentCount,
      availableAwards,
      draftPlacements,
      permanentPlacements,
      awards: designAwards,
    };
  }).sort((a, b) => {
    const order = { available: 0, draft: 1, placed: 2, locked: 3 };
    return (order[a.state] - order[b.state]) || String(a.name || '').localeCompare(String(b.name || ''));
  });
}

export function findOpenSpot(placements = []) {
  const spots = [40, 70].flatMap((y) => [20, 40, 60, 80].map((x) => ({ x, y })));
  return spots.find((spot) => placements.every((p) => (
    Math.abs(Number(p.x_percent) - spot.x) > 12
    || Math.abs(Number(p.y_percent) - spot.y) > 15
  ))) || { x: 50, y: 50 };
}

/** Legacy helper retained for regionalRewards regression coverage. */
export function buildUnlockedMap(wonTournaments = [], allTrophies = []) {
  const map = {};
  for (const win of wonTournaments) {
    for (const trophy of allTrophies) {
      if (win.trophy_item_id === trophy.id && (!trophy.tournament_id || trophy.tournament_id === win.id)) {
        if (!map[trophy.id]) map[trophy.id] = [];
        if (!map[trophy.id].some((w) => w.source_id === win.source_id && w.edition_id === win.edition_id)) {
          map[trophy.id].push(win);
        }
      }
    }
  }
  return map;
}

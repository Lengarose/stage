export function fixtureState(edition) {
  const count = Number(edition.actual_fixtures_count);
  const known = Number.isSafeInteger(count) && count >= 0 && edition.actual_fixtures_count != null;
  const active = ['in_progress', 'active', 'league_phase', 'knockout', 'playoffs'].includes(String(edition.status).toLowerCase());
  return {
    canDraw: known && count === 0 && active,
    canSimulate: known && count > 0 && active,
    explanation: !known ? 'Fixture count unavailable. Refresh after the lifecycle backend is deployed.'
      : count === 0 ? 'Draw fixtures before simulation.'
        : !active ? 'Simulation is available only for an active edition.' : `${count} fixtures in this edition.`,
  };
}

export async function loadEditionFixtureCount(client, kind, edition) {
  if (edition.actual_fixtures_count != null) return edition;
  const regional = kind === 'regional_league';
  const ids = new Set();
  for (let offset = 0; ; offset += 500) {
    const rows = await client.http.get(regional ? '/regional-league-fixtures' : '/competition-fixtures', {
      [regional ? 'league_id' : 'season_id']: edition.id, limit: 500, offset,
    });
    if (!Array.isArray(rows) || rows.some(row => !row?.id)) throw new Error('Invalid fixture inventory.');
    if (rows.length && rows.every(row => ids.has(row.id))) throw new Error('Fixture inventory repeated a page.');
    rows.forEach(row => ids.add(row.id));
    if (rows.length < 500) return { ...edition, actual_fixtures_count: ids.size };
  }
}

export async function submitEditionLifecycle(client, kind, edition, action, reason, confirmed, cycleId) {
  if (!edition?.id || !reason?.trim() || confirmed !== true) throw new Error('An exact edition, reason and confirmation are required.');
  return client.http.post(`/competition-views/${kind}/${encodeURIComponent(edition.id)}/lifecycle`, {
    action, reason: reason.trim(), confirmation: true,
    ...(cycleId?{expected_regional_cycle_id:cycleId,season_number:edition.season_number}:{}),
  });
}

export async function loadCycleDrawInventory(client, cycle) {
  const groups=cycle?.allocated_groups;
  if(cycle?.status!=='allocated' || cycle.edition_invalidated || cycle.invalidated_at || !Array.isArray(groups) || !groups.length || groups.length>12 || groups.some(g=>typeof g?.id!=='string' || !g.id.trim()) || new Set(groups.map(g=>g.id)).size!==groups.length)throw new Error('A valid saved allocation is required to check league draws.');
  return Promise.all(groups.map(async group=>{
    const edition=await client.entities.RegionalLeague.get(group.id);
    if(!edition || edition.id!==group.id || edition.regional_cycle_id!==cycle.id || edition.edition_invalidated || edition.invalidated_at || edition.region_slug!==cycle.region_slug || edition.platform!==cycle.platform || Number(edition.season_number)!==Number(cycle.season_number) || Number(edition.reset_series || 0)!==Number(cycle.reset_series || 0) || Number(edition.division)!==Number(group.division) || (edition.group_code || 'A')!==group.group_code || (edition.permanent_league_id || edition.id)!==group.permanent_league_id)throw new Error('The saved allocation and current groups disagree. Refresh and review the regional cycle.');
    // Always inventory actual rows: a cached counter cannot authorize another draw.
    const fresh=await loadEditionFixtureCount(client,'regional_league',{...edition,actual_fixtures_count:undefined});
    return {...fresh,can_draw:!fresh.actual_fixtures_count && ['draft','setup','registration','seeded','active','in_progress'].includes(fresh.status)};
  }));
}

export function managementPreviewReady(preview) {
  return Boolean(preview && preview.revision != null && Array.isArray(preview.blockers) && preview.blockers.length === 0 && !preview.applied);
}

export function buildLeagueManagementRequest({ action, league_id, definition, reason }) {
  return {
    action, reason: reason.trim(),
    ...(action === 'create' ? { definition } : { league_id }),
  };
}

export function adminEndpointError(error) {
  return error?.status === 404 || error?.status === 501
    ? 'This admin endpoint is unavailable on the connected backend. Deploy the lifecycle backend and refresh; the action was not confirmed.'
    : error?.message || 'The request failed. Refresh and review the current state before retrying.';
}

// Explicit user-reviewed legacy mappings; never infer a merge by name.
export const REGIONAL_DUPLICATE_REPAIRS = [
  { name: 'Premier Division', source_id: '46dbb09f-8319-4607-ab97-ec941745bfd8', canonical_id: 'c2d6e60f-89e0-4813-81a1-967551d8d69f' },
  { name: 'North American Division 1', source_id: 'e582c55b-1e72-45f5-ab63-137c3420404a', canonical_id: 'e91c6c27-4fd2-45d9-b6ed-6a3591d7b210' },
];
export function buildDuplicateLeagueRequest(sourceId, reason, testHistoryReset = false) {
  const pair = REGIONAL_DUPLICATE_REPAIRS.find(item => item.source_id === sourceId);
  if (!pair) throw new Error('Select a reviewed duplicate league mapping.');
  return { mode: 'consolidate', source_id: pair.source_id, canonical_id: pair.canonical_id, reason: reason.trim(), ...(testHistoryReset ? { test_history_reset: true } : {}) };
}

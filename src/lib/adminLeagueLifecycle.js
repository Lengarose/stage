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

export async function submitEditionLifecycle(client, kind, edition, action, reason, confirmed) {
  if (!edition?.id || !reason?.trim() || confirmed !== true) throw new Error('An exact edition, reason and confirmation are required.');
  return client.http.post(`/competition-views/${kind}/${encodeURIComponent(edition.id)}/lifecycle`, {
    action, reason: reason.trim(), confirmation: true,
  });
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

import { buildPlayerPresidentDirectoryRows, matchesPlayerPresidentQuery } from './presidentDirectory.js';

// Read complete directories in bounded, stably ordered pages. The selector UI
// still paginates its display, but must retain every already-registered player.
export async function loadDirectoryRows(entity, { filters = {}, orderBy = 'id', pageSize = 200 } = {}) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) throw new Error('Invalid directory page size');
  const rows = new Map();
  for (let offset = 0; ; offset += pageSize) {
    const page = await entity.filter({ ...filters, offset }, orderBy, pageSize);
    if (!Array.isArray(page)) throw new Error('Invalid directory response');
    const previousSize = rows.size;
    for (const row of page) rows.set(String(row.id), row);
    if (page.length < pageSize) return [...rows.values()];
    if (rows.size === previousSize) throw new Error('Directory pagination did not advance');
  }
}

export async function searchDirectory(client, query) {
  const [players, matchingClubs] = await Promise.all([
    loadDirectoryRows(client.entities.Player, { filters: { search: query }, orderBy: '-overall_rating' }),
    loadDirectoryRows(client.entities.Club, { filters: { search: query }, orderBy: '-wins' }),
  ]);
  // Club search also matches its president's gamertag. Hydrate president players
  // when only their club/country/platform matched the search.
  const clubsById = new Map(matchingClubs.map(club => [String(club.id), club]));
  const playersById = new Map(players.map(player => [String(player.id), player]));
  const missingIds = [...new Set([...clubsById.values()].map(club => club.president_player_id).filter(id => id && !playersById.has(String(id))))];
  const linkedPlayers = await Promise.all(missingIds.map(id => client.entities.Player.get(id)));
  for (const player of linkedPlayers) if (player?.id) playersById.set(String(player.id), player);
  const q = query.trim().toLowerCase();
  return {
    players,
    clubs: matchingClubs.filter(club => [club.name, club.tag].some(value => String(value || '').toLowerCase().includes(q))),
    presidents: buildPlayerPresidentDirectoryRows([...clubsById.values()], [...playersById.values()]).filter(row => matchesPlayerPresidentQuery(row, query)),
  };
}

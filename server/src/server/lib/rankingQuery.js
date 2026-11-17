'use strict';

const PAGE_SIZE = 25;
const PREVIEW_SIZE = 10;
const SUMMARY_FULL_LIMIT = 100;

function n(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value) {
  return String(value ?? '').trim();
}

function upper(value) {
  return text(value).toUpperCase();
}

function isRankingAdminRole(roleId) {
  if (roleId === null || roleId === undefined || roleId === '') return false;
  return [0, 2].includes(Number(roleId));
}

function compareRankings(a, b) {
  return (b.ranking_points || 0) - (a.ranking_points || 0) ||
    (b.wins || b.ranking_wins || 0) - (a.wins || a.ranking_wins || 0) ||
    (b.matches_ranked || b.ranking_matches || 0) - (a.matches_ranked || a.ranking_matches || 0) ||
    text(a.name || a.gamertag).localeCompare(text(b.name || b.gamertag));
}

function readQuery(query = {}) {
  return {
    region: text(query.region),
    country: text(query.country_code || query.country),
    position: upper(query.position),
    platform: text(query.platform),
    search: text(query.q || query.search),
    page: Math.max(1, n(query.page, 1)),
    limit: Math.min(50, Math.max(1, n(query.limit, PAGE_SIZE))),
  };
}

function same(left, right) {
  return text(left).toLowerCase() === text(right).toLowerCase();
}

function scopeFilters(rows, query, kind) {
  return rows.filter((row) => {
    if (query.region && !same(row.region, query.region)) return false;
    if (query.country && !same(row.country_code, query.country)) return false;
    if (query.platform && !same(row.platform, query.platform)) return false;
    if (kind === 'player' && query.position && upper(row.position) !== query.position) return false;
    return true;
  });
}

function searchRows(rows, query, kind) {
  const needle = query.search.toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => {
    const fields = kind === 'club'
      ? [row.name, row.tag, row.region, row.country_code]
      : [row.gamertag, row.club_name, row.club_tag, row.position];
    return fields.some((value) => text(value).toLowerCase().includes(needle));
  });
}

function rankWithin(rows) {
  return [...rows].sort(compareRankings).map((row, index) => ({ ...row, scope_rank: index + 1 }));
}

function uniqueSorted(rows, pick) {
  return [...new Set(rows.map(pick).map(text).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function facetsFrom(rows, kind) {
  const facets = {
    regions: uniqueSorted(rows, (row) => row.region),
    countries: uniqueSorted(rows, (row) => row.country_code),
    platforms: uniqueSorted(rows, (row) => row.platform),
  };
  if (kind === 'player') facets.positions = uniqueSorted(rows, (row) => upper(row.position));
  return facets;
}

function presentRankingRow(row, fullAccess, kind) {
  if (!row) return null;
  if (kind === 'club') {
    const base = {
      id: row.id,
      name: row.name,
      tag: row.tag,
      logo_url: row.logo_url,
      logo_position: row.logo_position,
      logo_zoom: row.logo_zoom,
      banner_url: row.banner_url,
      banner_position: row.banner_position,
      banner_zoom: row.banner_zoom,
      platform: row.platform,
      region: row.region,
      country_code: row.country_code,
      global_rank: row.global_rank,
      scope_rank: row.scope_rank ?? row.global_rank,
      matches_ranked: row.matches_ranked,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
    };
    if (!fullAccess) return base;
    return {
      ...base,
      regional_rank: row.regional_rank,
      country_rank: row.country_rank,
      goals_scored: row.goals_scored,
      goals_conceded: row.goals_conceded,
      clean_sheets: row.clean_sheets,
      competition_wins: row.competition_wins,
      ranking_points: row.ranking_points,
      form: row.form,
    };
  }
  const base = {
    id: row.id,
    gamertag: row.gamertag,
    avatar_url: row.avatar_url,
    avatar_position: row.avatar_position,
    avatar_zoom: row.avatar_zoom,
    position: row.position,
    secondary_position: row.secondary_position,
    platform: row.platform,
    country: row.country,
    country_code: row.country_code,
    club_id: row.club_id,
    club_name: row.club_name,
    club_tag: row.club_tag,
    region: row.region,
    global_rank: row.global_rank,
    scope_rank: row.scope_rank ?? row.global_rank,
    ranking_matches: row.ranking_matches,
    ranking_wins: row.ranking_wins,
    ranking_draws: row.ranking_draws,
    ranking_losses: row.ranking_losses,
    ranking_goals: row.ranking_goals,
    ranking_assists: row.ranking_assists,
    is_verified: row.is_verified,
  };
  if (!fullAccess) return base;
  return {
    ...base,
    regional_rank: row.regional_rank,
    country_rank: row.country_rank,
    position_rank: row.position_rank,
    ranking_win_rate: row.ranking_win_rate,
    ranking_clean_sheets: row.ranking_clean_sheets,
    ranking_motm: row.ranking_motm,
    ranking_avg_rating: row.ranking_avg_rating,
    competition_wins: row.competition_wins,
    ranking_points: row.ranking_points,
  };
}

function scopeName(query, kind) {
  const parts = [];
  if (query.region) parts.push(query.region);
  if (query.country) parts.push(query.country);
  if (query.platform) parts.push(query.platform);
  if (kind === 'player' && query.position) parts.push(query.position);
  return parts.length ? parts.join(' · ') : 'global';
}

function buildBoard({ rows, kind, fullAccess, query, meta, viewer }) {
  const source = Array.isArray(rows) ? rows : [];
  const totalRanked = source.length;
  const viewerId = kind === 'club' ? viewer?.club_id : viewer?.player_id;
  if (!fullAccess) {
    const slice = source.slice(0, PREVIEW_SIZE).map((row) => presentRankingRow(row, false, kind));
    return {
      rows: slice,
      access: 'limited',
      full_access: false,
      result_kind: 'preview',
      total_ranked: totalRanked,
      matching: null,
      displayed: slice.length,
      page: 1,
      page_size: PREVIEW_SIZE,
      pages: 1,
      scope: 'global',
      preview_limit: PREVIEW_SIZE,
      facets: null,
      viewer: viewer || null,
      highlighted_id: slice.some((row) => row.id === viewerId) ? viewerId : null,
      meta: meta || null,
    };
  }
  const filters = readQuery(query);
  const scoped = rankWithin(scopeFilters(source, filters, kind));
  const matched = searchRows(scoped, filters, kind);
  const pages = Math.max(1, Math.ceil(matched.length / filters.limit) || 1);
  const page = Math.min(filters.page, pages);
  const slice = matched.slice((page - 1) * filters.limit, page * filters.limit);
  return {
    rows: slice.map((row) => presentRankingRow(row, true, kind)),
    access: 'full',
    full_access: true,
    result_kind: matched.length <= filters.limit && page === 1 ? 'complete' : 'page',
    total_ranked: totalRanked,
    matching: matched.length,
    displayed: slice.length,
    page,
    page_size: filters.limit,
    pages,
    scope: scopeName(filters, kind),
    preview_limit: null,
    facets: facetsFrom(source, kind),
    viewer: viewer || null,
    highlighted_id: matched.some((row) => row.id === viewerId) ? viewerId : null,
    meta: meta || null,
  };
}

function locateIdentity({ rows, id, kind, fullAccess, query }) {
  const source = Array.isArray(rows) ? rows : [];
  if (!id) {
    return { found: false, ranked: false, reason: 'no_identity', access: fullAccess ? 'full' : 'limited' };
  }
  const rankedRow = source.find((row) => row.id === id);
  if (!rankedRow) {
    return { found: true, ranked: false, reason: 'unranked', access: fullAccess ? 'full' : 'limited' };
  }
  if (!fullAccess) {
    const inPreview = source.slice(0, PREVIEW_SIZE).some((row) => row.id === id);
    if (!inPreview) {
      return {
        found: true,
        ranked: true,
        in_preview: false,
        in_results: false,
        reason: 'outside_preview',
        access: 'limited',
      };
    }
    return {
      found: true,
      ranked: true,
      in_preview: true,
      in_results: true,
      reason: 'in_preview',
      access: 'limited',
      page: 1,
      row: presentRankingRow(rankedRow, false, kind),
    };
  }
  const filters = readQuery(query);
  const scoped = rankWithin(scopeFilters(source, filters, kind));
  const scopeRow = scoped.find((row) => row.id === id);
  const matched = searchRows(scoped, filters, kind);
  const index = matched.findIndex((row) => row.id === id);
  if (!scopeRow) {
    return {
      found: true,
      ranked: true,
      in_results: false,
      reason: 'outside_scope',
      access: 'full',
      global_rank: rankedRow.global_rank,
    };
  }
  if (index < 0) {
    return {
      found: true,
      ranked: true,
      in_results: false,
      reason: 'filtered_out',
      access: 'full',
      global_rank: scopeRow.global_rank,
      scope_rank: scopeRow.scope_rank,
      page: null,
    };
  }
  return {
    found: true,
    ranked: true,
    in_results: true,
    reason: 'ranked',
    access: 'full',
    page: Math.floor(index / filters.limit) + 1,
    global_rank: scopeRow.global_rank,
    scope_rank: scopeRow.scope_rank,
    row: presentRankingRow(matched[index], true, kind),
  };
}

function previewSummary(summary, fullAccess) {
  const clubs = summary.clubs || [];
  const players = summary.players || [];
  const clubLimit = fullAccess ? SUMMARY_FULL_LIMIT : PREVIEW_SIZE;
  const playerLimit = fullAccess ? SUMMARY_FULL_LIMIT : PREVIEW_SIZE;
  const shownClubs = clubs.slice(0, clubLimit).map((row) => presentRankingRow(row, fullAccess, 'club'));
  const shownPlayers = players.slice(0, playerLimit).map((row) => presentRankingRow(row, fullAccess, 'player'));
  return {
    clubs: shownClubs,
    players: shownPlayers,
    positions: fullAccess
      ? (summary.positions || []).map((group) => ({
        ...group,
        players: (group.players || []).map((row) => presentRankingRow(row, true, 'player')),
      }))
      : [],
    meta: {
      ...(summary.meta || {}),
      access: fullAccess ? 'full' : 'limited',
      full_access: Boolean(fullAccess),
      result_kind: 'preview',
      displayed_clubs: shownClubs.length,
      displayed_players: shownPlayers.length,
      preview_limit: fullAccess ? SUMMARY_FULL_LIMIT : PREVIEW_SIZE,
    },
  };
}

module.exports = {
  PAGE_SIZE,
  PREVIEW_SIZE,
  isRankingAdminRole,
  compareRankings,
  buildBoard,
  locateIdentity,
  previewSummary,
  presentRankingRow,
};

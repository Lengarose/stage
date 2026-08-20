const { EXECUTESQL } = require('../db/database');
const {
  isLeagueCompetition,
  isPublishedToday,
  participatingCountries,
  storyBeat,
  storyKindForBeat,
  tournamentFieldCard,
} = require('./newsFeedService');
const {
  CONTINENTS,
  countryDisplayName,
  decorateStoryLocation,
  indexClubs,
  normalizeCountryCode,
  resolveContinent,
} = require('../lib/continents');

const DESK_SECTIONS = new Set(['club_news', 'player_news', 'tournament', 'competitions', 'daily_news', 'world_news']);

function parseJson(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function clock(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

function asStory(item, beat) {
  const kind = storyKindForBeat(item, beat);
  return {
    id: item.id,
    beat,
    kind,
    stamp: String(kind || beat).replace(/_/g, ' ').toUpperCase(),
    title: item.title,
    body: item.body || '',
    club_id: item.club_id || null,
    club_name: item.club_name || null,
    club_logo_url: item.club_logo_url || null,
    player_id: item.player_id || null,
    player_name: item.player_name || null,
    player_avatar_url: item.player_avatar_url || item.photo_url || null,
    tournament_id: item.tournament_id || null,
    tournament_name: item.tournament_name || null,
    transfer_id: item.transfer_id || null,
    amount_stc: Number(item.transfer_fee_stc || 0),
    quotes: parseJson(item.quotes, []),
    photo_url: item.photo_url || item.image_url || null,
    link: item.link || '',
    published_at: clock(item.published_at || item.created_date),
    continent: item.continent || null,
    country_code: item.country_code || null,
    region: item.region || null,
  };
}

function countByKind(feed) {
  return feed.reduce((acc, row) => {
    acc[row.kind] = (acc[row.kind] || 0) + 1;
    return acc;
  }, {});
}

async function loadNewsItems() {
  return EXECUTESQL(
    `SELECT * FROM news_items
      WHERE is_global = 1 OR is_global IS NULL
      ORDER BY published_at DESC
      LIMIT 200`,
  ).catch(() => []);
}

function storyDeskMeta(section, feed) {
  const counts = countByKind(feed);
  if (section === 'club_news') {
    return {
      kicker: 'Club Desk',
      line: 'Stadium · shirts · contracts the club issued · tickets · trophies',
      board: {
        stadium: feed.filter((row) => row.kind === 'stadium').slice(0, 5),
        shirts: feed.filter((row) => row.kind === 'shirts').slice(0, 5),
        contracts: feed.filter((row) => row.kind === 'contract').slice(0, 5),
        tickets: feed.filter((row) => row.kind === 'tickets').slice(0, 5),
        trophies: feed.filter((row) => row.kind === 'trophy').slice(0, 5),
        counts,
      },
    };
  }
  if (section === 'player_news') {
    return {
      kicker: 'Player Desk',
      line: 'Lifestyle · rankings · the contract the player signed · MOTM',
      board: {
        lifestyle: feed.filter((row) => row.kind === 'lifestyle').slice(0, 5),
        rankings: feed.filter((row) => row.kind === 'ranking').slice(0, 5),
        signed: feed.filter((row) => row.kind === 'signed').slice(0, 5),
        motm: feed.filter((row) => row.kind === 'motm').slice(0, 5),
        counts,
      },
    };
  }
  return {
    kicker: 'Daily News',
    line: "Today's edition — every desk, only stories published today",
    board: {
      club: feed.filter((row) => row.beat === 'club_news').slice(0, 5),
      player: feed.filter((row) => row.beat === 'player_news').slice(0, 5),
      mercato: feed.filter((row) => row.beat === 'mercato').slice(0, 5),
      tournament: feed.filter((row) => row.beat === 'tournament' || row.beat === 'competitions').slice(0, 5),
      counts,
    },
  };
}

async function buildStoryDesk(section) {
  const news = await loadNewsItems();
  const feed = [
    ...news.map((item) => ({ item, beat: storyBeat(item) })),
  ]
    .filter((row) => row.beat === section)
    .map((row) => (row.item.stamp ? row.item : asStory(row.item, section)));

  return {
    section,
    feed,
    fields: [],
    ...storyDeskMeta(section, feed),
  };
}

function transferToStory(row) {
  return {
    id: `mercato_${row.id}`,
    beat: 'mercato',
    kind: row.status || 'mercato',
    stamp: String(row.status || 'mercato').replace(/_/g, ' ').toUpperCase(),
    title: row.headline || `${row.player_name || 'Player'} → ${row.to_club_name || 'club'}`,
    body: row.body || '',
    club_id: row.to_club_id || row.from_club_id || null,
    club_name: row.to_club_name || row.from_club_name || null,
    club_logo_url: row.to_club_logo_url || row.from_club_logo_url || null,
    player_id: row.player_id || null,
    player_name: row.player_name || null,
    player_avatar_url: row.player_avatar_url || null,
    tournament_id: row.competition_id || null,
    tournament_name: null,
    transfer_id: row.id,
    amount_stc: Number(row.transfer_fee || 0),
    quotes: [],
    photo_url: row.player_avatar_url || null,
    link: `/news?section=mercato&transfer=${row.id}`,
    published_at: clock(row.last_updated_at || row.published_at || row.created_date),
    continent: resolveContinent({ country_code: row.country_code }),
    country_code: row.country_code || null,
    region: null,
  };
}

async function loadClubCatalog() {
  return EXECUTESQL('SELECT id, name, tag, country_code, region FROM clubs').catch(() => []);
}

function tallyCountries(feed, clubs = []) {
  const byCode = new Map();
  for (const club of clubs) {
    const code = normalizeCountryCode(club.country_code);
    const continent = resolveContinent({ region: club.region, country_code: code });
    if (!code || !continent) continue;
    if (!byCode.has(code)) {
      byCode.set(code, {
        code,
        name: countryDisplayName(code),
        continent,
        count: 0,
      });
    }
  }
  for (const row of feed) {
    const code = normalizeCountryCode(row.country_code);
    if (!code || !row.continent) continue;
    const prev = byCode.get(code) || {
      code,
      name: countryDisplayName(code),
      continent: row.continent,
      count: 0,
    };
    prev.count += 1;
    byCode.set(code, prev);
  }
  return [...byCode.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

async function decorateWithContinent(stories) {
  const playerIds = [...new Set(stories.map((row) => row.player_id).filter(Boolean).map(String))];
  const tournamentIds = [...new Set(stories.map((row) => row.tournament_id).filter(Boolean).map(String))];
  const [clubs, players, tournaments] = await Promise.all([
    loadClubCatalog(),
    loadRowsByIds('players', playerIds),
    loadRowsByIds('tournaments', tournamentIds),
  ]);
  const catalog = indexClubs(clubs);
  const playersById = Object.fromEntries(players.map((row) => [String(row.id), row]));
  const tournamentsById = Object.fromEntries(tournaments.map((row) => [String(row.id), row]));
  const feed = stories.map((story) => decorateStoryLocation(story, { catalog, playersById, tournamentsById }));
  return { feed, clubs };
}

async function loadMercatoRows() {
  return EXECUTESQL(
    'SELECT * FROM mercato_transfers ORDER BY last_updated_at DESC LIMIT 200',
  ).catch(() => []);
}

function mixedStories(news, transfers) {
  const fromNews = news.map((item) => asStory(item, storyBeat(item)));
  const fromMercato = transfers.map(transferToStory);
  return [...fromNews, ...fromMercato]
    .sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0));
}

async function buildDailyDesk() {
  const [news, transfers] = await Promise.all([
    loadNewsItems(),
    loadMercatoRows(),
  ]);
  const todayNews = news.filter((item) => isPublishedToday(item.published_at || item.created_date));
  const todayTransfers = transfers.filter((item) => isPublishedToday(item.last_updated_at || item.published_at || item.created_date));
  const { feed } = await decorateWithContinent(mixedStories(todayNews, todayTransfers));
  return {
    section: 'daily_news',
    feed,
    fields: [],
    ...storyDeskMeta('daily_news', feed),
  };
}

async function buildWorldDesk() {
  const [news, transfers] = await Promise.all([
    loadNewsItems(),
    loadMercatoRows(),
  ]);
  const { feed, clubs } = await decorateWithContinent(mixedStories(news, transfers));
  const continents = CONTINENTS.map((continent) => ({
    ...continent,
    count: feed.filter((row) => row.continent === continent.id).length,
  }));
  return {
    section: 'world_news',
    kicker: 'World News',
    line: 'Pick a continent on the map, then a country. Every club is placed from its country code.',
    feed,
    fields: [],
    continents,
    countries: tallyCountries(feed, clubs),
    board: Object.fromEntries(
      CONTINENTS.map((continent) => [
        continent.id,
        feed.filter((row) => row.continent === continent.id).slice(0, 6),
      ]),
    ),
  };
}

function idList(value) {
  const parsed = parseJson(value, []);
  return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
}

async function loadRowsByIds(table, ids) {
  if (!ids.length) return [];
  return EXECUTESQL(
    `SELECT * FROM ${table} WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids,
  ).catch(() => []);
}

async function buildCompetitionDesk(section) {
  const wantLeague = section === 'competitions';
  const tournaments = await EXECUTESQL(
    `SELECT t.*, ti.name AS trophy_item_name, ti.image_url AS trophy_item_image
       FROM tournaments t
       LEFT JOIN trophy_items ti ON ti.id = t.trophy_item_id
      WHERE t.status IN ('registration', 'in_progress', 'completed')
      ORDER BY t.updated_date DESC
      LIMIT 40`,
  ).catch(() => []);
  const filtered = tournaments.filter((row) => isLeagueCompetition(row) === wantLeague);
  const tournamentIds = filtered.map((row) => row.id).filter(Boolean);
  const clubIds = [...new Set(filtered.flatMap((row) => idList(row.registered_clubs)))];
  const playerIds = [...new Set(filtered.flatMap((row) => idList(row.registered_players)))];

  const [matches, clubs, players, news] = await Promise.all([
    tournamentIds.length
      ? EXECUTESQL(
        `SELECT id, tournament_id, type, round, status,
                home_club_id, home_club_name, away_club_id, away_club_name,
                home_player_id, home_player_name, away_player_id, away_player_name,
                winner_club_id, winner_club_name, winner_player_id, winner_player_name,
                home_score, away_score
           FROM matches
          WHERE tournament_id IN (${tournamentIds.map(() => '?').join(',')})
          ORDER BY round ASC, created_date ASC`,
        tournamentIds,
      ).catch(() => [])
      : [],
    loadRowsByIds('clubs', clubIds),
    loadRowsByIds('players', playerIds),
    loadNewsItems(),
  ]);

  const clubsById = Object.fromEntries(clubs.map((row) => [String(row.id), row]));
  const playersById = Object.fromEntries(players.map((row) => [String(row.id), row]));
  const matchesByTournament = matches.reduce((acc, match) => {
    const key = String(match.tournament_id);
    acc[key] = acc[key] || [];
    acc[key].push(match);
    return acc;
  }, {});

  const fields = filtered.map((tournament) => {
    const registeredClubs = idList(tournament.registered_clubs).map((id) => clubsById[id]).filter(Boolean);
    const registeredPlayers = idList(tournament.registered_players).map((id) => playersById[id]).filter(Boolean);
    const countries = tournamentFieldCard(tournament, {
      countries: participatingCountries(
        registeredClubs.length ? registeredClubs : registeredPlayers,
      ),
      matches: matchesByTournament[String(tournament.id)] || [],
      trophyName: tournament.trophy_item_name || '',
      trophyUrl: tournament.trophy_item_image || tournament.trophy_url || '',
    });
    return countries;
  });

  const feed = news
    .map((item) => ({ item, beat: storyBeat(item) }))
    .filter((row) => row.beat === section)
    .map((row) => asStory(row.item, section));

  return {
    section,
    kicker: wantLeague ? 'Competition Desk' : 'Tournament Desk',
    line: wantLeague
      ? 'League tables, matchdays, phases and the side that lifted the title'
      : 'The field, the cup, the countries, the rounds and the champion',
    feed,
    fields,
    board: {
      live: fields.filter((row) => String(row.status) === 'in_progress').slice(0, 8),
      field: fields.filter((row) => String(row.status) === 'registration').slice(0, 8),
      champions: fields.filter((row) => row.winner_name).slice(0, 8),
    },
  };
}

async function buildDesk(section) {
  if (!DESK_SECTIONS.has(section)) {
    const error = new Error('Unknown news desk');
    error.status = 404;
    throw error;
  }
  if (section === 'tournament' || section === 'competitions') {
    return buildCompetitionDesk(section);
  }
  if (section === 'daily_news') return buildDailyDesk();
  if (section === 'world_news') return buildWorldDesk();
  return buildStoryDesk(section);
}

module.exports = {
  DESK_SECTIONS,
  asStory,
  buildDesk,
  pressToStory,
};

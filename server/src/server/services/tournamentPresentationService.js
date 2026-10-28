const { EXECUTESQL, withTransaction } = require('../db/database');
const { parse, configuredPrizes } = require('../lib/competitionPrizes');
const { safeImage, publicTrophy } = require('./gostOverviewService');
const rewards = require('./rewardConfigurationService');
const fields = ['name', 'description', 'start_date', 'banner_url', 'banner_color', 'banner_position', 'trophy_url'];
const fail = (text, status) => Object.assign(new Error(text), { status });
async function presentation(id, query = EXECUTESQL) {
  const [t] = await query('SELECT * FROM tournaments WHERE id=?', [id]);
  if (!t) throw fail('Tournament not found', 404);
  const player = t.participant_type === 'player';
  const ids = [...new Set(parse(t[player ? 'registered_players' : 'registered_clubs'], []).filter(Boolean).map(String))];
  const profiles = ids.length ? await query(`SELECT ${player ? 'id,gamertag,avatar_url,position,platform,country_code' : 'id,name,tag,logo_url,platform,country_code,region'} FROM ${player ? 'players' : 'clubs'} WHERE id IN (${ids.map(() => '?').join(',')})`, ids) : [];
  const awards = await query("SELECT metadata_json FROM trophy_awards WHERE source_type='tournament' AND source_id=? AND status='earned' AND award_role='winner'", [id]);
  const award = awards.map(a => parse(a.metadata_json, {})).find(a => a.version === 1);
  const [settlement] = await query("SELECT data_json FROM league_entities WHERE entity_type='competition_settlement' AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.source_id'))=? AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.source_type'))='tournament'", [id]);
  const captured = parse(settlement?.data_json, {});
  const [item] = t.trophy_item_id ? await query('SELECT id,name,image_url FROM trophy_items WHERE id=?', [t.trophy_item_id]) : [];
  const historical = ['completed', 'archived'].includes(t.status);
  const uploaded = safeImage(t.trophy_url) ? { name: 'Tournament trophy', image_url: safeImage(t.trophy_url) } : null;
  const trophy = historical ? award ? { name: award.design_name, image_url: safeImage(award.image_url) } : uploaded : publicTrophy(item) || uploaded;
  return { participants: ids.map(id => profiles.find(p => String(p.id) === id) || { id, name: 'Participant unavailable', available: false }), trophy,
    champion: historical && (award?.winning_id || t[player ? 'winner_player_id' : 'winner_club_id']) ? { id: award?.winning_id || t[player ? 'winner_player_id' : 'winner_club_id'], name: award?.winning_name || t[player ? 'winner_player_name' : 'winner_club_name'], player } : null,
    prizes: { pool: t.prize_pool_stc ?? null, rows: Array.isArray(captured.config) ? captured.config : configuredPrizes(t, parse(t.reward_snapshot, [])), payment_state: captured.state || 'Not verified', captured: Array.isArray(captured.config) } };
}
async function edit(id, input, actor, transaction = withTransaction) {
  return transaction(async query => {
    const [user] = await query('SELECT id,email,role_id FROM users WHERE id=?', [actor?.id]);
    if (!user) throw fail('Authentication required', 401);
    const [t] = await query('SELECT * FROM tournaments WHERE id=? FOR UPDATE', [id]);
    if (!t) throw fail('Tournament not found', 404);
    const admin = [0, 2].includes(Number(user.role_id));
    const players = await query('SELECT id FROM players WHERE user_id=?', [user.id]);
    const own = [t.creator_email, t.organizer_email].filter(Boolean).some(email => email.toLowerCase() === String(user.email).toLowerCase()) || players.some(p => p.id === t.creator_id);
    if (!admin && !own) throw fail('Tournament organiser access required', 403);
    if (['completed', 'archived'].includes(t.status)) throw fail('Completed history is read-only', 409);
    const changes = Object.fromEntries(fields.filter(k => Object.hasOwn(input, k)).map(k => [k, input[k]]));
    if (!Object.keys(changes).length) throw fail('No presentation changes supplied', 400);
    if (Object.hasOwn(changes, 'name') && (typeof changes.name !== 'string' || !changes.name.trim())) throw fail('Tournament name is required', 400);
    if (changes.banner_position && (!/^\d{1,3}(\.\d+)?% \d{1,3}(\.\d+)?%$/.test(changes.banner_position) || changes.banner_position.split(' ').some(v => Number.parseFloat(v) > 100))) throw fail('Invalid banner crop position', 400);
    for (const key of ['banner_url', 'trophy_url']) if (changes[key] && !safeImage(changes[key])) throw fail('Unsupported artwork URL', 400);
    if (Object.values(changes).some(v => typeof v !== 'string' && v !== null)) throw fail('Invalid presentation value', 400);
    await query(`UPDATE tournaments SET ${Object.keys(changes).map(k => `${k}=?`).join(',')},updated_date=NOW() WHERE id=?`, [...Object.values(changes), id]);
    if (admin) await rewards.audit(query, user, 'edit_tournament_presentation', 'tournament', id, Object.fromEntries(Object.keys(changes).map(k => [k,t[k]])), changes, input.reason || 'Admin updated tournament artwork/presentation');
    return { ...t, ...changes };
  });
}
module.exports = { presentation, edit, fields };

'use strict';

const {
  stableId,
  ClubBoardModel
} = require('../models/clubBoardModel');
const {
  VERSION,
  managementOffer
} = require('../lib/clubBoardPolicy');
const unpack = r => ({
  ...JSON.parse(r.data_json || '{}'),
  id: r.id,
  entity_type: r.entity_type
});
const parse = v => typeof v === 'string' ? JSON.parse(v) : v;
const excluded = new Set(['reset', 'superseded', 'cancelled', 'abandoned', 'retired']);
function objectiveFor({
  previousPosition = null,
  promoted = false,
  fieldSize = 20,
  relegatedSlots = 2
} = {}) {
  if (promoted) return {
    type: 'position',
    target_position: Math.max(1, fieldSize - relegatedSlots),
    description: 'Avoid relegation'
  };
  if (previousPosition) return {
    type: 'position',
    target_position: previousPosition,
    description: `Match or improve the previous final position (${previousPosition})`
  };
  return {
    type: 'completion',
    description: 'Complete the official season and establish a participating squad'
  };
}
function gradeObjective(objective, evidence) {
  if (!evidence.final || !evidence.within_appointment || evidence.invalidated) return 'unassessed';
  if (evidence.withdrawn) return 'below';
  if (evidence.confirmed_title || evidence.confirmed_promotion) return 'exceptional';
  if (objective.type === 'completion') return evidence.completed ? 'meets' : 'below';
  if (!Number.isInteger(evidence.position)) return 'unassessed';
  return evidence.position <= objective.target_position - 3 ? 'exceeds' : evidence.position <= objective.target_position ? 'meets' : 'below';
}
async function evidence(clubId, appointment, q) {
  const rows = (await q("SELECT * FROM league_entities WHERE entity_type IN ('regional_league','regional_league_standing','competition_season','competition_standing','regional_cup_edition','regional_calendar','regional_cycle') ORDER BY id FOR UPDATE")).map(unpack);
  const result = [];
  for (const root of rows.filter(r => ['regional_league', 'competition_season', 'regional_cup_edition'].includes(r.entity_type))) {
    const participants = parse(root.registered_club_ids || root.participant_ids || '[]');
    if (!participants.includes(clubId) || root.edition_invalidated || excluded.has(root.status)) continue;
    const standing = rows.find(r => ['regional_league_standing', 'competition_standing'].includes(r.entity_type) && r.club_id === clubId && (r.league_id === root.id || r.season_id === root.id));
    const calendar = rows.find(r => r.entity_type === 'regional_calendar' && r.status === 'published' && r.edition_ids?.includes(root.id));
    const starts = calendar?.start_monday ? `${calendar.start_monday}T00:00:00Z` : root.starts_at || root.start_date || null;
    const final = ['completed', 'archived'].includes(root.status);
    const finalRanking = root.regional_final_ranking_cycle_id ? parse(root.regional_final_ranked_club_ids || '[]') : [];
    const position = finalRanking.includes(clubId) ? finalRanking.indexOf(clubId) + 1 : final ? null : Number(standing?.position || standing?.rank) || null;
    const cycle = rows.find(r => r.entity_type === 'regional_cycle' && r.id === root.regional_final_ranking_cycle_id && r.status === 'allocated');
    const right = cycle?.plan?.rights?.find(r => r.club_id === clubId);
    const withdrawn = parse(root.withdrawn_club_ids || '[]').includes(clubId);
    result.push({
      withdrawn,
      confirmed_relegation: final && Boolean(right && right.division > root.division),
      edition_id: root.id,
      competition_type: root.entity_type,
      name: root.name,
      region_slug: root.region_slug,
      division: root.division,
      group_code: root.group_code || 'A',
      season_number: root.season_number,
      field_size: participants.length,
      starts_at: starts,
      position,
      matches_played: Number(standing?.played || standing?.matches_played || 0),
      matches_remaining: root.entity_type === 'regional_league' ? Math.max(0, (participants.length - 1) * 2 - Number(standing?.played || standing?.matches_played || 0)) : null,
      final,
      completed: final && !withdrawn,
      confirmed_title: final && !withdrawn && root.winner_club_id === clubId,
      confirmed_promotion: final && !withdrawn && Boolean(standing?.is_promoted || standing?.promoted || right && right.division < root.division),
      within_appointment: Boolean(starts && Date.parse(starts) >= Date.parse(appointment)),
      relegated_slots: Number(root.relegated_slots || root.relegation_spots || 0),
      previous_season_id: root.previous_season_id || null
    });
  }
  return result;
}
async function reconcile(club, manager, agreements, q, now = new Date(), model = new ClubBoardModel()) {
  const appointment = agreements.filter(a => a.kind === 'management').map(a => a.accepted_at).sort()[0];
  if (!appointment) return {
    evidence: [],
    grade: 'unassessed'
  };
  const sources = await evidence(club.id, appointment, q),
    objectives = await model.selectAll('club_board_objective', club.id, q);
  const applications = (await q("SELECT * FROM league_entities WHERE entity_type='season_registration' AND club_id=? ORDER BY id FOR UPDATE", [club.id])).map(unpack);
  for (const application of applications.filter(r => r.status === 'pending' && r.participation_status === 'registered' && !r.edition_invalidated)) {
    const id = stableId(['provisional_board_objective', club.id, manager.id, application.id]);
    if (objectives.some(o => o.id === id)) continue;
    const objective = {
      id,
      club_id: club.id,
      manager_player_id: manager.id,
      registration_id: application.id,
      policy_version: VERSION,
      status: 'provisional',
      type: 'completion',
      description: 'Establish a participating squad and complete the season, subject to confirmed entry',
      published_at: now.toISOString()
    };
    await model.create('club_board_objective', objective, q);
    objectives.push(objective);
    await model.create('club_board_notice', {
      id: stableId(['objective_notice', id]),
      club_id: club.id,
      recipient_player_id: manager.id,
      status: 'pending',
      subject: 'Your regional application — provisional objectives',
      body: `Dear ${manager.gamertag || 'Manager'},\n\nYour club has applied for the ${application.region_slug || 'regional'} competition. Entry is not yet confirmed. Our provisional objective is to establish a participating squad and complete the season. Final sporting objectives will be published after confirmation and group allocation.\n\nThis application does not change your accepted salary or contract dates.\n\nThe Club Board`,
      related_id: id
    }, q);
  }
  for (const source of sources.filter(s => s.competition_type === 'regional_league')) {
    const id = stableId(['board_objective', club.id, manager.id, source.edition_id]);
    if (objectives.some(o => o.id === id)) continue;
    // Objectives are never invented retrospectively. Existing/in-progress
    // competitions remain evidence, with no fabricated prior target.
    if (!source.starts_at || Date.parse(source.starts_at) <= now.getTime()) continue;
    const previous = sources.find(s => s.edition_id === source.previous_season_id && s.final) || sources.filter(s => s.competition_type === 'regional_league' && s.final && s.starts_at && Date.parse(s.starts_at) < Date.parse(source.starts_at)).sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at))[0];
    const objective = {
      id,
      club_id: club.id,
      manager_player_id: manager.id,
      policy_version: VERSION,
      edition_id: source.edition_id,
      status: 'published',
      published_at: now.toISOString(),
      ...objectiveFor({
        previousPosition: previous?.position,
        promoted: Boolean(previous && previous.division > source.division),
        fieldSize: source.field_size,
        relegatedSlots: source.relegated_slots
      })
    };
    await model.create('club_board_objective', objective, q);
    objectives.push(objective);
    await model.create('club_board_notice', {
      id: stableId(['objective_notice', id]),
      club_id: club.id,
      recipient_player_id: manager.id,
      status: 'pending',
      subject: `Your objectives — ${source.name}`,
      body: `Dear ${manager.gamertag || 'Manager'},\n\nYour club’s participation in ${source.name} is confirmed. Your published objective is: ${objective.description}.\n\nWe will report progress during the season and assess confirmed outcomes at your contract review. Your current accepted salary and expiry date remain unchanged.\n\nThe Club Board`,
      related_id: id
    }, q);
  }
  const grades = objectives.map(o => ({
    objective: o,
    evidence: sources.find(s => s.edition_id === o.edition_id)
  })).filter(r => r.evidence).map(r => ({
    ...r,
    grade: gradeObjective(r.objective, r.evidence)
  }));
  for(const result of grades.filter(r=>r.evidence.final&&r.evidence.within_appointment)) {
    const id=stableId(['board_outcome',club.id,manager.id,result.evidence.edition_id,result.grade,result.evidence.position,result.evidence.confirmed_title,result.evidence.confirmed_promotion,result.evidence.withdrawn]);
    if(await model.selectOne('club_board_outcome',id,q))continue;
    await model.create('club_board_outcome',{id,club_id:club.id,manager_player_id:manager.id,status:'recorded',recorded_at:now.toISOString(),...result},q);
    await model.create('club_board_notice',{id:stableId(['board_outcome_notice',id]),club_id:club.id,recipient_player_id:manager.id,status:'pending',subject:`Your confirmed season outcome — ${result.evidence.name}`,body:`Dear ${manager.gamertag||'Manager'},\n\nThe official season outcome is now confirmed. Your published objective was: ${result.objective.description}. Your assessment is ${result.grade}.${result.evidence.position?` The confirmed final position is ${result.evidence.position}.`:''}\n\nThis outcome informs a future management offer. It does not automatically rewrite accepted pay or create a payment. Trophy availability is confirmed separately after an award has been recorded.\n\nThe Club Board`,related_id:id},q);
  }
  // One combined review: use the highest earned grade once, never compound
  // raises per trophy. No GOST absence penalty and no tournament evidence.
  const order = ['unassessed', 'below', 'meets', 'exceeds', 'exceptional'];
  const grade = grades.reduce((best, r) => order.indexOf(r.grade) > order.indexOf(best) ? r.grade : best, 'unassessed');
  return {
    evidence: sources,
    objectives,
    assessments: grades,
    grade
  };
}
module.exports = {
  objectiveFor,
  gradeObjective,
  evidence,
  reconcile,
  managementOffer
};

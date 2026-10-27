import { STAGE_QUALIFICATION_RULES } from './qualificationConfig.js';

export function qualificationRange(slug) {
  const positions = STAGE_QUALIFICATION_RULES.find(rule => rule.competitionSlug === slug)?.positions;
  return positions?.length ? `${positions[0]} – ${positions[positions.length - 1]}` : 'Not configured';
}

export function clubPathway(club, leagues, standings, entries) {
  if (!club) return { text: 'Join a regional club to follow your pathway to GOST.', href: '/leagues' };
  const rows = standings.filter(row => String(row.club_id) === String(club.id));
  const candidates = leagues.filter(league => rows.some(row => row.league_id === league.id) && !['archived', 'superseded', 'cancelled'].includes(league.status));
  candidates.sort((a, b) => Number(b.season_number) - Number(a.season_number) || a.id.localeCompare(b.id));
  const league = candidates[0];
  if (!league) return { text: `${club.name}: no applicable regional season is available.`, href: '/leagues' };
  const sameEdition = candidates.filter(other => Number(other.season_number) === Number(league.season_number));
  const ownRows = rows.filter(row => row.league_id === league.id);
  if (sameEdition.length !== 1 || ownRows.length !== 1) return { text: `${club.name}: regional placement needs review before a pathway can be shown.`, href: '/leagues' };
  const row = ownRows[0];
  const played = Number(row.played) > 0;
  const final = ['completed', 'archived'].includes(league.status);
  const position = final ? Number(row.final_position || row.position) : played ? Number(row.position) : null;
  const confirmed = entries.filter(e => e.club_id === club.id && e.regional_league_id === league.id && e.status === 'confirmed');
  const destination = Number(league.division) === 1 && position > 0 ? STAGE_QUALIFICATION_RULES.find(rule => rule.positions.includes(position)) : null;
  return { club: club.name, league: league.name, division: league.division, position: position || null, final, destination: destination?.competitionName || null,
    text: confirmed.length === 1 ? `Confirmed qualification: ${confirmed[0].target_competition_name || 'GOST'}.` : destination ? `${final ? 'Final position' : 'Provisional position'}: ${position}. ${destination.competitionName} pathway; qualification not yet confirmed.` : !played && !final ? 'Regional season not started. No qualifying position yet.' : Number(league.division) !== 1 ? 'Promotion to Division 1 is the next step towards GOST.' : 'Outside the GOST qualification positions.',
    href: league.slug ? `/leagues/${league.slug}` : '/leagues' };
}

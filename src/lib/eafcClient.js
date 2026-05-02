import { base44 } from '@/api/base44Client';

// All EA calls proxied through backend to avoid CORS.

async function call(endpoint, params = {}) {
  const res = await base44.functions.invoke('eafcApi', { endpoint, params });
  if (res.data?.error) throw new Error(res.data.error);
  return res.data?.data;
}

export function normalizePlatform(platform) {
  if (platform === 'PlayStation' || platform === 'Xbox' || platform === 'PC') return 'common-gen5';
  return platform || 'common-gen5';
}

export async function searchClub(clubName, platform) {
  const results = await call('searchClub', { clubName, platform: normalizePlatform(platform) });
  return Array.isArray(results) ? results : [];
}

export async function getClubInfo(clubId, platform) {
  return call('clubInfo', { clubId, platform: normalizePlatform(platform) });
}

export async function getClubOverallStats(clubId, platform) {
  return call('overallStats', { clubId, platform: normalizePlatform(platform) });
}

export async function getMemberStats(clubId, platform) {
  return call('memberStats', { clubId, platform: normalizePlatform(platform) });
}

export async function getMemberCareerStats(clubId, platform) {
  return call('memberCareerStats', { clubId, platform: normalizePlatform(platform) });
}

export async function getClubMatches(clubId, platform, matchType = 'leagueMatch') {
  return call(matchType === 'leagueMatch' ? 'leagueMatches' : 'playoffMatches', { clubId, platform: normalizePlatform(platform) });
}

export async function getClubDashboard(clubId, platform) {
  const plt = normalizePlatform(platform);
  const id = String(clubId);

  const [clubInfo, overallStats, members, career, matchesLeague, matchesPlayoff] = await Promise.allSettled([
    call('clubInfo',          { clubId: id, platform: plt }),
    call('overallStats',      { clubId: id, platform: plt }),
    call('memberStats',       { clubId: id, platform: plt }),
    call('memberCareerStats', { clubId: id, platform: plt }),
    call('leagueMatches',     { clubId: id, platform: plt }),
    call('playoffMatches',    { clubId: id, platform: plt }),
  ]);

  const get = (r) => r.status === 'fulfilled' ? r.value : null;

  const rawInfo = get(clubInfo);
  const club = rawInfo ? (rawInfo[id] || Object.values(rawInfo)[0] || null) : null;

  const rawStats = get(overallStats);
  const stats = rawStats ? (rawStats[id] || Object.values(rawStats)[0] || null) : null;

  const rawMembers = get(members);
  const memberList = rawMembers
    ? Array.isArray(rawMembers) ? rawMembers : Object.entries(rawMembers).map(([name, s]) => ({ name, ...s }))
    : [];

  const rawCareer = get(career);
  const careerList = rawCareer
    ? Array.isArray(rawCareer) ? rawCareer : Object.entries(rawCareer).map(([name, s]) => ({ name, ...s }))
    : [];

  const allMatches = [...(get(matchesLeague) || []), ...(get(matchesPlayoff) || [])];

  if (!club && memberList.length === 0 && allMatches.length === 0) {
    const firstError = [clubInfo, members, matchesLeague].find(r => r.status === 'rejected');
    throw new Error(firstError?.reason?.message || 'EA Pro Clubs API unreachable.');
  }

  return { club, stats, members: memberList, career: careerList, matches: allMatches };
}
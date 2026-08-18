export function sameRecordId(a, b) {
  if (a == null || b == null || a === '' || b === '') return false;
  return String(a) === String(b);
}

export function isGameDayMatchSocketPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.deleted && payload.id) return true;
  if (payload._entity && String(payload._entity) !== 'Match') return false;
  if (!payload.id) return false;
  if (payload.match_id && payload.player_id && payload.status == null && payload.home_club_id == null) {
    return false;
  }
  return payload.status != null
    || payload.home_club_id != null
    || payload.away_club_id != null
    || payload.home_player_id != null
    || payload.away_player_id != null
    || payload.result_home_submitted != null
    || payload.result_away_submitted != null;
}

export function resolveGameDayMatchEvent(event, matchId) {
  const id = event?.id || event?.data?.id;
  if (event?.type === 'delete' && sameRecordId(id, matchId)) {
    return { type: 'delete', id: String(matchId) };
  }
  const data = event?.data;
  if (!isGameDayMatchSocketPayload(data)) return null;
  if (matchId && !sameRecordId(data.id, matchId)) return null;
  return { type: 'update', match: data };
}

const OFFICIAL_SOURCES = new Set([
  'regional_league',
  'regional_league_fixture',
  'competition',
  'competition_engine',
  'competition_fixture',
  'knockout',
]);

const PLAYER_MANAGED_SOURCES = new Set([
  '',
  'game_day',
  'gameday',
  'arranged_game',
  'ranked',
  'friendly',
]);

function norm(value) {
  return String(value || '').trim().toLowerCase();
}

function emailsEqual(a, b) {
  const left = norm(a);
  const right = norm(b);
  return Boolean(left && right && left === right);
}

function idsEqual(a, b) {
  return Boolean(a && b && String(a) === String(b));
}

function isPlayerManagedMatch(match = {}) {
  if (!match?.id) return false;
  const tournamentId = norm(match.tournament_id);
  if (tournamentId && tournamentId !== 'ranked') return false;
  const source = norm(match.source_fixture_type);
  if (OFFICIAL_SOURCES.has(source)) return false;
  if (source && !PLAYER_MANAGED_SOURCES.has(source)) return false;
  return true;
}

function isCancellableMatchStatus(status) {
  const value = norm(status);
  return value === 'scheduled' || value === 'pending';
}

function actorIsParticipant(match = {}, actor = {}) {
  if (idsEqual(actor.playerId, match.home_player_id) || idsEqual(actor.playerId, match.away_player_id)) return true;
  if (idsEqual(actor.clubId, match.home_club_id) || idsEqual(actor.clubId, match.away_club_id)) return true;
  if (emailsEqual(actor.email, match.home_player_email) || emailsEqual(actor.email, match.away_player_email)) return true;
  if (emailsEqual(actor.email, match.home_owner_email) || emailsEqual(actor.email, match.away_owner_email)) return true;
  return false;
}

function actorIsHome(match = {}, actor = {}) {
  return idsEqual(actor.playerId, match.home_player_id)
    || idsEqual(actor.clubId, match.home_club_id)
    || emailsEqual(actor.email, match.home_player_email)
    || emailsEqual(actor.email, match.home_owner_email);
}

function resolveMatchOpponent(match = {}, actor = {}) {
  const home = actorIsHome(match, actor);
  if (match.mode === 'club') {
    return home
      ? {
        email: match.away_owner_email || match.away_player_email || null,
        name: match.away_club_name || match.away_player_name || 'Away',
        playerId: match.away_player_id || null,
        clubId: match.away_club_id || null,
      }
      : {
        email: match.home_owner_email || match.home_player_email || null,
        name: match.home_club_name || match.home_player_name || 'Home',
        playerId: match.home_player_id || null,
        clubId: match.home_club_id || null,
      };
  }
  return home
    ? {
      email: match.away_player_email || null,
      name: match.away_player_name || 'Away',
      playerId: match.away_player_id || null,
      clubId: null,
    }
    : {
      email: match.home_player_email || null,
      name: match.home_player_name || 'Home',
      playerId: match.home_player_id || null,
      clubId: null,
    };
}

function actorRequestedCancel(match = {}, actor = {}) {
  const requestedBy = norm(match.cancel_requested_by);
  if (!requestedBy) return false;
  return emailsEqual(requestedBy, actor.email)
    || idsEqual(requestedBy, actor.playerId)
    || idsEqual(requestedBy, actor.clubId);
}

function canRequestMatchCancel(match = {}, actor = {}) {
  if (!isPlayerManagedMatch(match)) return false;
  if (!isCancellableMatchStatus(match.status)) return false;
  if (!actorIsParticipant(match, actor)) return false;
  if (norm(match.cancel_status) === 'pending') return false;
  return true;
}

function canConfirmMatchCancel(match = {}, actor = {}) {
  if (!isPlayerManagedMatch(match)) return false;
  if (!isCancellableMatchStatus(match.status)) return false;
  if (!actorIsParticipant(match, actor)) return false;
  if (norm(match.cancel_status) !== 'pending') return false;
  if (actorRequestedCancel(match, actor)) return false;
  return true;
}

function canRequestMatchReschedule(match = {}, actor = {}) {
  return canRequestMatchCancel(match, actor);
}

function applyConfirmedCancelPatch() {
  return {
    status: 'cancelled',
    cancel_status: null,
    cancel_requested_by: null,
  };
}

function applyCancelRequestPatch(actor = {}) {
  return {
    cancel_status: 'pending',
    cancel_requested_by: actor.email || actor.playerId || null,
  };
}

function applyDeclinedCancelPatch() {
  return {
    cancel_status: null,
    cancel_requested_by: null,
  };
}

function buildCancelRequestMessage({ match, actor, opponent }) {
  const home = match.home_player_name || match.home_club_name || 'Home';
  const away = match.away_player_name || match.away_club_name || 'Away';
  const requester = actor.name || actor.email || 'A player';
  return {
    recipientEmail: opponent.email,
    senderEmail: actor.email || null,
    senderGamertag: actor.name || actor.email || 'Player',
    subject: `Cancel request: ${home} vs ${away}`,
    body: `${requester} wants to cancel ${home} vs ${away}. Confirm to delete this fixture, or decline to keep it.`,
    messageType: 'match_invite',
    actionType: 'accept_decline',
    relatedEntityId: match.id,
    relatedEntityType: 'match',
    idempotencyKey: `match_cancel:${match.id}:${norm(actor.email || actor.playerId)}`,
    reuseByRelated: false,
    metadata: {
      cancel_request: true,
      created_match_id: match.id,
      challenger_name: home,
      opponent_name: away,
      invitation_type: match.mode === 'club' ? 'club_vs_club' : 'player_vs_player',
    },
    notification: {
      type: 'match_reminder',
      title: `${requester} wants to cancel the match`,
      body: 'Confirm to delete the fixture, or decline to keep it.',
    },
  };
}

function buildRescheduleRequestMessage({ match, actor, opponent, proposedMysql }) {
  const home = match.home_player_name || match.home_club_name || 'Home';
  const away = match.away_player_name || match.away_club_name || 'Away';
  const requester = actor.name || actor.email || 'A player';
  return {
    recipientEmail: opponent.email,
    senderEmail: actor.email || null,
    senderGamertag: actor.name || actor.email || 'Player',
    subject: `Reschedule: ${home} vs ${away}`,
    body: `${requester} wants to change ${home} vs ${away}.\nProposed: ${proposedMysql || 'Please discuss a new time.'}`,
    messageType: 'match_invite',
    actionType: 'accept_decline_date',
    relatedEntityId: match.id,
    relatedEntityType: 'match',
    idempotencyKey: `match_reschedule:${match.id}:${proposedMysql || 'open'}`,
    reuseByRelated: false,
    metadata: {
      reschedule_request: true,
      created_match_id: match.id,
      scheduled_date: proposedMysql || match.scheduled_date || null,
      challenger_name: home,
      opponent_name: away,
      invitation_type: match.mode === 'club' ? 'club_vs_club' : 'player_vs_player',
    },
    notification: {
      type: 'match_reminder',
      title: `${requester} wants to reschedule`,
      body: proposedMysql ? `New proposed date: ${proposedMysql}` : 'A new date was requested.',
    },
  };
}

module.exports = {
  isPlayerManagedMatch,
  isCancellableMatchStatus,
  actorIsParticipant,
  canRequestMatchCancel,
  canConfirmMatchCancel,
  canRequestMatchReschedule,
  resolveMatchOpponent,
  applyConfirmedCancelPatch,
  applyCancelRequestPatch,
  applyDeclinedCancelPatch,
  buildCancelRequestMessage,
  buildRescheduleRequestMessage,
};

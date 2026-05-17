/**
 * Central socket.io broadcast helpers (REST → Render /emit).
 * Keep channel names aligned with server/src/constants/constants.js
 * and src/lib/SocketContext.jsx CHANNELS.
 */
const { socketEmit } = require('../express/index');
const { SOCKET_CHANNELS, MAKE_SOCKET_CHANNEL } = require('../../constants/constants');
const { normalizeMatchForApi } = require('./datetime');
const { EXECUTESQL } = require('../db/database');

function broadcastMatch(record) {
  if (!record?.id) return;
  const payload = normalizeMatchForApi(record);
  socketEmit(MAKE_SOCKET_CHANNEL(record.id, SOCKET_CHANNELS.MATCH), payload);
  socketEmit(SOCKET_CHANNELS.MATCH, payload);
}

function broadcastMatchDeleted(id) {
  if (!id) return;
  const payload = { deleted: true, id };
  socketEmit(MAKE_SOCKET_CHANNEL(id, SOCKET_CHANNELS.MATCH), payload);
  socketEmit(SOCKET_CHANNELS.MATCH, payload);
}

async function broadcastMatchById(matchId) {
  if (!matchId) return;
  const rows = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [matchId]);
  if (rows[0]) broadcastMatch(rows[0]);
}

function broadcastPost(record) {
  if (!record) return;
  if (record.id) {
    socketEmit(MAKE_SOCKET_CHANNEL(record.id, SOCKET_CHANNELS.POST), record);
  }
  socketEmit(SOCKET_CHANNELS.POST, record);
  if (record.club_id) {
    socketEmit(MAKE_SOCKET_CHANNEL(record.club_id, SOCKET_CHANNELS.POST_FEED), record);
  }
  if (record.author_email) {
    socketEmit(MAKE_SOCKET_CHANNEL(record.author_email, SOCKET_CHANNELS.POST_FEED), record);
  }
}

function broadcastPostDeleted(id, existing = null) {
  const payload = { deleted: true, id };
  if (existing?.club_id) {
    socketEmit(MAKE_SOCKET_CHANNEL(existing.club_id, SOCKET_CHANNELS.POST_FEED), payload);
  }
  if (existing?.author_email) {
    socketEmit(MAKE_SOCKET_CHANNEL(existing.author_email, SOCKET_CHANNELS.POST_FEED), payload);
  }
  socketEmit(MAKE_SOCKET_CHANNEL(id, SOCKET_CHANNELS.POST), payload);
  socketEmit(SOCKET_CHANNELS.POST, payload);
}

function broadcastPlayer(record) {
  if (!record?.id) return;
  socketEmit(MAKE_SOCKET_CHANNEL(record.id, SOCKET_CHANNELS.PLAYER), record);
  if (record.club_id) {
    socketEmit(MAKE_SOCKET_CHANNEL(record.club_id, SOCKET_CHANNELS.CLUB), {
      _entity: 'player',
      ...record,
    });
  }
}

function broadcastPlayerDeleted(id, existing = null) {
  const payload = { deleted: true, id };
  socketEmit(MAKE_SOCKET_CHANNEL(id, SOCKET_CHANNELS.PLAYER), payload);
  if (existing?.club_id) {
    socketEmit(MAKE_SOCKET_CHANNEL(existing.club_id, SOCKET_CHANNELS.CLUB), {
      _entity: 'player',
      ...payload,
    });
  }
}

function broadcastClub(record) {
  if (!record?.id) return;
  socketEmit(MAKE_SOCKET_CHANNEL(record.id, SOCKET_CHANNELS.CLUB), record);
}

function broadcastClubDeleted(id) {
  if (!id) return;
  socketEmit(MAKE_SOCKET_CHANNEL(id, SOCKET_CHANNELS.CLUB), { deleted: true, id });
}

function broadcastNotification(record) {
  if (!record?.recipient_email) return;
  socketEmit(
    MAKE_SOCKET_CHANNEL(record.recipient_email, SOCKET_CHANNELS.NOTIFICATION),
    record
  );
}

function broadcastInbox(record) {
  if (!record?.recipient_email) return;
  socketEmit(MAKE_SOCKET_CHANNEL(record.recipient_email, SOCKET_CHANNELS.INBOX), record);
}

function broadcastInboxDeleted(id, recipientEmail) {
  if (!recipientEmail) return;
  socketEmit(MAKE_SOCKET_CHANNEL(recipientEmail, SOCKET_CHANNELS.INBOX), { deleted: true, id });
}

async function broadcastInboxToPlayerIds(record, playerIds = []) {
  broadcastInbox(record);
  const ids = [...new Set((playerIds || []).filter(Boolean))];
  if (!ids.length) return;
  const placeholders = ids.map(() => '?').join(',');
  const rows = await EXECUTESQL(
    `SELECT id, email FROM players WHERE id IN (${placeholders})`,
    ids
  ).catch(() => []);
  for (const row of rows) {
    if (row.email) {
      socketEmit(MAKE_SOCKET_CHANNEL(row.email, SOCKET_CHANNELS.INBOX), record);
    }
    socketEmit(MAKE_SOCKET_CHANNEL(row.id, SOCKET_CHANNELS.INBOX), record);
  }
}

function broadcastChatMessage(record) {
  if (!record?.match_id) return;
  socketEmit(MAKE_SOCKET_CHANNEL(record.match_id, SOCKET_CHANNELS.CHAT_MESSAGE), record);
}

function broadcastChatMessageDeleted(id, matchId) {
  if (!matchId) return;
  socketEmit(MAKE_SOCKET_CHANNEL(matchId, SOCKET_CHANNELS.CHAT_MESSAGE), { deleted: true, id });
}

function broadcastDressingRoom(record) {
  if (!record?.match_id) return;
  socketEmit(MAKE_SOCKET_CHANNEL(record.match_id, SOCKET_CHANNELS.DRESSING_ROOM), record);
}

function broadcastDressingRoomDeleted(id, matchId) {
  if (!matchId) return;
  socketEmit(MAKE_SOCKET_CHANNEL(matchId, SOCKET_CHANNELS.DRESSING_ROOM), { deleted: true, id });
}

function broadcastTournament(record) {
  if (!record?.id) return;
  socketEmit(MAKE_SOCKET_CHANNEL(record.id, SOCKET_CHANNELS.TOURNAMENT), record);
  socketEmit(SOCKET_CHANNELS.TOURNAMENT, record);
}

function broadcastTournamentDeleted(id) {
  if (!id) return;
  const payload = { deleted: true, id };
  socketEmit(MAKE_SOCKET_CHANNEL(id, SOCKET_CHANNELS.TOURNAMENT), payload);
  socketEmit(SOCKET_CHANNELS.TOURNAMENT, payload);
}

function broadcastMatchPlayerStat(record) {
  if (!record?.match_id) return;
  const payload = { _entity: 'MatchPlayerStat', ...record };
  socketEmit(MAKE_SOCKET_CHANNEL(record.match_id, SOCKET_CHANNELS.MATCH), payload);
  if (record.tournament_id) {
    socketEmit(MAKE_SOCKET_CHANNEL(record.tournament_id, SOCKET_CHANNELS.TOURNAMENT), payload);
  }
}

module.exports = {
  broadcastMatch,
  broadcastMatchDeleted,
  broadcastMatchById,
  broadcastPost,
  broadcastPostDeleted,
  broadcastPlayer,
  broadcastPlayerDeleted,
  broadcastClub,
  broadcastClubDeleted,
  broadcastNotification,
  broadcastInbox,
  broadcastInboxDeleted,
  broadcastInboxToPlayerIds,
  broadcastChatMessage,
  broadcastChatMessageDeleted,
  broadcastDressingRoom,
  broadcastDressingRoomDeleted,
  broadcastTournament,
  broadcastTournamentDeleted,
  broadcastMatchPlayerStat,
};

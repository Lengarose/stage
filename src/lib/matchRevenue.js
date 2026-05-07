import { stageClient } from '@/api/stageClient';
import { calcAttendance } from './fanAttendance';

const fmt = (n) => Number(n || 0).toLocaleString();

async function createTransaction(clubId, amount, type, description, referenceId) {
  try {
    await stageClient.entities.STCTransaction.create({
      club_id:      clubId,
      amount,
      type,
      description,
      reference_id: referenceId,
    });
  } catch (e) {
    console.warn('[matchRevenue] STCTransaction.create failed:', e);
  }
}

async function sendOwnerMessage(ownerEmail, subject, body, matchId) {
  try {
    await stageClient.entities.InboxMessage.create({
      recipient_email:     ownerEmail,
      sender_email:        'system@stage.com',
      subject,
      body,
      message_type:        'match_revenue',
      related_entity_id:   matchId,
      related_entity_type: 'match_revenue',
      status:              'pending',
      is_read:             false,
    });
  } catch (e) {
    console.warn('[matchRevenue] InboxMessage.create failed:', e);
  }
}

/**
 * processSoloMatchRevenue — settle wager for player-vs-player (non-club) matches.
 * Delegates entirely to the server-side processSoloWager handler which is authoritative
 * and guards against double-settlement via an atomic status claim.
 */
export async function processSoloMatchRevenue(gameSnapshot) {
  if (gameSnapshot.mode === 'club') return;
  if (!gameSnapshot.wager_stc || gameSnapshot.wager_status !== 'active') return;
  try {
    await stageClient.functions.invoke('processSoloWager', { match_id: gameSnapshot.id });
  } catch (err) {
    console.warn('[matchRevenue] solo wager settlement failed:', err);
  }
}

/**
 * processMatchRevenue — called once when a club match status → "completed".
 *
 * Handles:
 *  1. Fan attendance ticket revenue for the HOME club.
 *  2. Inbox notifications to both club owners (wager result is read from settled match state).
 *
 * Wager settlement is NOT done here — processMatchCompletion on the server handles it
 * atomically and reliably before this function is ever called.
 *
 * Guards against double-processing via an existing InboxMessage check.
 */
export async function processMatchRevenue(gameSnapshot) {
  if (gameSnapshot.mode !== 'club' || !gameSnapshot.home_club_id) return;

  // Guard: skip if already processed
  try {
    const existing = await stageClient.entities.InboxMessage.filter({
      related_entity_id:   gameSnapshot.id,
      related_entity_type: 'match_revenue',
    });
    if (existing.length > 0) return;
  } catch {
    // If filter fails, proceed
  }

  try {
    // Fetch fresh match data (has final scores + server-settled wager state)
    const matches = await stageClient.entities.Match.filter({ id: gameSnapshot.id }, null, 1);
    const game = matches[0];
    if (!game) return;

    const matchLabel = `${game.home_club_name} vs ${game.away_club_name}`;
    const scoreLabel = (game.home_score != null && game.away_score != null)
      ? `${game.home_score} – ${game.away_score}`
      : 'Confirmed';
    const isTournament = game.tournament_id && game.tournament_id !== 'ranked';
    const typeLabel = isTournament ? '🏆 Tournament' : '⚡ Ranked';

    // Fetch both clubs for attendance calc
    const [homeArr, awayArr] = await Promise.all([
      stageClient.entities.Club.filter({ id: game.home_club_id }, null, 1),
      game.away_club_id
        ? stageClient.entities.Club.filter({ id: game.away_club_id }, null, 1)
        : Promise.resolve([]),
    ]);
    const homeClub = homeArr[0];
    const awayClub = awayArr[0] || null;
    if (!homeClub) return;

    // ── 1. TICKET REVENUE (home club only) ────────────────────
    const att = calcAttendance(homeClub);
    const newHomeStcAfterTickets = (homeClub.stc || 0) + att.revenue;
    await stageClient.entities.Club.update(homeClub.id, { stc: newHomeStcAfterTickets });
    await createTransaction(
      homeClub.id,
      att.revenue,
      'ticket_revenue',
      `Gate receipts: ${fmt(att.count)} fans @ ${fmt(att.ticketPrice)} STC — ${matchLabel}`,
      game.id,
    );

    // ── 2. READ WAGER OUTCOME from already-settled match state ──
    const hasWager = Number(game.wager_stc || 0) > 0 && !isTournament;
    const wagerEach = Number(game.wager_stc || 0);
    const pot = wagerEach * 2;
    const homeScore = game.home_score ?? 0;
    const awayScore = game.away_score ?? 0;
    const homeWins  = homeScore > awayScore;

    let wagerSummary = null;
    if (hasWager && game.wager_status === 'settled') {
      wagerSummary = { type: 'settled', pot, homeWins, winner: homeWins ? game.home_club_name : game.away_club_name, loser: homeWins ? game.away_club_name : game.home_club_name };
    } else if (hasWager && game.wager_status === 'refunded') {
      wagerSummary = { type: 'draw', each: wagerEach };
    }

    // ── 3. INBOX — home club owner ────────────────────────────
    if (homeClub.owner_email) {
      const wagerBlock = wagerSummary
        ? wagerSummary.type === 'draw'
          ? [``, `🤝 Wager: Draw — ${fmt(wagerSummary.each)} STC refunded to both clubs`]
          : wagerSummary.homeWins
          ? [``, `🏆 Wager WON — Full pot: +${fmt(wagerSummary.pot)} STC added to balance`]
          : [``, `❌ Wager LOST — ${fmt(wagerEach)} STC forfeited to ${wagerSummary.winner}`]
        : [];

      const lines = [
        `📅 Match: ${matchLabel}`,
        `📊 Result: ${scoreLabel}  |  ${typeLabel}`,
        ``,
        `🏟️  Stadium: ${att.levelName} (capacity ${fmt(att.capacity)})`,
        `👥 Attendance: ${fmt(att.count)} fans (${att.pct}% full)`,
        `🎟️  Tickets: ${fmt(att.count)} × ${fmt(att.ticketPrice)} STC = +${fmt(att.revenue)} STC`,
        ...wagerBlock,
        ``,
        att.pct < 40
          ? `💡 Win more games to fill your stadium and boost gate receipts.`
          : att.pct >= 80
          ? `🔥 Near-capacity crowd — your club is on fire!`
          : `📈 Attendance growing. Keep the wins coming!`,
      ];

      await sendOwnerMessage(
        homeClub.owner_email,
        `🎟️ Match Revenue — ${matchLabel}`,
        lines.join('\n'),
        game.id,
      );
    }

    // ── 4. INBOX — away club owner (wager only) ───────────────
    if (awayClub?.owner_email && wagerSummary) {
      const awayWagerLines = wagerSummary.type === 'draw'
        ? [
            `📅 Match: ${matchLabel}`,
            `📊 Result: ${scoreLabel} (Draw)`,
            ``,
            `🤝 Wager: Draw — ${fmt(wagerSummary.each)} STC refunded to your club.`,
          ]
        : wagerSummary.homeWins
        ? [
            `📅 Match: ${matchLabel}`,
            `📊 Result: ${scoreLabel}`,
            ``,
            `❌ Wager LOST — ${fmt(wagerEach)} STC forfeited.`,
          ]
        : [
            `📅 Match: ${matchLabel}`,
            `📊 Result: ${scoreLabel}`,
            ``,
            `🏆 Wager WON — Full pot: +${fmt(wagerSummary.pot)} STC added to your balance!`,
          ];

      const awaySubject = wagerSummary.type === 'draw'
        ? `🤝 Wager Refunded — ${matchLabel}`
        : !wagerSummary.homeWins
        ? `🏆 Wager Won — ${matchLabel}`
        : `❌ Wager Lost — ${matchLabel}`;

      await sendOwnerMessage(awayClub.owner_email, awaySubject, awayWagerLines.join('\n'), game.id);
    }

  } catch (err) {
    console.error('[matchRevenue] processing failed:', err);
  }
}

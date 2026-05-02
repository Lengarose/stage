import { base44 } from '@/api/base44Client';
import { calcAttendance } from './fanAttendance';

const fmt = (n) => Number(n || 0).toLocaleString();

/* ── helpers ─────────────────────────────────────────────── */

async function createTransaction(clubId, amount, type, description, referenceId) {
  try {
    await base44.entities.STCTransaction.create({
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
    await base44.functions.invoke('sendInboxMessage', {
      recipient_email:     ownerEmail,
      sender_email:        'system@stage.com',
      subject,
      body,
      message_type:        'match_revenue',
      related_entity_id:   matchId,
      related_entity_type: 'match_revenue',
    });
  } catch (e) {
    console.warn('[matchRevenue] sendInboxMessage failed:', e);
  }
}

/* ── main export ─────────────────────────────────────────── */

/**
 * processMatchRevenue — called once when a club match status → "completed".
 *
 * Handles:
 *  1. Fan attendance ticket revenue for the HOME club.
 *  2. Wager settlement (winner takes pot / draw = refund) for BOTH clubs.
 *  3. STCTransaction records for every money movement.
 *  4. Inbox messages to both club owners with full breakdowns.
 *
 * Guards against double-processing via an existing InboxMessage check.
 */
export async function processMatchRevenue(gameSnapshot) {
  // Only club matches generate match revenue
  if (gameSnapshot.mode !== 'club' || !gameSnapshot.home_club_id) return;

  // ── Guard: skip if already processed ─────────────────────
  try {
    const existing = await base44.entities.InboxMessage.filter({
      related_entity_id:   gameSnapshot.id,
      related_entity_type: 'match_revenue',
    });
    if (existing.length > 0) return;
  } catch {
    // If filter fails, proceed (better to risk a duplicate than miss processing)
  }

  try {
    // ── Fetch fresh match data (has final scores + wager state) ──
    const matches = await base44.entities.Match.filter({ id: gameSnapshot.id }, null, 1);
    const game = matches[0];
    if (!game) return;

    const matchLabel = `${game.home_club_name} vs ${game.away_club_name}`;
    const scoreLabel = (game.home_score != null && game.away_score != null)
      ? `${game.home_score} – ${game.away_score}`
      : 'Confirmed';
    const isTournament = game.tournament_id && game.tournament_id !== 'ranked';
    const typeLabel = isTournament ? '🏆 Tournament' : '⚡ Ranked';

    // ── Fetch both clubs ───────────────────────────────────────
    const [homeArr, awayArr] = await Promise.all([
      base44.entities.Club.filter({ id: game.home_club_id }, null, 1),
      game.away_club_id
        ? base44.entities.Club.filter({ id: game.away_club_id }, null, 1)
        : Promise.resolve([]),
    ]);
    const homeClub = homeArr[0];
    const awayClub = awayArr[0] || null;
    if (!homeClub) return;

    // ── 1. TICKET REVENUE (home club only) ────────────────────
    const att = calcAttendance(homeClub);
    const newHomeStcAfterTickets = (homeClub.stc || 0) + att.revenue;
    await base44.entities.Club.update(homeClub.id, { stc: newHomeStcAfterTickets });
    await createTransaction(
      homeClub.id,
      att.revenue,
      'ticket_revenue',
      `Gate receipts: ${fmt(att.count)} fans @ ${fmt(att.ticketPrice)} STC — ${matchLabel}`,
      game.id,
    );

    // ── 2. WAGER SETTLEMENT ───────────────────────────────────
    const hasWager = (game.wager_stc || 0) > 0
      && game.wager_status === 'active'
      && game.wager_home_locked
      && game.wager_away_locked
      && !isTournament; // wagers only on non-tournament club games

    let wagerSummary = null;

    if (hasWager && awayClub) {
      const wagerEach = game.wager_stc;
      const pot       = wagerEach * 2;
      const homeScore = game.home_score ?? 0;
      const awayScore = game.away_score ?? 0;
      const isDraw    = homeScore === awayScore;
      const homeWins  = homeScore > awayScore;

      if (isDraw) {
        // Refund both clubs
        await Promise.all([
          base44.entities.Club.update(homeClub.id, { stc: newHomeStcAfterTickets + wagerEach }),
          base44.entities.Club.update(awayClub.id,  { stc: (awayClub.stc || 0) + wagerEach }),
        ]);
        await Promise.all([
          createTransaction(homeClub.id,  wagerEach, 'wager_refund', `Wager refunded (draw) — ${matchLabel}`, game.id),
          createTransaction(awayClub.id,  wagerEach, 'wager_refund', `Wager refunded (draw) — ${matchLabel}`, game.id),
        ]);
        await base44.entities.Match.update(game.id, { wager_status: 'refunded' });
        wagerSummary = { type: 'draw', each: wagerEach };

      } else {
        const winnerClub = homeWins ? homeClub : awayClub;
        const loserClub  = homeWins ? awayClub  : homeClub;

        // Winner gets full pot; loser already had funds deducted on wager lock
        const winnerNewStc = (winnerClub.id === homeClub.id)
          ? newHomeStcAfterTickets + pot
          : (winnerClub.stc || 0) + pot;
        await base44.entities.Club.update(winnerClub.id, { stc: winnerNewStc });

        await Promise.all([
          createTransaction(winnerClub.id, pot,         'wager_win',  `Wager won — ${matchLabel} (${scoreLabel})`,  game.id),
          createTransaction(loserClub.id,  -wagerEach,  'wager_loss', `Wager lost — ${matchLabel} (${scoreLabel})`, game.id),
        ]);
        await base44.entities.Match.update(game.id, { wager_status: 'settled' });
        wagerSummary = { type: 'settled', pot, winner: winnerClub.name, loser: loserClub.name, homeWins };
      }
    }

    // ── 3. INBOX — home club owner ────────────────────────────
    if (homeClub.owner_email) {
      const finalHomeStc = wagerSummary?.type === 'settled' && wagerSummary.homeWins
        ? (homeClub.stc || 0) + att.revenue + wagerSummary.pot
        : wagerSummary?.type === 'draw'
        ? (homeClub.stc || 0) + att.revenue + wagerSummary.each
        : newHomeStcAfterTickets;

      const wagerBlock = wagerSummary
        ? wagerSummary.type === 'draw'
          ? [``, `🤝 Wager: Draw — ${fmt(wagerSummary.each)} STC refunded to both clubs`]
          : wagerSummary.homeWins
          ? [``, `🏆 Wager WON — Full pot: +${fmt(wagerSummary.pot)} STC added to balance`]
          : [``, `❌ Wager LOST — ${fmt(game.wager_stc)} STC forfeited to ${wagerSummary.winner}`]
        : [];

      const totalGain = att.revenue
        + (wagerSummary?.type === 'settled' && wagerSummary.homeWins ? wagerSummary.pot : 0)
        + (wagerSummary?.type === 'draw' ? wagerSummary.each : 0);

      const lines = [
        `📅 Match: ${matchLabel}`,
        `📊 Result: ${scoreLabel}  |  ${typeLabel}`,
        ``,
        `🏟️  Stadium: ${att.levelName} (capacity ${fmt(att.capacity)})`,
        `👥 Attendance: ${fmt(att.count)} fans (${att.pct}% full)`,
        `🎟️  Tickets: ${fmt(att.count)} × ${fmt(att.ticketPrice)} STC = +${fmt(att.revenue)} STC`,
        ...wagerBlock,
        ``,
        `💰 Total added:  +${fmt(totalGain)} STC`,
        `📈 Club balance: ${fmt(finalHomeStc)} STC`,
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
            `📈 Club balance: ${fmt((awayClub.stc || 0) + wagerSummary.each)} STC`,
          ]
        : wagerSummary.homeWins
        ? [
            `📅 Match: ${matchLabel}`,
            `📊 Result: ${scoreLabel}`,
            ``,
            `❌ Wager LOST — ${fmt(game.wager_stc)} STC forfeited.`,
            `📈 Club balance: ${fmt(awayClub.stc || 0)} STC`,
          ]
        : [
            `📅 Match: ${matchLabel}`,
            `📊 Result: ${scoreLabel}`,
            ``,
            `🏆 Wager WON — Full pot: +${fmt(wagerSummary.pot)} STC added to your balance!`,
            `📈 Club balance: ${fmt((awayClub.stc || 0) + wagerSummary.pot)} STC`,
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

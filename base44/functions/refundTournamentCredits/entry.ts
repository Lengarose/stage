import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Triggered by: tournament DELETE (old_data) or status → "cancelled" UPDATE (data)
    const tournament = body.old_data || body.data;

    if (!tournament) {
      return Response.json({ error: 'No tournament data provided' }, { status: 400 });
    }

    // For update events, only proceed if status is cancelled
    if (body.event?.type === 'update' && tournament.status !== 'cancelled') {
      return Response.json({ skipped: true, reason: 'Not a cancellation' });
    }

    const registeredClubs = tournament.registered_clubs || [];
    const registeredPlayers = tournament.registered_players || [];
    const entryCredits = tournament.entry_credits || 0;
    const isPlayerTournament = tournament.participant_type === 'player';

    if (entryCredits === 0) {
      return Response.json({ message: 'Nothing to refund', refunded: 0 });
    }

    let results = [];

    if (isPlayerTournament) {
      // Refund each registered player
      results = await Promise.all(
        registeredPlayers.map(async (playerId) => {
          const players = await base44.asServiceRole.entities.Player.filter({ id: playerId });
          if (players.length === 0) return { playerId, status: 'not_found' };
          const player = players[0];
          const newCredits = (player.credits || 0) + entryCredits;
          await base44.asServiceRole.entities.Player.update(playerId, { credits: newCredits });
          if (player.email) {
            await base44.asServiceRole.entities.Notification.create({
              recipient_email: player.email,
              type: 'tournament_complete',
              title: '💸 Tournament Cancelled — Credits Refunded',
              body: `${tournament.name} was cancelled. ${entryCredits} credits have been refunded to you.`,
              link: '/tournaments',
              read: false,
            });
          }
          return { playerId, refunded: entryCredits, newCredits };
        })
      );
    } else {
      // Refund each registered club
      if (registeredClubs.length === 0) return Response.json({ message: 'Nothing to refund', refunded: 0 });
      results = await Promise.all(
        registeredClubs.map(async (clubId) => {
          const clubs = await base44.asServiceRole.entities.Club.filter({ id: clubId });
          if (clubs.length === 0) return { clubId, status: 'not_found' };
          const club = clubs[0];
          const newCredits = (club.credits || 0) + entryCredits;
          await base44.asServiceRole.entities.Club.update(clubId, { credits: newCredits });
          if (club.owner_email) {
            await base44.asServiceRole.entities.Notification.create({
              recipient_email: club.owner_email,
              type: 'tournament_complete',
              title: '💸 Tournament Cancelled — Credits Refunded',
              body: `${tournament.name} was cancelled. ${entryCredits} credits have been refunded to ${club.name}.`,
              link: '/tournaments',
              read: false,
            });
          }
          return { clubId, refunded: entryCredits, newCredits };
        })
      );
    }

    return Response.json({
      message: `Refunded ${entryCredits} credits to ${results.length} participant(s)`,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
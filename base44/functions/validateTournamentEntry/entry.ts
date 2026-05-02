/**
 * validateTournamentEntry — Check if a user/club can enter a tournament
 * 
 * Validates:
 * - Player/club has enough credits for entry_credits
 * - Player/club has enough STC for entry_fee_stc
 * 
 * POST body: { tournament_id, participant_id, participant_type }
 * participant_type: "club" | "player"
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { tournament_id, participant_id, participant_type } = body;

    if (!tournament_id || !participant_id || !participant_type) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch tournament
    const tournaments = await base44.asServiceRole.entities.Tournament.filter({ id: tournament_id });
    const tournament = tournaments[0];

    if (!tournament) {
      return Response.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Fetch participant
    let participant = null;
    if (participant_type === 'club') {
      const clubs = await base44.asServiceRole.entities.Club.filter({ id: participant_id });
      participant = clubs[0];
    } else if (participant_type === 'player') {
      const players = await base44.asServiceRole.entities.Player.filter({ id: participant_id });
      participant = players[0];
    }

    if (!participant) {
      return Response.json({ error: 'Participant not found' }, { status: 404 });
    }

    // Check requirements
    const requiredCredits = tournament.entry_credits || 50;
    const requiredSTC = tournament.entry_fee_stc || 0;
    const currentCredits = participant.credits || 0;
    const currentSTC = participant.stc || 0;

    const hasCredits = currentCredits >= requiredCredits;
    const hasSTC = currentSTC >= requiredSTC;
    const canEnter = hasCredits && hasSTC;

    const response = {
      canEnter,
      requirements: {
        credits: { required: requiredCredits, current: currentCredits, met: hasCredits },
        stc: { required: requiredSTC, current: currentSTC, met: hasSTC },
      },
    };

    if (!canEnter) {
      const missing = [];
      if (!hasCredits) missing.push(`${requiredCredits - currentCredits} more credits`);
      if (!hasSTC) missing.push(`${requiredSTC - currentSTC} more STC`);
      response.message = `Missing: ${missing.join(' and ')}`;
    }

    return Response.json(response);
  } catch (error) {
    console.error('Validation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
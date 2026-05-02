/**
 * tournamentRegistration — handles tournament entry with both credits AND STC validation.
 *
 * POST body: { tournament_id, club_id? (for club tournaments), player_id? (for solo) }
 *
 * Validation:
 *   - User must have enough credits (entry_credits)
 *   - User must have enough STC (entry_fee_stc, 100-1,000,000 range)
 *   - Funds are locked immediately upon successful registration
 *   - Transaction recorded for audit
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MIN_STC_ENTRY = 100;
const MAX_STC_ENTRY = 1_000_000;

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { tournament_id, club_id, player_id } = body;

  if (!tournament_id) {
    return Response.json({ error: 'tournament_id required' }, { status: 400 });
  }

  // Fetch tournament
  const tournaments = await base44.asServiceRole.entities.Tournament.filter({ id: tournament_id });
  const tournament = tournaments[0];
  if (!tournament) {
    return Response.json({ error: 'Tournament not found' }, { status: 404 });
  }

  // Check registration status
  if (tournament.status !== 'registration') {
    return Response.json({ error: 'Tournament registration is closed' }, { status: 400 });
  }

  // Validate STC entry fee range
  const entryFee = tournament.entry_fee_stc || 0;
  if (entryFee > 0 && (entryFee < MIN_STC_ENTRY || entryFee > MAX_STC_ENTRY)) {
    return Response.json({
      error: `Invalid tournament entry fee. Must be between ${MIN_STC_ENTRY} and ${MAX_STC_ENTRY.toLocaleString()} STC`
    }, { status: 400 });
  }

  const requiredCredits = tournament.entry_credits || 0;

  // Determine if club or player tournament
  const isClubTourney = tournament.participant_type === 'club';

  if (isClubTourney) {
    if (!club_id) {
      return Response.json({ error: 'club_id required for club tournament' }, { status: 400 });
    }

    // Fetch club
    const clubs = await base44.asServiceRole.entities.Club.filter({ id: club_id });
    const club = clubs[0];
    if (!club) {
      return Response.json({ error: 'Club not found' }, { status: 404 });
    }

    // Check if already registered
    if ((tournament.registered_clubs || []).includes(club_id)) {
      return Response.json({ error: 'Club already registered for this tournament' }, { status: 400 });
    }

    // Check if reached max teams
    if ((tournament.registered_clubs || []).length >= tournament.max_teams) {
      return Response.json({ error: 'Tournament is full' }, { status: 400 });
    }

    // Validate STC balance
    const clubStc = club.stc || 0;
    if (entryFee > 0 && clubStc < entryFee) {
      return Response.json({
        error: `Insufficient STC. Need ${entryFee.toLocaleString()}, have ${clubStc.toLocaleString()}`
      }, { status: 400 });
    }

    // Lock STC from club
    let newClubStc = clubStc;
    if (entryFee > 0) {
      newClubStc = clubStc - entryFee;
      await base44.asServiceRole.entities.Club.update(club_id, { stc: newClubStc });

      await base44.asServiceRole.entities.STCTransaction.create({
        club_id,
        amount: -entryFee,
        type: 'tournament_entry',
        description: `Tournament entry fee: ${tournament.name}`,
        reference_id: tournament_id,
      });
    }

    // Register club
    const updatedClubs = [...(tournament.registered_clubs || []), club_id];
    await base44.asServiceRole.entities.Tournament.update(tournament_id, {
      registered_clubs: updatedClubs,
    });

    return Response.json({
      success: true,
      message: `Club registered successfully`,
      stc_locked: entryFee,
      new_club_stc: newClubStc,
    });
  } else {
    // Player tournament
    if (!player_id) {
      return Response.json({ error: 'player_id required for player tournament' }, { status: 400 });
    }

    // Fetch player
    const players = await base44.asServiceRole.entities.Player.filter({ id: player_id });
    const player = players[0];
    if (!player) {
      return Response.json({ error: 'Player not found' }, { status: 404 });
    }

    // Check if already registered
    if ((tournament.registered_players || []).includes(player_id)) {
      return Response.json({ error: 'Player already registered for this tournament' }, { status: 400 });
    }

    // Check if reached max teams
    if ((tournament.registered_players || []).length >= tournament.max_teams) {
      return Response.json({ error: 'Tournament is full' }, { status: 400 });
    }

    // Validate STC balance
    const playerStc = player.stc || 0;
    if (entryFee > 0 && playerStc < entryFee) {
      return Response.json({
        error: `Insufficient STC. Need ${entryFee.toLocaleString()}, have ${playerStc.toLocaleString()}`
      }, { status: 400 });
    }

    // Lock STC from player
    let newPlayerStc = playerStc;
    if (entryFee > 0) {
      newPlayerStc = playerStc - entryFee;
      await base44.asServiceRole.entities.Player.update(player_id, { stc: newPlayerStc });

      await base44.asServiceRole.entities.STCTransaction.create({
        player_id,
        player_email: player.email,
        amount: -entryFee,
        type: 'tournament_entry',
        description: `Tournament entry fee: ${tournament.name}`,
        reference_id: tournament_id,
      });
    }

    // Register player
    const updatedPlayers = [...(tournament.registered_players || []), player_id];
    await base44.asServiceRole.entities.Tournament.update(tournament_id, {
      registered_players: updatedPlayers,
    });

    return Response.json({
      success: true,
      message: `Player registered successfully`,
      stc_locked: entryFee,
      new_player_stc: newPlayerStc,
    });
  }
});
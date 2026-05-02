import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { tournamentId } = await req.json();

    // Fetch tournament
    const tournaments = await base44.asServiceRole.entities.Tournament.filter({ id: tournamentId }, null, 1);
    const tournament = tournaments[0];
    if (!tournament) {
      return Response.json({ error: 'Tournament not found' }, { status: 404 });
    }

    if (tournament.type !== 'group_stage') {
      return Response.json({ error: 'This tournament is not a group stage tournament' }, { status: 400 });
    }

    // Fetch all matches and clubs
    const matches = await base44.asServiceRole.entities.Match.filter({ tournament_id: tournamentId });
    const clubs = await base44.asServiceRole.entities.Club.list();

    // Calculate number of groups
    const numGroups = tournament.num_groups || Math.max(1, Math.ceil((tournament.registered_clubs?.length || 0) / 4));

    // Initialize group standings
    const groupStandings = Array.from({ length: numGroups }, () => []);

    // Build club-to-group mapping
    const clubToGroup = {};
    matches.forEach(m => {
      if (m.group !== undefined) {
        if (!clubToGroup[m.home_club_id]) clubToGroup[m.home_club_id] = m.group;
        if (!clubToGroup[m.away_club_id]) clubToGroup[m.away_club_id] = m.group;
      }
    });

    // Assign clubs to groups
    const registeredClubs = clubs.filter(c => tournament.registered_clubs?.includes(c.id));
    registeredClubs.forEach((club, i) => {
      const groupIdx = clubToGroup[club.id] !== undefined ? clubToGroup[club.id] : i % numGroups;
      groupStandings[groupIdx].push({
        id: club.id,
        name: club.name,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: 0,
      });
    });

    // Process completed matches in the current round
    const completedMatches = matches.filter(m => m.status === 'completed' && m.round === tournament.current_round);

    completedMatches.forEach(match => {
      const groupIdx = match.group !== undefined ? match.group : 0;
      if (groupIdx >= groupStandings.length) return;

      const homeClub = groupStandings[groupIdx].find(c => c.id === match.home_club_id);
      const awayClub = groupStandings[groupIdx].find(c => c.id === match.away_club_id);

      if (!homeClub || !awayClub) return;

      homeClub.played += 1;
      awayClub.played += 1;
      homeClub.goalsFor += match.home_score || 0;
      homeClub.goalsAgainst += match.away_score || 0;
      awayClub.goalsFor += match.away_score || 0;
      awayClub.goalsAgainst += match.home_score || 0;

      if (match.home_score > match.away_score) {
        homeClub.wins += 1;
        homeClub.points += 3;
        awayClub.losses += 1;
      } else if (match.away_score > match.home_score) {
        awayClub.wins += 1;
        awayClub.points += 3;
        homeClub.losses += 1;
      } else {
        homeClub.draws += 1;
        awayClub.draws += 1;
        homeClub.points += 1;
        awayClub.points += 1;
      }

      homeClub.goalDiff = homeClub.goalsFor - homeClub.goalsAgainst;
      awayClub.goalDiff = awayClub.goalsFor - awayClub.goalsAgainst;
    });

    // Sort each group by points, then goal diff, then goals for
    groupStandings.forEach(group => {
      group.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
        return b.goalsFor - a.goalsFor;
      });
    });

    return Response.json({
      tournamentId,
      tournamentName: tournament.name,
      currentRound: tournament.current_round,
      numGroups,
      groups: groupStandings.map((group, idx) => ({
        groupIndex: idx,
        groupName: String.fromCharCode(65 + idx), // A, B, C, etc.
        standings: group,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
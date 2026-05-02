import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { tournamentId, groupAssignments } = await req.json();

    // groupAssignments: { "groupA": ["club_id1", "club_id2"], "groupB": [...] }
    const matches = await base44.asServiceRole.entities.Match.filter({ tournament_id: tournamentId });

    let updated = 0;
    for (const match of matches) {
      let groupIdx = null;
      
      // Determine which group this match belongs to
      for (const [groupLabel, clubIds] of Object.entries(groupAssignments)) {
        if (clubIds.includes(match.home_club_id) && clubIds.includes(match.away_club_id)) {
          groupIdx = parseInt(groupLabel.charAt(groupLabel.length - 1)) - 1; // Convert "groupA" to 0, "groupB" to 1
          break;
        }
      }

      if (groupIdx !== null) {
        await base44.asServiceRole.entities.Match.update(match.id, { group: groupIdx });
        updated += 1;
      }
    }

    return Response.json({
      success: true,
      matchesUpdated: updated,
      groupAssignments,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
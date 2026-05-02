import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { matchId } = await req.json();

    // Get match
    const matches = await base44.entities.LiveMatch.filter({ id: matchId }, null, 1);
    const match = matches[0];
    if (!match) return Response.json({ error: 'Match not found' }, { status: 404 });

    // Get all predictions for this match
    const predictions = await base44.entities.Prediction.filter({ live_match_id: matchId }, null, 1000);
    
    // Get events (goals, assists)
    const events = await base44.entities.LiveMatchEvent.filter({ live_match_id: matchId }, null, 500);

    // Find first goal scorer and assist
    const firstGoal = events.find(e => !e.is_own_goal);
    const assistProvider = firstGoal?.assist_email || null;

    for (const prediction of predictions) {
      let scorePoints = 0;
      let scorerPoints = 0;
      let assistMotmPoints = 0;

      // Score prediction: 15 points
      if (prediction.predicted_home_score === match.home_score && prediction.predicted_away_score === match.away_score) {
        scorePoints = 15;
      }

      // Scorer prediction: 35 points
      if (firstGoal && prediction.predicted_scorer_email === firstGoal.scorer_email) {
        scorerPoints = 35;
      }

      // Assist prediction: 50 points (50 is for both assist + motm, so if assist matches = 50)
      if (firstGoal && prediction.predicted_assist_email === assistProvider) {
        assistMotmPoints += 50;
      }

      // MOTM prediction: 50 points (bonus if they also guessed assist)
      // Note: MOTM is set during result confirmation in LiveMatchRoom
      // This would need to be updated when MOTM is finalized

      const totalPoints = scorePoints + scorerPoints + assistMotmPoints;

      await base44.entities.Prediction.update(prediction.id, {
        score_correct: scorePoints > 0,
        scorer_correct: scorerPoints > 0,
        assist_correct: assistMotmPoints > 0,
        score_points: scorePoints,
        scorer_points: scorerPoints,
        assist_motm_points: assistMotmPoints,
        total_points: totalPoints,
        match_status: 'completed',
      });
    }

    return Response.json({ success: true, predictionsUpdated: predictions.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
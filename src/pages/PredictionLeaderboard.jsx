import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Trophy, Target, Zap } from "lucide-react";
import PageHeader from "../components/PageHeader";

export default function PredictionLeaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    const unsub = base44.entities.Prediction.subscribe(() => load());
    return unsub;
  }, []);

  async function load() {
    const predictions = await base44.entities.Prediction.list("-total_points", 500);
    
    // Group by predictor and count correct predictions
    const scoreMap = {};
    predictions.forEach((pred) => {
      if (!scoreMap[pred.predictor_email]) {
        scoreMap[pred.predictor_email] = {
          email: pred.predictor_email,
          name: pred.predictor_name,
          totalPoints: 0,
          correctCount: 0,
          predictionCount: 0,
        };
      }
      scoreMap[pred.predictor_email].totalPoints += pred.total_points || 0;
      if (pred.score_correct) scoreMap[pred.predictor_email].correctCount += 1;
      scoreMap[pred.predictor_email].predictionCount += 1;
    });

    const sorted = Object.values(scoreMap).sort((a, b) => b.totalPoints - a.totalPoints);
    setLeaderboard(sorted);
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="PREDICTION LEADERBOARD"
        subtitle="Top score predictors — Compete for points"
      />

      {/* Legend */}
      <div className="bg-card border border-border rounded-lg p-3 text-center">
        <p className="leading-relaxed font-bold text-primary text-sm">Correct Score = 10 Points</p>
      </div>

      <div className="space-y-2">
        {leaderboard.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No predictions yet. Start predicting match scores!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((predictor, idx) => {
              const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;
              return (
                <div key={predictor.email} className="bg-card border border-border rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{medal}</span>
                      <div>
                        <p className="leading-relaxed font-bold text-foreground">{predictor.name}</p>
                        <p className="text-xs text-muted-foreground">{predictor.predictionCount} predictions</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="leading-relaxed font-black text-3xl text-primary">{predictor.totalPoints}</p>
                      <p className="text-xs text-muted-foreground">total points</p>
                    </div>
                  </div>
                  
                  {/* Stats */}
                   <div className="pt-2 border-t border-border flex items-center gap-4 text-xs">
                     <span className="text-muted-foreground">✓️ {predictor.correctCount}/{predictor.predictionCount} correct</span>
                     <span className="text-muted-foreground">Avg: {(predictor.totalPoints / predictor.predictionCount).toFixed(1)} pts</span>
                   </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
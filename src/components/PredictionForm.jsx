import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Target } from "lucide-react";

export default function PredictionForm({ matchId, homePlayerName, awayPlayerName, userEmail, userName, onSubmit }) {
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (homeScore === "" || awayScore === "") return;
    setLoading(true);
    try {
      const homeScoreInt = parseInt(homeScore);
      const awayScoreInt = parseInt(awayScore);
      let result = "D"; // Draw
      if (homeScoreInt > awayScoreInt) result = "H"; // Home wins
      else if (awayScoreInt > homeScoreInt) result = "A"; // Away wins

      await base44.entities.Prediction.create({
        live_match_id: matchId,
        predictor_email: userEmail,
        predictor_name: userName,
        predicted_home_score: homeScoreInt,
        predicted_away_score: awayScoreInt,
        predicted_result: result,
        match_status: "pending",
        score_correct: false,
        total_points: 0,
      });
      setHomeScore("");
      setAwayScore("");
      if (onSubmit) onSubmit();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-secondary border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Target className="w-4 h-4 text-primary" />
        <p className="text-sm leading-relaxed font-bold text-foreground">Make Your Prediction</p>
      </div>

      {/* Score Prediction */}
      <div className="bg-card border border-border rounded-lg p-3 space-y-2">
        <p className="text-xs text-primary leading-relaxed font-semibold">Final Score</p>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground block mb-1">{homePlayerName}</label>
            <input
              type="number"
              min="0"
              max="20"
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              placeholder="0"
              className="w-full bg-background border border-border rounded-lg px-2 py-2 text-center leading-relaxed font-bold text-lg text-foreground outline-none focus:border-primary/50"
            />
          </div>
          <div className="text-muted-foreground leading-relaxed font-bold text-lg">—</div>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground block mb-1">{awayPlayerName}</label>
            <input
              type="number"
              min="0"
              max="20"
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              placeholder="0"
              className="w-full bg-background border border-border rounded-lg px-2 py-2 text-center leading-relaxed font-bold text-lg text-foreground outline-none focus:border-primary/50"
            />
          </div>
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={homeScore === "" || awayScore === "" || loading}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 leading-relaxed text-sm"
      >
        {loading ? "Submitting..." : "Predict Score"}
      </Button>
    </div>
  );
}
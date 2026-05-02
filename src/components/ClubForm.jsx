// Shows last 5 match results as W/D/L pills
export default function ClubForm({ matches, clubId }) {
  if (!matches || matches.length === 0) return null;

  const completed = [...matches]
    .filter(m => m.status === "completed" && (m.home_club_id === clubId || m.away_club_id === clubId))
    .sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date))
    .slice(0, 5)
    .reverse();

  if (completed.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground mr-1 leading-relaxed uppercase tracking-wider">Form</span>
      {completed.map((m, i) => {
        const isHome = m.home_club_id === clubId;
        const myScore = isHome ? m.home_score : m.away_score;
        const theirScore = isHome ? m.away_score : m.home_score;
        const result = myScore > theirScore ? "W" : myScore < theirScore ? "L" : "D";
        return (
          <span key={i} className={
            result === "W" ? "w-5 h-5 rounded-full bg-success/20 text-success text-[10px] leading-relaxed font-bold flex items-center justify-center" :
            result === "L" ? "w-5 h-5 rounded-full bg-destructive/20 text-destructive text-[10px] leading-relaxed font-bold flex items-center justify-center" :
            "w-5 h-5 rounded-full bg-warning/20 text-warning text-[10px] leading-relaxed font-bold flex items-center justify-center"
          }>{result}</span>
        );
      })}
    </div>
  );
}
function getClubRoles(player) {
  const roles = player?.club_roles;
  if (Array.isArray(roles)) return roles;
  if (typeof roles === "string") {
    try {
      const parsed = JSON.parse(roles);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return roles.split(",").map((role) => role.trim()).filter(Boolean);
    }
  }
  return [];
}

function hasRole(player, role) {
  return getClubRoles(player).includes(role) || player?.role === role;
}

const BADGES = [
  { id: "top_scorer", label: "Top Scorer", emoji: "⚽", desc: "450+ career goals", check: p => (p.goals || 0) >= 450 },
  { id: "playmaker", label: "Playmaker", emoji: "🎯", desc: "300+ career assists", check: p => (p.assists || 0) >= 300 },
  { id: "veteran", label: "Veteran", emoji: "🎖️", desc: "500+ club matches", check: p => (p.matches_played_club || 0) >= 500 },
  { id: "winner", label: "Winner", emoji: "🏆", desc: "300+ wins", check: p => (p.wins_club || 0) >= 300 },
  { id: "clean_sheet", label: "Wall", emoji: "🧱", desc: "50+ clean sheets", check: p => (p.clean_sheets || 0) >= 50 },
  { id: "motm", label: "MOTM Hero", emoji: "🌟", desc: "100+ man of the match", check: p => (p.man_of_the_match || 0) >= 100 },
  { id: "high_rating", label: "Elite", emoji: "💎", desc: "Avg rating 8.5+", check: p => (p.avg_match_rating || 0) >= 8.5 },
  { id: "captain", label: "Captain", emoji: "🅒", desc: "Club captain", check: p => !hasRole(p, "president") && !hasRole(p, "owner") && hasRole(p, "captain") },
];

export default function AchievementBadges({ player }) {
  const earned = BADGES.filter(b => b.check(player));
  const locked = BADGES.filter(b => !b.check(player));

  if (earned.length === 0 && locked.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <h3 className="leading-relaxed text-lg font-bold text-foreground mb-4">Achievements</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {earned.map(b => (
          <div key={b.id} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-primary/5 border border-primary/20 text-center">
            <span className="text-2xl">{b.emoji}</span>
            <span className="text-xs leading-relaxed font-bold text-foreground">{b.label}</span>
            <span className="text-[10px] text-muted-foreground">{b.desc}</span>
          </div>
        ))}
        {locked.map(b => (
          <div key={b.id} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-secondary/50 border border-border/40 text-center opacity-40 grayscale">
            <span className="text-2xl">{b.emoji}</span>
            <span className="text-xs leading-relaxed font-bold text-muted-foreground">{b.label}</span>
            <span className="text-[10px] text-muted-foreground">{b.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

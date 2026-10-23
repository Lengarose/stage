export const isStageResult = (match) => ["completed", "forfeit", "bye"].includes(String(match.status || "").toLowerCase());
const labels = { group: "Group Stage", league: "League Phase", playoff: "Knockout Playoff Round", r16: "Round of 16", qf: "Quarterfinals", sf: "Semifinals", final: "Final", third: "Third-Place Playoff" };
const aliases = { group_stage: "group", ucl_league: "league", ucl_playoff: "playoff", ucl_r16: "r16", round_of_16: "r16", ucl_qf: "qf", quarter_final: "qf", ucl_sf: "sf", semi_final: "sf", third_place: "third", "third-place": "third", bronze: "third" };
const knockoutKey = (size) => size <= 2 ? "final" : size <= 4 ? "sf" : size <= 8 ? "qf" : size <= 16 ? "r16" : `last-${size}`;
const stageLabel = (key) => labels[key] || (key.startsWith("last-") ? `Round of ${key.slice(5)}` : key.replace(/_/g, " "));

export function buildTournamentStages(tournament, matches = []) {
  const type = tournament.type;
  const registered = tournament.participant_type === "player" ? tournament.registered_players : tournament.registered_clubs;
  const count = Math.max(2, (matches.length ? registered?.length : 0) || Number(tournament.max_teams) || 2);
  const stages = [];
  const add = (key, label = stageLabel(key)) => {
    if (!stages.some(s => s.id === key)) stages.push({ id: key, label, matches: [] });
  };
  if (type === "league") add("league");
  else if (type === "swiss") {
    for (let round = 1; round <= Number(tournament.total_rounds || Math.ceil(Math.log2(count))); round++) add(`swiss-${round}`, `Round ${round}`);
  } else {
    if (type === "group_stage") add("group");
    if (type === "swiss_ucl") {
      ["league", "playoff", "r16", "qf", "sf", "final"].forEach(key => add(key));
    } else if (!(type === "group_stage" && Number(tournament.knockout_enabled ?? 1) === 0)) {
      const qualifiers = type === "group_stage" ? Math.min(count, Number(tournament.num_groups || 2) * 2) : count;
      for (let size = 2 ** Math.ceil(Math.log2(qualifiers)); size >= 2; size /= 2) add(knockoutKey(size));
    }
  }
  const genericRounds = [...new Set(matches.filter(m => ["knockout", "double_elimination", ""].includes(String(m.type || ""))).map(m => Number(m.round || 1)))].sort((a, b) => a - b);
  const eliminationStages = stages.filter(s => !["group", "league"].includes(s.id));
  const thirdEligible = ["knockout", "group_stage"].includes(type) && Number(tournament.knockout_enabled ?? 1) !== 0;
  if (thirdEligible && count >= 4 && stages.some(s => s.id === "sf")) add("third");
  for (const match of [...matches].sort((a, b) => Number(a.round || 1) - Number(b.round || 1))) {
    const matchType = String(match.type || "").toLowerCase();
    let key = aliases[matchType] || matchType;
    if (key === "third" && !thirdEligible) continue;
    if (type === "league" && (!matchType || matchType === "league")) key = "league";
    if (matchType === "swiss") key = `swiss-${match.round || 1}`;
    if (["knockout", "double_elimination", ""].includes(matchType) && type !== "league") {
      const index = genericRounds.indexOf(Number(match.round || 1));
      key = eliminationStages[index]?.id || `round-${match.round || 1}`;
    }
    if (!key) key = `round-${match.round || 1}`;
    add(key, key.startsWith("round-") ? `Round ${match.round || 1}` : stageLabel(key));
    stages.find(s => s.id === key).matches.push(match);
  }
  const third = stages.findIndex(s => s.id === "third");
  if (third >= 0) { const [stage] = stages.splice(third, 1); const final = stages.findIndex(s => s.id === "final"); stages.splice(final < 0 ? stages.length : final, 0, stage); }
  return stages;
}

export function stageMatchSections(stage, matches = stage.matches) {
  const rounds = [...new Set(stage.matches.map(m => Number(m.round || 1)))].sort((a, b) => a - b);
  const phase = ["group", "league"].includes(stage.id);
  const explicitLegs = stage.matches.some(m => m.leg != null || m.leg_number != null);
  const sections = new Map();
  for (const match of [...matches].sort((a, b) => Number(a.leg ?? a.leg_number ?? a.round ?? 1) - Number(b.leg ?? b.leg_number ?? b.round ?? 1))) {
    let label = "Matches";
    if (phase) {
      const group = match.group ?? match.group_number;
      label = `${stage.id === "group" && group != null ? `Group ${Number.isFinite(Number(group)) ? String.fromCharCode(65 + Number(group)) : group} · ` : ""}Matchday ${match.round || 1}`;
    } else if (explicitLegs || rounds.length > 1) {
      const leg = Number(match.leg ?? match.leg_number ?? rounds.indexOf(Number(match.round || 1)) + 1);
      label = leg === 1 ? "First leg" : leg === 2 ? "Second leg" : `Decider ${leg}`;
    }
    if (!sections.has(label)) sections.set(label, []);
    sections.get(label).push(match);
  }
  const output = [...sections].map(([label, rows]) => ({ label, matches: rows }));
  return phase ? output.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })) : output;
}

export function stageAggregate(stage, match) {
  if (["group", "league"].includes(stage.id) || stage.id.startsWith("swiss-")) return null;
  const home = match.home_player_id || match.home_club_id;
  const away = match.away_player_id || match.away_club_id;
  if (!home || !away) return null;
  const legs = stage.matches.filter(m => {
    const h = m.home_player_id || m.home_club_id;
    const a = m.away_player_id || m.away_club_id;
    return (h === home && a === away) || (h === away && a === home);
  }).sort((a, b) => Number(a.leg ?? a.leg_number ?? a.round ?? 1) - Number(b.leg ?? b.leg_number ?? b.round ?? 1)).slice(0, 2);
  if (legs.length < 2 || legs.some(m => !isStageResult(m) || m.home_score == null || m.away_score == null)) return null;
  return legs.reduce((total, leg) => {
    const sameHome = (leg.home_player_id || leg.home_club_id) === home;
    total[0] += Number(sameHome ? leg.home_score : leg.away_score);
    total[1] += Number(sameHome ? leg.away_score : leg.home_score);
    return total;
  }, [0, 0]);
}

export function canScheduleTournamentMatch(match, tournament, user, player, clubs = []) {
  if (!user || !["unscheduled", "scheduled", "in_progress", "awaiting_confirmation"].includes(match.status) || match.scheduling_status === "home_proposed") return false;
  const same = (a, b) => Boolean(a && b && String(a) === String(b));
  const kind = tournament.participant_type === "player" ? "player" : "club";
  if (!match[`home_${kind}_id`] || !match[`away_${kind}_id`]) return false;
  if (tournament.participant_type === "player") return same(match.home_player_id, player?.id);
  const club = clubs.find(c => same(c.id, match.home_club_id));
  return Boolean(club && (same(club.president_user_id, user.id) || same(club.user_id, user.id) || (user.email && String(club.owner_email || "").toLowerCase() === String(user.email).toLowerCase())));
}

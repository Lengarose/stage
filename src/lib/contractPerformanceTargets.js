/**
 * Full list of performance target options for contract offers.
 * Grouped by category, filtered by position where relevant.
 *
 * Positions: GK, CB, LB, RB, CDM, CM, CAM, LM, RM, LW, RW, ST, CF
 *
 * `positions: []` means available for all positions.
 * `unit` is displayed as a suffix in the UI (e.g. "%" for percentages).
 */

export const PERFORMANCE_STAT_OPTIONS = [
  // ── Universal ───────────────────────────────────────────────────────────
  { value: "matches_played",    label: "Matches Played",          category: "Universal",   unit: "",   positions: [] },
  { value: "wins_count",        label: "Wins",                    category: "Universal",   unit: "",   positions: [] },
  { value: "man_of_the_match",  label: "MOTM Awards",             category: "Universal",   unit: "",   positions: [] },
  { value: "avg_match_rating",  label: "Avg Match Rating",        category: "Universal",   unit: "",   positions: [] },

  // ── Attacking ───────────────────────────────────────────────────────────
  { value: "goals",                  label: "Goals",                   category: "Attacking",   unit: "",  positions: ["ST", "CF", "LW", "RW", "CAM"] },
  { value: "assists",                label: "Assists",                 category: "Attacking",   unit: "",  positions: ["ST", "CF", "LW", "RW", "CAM", "CM", "LM", "RM"] },
  { value: "shots_on_target",        label: "Shots on Target",         category: "Attacking",   unit: "",  positions: ["ST", "CF", "LW", "RW", "CAM"] },
  { value: "shot_accuracy_pct",      label: "Shot Accuracy %",         category: "Attacking",   unit: "%", positions: ["ST", "CF", "LW", "RW"] },
  { value: "conversion_rate_pct",    label: "Conversion Rate %",       category: "Attacking",   unit: "%", positions: ["ST", "CF"] },
  { value: "big_chances_created",    label: "Big Chances Created",     category: "Attacking",   unit: "",  positions: ["ST", "CF", "LW", "RW", "CAM"] },
  { value: "big_chances_finished",   label: "Big Chances Finished",    category: "Attacking",   unit: "",  positions: ["ST", "CF"] },
  { value: "successful_dribbles",    label: "Successful Dribbles",     category: "Attacking",   unit: "",  positions: ["ST", "CF", "LW", "RW", "CAM", "CM"] },

  // ── Passing ─────────────────────────────────────────────────────────────
  { value: "passes_completed",       label: "Passes Completed",        category: "Passing",     unit: "",  positions: ["CM", "CDM", "CAM", "LM", "RM", "CB", "LB", "RB", "GK"] },
  { value: "pass_accuracy_pct",      label: "Pass Accuracy %",         category: "Passing",     unit: "%", positions: ["CM", "CDM", "CAM", "CB", "LB", "RB", "GK"] },
  { value: "key_passes",             label: "Key Passes",              category: "Passing",     unit: "",  positions: ["CAM", "CM", "LM", "RM", "LW", "RW"] },
  { value: "through_balls",          label: "Through Balls Completed", category: "Passing",     unit: "",  positions: ["CAM", "CM", "ST"] },
  { value: "long_pass_accuracy_pct", label: "Long Pass Accuracy %",    category: "Passing",     unit: "%", positions: ["CB", "CDM", "CM", "GK"] },
  { value: "crossing_accuracy_pct",  label: "Crossing Accuracy %",     category: "Passing",     unit: "%", positions: ["LB", "RB", "LM", "RM", "LW", "RW"] },
  { value: "progressive_passes",     label: "Progressive Passes",      category: "Passing",     unit: "",  positions: ["CM", "CDM", "CAM", "CB"] },
  { value: "chances_created",        label: "Chances Created",         category: "Passing",     unit: "",  positions: ["CAM", "CM", "LM", "RM", "LW", "RW"] },

  // ── Midfield ────────────────────────────────────────────────────────────
  { value: "ball_recoveries",        label: "Ball Recoveries",         category: "Midfield",    unit: "",  positions: ["CM", "CDM", "CAM", "LM", "RM"] },
  { value: "distance_covered_km",    label: "Distance Covered (km)",   category: "Midfield",    unit: "km",positions: ["CM", "CDM", "LM", "RM"] },

  // ── Defensive ───────────────────────────────────────────────────────────
  { value: "clean_sheets",           label: "Clean Sheets",            category: "Defensive",   unit: "",  positions: ["GK", "CB", "LB", "RB", "CDM"] },
  { value: "tackles_attempted",      label: "Tackles Attempted",       category: "Defensive",   unit: "",  positions: ["CB", "LB", "RB", "CDM", "CM"] },
  { value: "tackles_won",            label: "Tackles Won",             category: "Defensive",   unit: "",  positions: ["CB", "LB", "RB", "CDM", "CM"] },
  { value: "tackle_success_pct",     label: "Tackle Success Rate %",   category: "Defensive",   unit: "%", positions: ["CB", "LB", "RB", "CDM"] },
  { value: "interceptions",          label: "Interceptions",           category: "Defensive",   unit: "",  positions: ["CB", "LB", "RB", "CDM", "CM"] },
  { value: "duels_won",              label: "Duels Won",               category: "Defensive",   unit: "",  positions: ["CB", "LB", "RB", "CDM", "ST", "CF"] },
  { value: "aerial_duels_won",       label: "Aerial Duels Won",        category: "Defensive",   unit: "",  positions: ["CB", "CDM", "ST", "CF"] },
  { value: "blocks",                 label: "Blocks",                  category: "Defensive",   unit: "",  positions: ["CB", "LB", "RB", "CDM"] },

  // ── Goalkeeper ──────────────────────────────────────────────────────────
  { value: "saves",                  label: "Saves",                   category: "Goalkeeper",  unit: "",  positions: ["GK"] },
  { value: "save_percentage_pct",    label: "Save Percentage %",       category: "Goalkeeper",  unit: "%", positions: ["GK"] },
  { value: "penalties_saved",        label: "Penalties Saved",         category: "Goalkeeper",  unit: "",  positions: ["GK"] },
  { value: "gk_long_dist_accuracy",  label: "Long Distribution Accuracy %", category: "Goalkeeper", unit: "%", positions: ["GK"] },
];

/** Returns stat options filtered by player position (includes universal options) */
export function getStatOptionsForPosition(position) {
  if (!position) return PERFORMANCE_STAT_OPTIONS;
  return PERFORMANCE_STAT_OPTIONS.filter(s => s.positions.length === 0 || s.positions.includes(position));
}

/** Groups stat options by category */
export function groupStatOptions(options) {
  const groups = {};
  for (const opt of options) {
    if (!groups[opt.category]) groups[opt.category] = [];
    groups[opt.category].push(opt);
  }
  return groups;
}
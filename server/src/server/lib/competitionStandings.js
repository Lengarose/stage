'use strict';
function sortStandingRows(rows) {
  const counts = new Map();
  for (const row of rows) if (row.club_id != null && String(row.club_id).trim()) counts.set(String(row.club_id), (counts.get(String(row.club_id)) || 0) + 1);
  return [...rows].filter(row=>!row.is_excluded && counts.get(String(row.club_id)) === 1).sort((a,b)=>Number(b.points || 0)-Number(a.points || 0) || Number(b.goal_difference || 0)-Number(a.goal_difference || 0) || Number(b.goals_for || 0)-Number(a.goals_for || 0) || String(a.club_name || '').localeCompare(String(b.club_name || '')) || String(a.club_id).localeCompare(String(b.club_id)));
}
module.exports={sortStandingRows};

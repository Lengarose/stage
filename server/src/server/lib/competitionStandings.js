'use strict';
function sortStandingRows(rows) {
  return [...rows].filter(row=>!row.is_excluded).sort((a,b)=>Number(b.points || 0)-Number(a.points || 0) || Number(b.goal_difference || 0)-Number(a.goal_difference || 0) || Number(b.goals_for || 0)-Number(a.goals_for || 0) || String(a.club_name || '').localeCompare(String(b.club_name || '')) || String(a.club_id).localeCompare(String(b.club_id)));
}
module.exports={sortStandingRows};

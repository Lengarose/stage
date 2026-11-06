'use strict';
const text=value=>value==null?'':String(value);
const score=value=>value==null || value===''?null:Number(value);
function forfeitSnapshot(match) {
  return {version:1,id:text(match.id),status:text(match.status),result_state:text(match.result_state),forfeit_status:text(match.forfeit_status),forfeit_claimed_by:text(match.forfeit_claimed_by),forfeit_proof_url:text(match.forfeit_proof_url),home_club_id:text(match.home_club_id),away_club_id:text(match.away_club_id),home_score:score(match.home_score),away_score:score(match.away_score)};
}
function assertForfeitSnapshotCurrent(expected,match) {
  const current=forfeitSnapshot(match);
  const pending=match.forfeit_status==='pending' && match.forfeit_claimed_by && !['completed','confirmed','played','forfeit','cancelled','canceled','deleted','voided','archived','reset','superseded'].includes(String(match.status || '').toLowerCase()) && !['CONFIRMED','VOIDED','AUTO_CONFIRMED_TIMEOUT'].includes(String(match.result_state || '').toUpperCase());
  if(!pending || !expected || expected.version!==1 || Object.keys(current).some(key=>expected[key]!==current[key])){
    const error=new Error('This forfeit claim changed or is no longer pending. Refresh and review it before deciding.');
    error.status=409;error.code='FORFEIT_REVIEW_CHANGED';throw error;
  }
}
module.exports={forfeitSnapshot,assertForfeitSnapshotCurrent};

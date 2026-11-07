'use strict';
const VERSION='regional_reserves_v1';
const HOURS=48;
const RULES='After the shared confirmation week, existing applicants may respond to reserve invitations until one common deadline, at most 48 hours later. No individual extension and no new late application. Reserve willingness does not guarantee a place or Division 1. Final Division 1 vacancies follow the confirmed promotion results: losing Division 2 promotion finalists first, then remaining nonpromoted positions; equivalent candidates across groups use a stored draw, never raw points or goal difference.';
function deadline(window){return new Date(Date.parse(window.confirmation_closes_at)+HOURS*3600000).toISOString();}
function active(window,now=new Date()){return window.reserve_policy_version===VERSION && now.getTime()>=Date.parse(window.confirmation_closes_at) && now.getTime()<Date.parse(deadline(window));}
function validConfirmation(window,record){
 const at=Date.parse(record.confirmed_at);
 if(at>=Date.parse(window.registration_closes_at) && at<Date.parse(window.confirmation_closes_at))return true;
 const invitation=record.reserve_invitation,response=record.reserve_response;
 return window.reserve_policy_version===VERSION && invitation?.version===VERSION && invitation.deadline===deadline(window) && response?.decision==='accept' && response.responded_at===record.confirmed_at && at>=Date.parse(window.confirmation_closes_at) && at<Date.parse(invitation.deadline) && Date.parse(invitation.offered_at)<=at;
}
module.exports={VERSION,RULES,deadline,active,validConfirmation};

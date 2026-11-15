'use strict';
const {EXECUTESQL}=require('../db/database');
const {resolveUserIdentity}=require('./identityService');
const {matchAccess}=require('./gameDayViewService');
const isMatchChannel=id=>Boolean(id)&&!String(id).includes(':');
async function access(user,id){
 if(!isMatchChannel(id))return null;
 return matchAccess(user.id,id,EXECUTESQL,resolveUserIdentity);
}
async function sender(user,channel){
 const ctx=await access(user,channel);
 if(!ctx)return {sender_email:user.email};
 const {match,identity}=ctx;
 const club=[identity.club,identity.memberClub,identity.ownedClub,identity.presidentClub].find(c=>c&&[match.home_club_id,match.away_club_id].includes(c.id));
 const player=identity.player;
 return {sender_email:identity.user.email,sender_name:club?.name||player?.gamertag||'Player',sender_avatar:club?.logo_url||player?.avatar_url||''};
}
async function visibleCounts(user,counts){
 const entries=await Promise.all(Object.entries(counts).map(async([id,n])=>{
  try{await access(user,id);return [id,n];}catch(e){if([403,404].includes(e.status))return null;throw e;}
 }));
 return Object.fromEntries(entries.filter(Boolean));
}
module.exports={access,sender,visibleCounts,isMatchChannel};

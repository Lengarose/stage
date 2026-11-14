'use strict';
const parse=value=>typeof value==='string'?JSON.parse(value||'{}'):(value||{});
const email=value=>String(value||'').trim().toLowerCase();
async function context(message,query){
 const meta={...parse(message.metadata)};
 let root=message,seen=new Set([message.id]);
 while(!meta.challenger_email && parse(root.metadata).original_message_id){
  const id=parse(root.metadata).original_message_id;if(seen.has(id)||seen.size>=50)break;seen.add(id);
  const [previous]=await query('SELECT * FROM inbox_messages WHERE id = ? LIMIT 1',[id]);if(!previous)break;root=previous;
 }
 return {...meta,root_invitation_id:meta.root_invitation_id||root.id,challenger_email:meta.challenger_email||root.sender_email,opponent_email:meta.opponent_email||root.recipient_email};
}
async function identity(meta,senderEmail,query){
 const club=meta.invitation_type==='club_vs_club';
 const side=email(senderEmail)===email(meta.challenger_email)?'challenger':email(senderEmail)===email(meta.opponent_email)?'opponent':null;
 let sender=null,names={challenger:meta.challenger_name||'Home',opponent:meta.opponent_name||'Away'};
 if(club){
  const ids=[meta.challenger_club_id,meta.opponent_club_id].filter(Boolean);
  const clubs=ids.length?await query(`SELECT id,name,logo_url,owner_email FROM clubs WHERE id IN (${ids.map(()=>'?').join(',')})`,ids):[];
  for(const row of clubs){if(row.id===meta.challenger_club_id)names.challenger=row.name;if(row.id===meta.opponent_club_id)names.opponent=row.name;}
  const row=clubs.find(c=>side?c.id===meta[`${side}_club_id`]:email(c.owner_email)===email(senderEmail));
  if(row)sender={name:row.name,avatar:row.logo_url||null,club_name:row.name};
 }else{
  const playerId=side?meta[`${side}_player_id`]:null;
  let rows=playerId?await query('SELECT id, gamertag, avatar_url, club_id FROM players WHERE id = ? LIMIT 1',[playerId]).catch(()=>[]):[];
  if(!rows.length)rows=await query('SELECT id, gamertag, avatar_url, club_id FROM players WHERE LOWER(email)=LOWER(?) LIMIT 1',[senderEmail]).catch(()=>[]);
  if(rows[0])sender={name:rows[0].gamertag,avatar:rows[0].avatar_url||null,club_name:null};
 }
 return {...(sender||{name:side?names[side]:'Match participant',avatar:null,club_name:club&&side?names[side]:null}),names,recipient_name:side?names[side==='challenger'?'opponent':'challenger']:'Manager'};
}
function kickoffLabel(value,timezone='Europe/Brussels'){
 if(!value)return 'Please discuss a suitable kickoff time.';
 const digits=String(value).replace(' ','T').slice(0,19),date=new Date(digits+'Z');
 if(!Number.isFinite(date.getTime()))return 'Please discuss a suitable kickoff time.';
 const day=new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date);
 return `${day} at ${digits.slice(11,16)} (${timezone})`;
}
function rescheduleContent(sender,meta){
 const fixture=`${sender.names.challenger} vs ${sender.names.opponent}`;
 return {subject:`New kickoff proposal — ${fixture}`,body:`Dear ${sender.recipient_name}${meta.invitation_type==='club_vs_club'?' team':''},\n\n${sender.name} would like to propose a different kickoff time for ${fixture}.\n\nProposed kickoff: ${kickoffLabel(meta.scheduled_date,meta.timezone)}\n\nPlease open “Review request” to accept this time, decline, or propose an alternative. The game is only scheduled or changed once a proposal is accepted. You can then find the confirmed fixture in GameDay and Schedule, including Fixtures and Calendar.\n\nKind regards,\n${sender.name}${meta.invitation_type==='club_vs_club'?' Management':''}`};
}
async function enrich(messages,query){
 return Promise.all(messages.map(async message=>{
  if(!['match_invite','match_invite_response'].includes(message.message_type))return message;
  let meta;try{meta=parse(message.metadata);}catch{return message;}
  if(!meta.reschedule_request || (message.sender_gamertag && message.sender_avatar_url))return message;
  const resolved=await context(message,query),sender=await identity(resolved,message.sender_email,query);
  const oldGenerated=/would like to reschedule\.\s*(?:\\n|\n)?Proposed:/.test(message.body||'');
  return {...message,sender_gamertag:sender.name,sender_club_name:sender.club_name,sender_avatar_url:sender.avatar,...(oldGenerated?rescheduleContent(sender,resolved):{})};
 }));
}
module.exports={context,identity,rescheduleContent,kickoffLabel,enrich};

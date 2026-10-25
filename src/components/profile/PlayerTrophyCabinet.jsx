import {useEffect,useState} from 'react';
import {stageClient} from '@/api/stageClient';
import TrophyCabinetSystem from '@/components/trophy/TrophyCabinetSystem';
import {isClubPresidentForUser} from '@/lib/clubPresidentAccess';

export default function PlayerTrophyCabinet({player,currentUserEmail}) {
  const [actor,setActor]=useState(null);
  useEffect(()=>{let stopped=false;if(!currentUserEmail)stageClient.auth.me().then(user=>{if(!stopped)setActor(user);}).catch(()=>{});return()=>{stopped=true;};},[currentUserEmail,player.id]);
  const email=currentUserEmail||actor?.email;
  const canEdit=!!(email&&email.toLowerCase()===String(player.email||'').toLowerCase()||actor?.id&&actor.id===player.user_id);
  return <TrophyCabinetSystem key={player.id} ownerId={player.id} ownerType="player" canEdit={canEdit}/>;
}

export function ClubTrophyCabinetDisplay({clubId,currentUserEmail,club,canEditOverride}) {
  const canEdit=canEditOverride!==undefined?canEditOverride:isClubPresidentForUser({user:{email:currentUserEmail},club});
  return <TrophyCabinetSystem key={clubId} ownerId={clubId} ownerType="club" canEdit={canEdit}/>;
}

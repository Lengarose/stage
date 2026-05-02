/**
 * deleteClub — fully deletes a club and cleans up all related data.
 *
 * Steps:
 * 1. Auth check — only owner or admin can delete
 * 2. Release all players (remove club_id, set status=free_agent, clear roles)
 * 3. Delete contracts
 * 4. Delete join requests
 * 5. Delete follows targeting the club
 * 6. Delete inbox messages tied to the club (related_entity_type=club AND related_entity_id=clubId)
 * 7. Delete notifications tied to the club
 * 8. Delete the club record itself
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { club_id } = await req.json();
  if (!club_id) return Response.json({ error: 'Missing club_id' }, { status: 400 });

  // Fetch club to verify ownership
  const clubs = await base44.asServiceRole.entities.Club.filter({ id: club_id });
  const club = clubs?.[0];
  if (!club) return Response.json({ error: 'Club not found' }, { status: 404 });

  const isOwner = club.owner_email === user.email;
  const isAdmin = user.role === 'admin';
  if (!isOwner && !isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

  // 1. Release all players — remove club link, set free agent
  const players = await base44.asServiceRole.entities.Player.filter({ club_id });
  await Promise.all(players.map(p =>
    base44.asServiceRole.entities.Player.update(p.id, {
      club_id: null,
      status: 'free_agent',
      role: 'member',
      club_roles: ['member'],
      dressing_room_seat: null,
      is_ready: false,
    })
  ));

  // 2. Delete contracts
  const contracts = await base44.asServiceRole.entities.PlayerContract.filter({ team_id: club_id });
  await Promise.all(contracts.map(c => base44.asServiceRole.entities.PlayerContract.delete(c.id)));

  // 3. Delete contract history (linked via contract_id)
  const contractHistoryAll = await Promise.all(
    contracts.map(c => base44.asServiceRole.entities.PlayerContractHistory.filter({ contract_id: c.id }))
  );
  const allHistory = contractHistoryAll.flat();
  await Promise.all(allHistory.map(h => base44.asServiceRole.entities.PlayerContractHistory.delete(h.id)));

  // 4. Delete join requests
  const joinRequests = await base44.asServiceRole.entities.JoinRequest.filter({ club_id });
  await Promise.all(joinRequests.map(r => base44.asServiceRole.entities.JoinRequest.delete(r.id)));

  // 5. Delete follows targeting this club
  const follows = await base44.asServiceRole.entities.Follow.filter({ target_id: club_id, target_type: 'club' });
  await Promise.all(follows.map(f => base44.asServiceRole.entities.Follow.delete(f.id)));

  // 6. Delete inbox messages related to this club
  const msgs = await base44.asServiceRole.entities.InboxMessage.filter({ related_entity_id: club_id, related_entity_type: 'club' });
  await Promise.all(msgs.map(m => base44.asServiceRole.entities.InboxMessage.delete(m.id)));

  // 7. Delete challenges involving this club
  const challengesHome = await base44.asServiceRole.entities.Challenge.filter({ challenger_club_id: club_id });
  const challengesAway = await base44.asServiceRole.entities.Challenge.filter({ opponent_club_id: club_id });
  const allChallenges = [...challengesHome, ...challengesAway];
  await Promise.all(allChallenges.map(c => base44.asServiceRole.entities.Challenge.delete(c.id)));

  // 8. Delete the club
  await base44.asServiceRole.entities.Club.delete(club_id);

  return Response.json({ success: true, players_released: players.length });
});
export function getOwnedClubId(userLike) {
  return userLike?.owned_club_id || userLike?.ownedClubId || userLike?.owner_id || userLike?.ownerId || null;
}

export function getOwnedClubId(userLike) {
  return getPresidentClubId(userLike) || userLike?.owned_club_id || userLike?.ownedClubId || userLike?.owner_id || userLike?.ownerId || null;
}

export function getPresidentClubId(userLike) {
  return userLike?.president_club_id || userLike?.presidentClubId || null;
}

export function getPresidentId(userLike) {
  return userLike?.president_id || userLike?.presidentId || null;
}

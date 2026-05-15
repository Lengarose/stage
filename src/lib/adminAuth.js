/** Database admin: role slug or roles.id === 0 */
export function isAppAdminUser(u) {
  return u?.role === 'admin' || Number(u?.role_id) === 0;
}

/** Admin panel mode (respects stage_admin_effective_role_id impersonation override). */
export function isEffectiveAdmin(user) {
  if (!isAppAdminUser(user)) return false;
  if (typeof window === 'undefined') return true;
  const override = localStorage.getItem('stage_admin_effective_role_id');
  if (override === null) return true;
  return Number(override) === 0;
}

/** Call after admin sign-in so impersonation state does not hide the control panel. */
export function ensureAdminPanelMode() {
  if (typeof window === 'undefined') return;
  localStorage.setItem('stage_admin_effective_role_id', '0');
  localStorage.removeItem('admin_takeover_club_id');
}

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

/** Routes admins may open without leaving the control-panel header (see App.jsx redirect guard). */
export function isAdminGlobalRoute(pathname) {
  if (!pathname) return false;
  if (
    pathname === '/community' ||
    pathname === '/search' ||
    pathname === '/notifications' ||
    pathname === '/settings'
  ) {
    return true;
  }
  if (pathname === '/clubs' || pathname.startsWith('/clubs/')) return true;
  return false;
}

/** True when the STAGE CONTROL PANEL header should show (not player HOME/COMPETE nav). */
export function shouldShowAdminHeader(pathname, user, isAdminHint = false) {
  const onPanelPath = pathname?.startsWith('/admin') || isAdminGlobalRoute(pathname);
  if (!onPanelPath) return false;
  if (user) return isEffectiveAdmin(user);
  return Boolean(isAdminHint);
}

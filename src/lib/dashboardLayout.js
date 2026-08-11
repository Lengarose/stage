export const DASHBOARD_WIDGET_META = [
  { id: "glance", labelKey: "dashboardWidgetGlance" },
  { id: "stats", labelKey: "dashboardWidgetStats" },
  { id: "form", labelKey: "dashboardWidgetForm" },
  { id: "next_match", labelKey: "dashboardWidgetNextMatch" },
  { id: "upcoming", labelKey: "dashboardWidgetUpcoming" },
  { id: "activity_objectives", labelKey: "dashboardWidgetActivity" },
  { id: "tournaments_league", labelKey: "dashboardWidgetCompetitions" },
];

export const DEFAULT_DASHBOARD_LAYOUT = DASHBOARD_WIDGET_META.map((w) => w.id);

const STORAGE_KEY = "stage_dashboard_layout_v1";

export function loadDashboardLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_DASHBOARD_LAYOUT];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_DASHBOARD_LAYOUT];
    const valid = new Set(DEFAULT_DASHBOARD_LAYOUT);
    const kept = parsed.filter((id) => valid.has(id));
    const missing = DEFAULT_DASHBOARD_LAYOUT.filter((id) => !kept.includes(id));
    return [...kept, ...missing];
  } catch {
    return [...DEFAULT_DASHBOARD_LAYOUT];
  }
}

export function saveDashboardLayout(layout) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

export function resetDashboardLayout() {
  localStorage.removeItem(STORAGE_KEY);
  return [...DEFAULT_DASHBOARD_LAYOUT];
}

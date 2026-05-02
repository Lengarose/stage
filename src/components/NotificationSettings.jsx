import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, BellOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { NOTIFICATION_SETTINGS, getDefaultNotificationSettings } from "@/lib/notificationTypes";

// Group settings by category
const GROUPS = [
  { label: "💬 Social",        keys: ["messages"] },
  { label: "📋 Contracts",     keys: ["contract_offers", "contract_updates"] },
  { label: "⚽ Matches",       keys: ["match_reminders", "match_results"] },
  { label: "🛡️ Club",         keys: ["club_updates"] },
  { label: "🏆 Tournaments",   keys: ["tournament_updates"] },
  { label: "📢 General",       keys: ["announcements"] },
];

export default function NotificationSettings() {
  const [settings, setSettings] = useState(getDefaultNotificationSettings());
  const [player, setPlayer] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const user = await base44.auth.me();
      if (!user?.email) return;
      const players = await base44.entities.Player.filter({ email: user.email });
      const p = players?.[0];
      if (p) {
        setPlayer(p);
        if (p.notification_settings) {
          // Merge with defaults to ensure new keys are ON by default
          setSettings({ ...getDefaultNotificationSettings(), ...p.notification_settings });
        }
      }
    }
    load();
  }, []);

  async function handleToggle(key, value) {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    setSaved(false);

    if (!player?.id) return;
    setSaving(true);
    await base44.entities.Player.update(player.id, { notification_settings: updated });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const settingsByKey = {};
  NOTIFICATION_SETTINGS.forEach(s => { settingsByKey[s.key] = s; });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bell className="w-5 h-5 text-primary shrink-0" />
        <div>
          <h3 className="text-lg font-bold text-foreground">Notification Settings</h3>
          <p className="text-sm text-muted-foreground">Choose which notifications you want to receive</p>
        </div>
        {saving && <span className="ml-auto text-xs text-muted-foreground">Saving...</span>}
        {saved && <span className="ml-auto text-xs text-primary">Saved ✓</span>}
      </div>

      <div className="space-y-4">
        {GROUPS.map(group => (
          <div key={group.label} className="rounded-xl border border-border bg-secondary/40 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-secondary/60">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
            </div>
            <div className="divide-y divide-border">
              {group.keys.map(key => {
                const s = settingsByKey[key];
                if (!s) return null;
                return (
                  <div key={key} className="flex items-center justify-between px-4 py-3 gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{s.label}</p>
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                    </div>
                    <Switch
                      checked={settings[key] !== false}
                      onCheckedChange={(val) => handleToggle(key, val)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
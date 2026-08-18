import { useEffect, useState } from "react";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import { Bell, Mail, Smartphone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  NOTIFICATION_SETTINGS,
  NOTIFICATION_SETTING_GROUPS,
  NOTIFICATION_CHANNELS,
  getDefaultNotificationSettings,
  materializeNotificationSettings,
  setChannelCategory,
  isChannelCategoryOn,
} from "@/lib/notificationTypes";
import { useIsPhoneOrPwa } from "@/hooks/useIsPhoneOrPwa";
import { getWebPushStatus, setWebPushEnabled } from "@/lib/oneSignal";

const WEB_GROUPS = [
  { label: "💬 Social",        keys: ["messages"] },
  { label: "📋 Contracts",     keys: ["contract_offers", "contract_updates"] },
  { label: "⚽ Matches",       keys: ["match_reminders", "match_results"] },
  { label: "🛡️ Club",         keys: ["club_updates"] },
  { label: "🏆 Tournaments",   keys: ["tournament_updates"] },
  { label: "📢 General",       keys: ["announcements"] },
];

const CHANNEL_ICONS = {
  email: Mail,
  mobile: Smartphone,
  push: Bell,
};

function CategorySwitchList({ settings, channel, onToggle }) {
  const settingsByKey = Object.fromEntries(NOTIFICATION_SETTINGS.map((row) => [row.key, row]));
  return (
    <div className="space-y-4">
      {NOTIFICATION_SETTING_GROUPS.map((group) => (
        <div key={`${channel}-${group.label}`}>
          <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </p>
          <div className="divide-y divide-border rounded-lg border border-border/70 overflow-hidden">
            {group.keys.map((key) => {
              const row = settingsByKey[key];
              if (!row) return null;
              return (
                <div key={key} className="flex items-center justify-between gap-4 bg-secondary/20 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{row.label}</p>
                    <p className="text-xs text-muted-foreground">{row.description}</p>
                  </div>
                  <Switch
                    checked={isChannelCategoryOn(settings, channel, key)}
                    onCheckedChange={(val) => onToggle(channel, key, val)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NotificationSettings() {
  const phoneSurface = useIsPhoneOrPwa();
  const [settings, setSettings] = useState(getDefaultNotificationSettings());
  const [player, setPlayer] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pushStatus, setPushStatus] = useState({ configured: false, permission: false, optedIn: false });
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    async function load() {
      const { player: p } = await resolveMyPlayerAndClub();
      if (!p) return;
      setPlayer(p);
      setSettings(materializeNotificationSettings(p.notification_settings));
    }
    load();
  }, []);

  useEffect(() => {
    if (!phoneSurface) return undefined;
    let cancelled = false;
    getWebPushStatus().then((status) => {
      if (!cancelled) setPushStatus(status);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [phoneSurface]);

  async function persist(next) {
    setSettings(next);
    setSaved(false);
    if (!player?.id) return;
    setSaving(true);
    try {
      await stageClient.entities.Player.update(player.id, { notification_settings: next });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save notification settings:", err);
    } finally {
      setSaving(false);
    }
  }

  function handleToggle(channel, key, value) {
    persist(setChannelCategory(settings, channel, key, value));
  }

  async function handlePushMaster(value) {
    setPushBusy(true);
    try {
      setPushStatus(await setWebPushEnabled(value));
    } finally {
      setPushBusy(false);
    }
  }

  const status = (
    <>
      {saving && <span className="ml-auto text-xs text-muted-foreground">Saving...</span>}
      {saved && <span className="ml-auto text-xs text-primary">Saved ✓</span>}
    </>
  );

  if (phoneSurface) {
    const phoneOn = Boolean(pushStatus.configured && pushStatus.permission && pushStatus.optedIn);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-primary shrink-0" />
          <div>
            <h3 className="text-lg font-bold text-foreground">Notification Settings</h3>
            <p className="text-sm text-muted-foreground">Email, in-app, and push are separate. Same controls as the STAGE mobile app.</p>
          </div>
          {status}
        </div>

        {NOTIFICATION_CHANNELS.map((channel) => {
          const Icon = CHANNEL_ICONS[channel.key] || Bell;
          return (
            <div key={channel.key} className="rounded-xl border border-border bg-secondary/40 overflow-hidden">
              <div className="flex items-start gap-3 px-4 py-3 border-b border-border bg-secondary/60">
                <Icon className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{channel.label}</p>
                  <p className="text-xs text-muted-foreground">{channel.description}</p>
                </div>
              </div>
              <div className="p-4 space-y-4">
                {channel.key === "push" ? (
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-secondary/20 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Lock screen & banners</p>
                      <p className="text-xs text-muted-foreground">
                        {!pushStatus.configured
                          ? "Push is not configured on this build."
                          : pushStatus.permission
                            ? (pushStatus.optedIn ? "Push is on for this device." : "Permission granted, push is opted out.")
                            : "This browser has not allowed STAGE notifications yet."}
                      </p>
                    </div>
                    <Switch
                      checked={phoneOn}
                      disabled={pushBusy || !pushStatus.configured}
                      onCheckedChange={handlePushMaster}
                    />
                  </div>
                ) : null}
                <CategorySwitchList settings={settings} channel={channel.key} onToggle={handleToggle} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bell className="w-5 h-5 text-primary shrink-0" />
        <div>
          <h3 className="text-lg font-bold text-foreground">Web notifications</h3>
          <p className="text-sm text-muted-foreground">Toasts and the notification list in the STAGE website. Messages also covers live match and club chat.</p>
        </div>
        {status}
      </div>

      <div className="space-y-4">
        {WEB_GROUPS.map((group) => (
          <div key={group.label} className="rounded-xl border border-border bg-secondary/40 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-secondary/60">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
            </div>
            <div className="divide-y divide-border">
              {group.keys.map((key) => {
                const row = NOTIFICATION_SETTINGS.find((item) => item.key === key);
                if (!row) return null;
                return (
                  <div key={key} className="flex items-center justify-between px-4 py-3 gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{row.label}</p>
                      <p className="text-xs text-muted-foreground">{row.description}</p>
                    </div>
                    <Switch
                      checked={isChannelCategoryOn(settings, "web", key)}
                      onCheckedChange={(val) => handleToggle("web", key, val)}
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

import {
  Bell, Megaphone, Music2, Radio, Sparkles, Target, Trophy, Volume2, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NOTIFICATION_SOUNDS, playNotificationSound } from "@/lib/notificationSound";
import { useTranslation } from "@/hooks/useTranslation";

const ICON_MAP = {
  whistle: Megaphone,
  boot: Zap,
  goal: Target,
  crowd: Megaphone,
  trophy: Trophy,
  pulse: Radio,
  zap: Sparkles,
  bell: Bell,
  pop: Volume2,
  tap: Volume2,
  ding: Bell,
  tone: Music2,
  blip: Zap,
  smooth: Music2,
  rise: Sparkles,
  echo: Radio,
  match: Target,
  locker: Volume2,
  final: Megaphone,
  champion: Trophy,
};

export default function SoundIconPicker({ value, onChange }) {
  const { t } = useTranslation();
  const sportSounds = NOTIFICATION_SOUNDS.filter((s) => s.category === "sport" || s.category === "digital");
  const classicSounds = NOTIFICATION_SOUNDS.filter((s) => s.category === "classic");

  function renderGrid(sounds, title) {
    return (
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">{title}</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {sounds.map((sound) => {
            const Icon = ICON_MAP[sound.icon] || Bell;
            const selected = value === sound.id;
            return (
              <button
                key={sound.id}
                type="button"
                onClick={() => {
                  onChange(sound.id);
                  playNotificationSound(sound.id);
                }}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border p-2.5 transition-all text-center",
                  selected
                    ? "border-amber-400/50 bg-amber-500/10 shadow-[0_0_16px_-6px_rgba(255,184,0,0.7)]"
                    : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]"
                )}
              >
                <Icon className={cn("w-5 h-5", selected ? "text-amber-300" : "text-white/50")} />
                <span className={cn(
                  "text-[8px] font-bold uppercase tracking-wide leading-tight line-clamp-2",
                  selected ? "text-amber-200" : "text-white/45"
                )}>
                  {sound.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {renderGrid(sportSounds, t("settingsPage.soundSport"))}
      {renderGrid(classicSounds, t("settingsPage.soundClassic"))}
    </div>
  );
}

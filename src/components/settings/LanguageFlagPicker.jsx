import { cn } from "@/lib/utils";
import { DISPLAY_LANGUAGES } from "@/lib/languages";
import { useTranslation } from "@/hooks/useTranslation";

export default function LanguageFlagPicker({ value, onChange }) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-2">
      {DISPLAY_LANGUAGES.map((lang) => {
        const selected = value === lang.value;
        const disabled = !lang.enabled;

        return (
          <button
            key={lang.value}
            type="button"
            disabled={disabled}
            title={disabled ? t("settingsPage.languageComingSoon") : lang.nativeLabel}
            onClick={() => !disabled && onChange(lang.value)}
            className={cn(
              "relative flex flex-col items-center gap-1.5 rounded-xl border p-2.5 transition-all",
              disabled && "opacity-35 cursor-not-allowed grayscale",
              !disabled && selected && "border-cyan-400/50 bg-cyan-500/10 shadow-[0_0_20px_-8px_rgba(0,229,255,0.8)]",
              !disabled && !selected && "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]"
            )}
          >
            <span className="text-2xl leading-none" aria-hidden>{lang.flag}</span>
            <span className={cn(
              "text-[9px] font-bold uppercase tracking-wider text-center leading-tight",
              selected ? "text-cyan-300" : "text-white/50"
            )}>
              {lang.value}
            </span>
            {selected ? (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-400" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

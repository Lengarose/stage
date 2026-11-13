import { Plus, RotateCcw } from "lucide-react";
import { GamerHeroAction } from "@/components/profile/gamer/GamerProfileUI";
import { CLIP_16 } from "@/components/landing/clips";
import { cn } from "@/lib/utils";
import { DASHBOARD_WIDGET_META } from "@/lib/dashboardLayout";
import { useTranslation } from "@/hooks/useTranslation";

export default function DashboardCustomizer({ activeWidgets, onAddWidget, onReset }) {
  const { t } = useTranslation();
  const availableToAdd = DASHBOARD_WIDGET_META.filter((w) => !activeWidgets.includes(w.id));

  return (
    <div className={cn(CLIP_16, "p-px")} style={{ background: "rgba(0, 212, 255, 0.35)" }}>
      <div className={cn(CLIP_16, "space-y-3 bg-gradient-to-br from-[#070b14]/95 via-cyan-950/40 to-black/90 p-4 backdrop-blur-md")}>
      <p className="text-xs text-white/45">{t("commonPages.dashboardLayoutHint")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2 flex-1">
          {availableToAdd.map((widget) => (
            <GamerHeroAction
              key={widget.id}
              type="button"
              tone="ghost"
              onClick={() => onAddWidget(widget.id)}
              className="max-w-none px-3 py-1.5 text-[10px]"
            >
              <Plus className="w-3 h-3" />
              {t(`commonPages.${widget.labelKey}`)}
            </GamerHeroAction>
          ))}
          {availableToAdd.length === 0 ? (
            <span className="text-xs text-white/40">{t("commonPages.dashboardLayoutAllVisible")}</span>
          ) : null}
        </div>
        <GamerHeroAction
          type="button"
          tone="ghost"
          onClick={onReset}
          className="max-w-none shrink-0 px-3 py-1.5 text-[10px]"
        >
          <RotateCcw className="w-3 h-3" />
          {t("commonPages.dashboardLayoutReset")}
        </GamerHeroAction>
      </div>
      </div>
    </div>
  );
}

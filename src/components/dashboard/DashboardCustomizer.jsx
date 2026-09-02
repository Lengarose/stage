import { Plus, RotateCcw } from "lucide-react";
import { GamerHeroAction } from "@/components/profile/gamer/GamerProfileUI";
import { DASHBOARD_WIDGET_META } from "@/lib/dashboardLayout";
import { useTranslation } from "@/hooks/useTranslation";

const CLIP = { clipPath: "polygon(2% 0, 100% 0, 98% 100%, 0 100%)" };

export default function DashboardCustomizer({ activeWidgets, onAddWidget, onReset }) {
  const { t } = useTranslation();
  const availableToAdd = DASHBOARD_WIDGET_META.filter((w) => !activeWidgets.includes(w.id));

  return (
    <div
      className="border border-dashed border-cyan-300/30 bg-gradient-to-br from-[#070b14]/95 via-cyan-950/40 to-black/90 p-4 space-y-3 backdrop-blur-md"
      style={CLIP}
    >
      <p className="text-xs text-white/45">{t("commonPages.dashboardLayoutHint")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2 flex-1">
          {availableToAdd.map((widget) => (
            <GamerHeroAction
              key={widget.id}
              type="button"
              onClick={() => onAddWidget(widget.id)}
              className="max-w-none text-[10px] px-3 py-1.5"
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
          onClick={onReset}
          className="max-w-none shrink-0 text-[10px] px-3 py-1.5 border-white/15 text-white/60 hover:text-white"
        >
          <RotateCcw className="w-3 h-3" />
          {t("commonPages.dashboardLayoutReset")}
        </GamerHeroAction>
      </div>
    </div>
  );
}

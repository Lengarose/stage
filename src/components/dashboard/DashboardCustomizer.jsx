import { Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DASHBOARD_WIDGET_META } from "@/lib/dashboardLayout";
import { useTranslation } from "@/hooks/useTranslation";

export default function DashboardCustomizer({ activeWidgets, onAddWidget, onReset }) {
  const { t } = useTranslation();
  const availableToAdd = DASHBOARD_WIDGET_META.filter((w) => !activeWidgets.includes(w.id));

  return (
    <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 space-y-3">
      <p className="text-xs text-muted-foreground">{t("commonPages.dashboardLayoutHint")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2 flex-1">
          {availableToAdd.map((widget) => (
            <Button
              key={widget.id}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onAddWidget(widget.id)}
              className="gap-1 font-heading uppercase text-xs"
            >
              <Plus className="w-3 h-3" />
              {t(`commonPages.${widget.labelKey}`)}
            </Button>
          ))}
          {availableToAdd.length === 0 ? (
            <span className="text-xs text-muted-foreground">{t("commonPages.dashboardLayoutAllVisible")}</span>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onReset}
          className="gap-1 font-heading uppercase text-xs shrink-0"
        >
          <RotateCcw className="w-3 h-3" />
          {t("commonPages.dashboardLayoutReset")}
        </Button>
      </div>
    </div>
  );
}

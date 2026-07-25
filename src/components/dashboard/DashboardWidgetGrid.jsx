import { useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import DashboardWidget from "@/components/DashboardWidget";
import DashboardCustomizer from "@/components/dashboard/DashboardCustomizer";
import {
  DASHBOARD_WIDGET_META,
  loadDashboardLayout,
  resetDashboardLayout,
  saveDashboardLayout,
} from "@/lib/dashboardLayout";
import { useTranslation } from "@/hooks/useTranslation";

function reorder(list, startIndex, endIndex) {
  const result = [...list];
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

export default function DashboardWidgetGrid({ widgets, hiddenByDefault = new Set() }) {
  const { t } = useTranslation();
  const [editMode, setEditMode] = useState(false);
  const [layout, setLayout] = useState(() => loadDashboardLayout());

  const metaById = useMemo(
    () => Object.fromEntries(DASHBOARD_WIDGET_META.map((w) => [w.id, w])),
    []
  );

  const visibleLayout = layout.filter((id) => widgets[id] && !hiddenByDefault.has(id));

  function persist(next) {
    setLayout(next);
    saveDashboardLayout(next);
  }

  function handleDragEnd(result) {
    if (!result.destination) return;
    const visible = layout.filter((id) => widgets[id]);
    const reorderedVisible = reorder(visible, result.source.index, result.destination.index);
    const hidden = layout.filter((id) => !widgets[id]);
    persist([...reorderedVisible, ...hidden]);
  }

  function handleAddWidget(id) {
    if (layout.includes(id)) return;
    persist([...layout, id]);
  }

  function handleRemoveWidget(id) {
    persist(layout.filter((item) => item !== id));
  }

  function handleReset() {
    persist(resetDashboardLayout());
  }

  function renderBlock(id, dragProps = null, isDragging = false) {
    const meta = metaById[id];
    const content = widgets[id];
    if (!content) return null;

    if (editMode) {
      return (
        <DashboardWidget
          id={id}
          title={meta ? t(`commonPages.${meta.labelKey}`) : id}
          onRemove={handleRemoveWidget}
          isDragging={isDragging}
          dragHandleProps={dragProps?.dragHandleProps}
        >
          {content}
        </DashboardWidget>
      );
    }
    return content;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant={editMode ? "default" : "outline"}
          className="gap-2 font-heading uppercase text-xs"
          onClick={() => setEditMode((v) => !v)}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          {editMode ? t("commonPages.dashboardLayoutDone") : t("commonPages.dashboardLayoutEdit")}
        </Button>
      </div>

      {editMode ? (
        <DashboardCustomizer
          activeWidgets={layout}
          onAddWidget={handleAddWidget}
          onReset={handleReset}
        />
      ) : null}

      {editMode ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="dashboard-widgets">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
                {visibleLayout.map((id, index) => (
                  <Draggable key={id} draggableId={id} index={index}>
                    {(dragProvided, snapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className="min-w-0"
                      >
                        {renderBlock(id, dragProvided, snapshot.isDragging)}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        <div className="space-y-4">
          {visibleLayout.map((id) => (
            <div key={id} className="min-w-0">{renderBlock(id)}</div>
          ))}
        </div>
      )}
    </div>
  );
}

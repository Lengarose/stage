import { Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const AVAILABLE_WIDGETS = [
  { id: 'stats', label: 'Quick Stats' },
  { id: 'live', label: 'Live Matches' },
  { id: 'top_performers', label: 'Top Performers' },
  { id: 'quick_actions', label: 'Quick Actions' },
  { id: 'tournaments', label: 'Open Tournaments' },
  { id: 'clubs', label: 'Top Clubs' },
];

export default function DashboardCustomizer({ activeWidgets, onAddWidget, onReset }) {
  const availableToAdd = AVAILABLE_WIDGETS.filter(w => !activeWidgets.includes(w.id));

  return (
    <div className="flex items-center gap-2 mb-6">
      <div className="flex flex-wrap gap-2 flex-1">
        {availableToAdd.map(widget => (
          <Button
            key={widget.id}
            size="sm"
            variant="outline"
            onClick={() => onAddWidget(widget.id)}
            className="gap-1"
          >
            <Plus className="w-3 h-3" />
            {widget.label}
          </Button>
        ))}
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={onReset}
        className="gap-1"
        title="Reset to default layout"
      >
        <RotateCcw className="w-3 h-3" />
        Reset
      </Button>
    </div>
  );
}
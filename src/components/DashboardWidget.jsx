import { useState } from 'react';
import { GripVertical, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DashboardWidget({ id, title, children, onRemove, isDragging, dragHandleProps }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={cn('bg-card border border-border rounded-xl overflow-hidden transition-all', isDragging && 'opacity-50 ring-2 ring-primary')}
      data-widget-id={id}
    >
      <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/50">
        <div className="flex items-center gap-2">
          <span {...(dragHandleProps || {})} className="cursor-grab active:cursor-grabbing flex items-center">
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </span>
          {id === 'live' && <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />}
          <h3 className="leading-relaxed font-bold text-sm text-foreground">{title}</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <ChevronDown className={cn('w-4 h-4 transition-transform duration-200', collapsed && '-rotate-90')} />
          </button>
          {onRemove && (
            <button
              onClick={() => onRemove(id)}
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
              title="Remove widget"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      {!collapsed && (
        <div className="p-4 overflow-auto max-h-96">
          {children}
        </div>
      )}
    </div>
  );
}
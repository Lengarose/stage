import { useState } from 'react';
import { GripVertical, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const CLIP = { clipPath: "polygon(2% 0, 100% 0, 98% 100%, 0 100%)" };

export default function DashboardWidget({ id, title, children, onRemove, isDragging, dragHandleProps }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={cn(
        'overflow-hidden border border-cyan-300/20 bg-[#070b14]/88 backdrop-blur-md transition-all',
        isDragging && 'opacity-50 ring-2 ring-cyan-400/50',
      )}
      style={CLIP}
      data-widget-id={id}
    >
      <div className="flex items-center justify-between p-4 border-b border-cyan-300/10 bg-cyan-300/[0.03]">
        <div className="flex items-center gap-2">
          <span {...(dragHandleProps || {})} className="cursor-grab active:cursor-grabbing flex items-center">
            <GripVertical className="w-4 h-4 text-white/40" />
          </span>
          {id === 'live' && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
          <h3 className="leading-relaxed font-heading font-black uppercase text-sm tracking-[0.12em] text-white/90">{title}</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="text-white/40 hover:text-cyan-300 transition-colors p-0.5"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <ChevronDown className={cn('w-4 h-4 transition-transform duration-200', collapsed && '-rotate-90')} />
          </button>
          {onRemove && (
            <button
              onClick={() => onRemove(id)}
              className="text-white/40 hover:text-rose-400 transition-colors p-0.5"
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

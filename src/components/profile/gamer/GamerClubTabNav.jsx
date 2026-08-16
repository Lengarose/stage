import { cn } from "@/lib/utils";
import { GamerTabNav } from "./GamerProfileUI";

export default function GamerClubTabNav({ groups, activeTab, tabLabels, onChange, badgeForTab }) {
  const activeGroup = groups.find((g) => g.tabs.includes(activeTab)) || groups[0];

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {groups.map((group) => {
          const isActive = group.tabs.includes(activeTab);
          const badge = group.tabs.map((id) => badgeForTab?.(id)).find(Boolean);
          return (
            <button
              key={group.label}
              type="button"
              onClick={() => onChange(group.tabs[0])}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-[10px] sm:text-xs font-black uppercase tracking-[0.18em] transition-all",
                isActive
                  ? "bg-gradient-to-r from-cyan-500/25 to-teal-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_20px_-6px_rgba(0,229,255,0.8)]"
                  : "bg-white/[0.03] text-white/40 border border-white/10 hover:text-white/70 hover:border-white/20"
              )}
            >
              {group.label}
              {badge ? (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-cyan-500 text-black text-[9px] font-black normal-case tracking-normal">
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {activeGroup && activeGroup.tabs.length > 1 ? (
        <GamerTabNav
          tabs={activeGroup.tabs.map((id) => ({
            id,
            label: tabLabels[id] || id,
            badge: badgeForTab?.(id) || undefined,
          }))}
          active={activeTab}
          onChange={onChange}
        />
      ) : null}
    </div>
  );
}

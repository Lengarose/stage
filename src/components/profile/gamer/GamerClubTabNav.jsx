import { cn } from "@/lib/utils";
import { GamerTabNav } from "./GamerProfileUI";

export default function GamerClubTabNav({ groups, activeTab, tabLabels, onChange, badgeForTab }) {
  const activeGroup = groups.find((g) => g.tabs.includes(activeTab)) || groups[0];

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {groups.map((group) => {
          const isActive = group.tabs.includes(activeTab);
          return (
            <button
              key={group.label}
              type="button"
              onClick={() => onChange(group.tabs[0])}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all border",
                isActive
                  ? "bg-gradient-to-r from-amber-500/20 to-yellow-500/15 text-amber-300 border-amber-400/40"
                  : "bg-white/[0.03] text-white/40 border-white/10 hover:text-white/70"
              )}
            >
              {group.label}
            </button>
          );
        })}
      </div>

      {activeGroup ? (
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

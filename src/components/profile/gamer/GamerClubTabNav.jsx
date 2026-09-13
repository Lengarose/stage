import { cn } from "@/lib/utils";
import { GamerTabNav } from "./GamerProfileUI";

export default function GamerClubTabNav({ groups, activeTab, tabLabels, onChange, badgeForTab }) {
  const activeGroup = groups.find((g) => g.tabs.includes(activeTab)) || groups[0];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-7 gap-y-3 overflow-visible pb-1">
        {groups.map((group) => {
          const isActive = group.tabs.includes(activeTab);
          const badge = group.tabs.map((id) => badgeForTab?.(id)).find(Boolean);
          return (
            <button
              key={group.label}
              type="button"
              onClick={() => onChange(group.tabs[0])}
              className={cn(
                "shrink-0 border-0 bg-transparent px-0 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] transition-all sm:text-xs",
                isActive
                  ? "text-cyan-50 drop-shadow-[0_0_16px_rgba(0,229,255,0.70)]"
                  : "text-cyan-100/45 hover:text-cyan-50 hover:drop-shadow-[0_0_14px_rgba(0,229,255,0.45)]"
              )}
            >
              {group.label}
              {badge ? (
                <span
                  className="ml-1.5 inline-flex h-[18px] min-w-[22px] items-center justify-center bg-cyan-300 px-1 text-[9px] font-black normal-case tracking-normal text-black"
                  style={{ clipPath: "polygon(16% 0, 100% 0, 84% 100%, 0 100%)" }}
                >
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

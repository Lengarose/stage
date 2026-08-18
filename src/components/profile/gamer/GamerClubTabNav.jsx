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
                "shrink-0 border px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] transition-all sm:text-xs",
                isActive
                  ? "border-cyan-200/55 bg-gradient-to-r from-sky-500/35 via-cyan-400/20 to-blue-600/30 text-cyan-50 shadow-[0_0_24px_-8px_rgba(0,229,255,0.95)]"
                  : "border-cyan-300/15 bg-[#06111d]/80 text-cyan-100/45 hover:border-cyan-300/35 hover:bg-cyan-300/10 hover:text-cyan-50"
              )}
              style={{ clipPath: "polygon(10% 0, 100% 0, 90% 100%, 0 100%)" }}
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

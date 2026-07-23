import { Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

const POSITIONS = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST", "CF"];
const PLATFORMS = ["PlayStation", "Xbox", "PC"];

export default function TransferFilters({ search, onSearch, position, onPosition, statusFilter, onStatus, platform, onPlatform }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder={t("commonPages.searchGamertag")}
          className="w-full bg-secondary border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors"
        />
      </div>

      {/* Filter chips row */}
      <div className="flex items-center gap-2 flex-wrap">
        <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground shrink-0" />

        {/* Status filter */}
        {[
          { id: "all", label: t("commonPages.all") },
          { id: "free_agent", label: t("commonPages.freeAgentTitle") },
          { id: "expiring", label: t("commonPages.expiring") },
        ].map(opt => (
          <button
            key={opt.id}
            onClick={() => onStatus(opt.id)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border font-medium transition-all",
              statusFilter === opt.id
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}

        <div className="w-px h-4 bg-border mx-1" />

        {/* Position filter */}
        <select
          value={position}
          onChange={e => onPosition(e.target.value)}
          className="text-xs bg-secondary border border-border rounded-full px-3 py-1.5 text-muted-foreground outline-none focus:border-primary/50 cursor-pointer"
        >
          <option value="">{t("commonPages.allPositions")}</option>
          {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        {/* Platform filter */}
        <select
          value={platform}
          onChange={e => onPlatform(e.target.value)}
          className="text-xs bg-secondary border border-border rounded-full px-3 py-1.5 text-muted-foreground outline-none focus:border-primary/50 cursor-pointer"
        >
          <option value="">{t("commonPages.allPlatforms")}</option>
          {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";
import { CONTRACT_TYPES } from "@/lib/contractTypes";
import { User, CheckCircle } from "lucide-react";

export default function PlayerSelectList({ players, contracts, selectedId, onSelect }) {
  function getPlayerContractStatus(playerId) {
    const active = contracts.find(c => c.user_id === playerId && c.status === "active");
    if (active) return { status: "active", meta: CONTRACT_TYPES[active.contract_type] };
    const pending = contracts.find(c => c.user_id === playerId && c.status === "pending");
    if (pending) return { status: "pending", meta: CONTRACT_TYPES[pending.contract_type] };
    return null;
  }

  return (
    <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
      {players.map((p) => {
        const contractInfo = getPlayerContractStatus(p.id);
        const isSelected = selectedId === p.id;

        return (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left",
              isSelected
                ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20"
                : "bg-card border-border hover:border-primary/20 hover:bg-secondary/50"
            )}
          >
            <div className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 overflow-hidden">
              {p.avatar_url ? (
                <img
                  src={p.avatar_url}
                  alt={p.gamertag}
                  className="w-full h-full object-cover"
                  style={{ objectPosition: p.avatar_position || "50% 50%" }}
                />
              ) : (
                <User className="w-4 h-4 text-muted-foreground" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground truncate">{p.gamertag}</span>
                {p.position && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-medium">
                    {p.position}
                  </span>
                )}
              </div>
              {contractInfo ? (
                <span className={cn(
                  "text-[11px] font-medium",
                  contractInfo.status === "active" ? "text-success" : "text-warning"
                )}>
                  {contractInfo.status === "active" ? "Active" : "Pending"}: {contractInfo.meta?.label}
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground">No contract</span>
              )}
            </div>

            {isSelected && (
              <CheckCircle className="w-5 h-5 text-primary shrink-0" />
            )}
          </button>
        );
      })}

      {players.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No players in the roster
        </div>
      )}
    </div>
  );
}
import { CONTRACT_TYPES } from "@/lib/contractTypes";
import { cn } from "@/lib/utils";
import { User, FileText, Gamepad2, Clock, Calendar, Info } from "lucide-react";

export default function ContractSummary({ player, contractType }) {
  const meta = CONTRACT_TYPES[contractType];
  if (!player || !meta) return null;

  const today = new Date();
  const endDate = new Date(today.getTime() + meta.max_days * 24 * 60 * 60 * 1000);

  return (
    <div className={cn("rounded-xl border-2 p-5", meta.bg, meta.border)}>
      <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-4">
        Contract Summary
      </h4>

      <div className="space-y-3">
        {/* Player */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center overflow-hidden shrink-0">
            {player.avatar_url ? (
              <img
                src={player.avatar_url}
                alt={player.gamertag}
                className="w-full h-full object-cover"
                style={{ objectPosition: player.avatar_position || "50% 50%" }}
              />
            ) : (
              <User className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{player.gamertag}</p>
            <p className="text-[11px] text-muted-foreground">{player.position || "No position"}</p>
          </div>
        </div>

        <div className="h-px bg-border/50" />

        {/* Contract type */}
        <div className="flex items-center gap-3">
          <FileText className={cn("w-4 h-4 shrink-0", meta.color)} />
          <div>
            <p className="text-xs text-muted-foreground">Contract Type</p>
            <p className={cn("text-sm font-bold", meta.color)}>{meta.label}</p>
          </div>
        </div>

        {/* Games */}
        <div className="flex items-center gap-3">
          <Gamepad2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Games Allowed</p>
            <p className="text-sm font-semibold text-foreground">{meta.max_games}</p>
          </div>
        </div>

        {/* Duration */}
        <div className="flex items-center gap-3">
          <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="text-sm font-semibold text-foreground">{meta.max_days} days</p>
          </div>
        </div>

        {/* Dates */}
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Start / Est. End</p>
            <p className="text-sm font-semibold text-foreground">
              When accepted — {endDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
        </div>

        <div className="h-px bg-border/50" />

        {/* Rule text */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/50 border border-border">
          <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Contract ends when the game limit is reached or the duration expires — whichever comes first. Start date begins when the player accepts the offer.
          </p>
        </div>
      </div>
    </div>
  );
}
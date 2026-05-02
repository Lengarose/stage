import { Info, User, Briefcase } from "lucide-react";

export default function OwnershipContractInfo() {
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-sm text-foreground mb-2">Club Ownership & Player Contracts</p>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <Briefcase className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <p><span className="text-primary font-semibold">Ownership Contract:</span> Defines your role as club owner. 3,650 days duration.</p>
            </div>
            <div className="flex items-start gap-2">
              <User className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
              <p><span className="text-accent font-semibold">Player Contract:</span> Your contract as a player in your own club (optional). Can be star, important, squad, academy, or trial.</p>
            </div>
            <p className="text-muted-foreground mt-3 p-2 rounded-lg bg-secondary/30">
              ⭐ Club creators/owners can hold <strong>up to 2 contracts</strong>: 1 ownership contract + 1 player contract.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
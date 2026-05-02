import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ChooseResidenceBanner({ onGoToStore }) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-5 py-4 rounded-2xl bg-primary/10 border border-primary/30">
      <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
        <Home className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-foreground text-sm">No residence chosen</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Every player needs a place to live. Choose a property to rent or buy as your residence.
        </p>
      </div>
      <Button size="sm" onClick={onGoToStore} className="bg-primary text-primary-foreground shrink-0 gap-1.5">
        <Home className="w-3.5 h-3.5" />
        Choose Residence
      </Button>
    </div>
  );
}
import TransferWindowPanel from "@/components/admin/TransferWindowPanel";
import { TrendingUp } from "lucide-react";

export default function TransfersTab() {
  return (
    <div className="max-w-2xl">
      <h3 className="font-heading text-lg uppercase tracking-tight text-foreground mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" /> Transfer Window
      </h3>
      <TransferWindowPanel />
    </div>
  );
}

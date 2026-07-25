import TransferWindowPanel from "@/components/admin/TransferWindowPanel";
import { useTranslation } from "@/hooks/useTranslation";
import { TrendingUp } from "lucide-react";

export default function TransfersTab() {
  const { t } = useTranslation();

  return (
    <div className="max-w-2xl">
      <h3 className="font-heading text-lg uppercase tracking-tight text-foreground mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" /> {t("admin.transfers.windowTitle")}
      </h3>
      <TransferWindowPanel />
    </div>
  );
}

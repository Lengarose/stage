import { Building2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

// Compatibility component name: this step now explains Board-controlled pay.
// It never collects self-assigned compensation or performance objectives.
export default function FounderPlayerTermsSetup({ onComplete }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      <Building2 className="h-8 w-8 text-blue-200" />
      <h2 className="text-xl font-black uppercase tracking-wide text-white">{t("commonPages.obFounderWagesTitle")}</h2>
      <p className="text-sm leading-relaxed text-white/70">{t("commonPages.obFounderWagesDesc")}</p>
      <div className="space-y-3 border border-white/15 p-4 text-sm text-white/70">
        <p>{t("commonPages.boardSignupManagement", "Management: the Club Board proposes a separate 12-week paid agreement. Review, negotiate, accept or decline it.")}</p>
        <p>{t("commonPages.boardSignupPlayer", "Playing for your club: your player agreement is separate and uses the same Card Level salary limits as every player.")}</p>
        <p>{t("commonPages.boardSignupOwnership", "Creating the club gives you management access. Declining a paid offer does not remove your ownership or access.")}</p>
      </div>
      <button type="button" onClick={() => onComplete?.({})} className="w-full border border-white/20 bg-white py-3 text-sm font-black uppercase tracking-widest text-[#0d2461] hover:bg-white/90">
        {t("commonPages.obContinueClub")}
      </button>
    </div>
  );
}

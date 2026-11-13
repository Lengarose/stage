import { Building2, CheckCircle } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

// Internal name retained for compatibility with the existing onboarding flow.
// Ownership is established by createFounder, never by accepting paid terms here.
export default function PresidentContractSetup({ club, player, user, founderState, onComplete }) {
  const { t } = useTranslation();
  const offers = Array.isArray(founderState?.boardOffers) ? founderState.boardOffers : [];
  return (
    <div className="space-y-4">
      <Building2 className="h-8 w-8 text-blue-200" />
      <h2 className="text-xl font-black uppercase tracking-wide text-white">{t("commonPages.obPresidentContractTitle")}</h2>
      <p className="text-sm text-white/60">{t("commonPages.obPresidentContractDesc")}</p>
      <div className="border border-white/15 p-4">
        <p className="font-black text-white">{club?.name}</p>
        <p className="mt-1 text-sm text-white/65">{player?.gamertag || user?.email} · {t("commonPages.boardSignupManager", "Manager")}</p>
      </div>
      <div className="space-y-3 border border-white/15 p-4 text-sm text-white/70">
        <p>{t("commonPages.obPresidentContractRole")}</p>
        <p>{t("commonPages.obPresidentContractDuration")}</p>
        <p>{t("commonPages.obPresidentContractSalary")}</p>
        {offers.map(offer => <p key={offer.id} className="border-t border-white/10 pt-2">
          {offer.kind === "management" ? t("commonPages.boardSignupManagementOffer", "Management offer") : t("commonPages.boardSignupPlayerOffer", "Player offer")}: {Number(offer.weekly_salary_stc).toLocaleString()} STC / {t("commonPages.boardSignupWeek", "week")} · {t("commonPages.boardSignupPending", "Awaiting your response in Inbox")}
        </p>)}
        <p>{t("commonPages.obPresidentContractNote")}</p>
      </div>
      <button type="button" onClick={() => onComplete?.()} className="flex w-full items-center justify-center gap-2 border border-white/20 bg-white py-3 text-xs font-black uppercase tracking-widest text-[#0d2461] hover:bg-white/90">
        <CheckCircle className="h-4 w-4" /> {t("commonPages.obSignPresidentContract")}
      </button>
    </div>
  );
}

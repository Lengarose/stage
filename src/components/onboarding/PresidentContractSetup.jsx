import { useState } from "react";
import { Building2, CheckCircle, FileText, Loader2 } from "lucide-react";
import { stageClient } from "@/api/stageClient";
import { getContractType } from "@/lib/playerContractFields";
import { useTranslation } from "@/hooks/useTranslation";

function resolvePresidentContract(founderState) {
  if (!founderState || typeof founderState !== "object") return null;
  if (getContractType(founderState.presidentContract) === "ownership") {
    return founderState.presidentContract;
  }
  const fromList = Array.isArray(founderState.contracts)
    ? founderState.contracts.find((contract) => getContractType(contract) === "ownership")
    : null;
  return fromList || null;
}

export default function PresidentContractSetup({
  club,
  player,
  user,
  founderState,
  playerContract = null,
  onComplete,
}) {
  const { t } = useTranslation();
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState(null);
  const presidentContract = resolvePresidentContract(founderState);
  const presidentName = player?.gamertag || user?.email || t("commonPages.cdPresident");

  async function ensurePresidentContract() {
    if (presidentContract?.id) return presidentContract;
    if (!player?.id || !club?.name) return null;
    const refreshed = await stageClient.clubs.createFounder({
      player_id: player.id,
      idempotency_key: `${user?.id || user?.email || "user"}:${player.id}:${String(club.name).trim().toLowerCase()}`,
      club: {
        name: club.name,
        tag: club.tag,
        platform: club.platform,
        region: club.region,
        country_code: club.country_code,
        owner_email: user?.email || club.owner_email,
        logo_url: club.logo_url || null,
      },
      playerContract: playerContract || undefined,
    });
    return resolvePresidentContract(refreshed);
  }

  async function handleSign() {
    setSigning(true);
    setError(null);
    try {
      const contract = await ensurePresidentContract();
      const status = String(contract?.status || "").toLowerCase();
      if (contract?.id && (status === "pending" || status === "negotiating" || status === "pending_window")) {
        await stageClient.functions.invoke("contractManagement", {
          action: "accept",
          contract_id: contract.id,
        });
      }
      onComplete?.();
    } catch (err) {
      setError(err?.message || t("commonPages.obErrPresidentContract"));
      setSigning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-black uppercase tracking-wide text-white mb-1">
          {t("commonPages.obPresidentContractTitle")}
        </h2>
        <p className="text-white/40 text-xs">{t("commonPages.obPresidentContractDesc")}</p>
      </div>

      <div className="rounded-xl border border-blue-400/25 bg-blue-500/10 p-4">
        <p className="text-[10px] uppercase tracking-widest text-blue-300 font-bold mb-1">
          {t("commonPages.cdPresident")}
        </p>
        <p className="text-lg font-black text-white">{presidentName}</p>
        <p className="text-sm text-white/55 mt-1">{club?.name || t("commonPages.obCreateYourClub")}</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2 text-sm text-white/70">
        <p className="flex items-center gap-2 font-semibold text-white">
          <FileText className="w-4 h-4 text-blue-300" /> {t("commonPages.obPresidentContractTerms")}
        </p>
        <p>{t("commonPages.obPresidentContractRole")}</p>
        <p>{t("commonPages.obPresidentContractDuration")}</p>
        <p>{t("commonPages.obPresidentContractSalary")}</p>
        <p className="text-white/45 text-xs pt-1">{t("commonPages.obPresidentContractNote")}</p>
      </div>

      {error && (
        <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSign}
        disabled={signing}
        className="w-full bg-white text-[#0d2461] font-black uppercase tracking-widest text-xs py-3 rounded-xl hover:bg-gray-100 disabled:opacity-40 transition-all shadow-lg flex items-center justify-center gap-2"
      >
        {signing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        {signing ? t("commonPages.obSigning") : t("commonPages.obSignPresidentContract")}
      </button>

      <p className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-widest text-white/30">
        <Building2 className="w-3 h-3" /> {t("commonPages.obPresidentContractLocked")}
      </p>
    </div>
  );
}

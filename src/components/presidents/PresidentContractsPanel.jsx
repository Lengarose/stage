import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, User } from "lucide-react";
import { stageClient } from "@/api/stageClient";
import ContractCard from "@/components/contracts/ContractCard";
import { CONTRACT_TYPES } from "@/lib/contractTypes";
import { getContractTargetPlayerId, getContractType, normalizePlayerContracts } from "@/lib/playerContractFields";
import { asObjectArray } from "@/lib/safeData";
import { useTranslation } from "@/hooks/useTranslation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const OFFER_TABS = [
  { id: "sent", key: "presOfferSent", statuses: ["pending", "pending_window"] },
  { id: "accepted", key: "presOfferAccepted", statuses: ["active"] },
  { id: "declined", key: "presOfferDeclined", statuses: ["rejected"] },
  { id: "negotiable", key: "presOfferNegotiable", statuses: ["negotiating"] },
];

const SIGNED_STATUSES = ["active"];

function SignedPlayerRow({ contract, player }) {
  const contractType = getContractType(contract);
  const meta = CONTRACT_TYPES[contractType] || CONTRACT_TYPES.squad;
  const name = player?.gamertag || "—";

  return (
    <Link
      to={player?.id ? `/players/${player.id}` : "#"}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors",
        meta.bg,
        meta.border,
        "hover:border-amber-300/35"
      )}
    >
      <span className="w-10 h-10 rounded-full border border-white/15 bg-white/5 overflow-hidden shrink-0 flex items-center justify-center">
        {player?.avatar_url ? (
          <span
            className="w-full h-full block"
            style={{
              backgroundImage: `url(${player.avatar_url})`,
              backgroundSize: "cover",
              backgroundPosition: player.avatar_position || "50% 50%",
            }}
            aria-hidden
          />
        ) : (
          <User className="w-4 h-4 text-white/40" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white truncate">{name}</p>
        <p className="text-xs text-white/45 mt-0.5 truncate">
          {[player?.position, player?.platform].filter(Boolean).join(" · ") || meta.label}
        </p>
      </div>
      <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider shrink-0", meta.badge)}>
        {meta.label}
      </span>
    </Link>
  );
}

export default function PresidentContractsPanel({ clubId, showOfferStatuses = false }) {
  const { t } = useTranslation();
  const [contracts, setContracts] = useState([]);
  const [playerMap, setPlayerMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState("sent");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!clubId) {
        setContracts([]);
        setPlayerMap({});
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const rows = normalizePlayerContracts(
          asObjectArray(await stageClient.entities.PlayerContract.filter({ team_id: clubId }).catch(() => []))
        );
        if (cancelled) return;
        setContracts(rows);

        const ids = [...new Set(rows.map(getContractTargetPlayerId).filter(Boolean))];
        const players = await Promise.all(
          ids.map((pid) => stageClient.entities.Player.get(pid).catch(() => null))
        );
        if (cancelled) return;
        const map = {};
        players.filter(Boolean).forEach((p) => { map[p.id] = p; });
        setPlayerMap(map);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [clubId]);

  if (!clubId) {
    return (
      <p className="text-sm text-white/45 py-6 text-center">
        {showOfferStatuses ? t("commonPages.presNoContracts") : t("commonPages.presNoSignedPlayers")}
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-white/40" />
      </div>
    );
  }

  if (!showOfferStatuses) {
    const signed = contracts.filter((c) => SIGNED_STATUSES.includes(c.status));
    if (signed.length === 0) {
      return (
        <p className="text-sm text-white/45 py-6 text-center">{t("commonPages.presNoSignedPlayers")}</p>
      );
    }
    return (
      <div className="space-y-2">
        {signed.map((contract) => (
          <SignedPlayerRow
            key={contract.id}
            contract={contract}
            player={playerMap[getContractTargetPlayerId(contract)]}
          />
        ))}
      </div>
    );
  }

  return (
    <Tabs value={subTab} onValueChange={setSubTab} className="space-y-3">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
        {OFFER_TABS.map((tab) => {
          const count = contracts.filter((c) => tab.statuses.includes(c.status)).length;
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={cn(
                "rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white/55 data-[state=active]:border-amber-300/35 data-[state=active]:bg-amber-300/10 data-[state=active]:text-amber-100"
              )}
            >
              {t(`commonPages.${tab.key}`)}
              {count > 0 ? (
                <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">{count}</span>
              ) : null}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {OFFER_TABS.map((tab) => {
        const list = contracts.filter((c) => tab.statuses.includes(c.status));
        return (
          <TabsContent key={tab.id} value={tab.id} className="mt-0 space-y-2">
            {list.length === 0 ? (
              <p className="text-sm text-white/45 py-6 text-center">{t("commonPages.presNoContracts")}</p>
            ) : (
              list.map((contract) => (
                <ContractCard
                  key={contract.id}
                  contract={contract}
                  player={playerMap[getContractTargetPlayerId(contract)]}
                  canManage={false}
                  isMyContract={false}
                  onAccept={() => {}}
                  onReject={() => {}}
                  onTerminate={() => {}}
                  onCancel={() => {}}
                  onRenew={null}
                  onNegotiate={null}
                />
              ))
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

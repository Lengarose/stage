import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { stageClient } from "@/api/stageClient";
import ContractCard from "@/components/contracts/ContractCard";
import { getContractTargetPlayerId, normalizePlayerContracts } from "@/lib/playerContractFields";
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

export default function PresidentContractsPanel({ clubId }) {
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
      <p className="text-sm text-white/45 py-6 text-center">{t("commonPages.presNoContracts")}</p>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-white/40" />
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

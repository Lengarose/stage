import { useState, useEffect } from "react";
import { resolveMyPlayerAndClub } from "@/api/stageClient";
import STCWallet from "@/components/lifestyle/STCWallet";
import { Wallet as WalletIcon } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export default function Wallet() {
  const { t } = useTranslation();
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    resolveMyPlayerAndClub()
      .then(({ player: p }) => { setPlayer(p); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#f5c542] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#00e5ff]">
            {t("matchFlow.kickoff")}
          </p>
          <h1
            className="font-heading text-4xl font-black uppercase leading-none tracking-tight text-foreground md:text-5xl"
            style={{ letterSpacing: "0.04em" }}
          >
            {t("commonPages.walletTitle")}
          </h1>
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            {t("commonPages.walletSubtitle")}
          </p>
        </div>
        <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-[#f5c542]/35 bg-[#f5c542]/10 sm:flex">
          <WalletIcon className="h-5 w-5 text-[#f5c542]" />
        </div>
      </div>
      <STCWallet player={player} compact={false} />
    </div>
  );
}

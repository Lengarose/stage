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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-2">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <WalletIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-heading font-black text-2xl uppercase tracking-tight text-foreground">{t("commonPages.walletTitle")}</h1>
          <p className="text-xs text-muted-foreground">{t("commonPages.walletSubtitle")}</p>
        </div>
      </div>
      <STCWallet player={player} compact={false} />
    </div>
  );
}

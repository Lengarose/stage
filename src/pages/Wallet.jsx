import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import STCWallet from "@/components/lifestyle/STCWallet";
import { Wallet as WalletIcon } from "lucide-react";

export default function Wallet() {
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    stageClient.auth.me().then(u => {
      if (!u?.email) { setLoading(false); return; }
      stageClient.entities.Player.filter({ email: u.email }, null, 1)
        .then(rows => { setPlayer(rows[0] || null); setLoading(false); })
        .catch(() => setLoading(false));
    }).catch(() => setLoading(false));
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
          <h1 className="font-heading font-black text-2xl uppercase tracking-tight text-foreground">STC Wallet</h1>
          <p className="text-xs text-muted-foreground">Your full transaction history and income sources</p>
        </div>
      </div>
      <STCWallet player={player} compact={false} />
    </div>
  );
}

import { useEffect, useState } from "react";
import { stageClient } from "@/api/stageClient";
import { GamerSectionCard } from "@/components/profile/gamer/GamerProfileUI";
import { formatMercatoDate, formatMercatoFee } from "@/lib/mercato";

export default function PlayerTransferHistory({ playerId }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!playerId) return undefined;
    let alive = true;
    stageClient.http.get(`/mercato-transfers/players/${playerId}`)
      .then((data) => { if (alive) setRows(Array.isArray(data) ? data : []); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [playerId]);

  if (!playerId || rows.length === 0) return null;

  return (
    <GamerSectionCard title="Transfer History">
      <ol className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {row.from_club_name || "Academy / Free"} → {row.to_club_name || "Unknown"}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-white/40">
                {(row.transfer_date || row.published_at || "").slice(0, 4) || formatMercatoDate(row.last_updated_at)} · {row.deal_type_label || row.deal_type}
              </p>
            </div>
            <span className="shrink-0 text-sm font-black text-cyan-300">{formatMercatoFee(row.transfer_fee, row.currency)}</span>
          </li>
        ))}
      </ol>
    </GamerSectionCard>
  );
}

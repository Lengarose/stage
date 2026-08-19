import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRightLeft } from "lucide-react";
import { stageClient } from "@/api/stageClient";
import { formatMercatoDate, formatMercatoFee } from "@/lib/mercato";
import { CareerTile, CareerTileBackgroundDialog } from "@/components/profile/PlayerCareerSummary";

function TransferClubMini({ id, name, fallback = "Academy" }) {
  const label = name || fallback;
  const content = (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden border border-cyan-200/20 bg-black/35"
        style={{ clipPath: "polygon(14% 0, 100% 0, 86% 100%, 0 100%)" }}
      >
        <span className="font-heading text-[10px] font-black text-[#f5c542]">{String(label).slice(0, 2).toUpperCase()}</span>
      </span>
      <span className="truncate text-xs font-black uppercase text-white">{label}</span>
    </span>
  );
  return id ? <Link to={`/clubs/${id}`} className="min-w-0 hover:text-cyan-200">{content}</Link> : content;
}

export default function PlayerTransferHistory({
  playerId,
  player,
  canCustomize = false,
  canUseCareerTileBackgrounds = false,
  onPlayerChanged,
}) {
  const [rows, setRows] = useState([]);
  const [activeBackground, setActiveBackground] = useState(null);

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
    <>
      <CareerTile
        tileKey="transfers"
        title="Transfer History"
        eyebrow="Movement"
        player={player}
        canCustomize={canCustomize}
        canUseBackgrounds={canUseCareerTileBackgrounds}
        onChangeBackground={setActiveBackground}
      >
        <ol className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="grid gap-3 border border-white/10 bg-white/[0.025] px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] sm:items-center">
              <TransferClubMini id={row.from_club_id} name={row.from_club_name} fallback="Academy" />
              <ArrowRightLeft className="h-4 w-4 text-cyan-300/65" />
              <TransferClubMini id={row.to_club_id} name={row.to_club_name} fallback="Unknown" />
              <div className="min-w-0 sm:text-right">
                <p className="font-heading text-sm font-black text-[#f5c542]">{formatMercatoFee(row.transfer_fee, row.currency)}</p>
                <p className="text-[10px] uppercase tracking-widest text-white/40">
                  {(row.transfer_date || row.published_at || "").slice(0, 4) || formatMercatoDate(row.last_updated_at)} · {row.deal_type_label || row.deal_type}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </CareerTile>
      <CareerTileBackgroundDialog
        player={player}
        tileKey={activeBackground}
        open={Boolean(activeBackground)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setActiveBackground(null);
        }}
        canUseBackgrounds={canUseCareerTileBackgrounds}
        onPlayerChanged={onPlayerChanged}
      />
    </>
  );
}

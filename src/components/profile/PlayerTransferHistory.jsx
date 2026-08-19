import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRightLeft, Clock3 } from "lucide-react";
import { stageClient } from "@/api/stageClient";
import { formatMercatoDate, formatMercatoFee } from "@/lib/mercato";
import { CareerTile, CareerTileBackgroundDialog } from "@/components/profile/PlayerCareerSummary";

function TransferClubMini({ id, name, fallback = "Academy" }) {
  const label = name || fallback;
  const content = (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden border border-cyan-200/20 bg-black/35"
        style={{ clipPath: "polygon(14% 0, 100% 0, 86% 100%, 0 100%)" }}
      >
        <span className="font-heading text-[10px] font-black text-[#f5c542]">{String(label).slice(0, 2).toUpperCase()}</span>
      </span>
      <span className="min-w-0 truncate text-xs font-black uppercase text-white">{label}</span>
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

  if (!playerId) return null;

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
        {rows.length ? (
          <ol className="max-h-[390px] space-y-2 overflow-y-auto pr-1">
            {rows.map((row) => (
              <li key={row.id} className="min-w-0 border border-white/10 bg-white/[0.025] px-3 py-3">
                <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                  <TransferClubMini id={row.from_club_id} name={row.from_club_name} fallback="Academy" />
                  <ArrowRightLeft className="h-4 w-4 justify-self-start text-cyan-300/65 sm:justify-self-center" />
                  <TransferClubMini id={row.to_club_id} name={row.to_club_name} fallback="Unknown" />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2">
                  <p className="font-heading text-xs font-black uppercase text-[#f5c542]">{formatMercatoFee(row.transfer_fee, row.currency)}</p>
                  <p className="min-w-0 break-words text-[10px] uppercase tracking-widest text-white/40">
                    {(row.transfer_date || row.published_at || "").slice(0, 4) || formatMercatoDate(row.last_updated_at)} · {row.deal_type_label || row.deal_type || "Transfer"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="flex min-h-[150px] items-center gap-3 border border-white/10 bg-white/[0.025] px-4 py-5 text-white/42">
            <Clock3 className="h-5 w-5 shrink-0 text-cyan-200/45" />
            <div className="min-w-0">
              <p className="font-heading text-sm font-black uppercase text-white/70">No transfer history yet</p>
              <p className="mt-1 text-sm leading-relaxed text-white/42">Transfers will appear here once this player moves clubs.</p>
            </div>
          </div>
        )}
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

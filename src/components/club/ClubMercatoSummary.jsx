import { useEffect, useState } from "react";
import { stageClient } from "@/api/stageClient";
import { formatMercatoFee, formatSignedBalance } from "@/lib/mercato";

function Line({ row, inbound }) {
  const other = inbound ? row.from_club_name || "Free agency" : row.to_club_name || "Unknown";
  return (
    <li className="flex items-center justify-between gap-3 border-b border-white/10 py-2 text-sm">
      <span className="truncate text-white">{row.player_name || "Player"} <span className="text-white/40">{inbound ? "from" : "to"} {other}</span></span>
      <strong className="shrink-0 text-cyan-300">{formatMercatoFee(row.transfer_fee, row.currency)}</strong>
    </li>
  );
}

export default function ClubMercatoSummary({ clubId }) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!clubId) return undefined;
    let alive = true;
    stageClient.http.get(`/mercato-transfers/clubs/${clubId}`)
      .then((data) => { if (alive) setSummary(data); })
      .catch(() => { if (alive) setSummary(null); });
    return () => { alive = false; };
  }, [clubId]);

  if (!summary) return null;

  return (
    <section className="mb-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Club Mercato</p>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div className="rounded-lg border border-white/10 p-3"><p className="text-[10px] uppercase tracking-widest text-white/40">Spent</p><p className="text-lg font-black text-rose-300">{formatMercatoFee(summary.spent)}</p></div>
        <div className="rounded-lg border border-white/10 p-3"><p className="text-[10px] uppercase tracking-widest text-white/40">Received</p><p className="text-lg font-black text-emerald-300">{formatMercatoFee(summary.received)}</p></div>
        <div className="rounded-lg border border-white/10 p-3"><p className="text-[10px] uppercase tracking-widest text-white/40">Balance</p><p className="text-lg font-black text-white">{formatSignedBalance(summary.balance)}</p></div>
        <div className="rounded-lg border border-white/10 p-3"><p className="text-[10px] uppercase tracking-widest text-white/40">In</p><p className="text-lg font-black text-white">{summary.players_in || 0}</p></div>
        <div className="rounded-lg border border-white/10 p-3"><p className="text-[10px] uppercase tracking-widest text-white/40">Out</p><p className="text-lg font-black text-white">{summary.players_out || 0}</p></div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Transfers In</p>
          <ul>{(summary.transfers_in || []).length ? summary.transfers_in.map((row) => <Line key={row.id} row={row} inbound />) : <li className="text-xs text-white/40">No arrivals yet.</li>}</ul>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Transfers Out</p>
          <ul>{(summary.transfers_out || []).length ? summary.transfers_out.map((row) => <Line key={row.id} row={row} inbound={false} />) : <li className="text-xs text-white/40">No departures yet.</li>}</ul>
        </div>
      </div>
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import {
  MERCATO_FILTERS,
  MERCATO_PRICE_BANDS,
  formatDeadlineCountdown,
  formatMercatoClock,
  formatMercatoDate,
  formatMercatoFee,
  mercatoStatusLabel,
} from "@/lib/mercato";

function ClubMark({ name, logo, side }) {
  return (
    <div className={`mercato-club mercato-club--${side}`}>
      {logo ? <img src={logo} alt="" /> : <span className="mercato-club-fallback">{(name || "?").slice(0, 2)}</span>}
      <strong>{name || (side === "from" ? "Free agent" : "Unknown")}</strong>
      <em>{side === "from" ? "FROM" : "TO"}</em>
    </div>
  );
}

export function MercatoTransferCard({ transfer, selected, onSelect }) {
  if (!transfer) return null;
  return (
    <button type="button" className={`mercato-card${selected ? " is-selected" : ""}`} onClick={() => onSelect?.(transfer)}>
      <span className={`mercato-stamp mercato-stamp--${transfer.status}`}>{transfer.status_label || mercatoStatusLabel(transfer.status)}</span>
      <div className="mercato-card-player">
        {transfer.player_avatar_url ? <img src={transfer.player_avatar_url} alt="" /> : <span className="mercato-avatar-fallback" />}
        <div>
          <p className="mercato-kicker">{transfer.deal_type_label || transfer.deal_type}</p>
          <h3>{transfer.player_name || "Player"}</h3>
          <p>{[transfer.player_position, transfer.player_nationality].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <div className="mercato-card-route">
        <ClubMark name={transfer.from_club_name} logo={transfer.from_club_logo_url} side="from" />
        <span className="mercato-arrow" aria-hidden>→</span>
        <ClubMark name={transfer.to_club_name} logo={transfer.to_club_logo_url} side="to" />
      </div>
      <dl className="mercato-card-meta">
        <div><dt>Transfer Fee</dt><dd>{formatMercatoFee(transfer.transfer_fee, transfer.currency)}</dd></div>
        <div><dt>Contract</dt><dd>{transfer.contract_years ? `${transfer.contract_years} years` : "—"}</dd></div>
        <div><dt>Date</dt><dd>{formatMercatoDate(transfer.transfer_date || transfer.last_updated_at)}</dd></div>
      </dl>
    </button>
  );
}

function TransferDetail({ transfer }) {
  if (!transfer) {
    return <p className="mercato-empty-detail">Select a deal from the live tape.</p>;
  }
  return (
    <article className="mercato-detail">
      <p className={`mercato-stamp mercato-stamp--${transfer.status}`}>{transfer.status_label || mercatoStatusLabel(transfer.status)}</p>
      <h2>{transfer.headline}</h2>
      <p className="mercato-detail-body">{transfer.body}</p>
      <div className="mercato-card-route">
        <ClubMark name={transfer.from_club_name} logo={transfer.from_club_logo_url} side="from" />
        <span className="mercato-arrow" aria-hidden>→</span>
        <ClubMark name={transfer.to_club_name} logo={transfer.to_club_logo_url} side="to" />
      </div>
      <dl className="mercato-detail-grid">
        <div><dt>Fee</dt><dd>{formatMercatoFee(transfer.transfer_fee, transfer.currency)}</dd></div>
        {Number(transfer.add_ons_amount) > 0 ? <div><dt>Add-ons</dt><dd>{formatMercatoFee(transfer.add_ons_amount, transfer.currency)}</dd></div> : null}
        {Number(transfer.sell_on_clause) > 0 ? <div><dt>Sell-on</dt><dd>{transfer.sell_on_clause}%</dd></div> : null}
        {Number(transfer.release_clause) > 0 ? <div><dt>Release clause</dt><dd>{formatMercatoFee(transfer.release_clause, transfer.currency)}</dd></div> : null}
        <div><dt>Contract</dt><dd>{transfer.contract_years ? `${transfer.contract_years} years` : "—"}</dd></div>
        <div><dt>Wage</dt><dd>{Number(transfer.weekly_salary_stc) > 0 ? `${formatMercatoFee(transfer.weekly_salary_stc, transfer.currency)}${transfer.salary_is_estimate ? " (est.)" : ""}` : "Private"}</dd></div>
        <div><dt>Source</dt><dd>{transfer.journalist_name || transfer.source_name || "STAGE desk"}</dd></div>
        <div><dt>Reliability</dt><dd>{String(transfer.reliability || "medium").toUpperCase()}</dd></div>
      </dl>
      {Array.isArray(transfer.events) && transfer.events.length > 0 ? (
        <ol className="mercato-timeline">
          {transfer.events.map((event) => (
            <li key={event.id}>
              <span>{formatMercatoDate(event.created_at)}</span>
              <strong>{mercatoStatusLabel(event.status)}</strong>
              <p>{event.title || event.body}</p>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="mercato-detail-links">
        {transfer.player_id ? <Link to={`/players/${transfer.player_id}`}>Player file</Link> : null}
        {transfer.to_club_id ? <Link to={`/clubs/${transfer.to_club_id}`}>Buying club</Link> : null}
        {transfer.from_club_id ? <Link to={`/clubs/${transfer.from_club_id}`}>Selling club</Link> : null}
      </div>
    </article>
  );
}

export default function MercatoDesk({ initialTransferId = "" }) {
  const [desk, setDesk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [priceBand, setPriceBand] = useState("any");
  const [selectedId, setSelectedId] = useState(initialTransferId);
  const [selected, setSelected] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let alive = true;
    stageClient.http.get("/mercato-transfers/desk")
      .then((data) => { if (alive) setDesk(data); })
      .catch(() => { if (alive) setDesk({ feed: [], top: {}, rankings: {}, deadline: { active: false } }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!desk?.deadline?.active) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [desk?.deadline?.active]);

  const band = MERCATO_PRICE_BANDS.find((item) => item.id === priceBand) || MERCATO_PRICE_BANDS[0];
  const feed = useMemo(() => {
    const rows = Array.isArray(desk?.feed) ? desk.feed : [];
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "all") {
        const groups = {
          official: ["official", "signed"],
          rumours: ["rumour", "reported"],
          negotiations: ["negotiation", "agreement_close", "agreement", "medical"],
          completed: ["official", "signed"],
          failed: ["failed"],
        };
        if (groups[filter] && !groups[filter].includes(row.status)) return false;
        if (filter === "loans" && !String(row.deal_type || "").includes("loan")) return false;
        if (filter === "free_agents" && row.deal_type !== "free" && row.from_club_id) return false;
        if (filter === "contract_extensions" && row.deal_type !== "extension") return false;
      }
      if (q) {
        const hay = `${row.player_name || ""} ${row.from_club_name || ""} ${row.to_club_name || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const fee = Number(row.transfer_fee || 0);
      if (band.min && fee < band.min) return false;
      if (band.max && fee > band.max) return false;
      return true;
    });
  }, [desk, filter, query, band]);

  const firstId = feed[0]?.id;
  useEffect(() => {
    const id = selectedId || firstId;
    if (!id) {
      setSelected(null);
      return undefined;
    }
    let alive = true;
    stageClient.http.get(`/mercato-transfers/${id}`)
      .then((row) => { if (alive) setSelected(row); })
      .catch(() => { if (alive) setSelected(null); });
    return () => { alive = false; };
  }, [selectedId, firstId]);

  const remaining = desk?.deadline?.active
    ? Math.max(0, new Date(desk.deadline.ends_at).getTime() - now)
    : 0;

  if (loading) {
    return <div className="mercato-desk"><p className="mercato-loading">Opening the transfer tape…</p></div>;
  }

  const rankings = desk?.rankings || {};
  const top = desk?.top || {};

  return (
    <div className={`mercato-desk${desk?.deadline?.active ? " mercato-desk--deadline" : ""}`}>
      {desk?.deadline?.active ? (
        <div className="mercato-deadline">
          <span>DEADLINE DAY</span>
          <strong>{formatDeadlineCountdown(remaining)}</strong>
          <em>Window closes {formatMercatoClock(desk.deadline.ends_at)}</em>
        </div>
      ) : (
        <div className="mercato-window-line">
          Transfer Live · {desk?.window?.label || "No window labelled"} · {String(desk?.window_kind || "custom").toUpperCase()}
        </div>
      )}

      <div className="mercato-filters">
        {MERCATO_FILTERS.map((item) => (
          <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>
        ))}
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Club, player, nation…" />
        <select value={priceBand} onChange={(event) => setPriceBand(event.target.value)}>
          {MERCATO_PRICE_BANDS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </div>

      <div className="mercato-layout">
        <section className="mercato-tape" aria-label="Transfer live">
          <h2>Transfer Live</h2>
          {feed.length === 0 ? <p className="mercato-empty-detail">No deals on this tape yet.</p> : null}
          <ol>
            {feed.map((row) => (
              <li key={row.id}>
                <button type="button" className={row.id === (selected?.id || selectedId) ? "is-active" : ""} onClick={() => setSelectedId(row.id)}>
                  <time>{formatMercatoClock(row.last_updated_at || row.published_at)}</time>
                  <span className={`mercato-stamp mercato-stamp--${row.status}`}>{row.status_label || mercatoStatusLabel(row.status)}</span>
                  <p>{row.headline}</p>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section className="mercato-stage">
          <MercatoTransferCard transfer={selected || feed[0]} selected onSelect={(row) => setSelectedId(row.id)} />
          <TransferDetail transfer={selected} />
        </section>

        <aside className="mercato-board">
          <h2>Top Transfers</h2>
          {(top.biggest || []).slice(0, 5).map((row) => (
            <button key={`top-${row.id}`} type="button" onClick={() => setSelectedId(row.id)}>
              <strong>{row.player_name}</strong>
              <span>{formatMercatoFee(row.transfer_fee, row.currency)}</span>
            </button>
          ))}
          <h2>Spending</h2>
          {(rankings.clubs_spending || []).slice(0, 5).map((row) => (
            <p key={`spend-${row.club_id}`}><strong>{row.club_name}</strong> {formatMercatoFee(row.total)}</p>
          ))}
          <h2>Sales</h2>
          {(rankings.clubs_sales || []).slice(0, 5).map((row) => (
            <p key={`sale-${row.club_id}`}><strong>{row.club_name}</strong> {formatMercatoFee(row.total)}</p>
          ))}
        </aside>
      </div>
    </div>
  );
}

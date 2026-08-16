import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import { DESK_FILTERS, filterDeskFeed, formatDeskAmount, formatDeskClock } from "@/lib/newsDesks";

function Mark({ name, image }) {
  return (
    <div className="news-desk-mark">
      {image ? <img src={image} alt="" /> : <span>{(name || "?").slice(0, 2)}</span>}
      <strong>{name || "STAGE"}</strong>
    </div>
  );
}

export function StoryCard({ story, selected, onSelect }) {
  if (!story) return null;
  return (
    <button type="button" className={`mercato-card${selected ? " is-selected" : ""}`} onClick={() => onSelect?.(story)}>
      <span className={`mercato-stamp mercato-stamp--${story.kind}`}>{story.stamp}</span>
      <div className="mercato-card-player">
        <Mark
          name={story.player_name || story.club_name || story.tournament_name}
          image={story.player_avatar_url || story.club_logo_url || story.photo_url}
        />
      </div>
      <h3>{story.title}</h3>
      <p className="news-desk-excerpt">{story.body}</p>
      <dl className="mercato-card-meta">
        {story.club_name ? <div><dt>Club</dt><dd>{story.club_name}</dd></div> : null}
        {story.player_name ? <div><dt>Player</dt><dd>{story.player_name}</dd></div> : null}
        {formatDeskAmount(story.amount_stc) ? <div><dt>Amount</dt><dd>{formatDeskAmount(story.amount_stc)}</dd></div> : null}
        {story.tournament_name ? <div><dt>Competition</dt><dd>{story.tournament_name}</dd></div> : null}
      </dl>
    </button>
  );
}

function FieldCard({ field, selected, onSelect }) {
  if (!field) return null;
  return (
    <button type="button" className={`mercato-card news-desk-field${selected ? " is-selected" : ""}`} onClick={() => onSelect?.(field)}>
      <span className={`mercato-stamp mercato-stamp--${field.current_phase}`}>{field.stamp}</span>
      <h3>{field.name}</h3>
      <p className="news-desk-excerpt">
        {field.entry_count} {field.participant_type === "player" ? "players" : "clubs"}
        {field.country_count ? ` · ${field.country_count} countries` : ""}
        {field.trophy_name ? ` · Cup: ${field.trophy_name}` : ""}
      </p>
      {field.trophy_url ? <img className="news-desk-trophy" src={field.trophy_url} alt="" /> : null}
      <div className="news-desk-countries">
        {(field.countries || []).slice(0, 12).map((row) => (
          <span key={row.code}>{row.code}</span>
        ))}
      </div>
      {field.winner_name ? <p className="news-desk-winner">Champion: {field.winner_name}</p> : null}
    </button>
  );
}

export function StoryDetail({ story }) {
  if (!story) return <p className="mercato-empty-detail">Select a story from the live tape.</p>;
  return (
    <article className="mercato-detail">
      <p className={`mercato-stamp mercato-stamp--${story.kind}`}>{story.stamp}</p>
      <h2>{story.title}</h2>
      <p className="mercato-detail-body">{story.body}</p>
      {Array.isArray(story.quotes) && story.quotes.length > 0 ? (
        <ol className="mercato-timeline">
          {story.quotes.map((quote, index) => (
            <li key={quote.id || index}>
              <strong>{quote.question || "Quote"}</strong>
              <p>{quote.answer || quote.quote || quote}</p>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="mercato-detail-links">
        {story.player_id ? <Link to={`/players/${story.player_id}`}>Player file</Link> : null}
        {story.club_id ? <Link to={`/clubs/${story.club_id}`}>Club file</Link> : null}
        {story.transfer_id ? <Link to={`/news?section=mercato&transfer=${story.transfer_id}`}>Same transfer</Link> : null}
        {story.tournament_id ? <Link to={story.link || `/tournaments/${story.tournament_id}`}>Open competition</Link> : null}
        {story.link && !story.tournament_id && !story.club_id && !story.player_id ? <Link to={story.link}>Open</Link> : null}
      </div>
    </article>
  );
}

function FieldDetail({ field }) {
  if (!field) return <p className="mercato-empty-detail">Select a cup from the tape.</p>;
  return (
    <article className="mercato-detail">
      <p className={`mercato-stamp mercato-stamp--${field.current_phase}`}>{field.stamp}</p>
      <h2>{field.name}</h2>
      <p className="mercato-detail-body">
        {field.entry_count} sides are in the field
        {field.country_count ? ` from ${field.country_count} countries` : ""}.
        {field.trophy_name ? ` The cup is ${field.trophy_name}.` : ""}
        {field.winner_name ? ` ${field.winner_name} won it.` : ` Current phase: ${field.current_phase_label}.`}
      </p>
      {field.trophy_url ? <img className="news-desk-trophy news-desk-trophy--large" src={field.trophy_url} alt="" /> : null}
      <div className="news-desk-countries">
        {(field.countries || []).map((row) => (
          <span key={row.code}>{row.code} · {row.count}</span>
        ))}
      </div>
      {(field.phases || []).map((phase) => (
        <section key={phase.key} className="news-desk-phase">
          <h3>{phase.stamp} · {phase.label}</h3>
          {phase.advancers.length ? <p>Through: {phase.advancers.join(", ")}</p> : null}
          <ul>
            {phase.matches.map((match) => (
              <li key={match.id}>
                {match.home} vs {match.away}
                {match.score ? ` ${match.score}` : ""}
                {match.winner ? ` — ${match.winner} advanced` : ""}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {field.link ? (
        <div className="mercato-detail-links">
          <Link to={field.link}>Open full bracket</Link>
        </div>
      ) : null}
    </article>
  );
}

function BoardList({ title, rows, onSelect, empty }) {
  return (
    <>
      <h2>{title}</h2>
      {(!rows || rows.length === 0) ? <p className="mercato-empty-detail">{empty}</p> : null}
      {(rows || []).map((row) => (
        <button key={row.id} type="button" onClick={() => onSelect(row)}>
          <strong>{row.title || row.name}</strong>
          <span>{row.stamp || row.club_name || row.player_name || row.winner_name || ""}</span>
        </button>
      ))}
    </>
  );
}

export default function NewsBeatDesk({ section }) {
  const [desk, setDesk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [selectedFieldId, setSelectedFieldId] = useState("");
  const isCompetition = section === "tournament" || section === "competitions";

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFilter("all");
    setQuery("");
    setSelectedId("");
    setSelectedFieldId("");
    stageClient.http.get(`/news-desks/${section}`)
      .then((data) => { if (alive) setDesk(data); })
      .catch(() => { if (alive) setDesk({ feed: [], fields: [], board: {}, kicker: "Desk", line: "" }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [section]);

  const filters = DESK_FILTERS[section] || DESK_FILTERS.daily_news;
  const feed = useMemo(() => filterDeskFeed(desk?.feed, { filter, query }), [desk, filter, query]);
  const fields = useMemo(() => {
    const rows = Array.isArray(desk?.fields) ? desk.fields : [];
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "champion" && !row.winner_name) return false;
      if (filter === "field" && String(row.status) === "completed") return false;
      if (filter === "phase" && !(row.phases || []).length) return false;
      if (q) {
        const hay = `${row.name || ""} ${(row.countries || []).map((item) => item.code).join(" ")} ${row.trophy_name || ""} ${row.winner_name || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [desk, filter, query]);

  const selectedStory = feed.find((row) => row.id === selectedId) || feed[0] || null;
  const selectedField = fields.find((row) => row.id === (selectedFieldId || selectedStory?.tournament_id)) || fields[0] || null;

  if (loading) {
    return <div className="mercato-desk news-desk"><p className="mercato-loading">Opening the desk…</p></div>;
  }

  return (
    <div className="mercato-desk news-desk">
      <div className="mercato-window-line">
        {desk?.kicker || "Desk"} · {desk?.line || "Live tape"}
      </div>
      <div className="mercato-filters">
        {filters.map((item) => (
          <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>
        ))}
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Club, player, country…" />
      </div>
      <div className="mercato-layout">
        <section className="mercato-tape" aria-label="Desk live tape">
          <h2>{isCompetition ? "Competition Live" : "Live tape"}</h2>
          {isCompetition && fields.length === 0 && feed.length === 0 ? <p className="mercato-empty-detail">No cups on this desk yet.</p> : null}
          {!isCompetition && feed.length === 0 ? (
            <p className="mercato-empty-detail">
              {section === "daily_news" ? "No news today." : "No stories on this desk yet."}
            </p>
          ) : null}
          {isCompetition ? (
            <ol>
              {fields.map((row) => (
                <li key={`field-${row.id}`}>
                  <button type="button" className={row.id === selectedField?.id ? "is-active" : ""} onClick={() => { setSelectedFieldId(row.id); setSelectedId(""); }}>
                    <span className={`mercato-stamp mercato-stamp--${row.current_phase}`}>{row.stamp}</span>
                    <p>{row.name}</p>
                  </button>
                </li>
              ))}
              {feed.map((row) => (
                <li key={row.id}>
                  <button type="button" className={row.id === selectedStory?.id ? "is-active" : ""} onClick={() => { setSelectedId(row.id); setSelectedFieldId(row.tournament_id || ""); }}>
                    <time>{formatDeskClock(row.published_at)}</time>
                    <span className={`mercato-stamp mercato-stamp--${row.kind}`}>{row.stamp}</span>
                    <p>{row.title}</p>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <ol>
              {feed.map((row) => (
                <li key={row.id}>
                  <button type="button" className={row.id === selectedStory?.id ? "is-active" : ""} onClick={() => setSelectedId(row.id)}>
                    <time>{formatDeskClock(row.published_at)}</time>
                    <span className={`mercato-stamp mercato-stamp--${row.kind}`}>{row.stamp}</span>
                    <p>{row.title}</p>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="mercato-stage">
          {isCompetition ? (
            <>
              <FieldCard field={selectedField} selected onSelect={(row) => setSelectedFieldId(row.id)} />
              {selectedStory && selectedStory.tournament_id === selectedField?.id ? <StoryCard story={selectedStory} selected /> : null}
              <FieldDetail field={selectedField} />
              {selectedStory ? <StoryDetail story={selectedStory} /> : null}
            </>
          ) : (
            <>
              <StoryCard story={selectedStory} selected onSelect={(row) => setSelectedId(row.id)} />
              <StoryDetail story={selectedStory} />
            </>
          )}
        </section>

        <aside className="mercato-board">
          {section === "club_news" ? (
            <>
              <BoardList title="Stadium" rows={desk?.board?.stadium} onSelect={(row) => setSelectedId(row.id)} empty="No stadium moves." />
              <BoardList title="Shirts" rows={desk?.board?.shirts} onSelect={(row) => setSelectedId(row.id)} empty="No shirt sales." />
              <BoardList title="Contracts issued" rows={desk?.board?.contracts} onSelect={(row) => setSelectedId(row.id)} empty="No club contracts." />
            </>
          ) : null}
          {section === "player_news" ? (
            <>
              <BoardList title="Rankings" rows={desk?.board?.rankings} onSelect={(row) => setSelectedId(row.id)} empty="No ranking bulletin." />
              <BoardList title="Lifestyle" rows={desk?.board?.lifestyle} onSelect={(row) => setSelectedId(row.id)} empty="No lifestyle buys." />
              <BoardList title="Signed" rows={desk?.board?.signed} onSelect={(row) => setSelectedId(row.id)} empty="No signatures." />
            </>
          ) : null}
          {section === "daily_news" ? (
            <>
              <BoardList title="Club" rows={desk?.board?.club} onSelect={(row) => setSelectedId(row.id)} empty="No club stories today." />
              <BoardList title="Player" rows={desk?.board?.player} onSelect={(row) => setSelectedId(row.id)} empty="No player stories today." />
              <BoardList title="Mercato" rows={desk?.board?.mercato} onSelect={(row) => setSelectedId(row.id)} empty="No deals today." />
            </>
          ) : null}
          {isCompetition ? (
            <>
              <BoardList title="Live" rows={desk?.board?.live} onSelect={(row) => setSelectedFieldId(row.id)} empty="No live cups." />
              <BoardList title="The field" rows={desk?.board?.field} onSelect={(row) => setSelectedFieldId(row.id)} empty="No open registrations." />
              <BoardList title="Champions" rows={desk?.board?.champions} onSelect={(row) => setSelectedFieldId(row.id)} empty="No champions yet." />
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { stageClient } from "@/api/stageClient";
import { continentIdFromIso, flagImageUrl, getCountryName } from "@/lib/allCountries";
import { filterDeskFeed, formatDeskClock } from "@/lib/newsDesks";
import WorldAtlas from "@/components/news/WorldAtlas";
import { StoryCard, StoryDetail } from "@/components/news/NewsBeatDesk";

function countryMatches(rowCode, selected) {
  const a = String(rowCode || "").toUpperCase();
  const b = String(selected || "").toUpperCase();
  if (!b) return true;
  if (a === b) return true;
  const uk = new Set(["GB", "UK", "ENG", "SCO", "WAL", "NIR"]);
  return uk.has(a) && uk.has(b);
}

function countryName(row) {
  const code = String(row.code || "").toUpperCase();
  return row.name || getCountryName(code) || code;
}

export default function WorldNewsDesk({ initialContinent = "", initialCountry = "" }) {
  const [desk, setDesk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [continent, setContinent] = useState(initialContinent);
  const [country, setCountry] = useState(initialCountry);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    let alive = true;
    stageClient.http.get("/news-desks/world_news")
      .then((data) => { if (alive) setDesk(data); })
      .catch(() => { if (alive) setDesk({ feed: [], continents: [], countries: [], kicker: "World News" }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const continents = Array.isArray(desk?.continents) ? desk.continents : [];
  const countries = useMemo(() => {
    const rows = Array.isArray(desk?.countries) ? desk.countries : [];
    return continent ? rows.filter((row) => row.continent === continent) : rows;
  }, [desk, continent]);

  const feed = useMemo(
    () => filterDeskFeed(
      (desk?.feed || []).filter((row) => {
        if (continent && row.continent !== continent) return false;
        if (country && !countryMatches(row.country_code, country)) return false;
        return true;
      }),
      { query },
    ),
    [desk, continent, country, query],
  );
  const selected = feed.find((row) => row.id === selectedId) || feed[0] || null;
  const active = continents.find((row) => row.id === continent);
  const activeCountry = countries.find((row) => row.code === country);

  const pickContinent = (id) => {
    setContinent(id);
    setCountry("");
    setSelectedId("");
  };

  const pickCountry = (code) => {
    const next = String(code || "").toUpperCase();
    const match = (desk?.countries || []).find((row) => row.code === next);
    setContinent(match?.continent || continentIdFromIso(next) || "");
    setCountry(next);
    setSelectedId("");
  };

  if (loading) {
    return <div className="mercato-desk news-desk"><p className="mercato-loading">Opening the world desk…</p></div>;
  }

  return (
    <div className="mercato-desk news-desk">
      <div className="mercato-window-line">
        {desk?.kicker || "World News"} · {activeCountry?.name || active?.name || "Geographic desk"}
        {continent ? (
          <button
            type="button"
            className="world-desk-back"
            onClick={() => { setContinent(""); setCountry(""); setSelectedId(""); }}
          >
            Whole world
          </button>
        ) : null}
      </div>

      <WorldAtlas
        continents={continents}
        countries={desk?.countries || []}
        selectedContinent={continent}
        selectedCountry={country}
        onSelectContinent={pickContinent}
        onSelectCountry={pickCountry}
      />

      {continent ? (
        <div className="world-country-flags" aria-label="Countries with clubs">
          {countries.length === 0 ? (
            <p className="world-atlas-hint">No clubs on this continent yet.</p>
          ) : countries.map((row) => {
            const selected = country === row.code;
            const name = countryName(row);
            const src = flagImageUrl(row.code, 80);
            return (
              <button
                key={row.code}
                type="button"
                aria-pressed={selected}
                aria-label={name}
                title={name}
                className={selected ? "is-active" : ""}
                onClick={() => {
                  if (selected) {
                    setCountry("");
                    setSelectedId("");
                    return;
                  }
                  pickCountry(row.code);
                }}
              >
                {src ? (
                  <img src={src} alt="" width={48} height={36} decoding="async" />
                ) : (
                  <span className="world-country-flags-code">{row.code}</span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="world-atlas-hint">Click a continent, then a flag. Every country on the map is also clickable.</p>
      )}

      {(continent || country) ? (
        <>
          <div className="mercato-filters">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Club, player, country…" />
          </div>
          <div className="mercato-layout">
            <section className="mercato-tape" aria-label="World tape">
              <h2>{activeCountry?.name || active?.name || "World"} Live</h2>
              {feed.length === 0 ? <p className="mercato-empty-detail">No news from this place yet.</p> : null}
              <ol>
                {feed.map((row) => (
                  <li key={row.id}>
                    <button type="button" className={row.id === selected?.id ? "is-active" : ""} onClick={() => setSelectedId(row.id)}>
                      <time>{formatDeskClock(row.published_at)}</time>
                      <span className={`mercato-stamp mercato-stamp--${row.kind}`}>{row.stamp}</span>
                      <p>{row.title}</p>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
            <section className="mercato-stage">
              <StoryCard story={selected} selected onSelect={(row) => setSelectedId(row.id)} />
              <StoryDetail story={selected} />
            </section>
            <aside className="mercato-board">
              <h2>{activeCountry ? "This country" : "This continent"}</h2>
              <p><strong>{activeCountry?.name || active?.name}</strong> {feed.length}</p>
              {(country
                ? feed.slice(0, 6)
                : (desk?.board?.[continent] || [])
              ).map((row) => (
                <button key={row.id} type="button" onClick={() => setSelectedId(row.id)}>
                  <strong>{row.title}</strong>
                  <span>{row.stamp}</span>
                </button>
              ))}
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}

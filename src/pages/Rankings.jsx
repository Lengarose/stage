import IdentityAvatar from "@/components/profile/IdentityAvatar";
import { useCardProgression } from "@/hooks/useCardProgression";
import { useTranslation } from "@/hooks/useTranslation";
import { stageClient } from "@/api/stageClient";
import { rankingsPresentation } from "@/lib/rankingsPresentation";
import { getCountryShortName } from "@/lib/countryDisplay";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./rankings.css";

const PAGE_SIZE = 25;

function formatNumber(value) {
  return Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(Number(value) || 0);
}

function placeLabel(rank) {
  if (rank === 1) return "Gold";
  if (rank === 2) return "Silver";
  if (rank === 3) return "Bronze";
  return "";
}

function playerStats(player, limited) {
  const position = String(player.position || "").toUpperCase();
  const stats = [{ key: "ranking_matches", label: "GP", title: "Games played in official ranking matches" }];
  const defensive = ["GK", "CB", "LCB", "RCB", "LB", "RB", "LWB", "RWB"].includes(position);
  const creative = ["CDM", "CM", "CAM", "LM", "RM"].includes(position);
  if (defensive) stats.push({ key: "ranking_clean_sheets", label: "CS", title: "Clean sheets", plus: true });
  if (creative) {
    stats.push({ key: "ranking_assists", label: "A", title: "Assists" });
    stats.push({ key: "ranking_goals", label: "G", title: "Goals" });
  } else {
    stats.push({ key: "ranking_goals", label: "G", title: "Goals" });
    stats.push({ key: "ranking_assists", label: "A", title: "Assists" });
  }
  if (!limited) stats.push({ key: "ranking_avg_rating", label: "Rating", title: "Average match rating. Not STAGE Card Level and not ranking points.", plus: true });
  return stats.filter((stat) => !limited || !stat.plus);
}

function clubStats(club, limited) {
  const stats = [
    { label: "GP", value: club.matches_ranked || 0, title: "Official ranking matches" },
    { label: "Record", value: `${club.wins || 0}W ${club.draws || 0}D ${club.losses || 0}L`, title: "Wins, draws and losses" },
  ];
  if (!limited) {
    const difference = Number(club.goals_scored || 0) - Number(club.goals_conceded || 0);
    stats.push({ label: "GD", value: difference > 0 ? `+${difference}` : difference, title: "Goal difference" });
    stats.push({ label: "Titles", value: club.competition_wins || 0, title: "Eligible official titles counted by the ranking" });
  }
  return stats;
}

function CardLevel({ playerId }) {
  const { card, error } = useCardProgression(playerId);
  const level = Number.isInteger(card?.level) ? card.level : null;
  return (
    <span className="rankings-level" title={error ? "Card Level is temporarily unavailable" : "STAGE Card Level from official match progression. Not ranking points or match rating."}>
      Card Lv {level ?? "—"}
    </span>
  );
}

function RankMark({ rank }) {
  const medal = placeLabel(rank);
  return (
    <span className="rankings-rank" data-place={medal ? rank : undefined}>
      {rank ?? "—"}
      {medal ? <small>{medal}</small> : null}
    </span>
  );
}

function ResultCaption({ board, kindLabel }) {
  if (!board) return null;
  if (board.result_kind === "preview") {
    return (
      <p className="rankings-note">
        Free preview: {board.displayed} of {board.total_ranked} ranked {kindLabel}. This is not the full board.
      </p>
    );
  }
  if (board.result_kind === "complete") {
    return (
      <p className="rankings-note">
        Complete results: {board.matching} of {board.total_ranked} ranked {kindLabel} match. Showing {board.displayed}.
      </p>
    );
  }
  return (
    <p className="rankings-note">
      Page {board.page} of {board.pages}. Showing {board.displayed} of {board.matching} matching {kindLabel}. {board.total_ranked} are ranked in total.
    </p>
  );
}

export default function Rankings() {
  const { t } = useTranslation();
  const dialogRef = useRef(null);
  const [view, setView] = useState("clubs");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [position, setPosition] = useState("");
  const [platform, setPlatform] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [board, setBoard] = useState(null);
  const [boardView, setBoardView] = useState(null);
  const [status, setStatus] = useState("loading");
  const [access, setAccess] = useState("unknown");
  const [presentation, setPresentation] = useState(() => rankingsPresentation());
  const [slideIndex, setSlideIndex] = useState(0);
  const [slideshowPaused, setSlideshowPaused] = useState(false);
  const [locateMessage, setLocateMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const fullAccess = access === "full";
  const kind = view === "clubs" ? "club" : "player";
  const kindLabel = view === "clubs" ? "clubs" : "players";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    stageClient.entities.RankingsPageConfig.filter({ key: "main" }, "-updated_date", 1)
      .then((rows) => { if (active) setPresentation(rankingsPresentation(rows?.[0] || {})); })
      .catch(() => { if (active) setPresentation(rankingsPresentation()); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    const query = { page, limit: PAGE_SIZE, q: search, region, country_code: country, platform };
    if (view === "positions" && position) query.position = position;
    stageClient.http.get(view === "clubs" ? "/rankings/clubs" : "/rankings/players", query)
      .then((data) => {
        if (!active) return;
        setBoard(data);
        setBoardView(view);
        setAccess(data?.full_access === true ? "full" : data?.access === "limited" ? "limited" : "unknown");
        setStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setBoard(null);
        setBoardView(null);
        setAccess("unknown");
        setStatus("error");
      });
    return () => { active = false; };
  }, [view, page, search, region, country, position, platform, attempt]);

  useEffect(() => {
    if (!fullAccess && view === "positions") setView("players");
  }, [fullAccess, view]);

  useEffect(() => {
    if (status !== "ready" || !board?.highlighted_id) return;
    document.getElementById(`ranking-${board.highlighted_id}`)?.scrollIntoView({ block: "center" });
  }, [status, board]);

  const facets = board?.facets || {};
  const showPlatform = fullAccess && (facets.platforms || []).length > 0;
  const filtersActive = Boolean(search || region || country || position || platform);
  const accentColor = useMemo(() => {
    const map = { ice: "#c2edfa", blue: "#4d8dff", cyan: "#00d4ff", gold: "#f5c542", red: "#ff6575", violet: "#c3a6ff" };
    return map[presentation.accent] || "#4d8dff";
  }, [presentation.accent]);

  const backgrounds = [
    { url: presentation.background_url, position: presentation.background_position, zoom: presentation.background_zoom },
    ...presentation.background_slides,
  ].filter(slide => slide.url);
  const activeBackground = backgrounds[slideIndex % Math.max(1, backgrounds.length)];
  useEffect(() => {
    if (!presentation.slideshow_enabled || slideshowPaused || backgrounds.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setSlideIndex(current => (current + 1) % backgrounds.length), presentation.slide_interval_seconds * 1000);
    return () => window.clearInterval(timer);
  }, [presentation.slideshow_enabled, presentation.slide_interval_seconds, slideshowPaused, backgrounds.length]);

  function changeView(next) {
    setView(next);
    setPage(1);
    setLocateMessage("");
  }

  function resetFilters() {
    setRegion("");
    setCountry("");
    setPosition("");
    setPlatform("");
    setSearchInput("");
    setSearch("");
    setPage(1);
    setLocateMessage("");
  }

  async function findMe() {
    setLocating(true);
    setLocateMessage("");
    try {
      const result = await stageClient.http.get("/rankings/me", {
        kind,
        q: search,
        region,
        country_code: country,
        platform,
        position: view === "positions" ? position : "",
        limit: PAGE_SIZE,
      });
      if (!result?.found || result.reason === "no_identity") {
        setLocateMessage(kind === "club"
          ? "No club managed by this account was found."
          : "No player profile linked to this account was found.");
      } else if (result.reason === "unranked") {
        setLocateMessage(kind === "club"
          ? "Your club is not in the official rankings yet. A club needs completed official competition results."
          : "Your player is not in the official rankings yet. Rankings start after an official competition match.");
      } else if (result.reason === "outside_preview") {
        setLocateMessage("You are ranked, but outside the free top-10 preview. STAGE Plus shows your position. The exact rank stays hidden on the free preview.");
      } else if (result.reason === "filtered_out" || result.reason === "outside_scope") {
        setLocateMessage(`You are ranked globally at ${result.global_rank}, but the current filters hide that row. Reset filters to see it.`);
      } else if (result.page && result.page !== page) {
        setPage(result.page);
        setLocateMessage(`Your rank in this scope is ${result.scope_rank}. Global rank ${result.global_rank}.`);
      } else {
        setLocateMessage(`Your rank in this scope is ${result.scope_rank}. Global rank ${result.global_rank}.`);
        document.getElementById(`ranking-${result.row?.id}`)?.scrollIntoView({ block: "center" });
      }
    } catch {
      setLocateMessage("Your ranking could not be located. Try again.");
    } finally {
      setLocating(false);
    }
  }

  const boardReady = status === "ready" && board && boardView === view;
  const rows = boardReady ? board.rows || [] : [];
  const scopeIsGlobal = !board?.scope || board.scope === "global";

  return (
    <main className="rankings-page" style={{ "--rankings-accent": accentColor }}>
      {activeBackground ? (
        <div className="rankings-backdrop" aria-hidden="true">
          <img
            src={activeBackground.url}
            alt=""
            style={{ objectPosition: activeBackground.position, transform: `scale(${activeBackground.zoom / 100})` }}
          />
          <div className="rankings-backdrop-fade" />
        </div>
      ) : null}
      <div className="rankings-content">
        <header className="rankings-header">
          <div>
            <p className="rankings-kicker">STAGE / OFFICIAL COMPETITION</p>
            <h1>{t("competitionFlow.rankingsTitle")}<span className="rankings-title-square" aria-hidden="true" /></h1>
            <p className="rankings-intro">The official STAGE leaderboard. Find your place.</p>
          </div>
          <div className="rankings-header-actions">
            <button type="button" onClick={() => dialogRef.current?.showModal()}>How rankings work</button>
            <button type="button" onClick={findMe} disabled={locating || status === "loading"}>{locating ? "Looking…" : "Find me"}</button>
          </div>
        </header>

        <div className="rankings-overview-strip">
        {boardReady ? (
          <div className="rankings-counts" aria-label="Ranking totals">
            <div><strong>{board.meta?.official_fixtures_count ?? "—"}</strong><span>{t("competitionFlow.officialFixtures")}</span></div>
            <div><strong>{board.meta?.club_count ?? "—"}</strong><span>{t("competitionFlow.rankedClubs")}</span></div>
            <div><strong>{board.meta?.ranked_player_count ?? "—"}</strong><span>{t("competitionFlow.rankedPlayers")}</span></div>
          </div>
        ) : null}

          {backgrounds.length > 1 && presentation.slideshow_enabled ? <div className="rankings-background-controls" aria-label="Background slideshow"><button type="button" onClick={() => setSlideIndex(current => (current + 1) % backgrounds.length)}>Change image</button><button type="button" aria-pressed={slideshowPaused} onClick={() => setSlideshowPaused(current => !current)}>{slideshowPaused ? "Play slideshow" : "Pause slideshow"}</button></div> : null}
        </div>
        {access === "limited" ? (
          <p className="rankings-banner">
            Free accounts see the top 10 global rankings and basic match records. STAGE Plus unlocks the full board, filters, position rankings, ranking points and match ratings. <Link to="/store">Open the Store</Link>
          </p>
        ) : null}
        {locateMessage ? <p className="rankings-status" role="status">{locateMessage}</p> : null}

        <div className="rankings-tabs" role="tablist" aria-label="Ranking views">
          <button type="button" role="tab" aria-selected={view === "clubs"} onClick={() => changeView("clubs")}>{t("competitionFlow.clubs")}</button>
          <button type="button" role="tab" aria-selected={view === "players"} onClick={() => changeView("players")}>{t("competitionFlow.players")}</button>
          {fullAccess ? <button type="button" role="tab" aria-selected={view === "positions"} onClick={() => changeView("positions")}>{t("competitionFlow.bestByPosition")}</button> : null}
        </div>

        {fullAccess ? (
          <div className="rankings-filters">
            <label>
              <span className="sr-only">Search {kindLabel}</span>
              <input type="search" value={searchInput} placeholder={`Search ${kindLabel}`} onChange={(event) => setSearchInput(event.target.value)} />
            </label>
            <label>
              <span className="sr-only">{t("competitionFlow.regional")}</span>
              <select value={region} onChange={(event) => { setRegion(event.target.value); setPage(1); }}>
                <option value="">{t("competitionFlow.allRegions")}</option>
                {(facets.regions || []).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">{t("competitionFlow.country")}</span>
              <select value={country} onChange={(event) => { setCountry(event.target.value); setPage(1); }}>
                <option value="">{t("competitionFlow.allCountries")}</option>
                {(facets.countries || []).map((option) => <option key={option} value={option}>{getCountryShortName(option, option)}</option>)}
              </select>
            </label>
            {view === "positions" ? (
              <label>
                <span className="sr-only">Position</span>
                <select value={position} onChange={(event) => { setPosition(event.target.value); setPage(1); }}>
                  <option value="">{t("competitionFlow.allPositions")}</option>
                  {(facets.positions || []).map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            ) : null}
            {showPlatform ? (
              <label>
                <span className="sr-only">{t("competitionFlow.allPlatforms")}</span>
                <select value={platform} onChange={(event) => { setPlatform(event.target.value); setPage(1); }}>
                  <option value="">{t("competitionFlow.allPlatforms")}</option>
                  {facets.platforms.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            ) : null}
            <button type="button" onClick={resetFilters} disabled={!filtersActive}>Reset filters</button>
          </div>
        ) : null}

        {status === "loading" ? <p className="rankings-status" role="status">{t("competitionFlow.loading")}</p> : null}
        {status === "error" ? (
          <div className="rankings-error" role="alert">
            <p>Rankings could not be loaded. This does not mean the board is empty.</p>
            <button type="button" onClick={() => setAttempt((current) => current + 1)}>Retry</button>
          </div>
        ) : null}

        {boardReady && board.total_ranked === 0 ? (
          <p className="rankings-empty">{view === "clubs" ? t("competitionFlow.noRankedClubs") : t("competitionFlow.noRankedPlayers")}</p>
        ) : null}
        {boardReady && board.total_ranked > 0 && rows.length === 0 ? (
          <p className="rankings-empty">No {kindLabel} match these filters. The ranked list itself is not empty.</p>
        ) : null}
        {boardReady && rows.length > 0 ? <ResultCaption board={board} kindLabel={kindLabel} /> : null}
        {fullAccess ? (
          <details className="rankings-stat-guide"><summary>Stat guide — what do the columns mean?</summary><dl>
            <div><dt>GP</dt><dd>Games played</dd></div><div><dt>G</dt><dd>Goals scored</dd></div><div><dt>A</dt><dd>Assists</dd></div><div><dt>CS</dt><dd>Clean sheets</dd></div><div><dt>GD</dt><dd>Goal difference</dd></div><div><dt>Record</dt><dd>Wins, draws and losses</dd></div><div><dt>Rating</dt><dd>Average match rating, separate from Card Level and ranking points.</dd></div><div><dt>Points</dt><dd>Points from the official ranking calculation.</dd></div>
          </dl></details>
        ) : null}

        {boardReady && rows.length > 0 ? (
          <table className="rankings-table">
            <caption className="sr-only">{t("competitionFlow.rankingsTitle")} — {kindLabel}</caption>
            <thead>
              <tr>
                <th title="Rank inside the selected scope. Search does not change this number.">Rank</th>
                <th>{view === "clubs" ? t("competitionFlow.club") : t("competitionFlow.player")}</th>
                <th>Record</th>
                {fullAccess ? <th title="Ranking points from the official ranking calculation.">Points</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rank = scopeIsGlobal ? row.global_rank : row.scope_rank;
                const you = board.highlighted_id && board.highlighted_id === row.id;
                const name = view === "clubs" ? row.name : row.gamertag;
                const href = view === "clubs" ? `/clubs/${row.id}` : `/players/${row.id}`;
                const stats = view === "clubs" ? clubStats(row, !fullAccess) : playerStats(row, !fullAccess);
                const identity = view === "clubs"
                  ? [row.tag ? `[${row.tag}]` : "", row.region, row.country_code, row.platform].filter(Boolean).join(" · ")
                  : [row.position, row.club_name || "Free agent", getCountryShortName(row.country_code, row.country), row.platform].filter(Boolean).join(" · ");
                return (
                  <tr key={row.id} id={`ranking-${row.id}`} className={you ? "rankings-row is-you" : "rankings-row"}>
                    <td><RankMark rank={rank} /></td>
                    <td>
                      <div className="rankings-identity">
                        <IdentityAvatar
                          className="rankings-avatar"
                          src={view === "clubs" ? row.logo_url : row.avatar_url}
                          name={name}
                          alt=""
                          position={view === "clubs" ? row.logo_position : row.avatar_position}
                          zoom={view === "clubs" ? row.logo_zoom : row.avatar_zoom}
                        />
                        <div>
                          <Link className="rankings-name" to={href}>{name}</Link>
                          {you ? <span className="rankings-you">YOU</span> : null}
                          <p className="rankings-meta">{identity}</p>
                          {view !== "clubs" && fullAccess ? <CardLevel playerId={row.id} /> : null}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="rankings-stats">
                        {stats.map((stat) => (
                          <div key={stat.label} className={stat.label === "GP" || stat.label === "Record" ? undefined : "rankings-extra"} title={stat.title}>
                            <b>{stat.value ?? formatNumber(row[stat.key])}</b>
                            <span>{stat.label}</span>
                          </div>
                        ))}
                      </div>
                      {!scopeIsGlobal && fullAccess ? <span className="rankings-global">Global #{row.global_rank}</span> : null}
                    </td>
                    {fullAccess ? (
                      <td className="rankings-points">
                        {formatNumber(row.ranking_points)}
                        <small>PTS</small>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}

        {boardReady && fullAccess && board.pages > 1 ? (
          <div className="rankings-pages">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={board.page <= 1}>Previous</button>
            <span>Page {board.page} of {board.pages}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(board.pages, current + 1))} disabled={board.page >= board.pages}>Next</button>
          </div>
        ) : null}
      </div>

      <dialog ref={dialogRef} className="rankings-dialog" aria-labelledby="rankings-how-title">
        <h2 id="rankings-how-title">How rankings work</h2>
        <p>This page calculates the current official board when it loads. Saved club and player ranking fields change only when an admin rebuilds rankings. There is no separate seasonal archive on this page.</p>
        <h3>Eligible matches</h3>
        <ul>
          <li>Completed, confirmed, played or forfeited official tournament matches run by STAGE admin, or official tournaments with no community creator.</li>
          <li>Completed official competition fixtures and regional league fixtures.</li>
          <li>Fixtures marked excluded from standings are left out. Arrange Game results are not included.</li>
        </ul>
        <h3>Calculation</h3>
        <p>Club points come from the match result, goal difference, goals and clean sheets, multiplied by the competition and round weight already used by the ranking engine. Eligible club titles add a championship or runner-up bonus. A player needs at least one official ranking match. Player points use participation, results, match rating, man of the match, position-weighted goals, assists and clean sheets, and official titles. A capped overall-rating factor is part of that calculation and is not shown as OVR.</p>
        <h3>Ties and scopes</h3>
        <p>Equal points are ordered by wins, then matches played, then name. Global rank is across everyone eligible. A region, country, position or platform filter shows rank inside that scope. Search only hides other rows. It does not turn a global rank into number 1.</p>
        <h3>Card Level, points and rating</h3>
        <p>STAGE Card Level comes from official match progression and is separate from this board. Ranking points are the leaderboard score. Match rating is the average rating recorded in official ranking matches.</p>
        <h3>Free and STAGE Plus</h3>
        <p>Free accounts see a top-10 global preview with basic records. STAGE Plus sees the full board, filters, position rankings, ranking points and match ratings. Those limits are applied on the server.</p>
        <button type="button" onClick={() => dialogRef.current?.close()}>Close</button>
      </dialog>
    </main>
  );
}

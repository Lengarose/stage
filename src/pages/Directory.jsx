import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Shield } from "lucide-react";
import { stageClient } from "@/api/stageClient";
import { DirectoryHeader, DirectoryTools, DirectoryCard, DirectoryPagination } from "@/components/directory/DirectoryPresentation";
import { loadPlayerDirectoryPages } from "@/lib/playerDirectoryLoader";
import { loadClubDirectoryPages } from "@/lib/clubDirectoryLoader";
import { filterPublicPlayerProfiles } from "@/lib/playerDirectory";
import { buildPlayerPresidentDirectoryRows, matchesPlayerPresidentQuery } from "@/lib/presidentDirectory";
import { asObjectArray, parseJsonArray } from "@/lib/safeData";
import { useTranslation } from "@/hooks/useTranslation";

const PAGE_SIZE = 15;
const PLATFORMS = ["All Platforms", "PlayStation", "Xbox", "PC"];
const POSITIONS = ["All Positions", "GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST", "CF"];
const KINDS = ["players", "clubs", "managers"];

/** One public directory. Tournament entrance pages reuse it with a fixed participant category. */
export default function Directory({ tournamentId, initialKind = "players" } = {}) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const requestedKind = tournamentId ? initialKind : params.get("type");
  const kind = KINDS.includes(requestedKind) ? requestedKind : "players";
  const [data, setData] = useState({ players: [], clubs: [], managers: [], clubLookup: {} });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("All Platforms");
  const [detail, setDetail] = useState("all");
  const [sort, setSort] = useState("asc");
  const [view, setView] = useState("grid");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [playerRows, clubRows, tournament] = await Promise.all([
          loadPlayerDirectoryPages(), loadClubDirectoryPages(),
          tournamentId ? stageClient.entities.Tournament.get(tournamentId) : Promise.resolve(null),
        ]);
        const allPlayers = asObjectArray(playerRows);
        const allClubs = asObjectArray(clubRows).filter(c => c.id);
        let players = filterPublicPlayerProfiles(allPlayers);
        let clubs = allClubs;
        if (tournamentId) {
          const playerIds = parseJsonArray(tournament?.registered_players || []);
          const clubIds = parseJsonArray(tournament?.registered_clubs || []);
          players = players.filter(p => playerIds.includes(p.id));
          clubs = clubs.filter(c => clubIds.includes(c.id));
        }
        if (active) setData({ players, clubs, managers: buildPlayerPresidentDirectoryRows(allClubs, allPlayers), clubLookup: Object.fromEntries(allClubs.map(club => [club.id, club])) });
      } catch {
        if (active) setData({ players: [], clubs: [], managers: [], clubLookup: {} });
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [tournamentId]);

  useEffect(() => { setSearch(""); setPlatform("All Platforms"); setDetail("all"); setPage(1); }, [kind]);

  const clubMap = data.clubLookup;
  const isPlayer = kind === "players";
  const rows = data[kind];
  const regions = [...new Set(rows.map(row => kind === "managers" ? clubMap[row.club_id]?.region : row.region).filter(Boolean))].sort();
  const query = search.trim().toLowerCase();
  const filtered = rows.filter(row => {
    const matchesSearch = kind === "managers" ? matchesPlayerPresidentQuery(row, search)
      : !query || [row.gamertag, row.name, row.tag, clubMap[row.club_id]?.name].some(value => String(value || "").toLowerCase().includes(query));
    const matchesDetail = detail === "all" || (isPlayer ? row.position === detail || row.secondary_position === detail : (kind === "managers" ? clubMap[row.club_id]?.region : row.region) === detail);
    return matchesSearch && (platform === "All Platforms" || row.platform === platform) && matchesDetail;
  }).sort((a, b) => (sort === "asc" ? 1 : -1) * String(a.gamertag || a.name || a.display_name || "").localeCompare(String(b.gamertag || b.name || b.display_name || "")));
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = Boolean(search || platform !== "All Platforms" || detail !== "all");
  const clearFilters = () => { setSearch(""); setPlatform("All Platforms"); setDetail("all"); setPage(1); };
  const placeholder = kind === "clubs" ? t("commonPages.clubsSearchPlaceholder") : kind === "managers" ? "Search managers or clubs" : t("competitionFlow.searchPlayers");

  return <div className={`stage-directory stage-directory--${kind}`}>
    <DirectoryHeader kind={kind} title={tournamentId ? (isPlayer ? "Players" : "Clubs") : "STAGE Directory"} count={rows.length} loading={loading} scoped={Boolean(tournamentId)} />
    <DirectoryTools search={search} onSearch={value => { setSearch(value); setPage(1); }} placeholder={placeholder} view={view} onView={setView} sort={sort} onSort={value => { setSort(value); setPage(1); }}>
      <label className="directory-select"><span className="sr-only">Platform</span><select value={platform} onChange={e => { setPlatform(e.target.value); setPage(1); }}>
        {PLATFORMS.map(value => <option key={value} value={value}>{value === "All Platforms" ? t("commonPages.allPlatforms") : value}</option>)}
      </select></label>
      <label className="directory-select"><span className="sr-only">{isPlayer ? "Position" : "Region"}</span><select value={detail} onChange={e => { setDetail(e.target.value); setPage(1); }}>
        <option value="all">{isPlayer ? t("competitionFlow.allPositions") : t("commonPages.allRegions")}</option>
        {(isPlayer ? POSITIONS.slice(1) : regions).map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>
    </DirectoryTools>
    <div className="directory-results" role="status"><span>{loading ? t("commonPages.loading") : `${filtered.length} ${kind} · ${sort === "asc" ? "A–Z" : "Z–A"}`}</span>{hasFilters && <button type="button" onClick={clearFilters}>Clear filters</button>}</div>
    {loading ? <div className="directory-loading" role="status">{t("commonPages.loading")}</div> : filtered.length === 0 ? <div className="directory-empty"><Shield size={32} aria-hidden="true" />No {kind} found. Try another name or adjust your filters.</div> : <>
      <div className={`directory-cards ${view === "list" ? "directory-cards--list" : ""}`}>
        {paginated.map(item => <DirectoryCard key={`${item.id}-${item.club_id || ""}`} kind={kind} item={item} club={clubMap[item.club_id]} profileLabel={kind === "clubs" ? t("commonPages.viewClub") : t("competitionFlow.viewProfile")} />)}
      </div>
      <DirectoryPagination page={page} totalPages={totalPages} onPage={setPage} />
    </>}
  </div>;
}

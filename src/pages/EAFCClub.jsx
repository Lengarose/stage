import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { searchClub, getClubDashboard } from "@/lib/eafcClient";
import { ArrowLeft, Shield, Users, Trophy, Swords, Star, TrendingUp, ChevronUp, ChevronDown, Loader2, AlertCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { asObject, asObjectArray, parseJsonArray } from "@/lib/safeData";

export default function EAFCClub() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const initClubId = urlParams.get("clubId");
  const initPlatform = urlParams.get("platform") || "common-gen5";
  const initClubName = urlParams.get("name") || "";

  const PLATFORMS = [
    { value: "common-gen5", label: t("commonPages.eafcPlatformGen5") },
    { value: "common-gen4", label: t("commonPages.eafcPlatformGen4") },
    { value: "nx", label: t("commonPages.eafcPlatformNx") },
  ];

  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState(initPlatform);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchHistory, setSearchHistory] = useState(() => {
    return parseJsonArray(localStorage.getItem("eafc_search_history") || "[]");
  });

  const [clubId, setClubId] = useState(initClubId || null);
  const [clubName, setClubName] = useState(initClubName);
  const [dashboard, setDashboard] = useState(null);
  const [loadingDash, setLoadingDash] = useState(false);
  const [dashError, setDashError] = useState("");

  const [memberSort, setMemberSort] = useState({ key: "gamesPlayed", dir: -1 });
  const [matchPage, setMatchPage] = useState(0);
  const MATCH_PAGE_SIZE = 5;

  useEffect(() => {
    if (initClubId) loadDashboard(initClubId, initPlatform);
  }, []);

  async function doSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError("");
    setSearchResults([]);
    try {
      const clubs = await searchClub(query.trim(), platform);
      const list = asObjectArray(clubs);
      setSearchResults(list);
      if (list.length === 0) setSearchError(t("commonPages.eafcNoClubs"));
    } catch (e) {
      setSearchError(e.message || t("commonPages.eafcSearchFailed"));
    }
    setSearching(false);
  }

  async function loadDashboard(id, plt) {
    setClubId(id);
    setDashboard(null);
    setDashError("");
    setLoadingDash(true);
    setMatchPage(0);
    try {
      const data = await getClubDashboard(id, plt || platform);
      setDashboard(asObject(data));
    } catch (e) {
      setDashError(e.message || t("commonPages.eafcLoadFailed"));
    }
    setLoadingDash(false);
  }

  function selectClub(club) {
    const safeClub = asObject(club);
    if (!safeClub) return;
    const id = safeClub.clubId || safeClub.id;
    const name = safeClub.name || safeClub.clubName || "";
    if (!id) return;
    setClubName(name);
    setSearchResults([]);
    setQuery("");
    const entry = { id, name, platform };
    const updated = [entry, ...asObjectArray(searchHistory).filter(h => h.id !== id)].slice(0, 8);
    setSearchHistory(updated);
    localStorage.setItem("eafc_search_history", JSON.stringify(updated));
    loadDashboard(id, platform);
  }

  const safeSearchResults = asObjectArray(searchResults);
  const safeSearchHistory = asObjectArray(searchHistory);
  const safeMembers = asObjectArray(dashboard?.members);
  const safeCareer = asObjectArray(dashboard?.career);
  const safeMatches = asObjectArray(dashboard?.matches);
  const sortedMembers = [...safeMembers].sort((a, b) => {
    const av = Number(a[memberSort.key]) || 0;
    const bv = Number(b[memberSort.key]) || 0;
    return memberSort.dir * (bv - av);
  });

  function toggleSort(key) {
    setMemberSort(s => s.key === key ? { key, dir: s.dir * -1 } : { key, dir: -1 });
  }

  const pagedMatches = safeMatches.slice(matchPage * MATCH_PAGE_SIZE, (matchPage + 1) * MATCH_PAGE_SIZE);
  const totalMatchPages = Math.ceil(safeMatches.length / MATCH_PAGE_SIZE);

  const club = asObject(dashboard?.club);
  const stats = asObject(club?.seasons?.[0]) || {};

  const memberCols = [
    { key: "gamesPlayed", label: t("commonPages.eafcGp") },
    { key: "goals", label: t("commonPages.goals") },
    { key: "assists", label: t("commonPages.assists") },
    { key: "mom", label: t("commonPages.eafcMom") },
    { key: "ratingAve", label: t("commonPages.prRating") },
  ];

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">{t("commonPages.eafcTitle")}</h1>
          <p className="font-subtitle text-sm text-muted-foreground">{t("commonPages.eafcSubtitle")}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <div className="flex gap-3">
          <select
            value={platform}
            onChange={e => setPlatform(e.target.value)}
            className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 shrink-0"
          >
            {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && doSearch()}
              placeholder={t("commonPages.eafcSearchPlaceholder")}
              className="pl-10 bg-secondary border-border"
            />
          </div>
          <Button type="button" onClick={doSearch} disabled={searching || !query.trim()} className="bg-primary text-primary-foreground font-heading shrink-0">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : t("commonPages.searchCta")}
          </Button>
        </div>

        {safeSearchResults.length > 0 && (
          <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
            {safeSearchResults.map((c, i) => (
              <button type="button" key={c.clubId || i} onClick={() => selectClub(c)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/60 transition-colors text-left">
                <Shield className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-bold text-foreground text-sm truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{t("commonPages.eafcResultMeta", { id: c.clubId, count: c.memberCount || "?" })}</p>
                </div>
                {c.seasons?.[0] && (
                  <span className="text-xs text-success shrink-0">
                    W{c.seasons[0].wins || 0} D{c.seasons[0].draws || 0} L{c.seasons[0].losses || 0}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {searchError && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {searchError}
          </div>
        )}

        {!searching && safeSearchResults.length === 0 && !searchError && safeSearchHistory.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{t("commonPages.eafcRecent")}</p>
            <div className="flex flex-wrap gap-2">
              {safeSearchHistory.map(h => (
                <button type="button" key={h.id} onClick={() => { setClubName(h.name); loadDashboard(h.id, h.platform); }}
                  className="text-xs px-3 py-1.5 rounded-full bg-secondary border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
                  {h.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loadingDash && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">{t("commonPages.eafcFetching")}</p>
        </div>
      )}

      {dashError && !loadingDash && (
        <div className="bg-card border border-destructive/30 rounded-2xl p-6 text-center space-y-2">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
          <p className="text-destructive font-medium">{dashError}</p>
          <Button type="button" variant="outline" onClick={() => loadDashboard(clubId, platform)} className="border-border">{t("commonPages.eafcRetry")}</Button>
        </div>
      )}

      {dashboard && !loadingDash && (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="font-heading text-2xl font-bold text-foreground">{club?.name || clubName}</h2>
                <p className="text-sm text-muted-foreground">
                  {club?.clubInfo?.clubAbbr && <span className="text-primary font-mono">[{club.clubInfo.clubAbbr}]</span>} · {t("commonPages.eafcDivision", { n: club?.divisionOffset || "?" })} · {PLATFORMS.find(p => p.value === platform)?.label}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              <StatBox icon={Trophy} label={t("commonPages.profWins")} value={stats.wins || club?.wins || 0} color="text-success" />
              <StatBox icon={Swords} label={t("commonPages.profLosses")} value={stats.losses || club?.losses || 0} color="text-destructive" />
              <StatBox icon={Star} label={t("commonPages.cdDraws")} value={stats.draws || club?.draws || 0} color="text-warning" />
              <StatBox icon={Users} label={t("commonPages.dashboardEafcMembers")} value={club?.memberCount || safeMembers.length || 0} color="text-primary" />
            </div>

            {(stats.wins || stats.losses || stats.draws) && (
              <div className="mt-4">
                <div className="flex text-xs text-muted-foreground justify-between mb-1">
                  <span>{t("commonPages.eafcWinRate")}</span>
                  <span>{Math.round(((stats.wins || 0) / Math.max(1, (stats.wins || 0) + (stats.losses || 0) + (stats.draws || 0))) * 100)}%</span>
                </div>
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-success rounded-full"
                    style={{ width: `${Math.round(((stats.wins || 0) / Math.max(1, (stats.wins || 0) + (stats.losses || 0) + (stats.draws || 0))) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {safeMembers.length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" /> {t("commonPages.eafcMembers", { count: safeMembers.length })}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-5 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">{t("commonPages.prPlayer")}</th>
                      {memberCols.map(col => (
                        <th key={col.key}
                          className="text-center px-3 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium cursor-pointer hover:text-foreground select-none"
                          onClick={() => toggleSort(col.key)}>
                          <span className="flex items-center justify-center gap-1">
                            {col.label}
                            {memberSort.key === col.key
                              ? memberSort.dir === -1 ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                              : <span className="w-3 h-3" />}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMembers.map((m, i) => (
                      <tr key={m.name || i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="px-5 py-3 font-medium text-foreground">{m.name || m.gamertag || t("commonPages.homeUnknown")}</td>
                        <td className="px-3 py-3 text-center text-muted-foreground">{m.gamesPlayed || 0}</td>
                        <td className="px-3 py-3 text-center text-success font-bold">{m.goals || 0}</td>
                        <td className="px-3 py-3 text-center text-primary">{m.assists || 0}</td>
                        <td className="px-3 py-3 text-center text-warning">{m.mom || 0}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={cn("font-bold", Number(m.ratingAve) >= 7 ? "text-success" : Number(m.ratingAve) >= 6 ? "text-warning" : "text-muted-foreground")}>
                            {m.ratingAve ? Number(m.ratingAve).toFixed(2) : "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {safeCareer.length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-accent" /> {t("commonPages.eafcCareerStats")}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-5 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">{t("commonPages.prPlayer")}</th>
                      <th className="text-center px-3 py-3 text-xs text-muted-foreground uppercase">{t("commonPages.eafcGames")}</th>
                      <th className="text-center px-3 py-3 text-xs text-muted-foreground uppercase">{t("commonPages.goals")}</th>
                      <th className="text-center px-3 py-3 text-xs text-muted-foreground uppercase">{t("commonPages.assists")}</th>
                      <th className="text-center px-3 py-3 text-xs text-muted-foreground uppercase">{t("commonPages.profWins")}</th>
                      <th className="text-center px-3 py-3 text-xs text-muted-foreground uppercase">{t("commonPages.eafcCs")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {safeCareer.slice(0, 20).map((m, i) => (
                      <tr key={m.name || i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="px-5 py-3 font-medium text-foreground">{m.name || t("commonPages.homeUnknown")}</td>
                        <td className="px-3 py-3 text-center text-muted-foreground">{m.gamesPlayed || 0}</td>
                        <td className="px-3 py-3 text-center text-success font-bold">{m.goals || 0}</td>
                        <td className="px-3 py-3 text-center text-primary">{m.assists || 0}</td>
                        <td className="px-3 py-3 text-center text-success">{m.wins || 0}</td>
                        <td className="px-3 py-3 text-center text-warning">{m.cleanSheetsDef || m.cleanSheetsGk || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {safeMatches.length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
                  <Swords className="w-5 h-5 text-destructive" /> {t("commonPages.eafcRecentMatches", { count: safeMatches.length })}
                </h3>
              </div>
              <div className="divide-y divide-border">
                {pagedMatches.map((m, i) => {
                  const clubs = asObject(m.clubs) || {};
                  const clubIds = Object.keys(clubs);
                  const myEntry = clubs[clubId] || clubs[String(clubId)] || clubs[clubIds[0]];
                  const oppId = clubIds.find(id => id !== String(clubId)) || clubIds[1];
                  const oppEntry = clubs[oppId];
                  const myScore = myEntry?.score ?? "?";
                  const oppScore = oppEntry?.score ?? "?";
                  const oppName = oppEntry?.details?.name || t("commonPages.eafcClubFallback", { id: oppId });
                  const won = Number(myScore) > Number(oppScore);
                  const drew = myScore === oppScore;
                  return (
                    <div key={i} className="px-5 py-3 flex items-center gap-4">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-heading font-bold text-xs shrink-0",
                        won ? "bg-success/20 text-success" : drew ? "bg-warning/20 text-warning" : "bg-destructive/20 text-destructive"
                      )}>
                        {won ? "W" : drew ? "D" : "L"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{t("commonPages.eafcVs", { name: oppName })}</p>
                        <p className="text-xs text-muted-foreground capitalize">{m.matchType || "match"}</p>
                      </div>
                      <p className="font-heading font-bold text-lg text-foreground shrink-0">
                        {myScore} – {oppScore}
                      </p>
                    </div>
                  );
                })}
              </div>
              {totalMatchPages > 1 && (
                <div className="px-5 py-3 flex items-center justify-between border-t border-border">
                  <Button type="button" variant="outline" size="sm" disabled={matchPage === 0} onClick={() => setMatchPage(p => p - 1)} className="border-border text-xs">{t("commonPages.eafcPrevious")}</Button>
                  <span className="text-xs text-muted-foreground">{matchPage + 1} / {totalMatchPages}</span>
                  <Button type="button" variant="outline" size="sm" disabled={matchPage >= totalMatchPages - 1} onClick={() => setMatchPage(p => p + 1)} className="border-border text-xs">{t("competitionFlow.next")}</Button>
                </div>
              )}
            </div>
          )}

          {safeMembers.length === 0 && safeMatches.length === 0 && (
            <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground">
              {t("commonPages.eafcNoDetail")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatBox({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-secondary border border-border rounded-xl p-4 text-center">
      <Icon className={cn("w-5 h-5 mx-auto mb-1.5", color)} />
      <p className="font-heading font-bold text-xl text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}

import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { Link } from "react-router-dom";
import { Crown, Search, ChevronLeft, ChevronRight, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { asObjectArray } from "@/lib/safeData";
import { buildPlayerPresidentDirectoryRows, matchesPlayerPresidentQuery } from "@/lib/presidentDirectory";
import { getCountryDisplayName } from "@/lib/countryDisplay";

const PAGE_SIZE = 15;

export default function Presidents() {
  const { t } = useTranslation();
  const [presidents, setPresidents] = useState([]);
  const [clubs, setClubs] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function load() {
      try {
        const [clubData, playerData] = await Promise.all([
          stageClient.entities.Club.list(null, 500).catch(() => []),
          stageClient.entities.Player.list("-overall_rating", 500).catch(() => []),
        ]);
        const map = {};
        asObjectArray(clubData).forEach((c) => { if (c?.id) map[c.id] = c; });
        setClubs(map);
        setPresidents(buildPlayerPresidentDirectoryRows(asObjectArray(clubData), asObjectArray(playerData)));
      } catch {
        setPresidents([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = asObjectArray(presidents).filter((p) => {
    return matchesPlayerPresidentQuery(p, search);
  }).sort((a, b) => (a.display_name || "").localeCompare(b.display_name || ""));

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const inputCls = "bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400/50 focus:bg-white/8 transition-all";

  return (
    <div className="min-h-screen p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="mb-10">
        <p className="text-amber-300/80 text-[10px] uppercase tracking-[0.35em] font-bold mb-1">STAGE</p>
        <h1
          className="font-heading font-black uppercase leading-none text-foreground"
          style={{ fontSize: "clamp(2rem, 5vw, 3.25rem)", letterSpacing: "-0.02em" }}
        >
          {t("nav.presidents")}
        </h1>
        <p className="text-muted-foreground text-sm mt-3">
          {loading ? t("commonPages.loading") : t("commonPages.presidentsCount", { count: filtered.length })}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t("commonPages.presidentsSearchPlaceholder")}
            className={cn(inputCls, "pl-10 w-full")}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-9 h-9 border-4 border-amber-400/20 border-t-amber-400 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-white/30 text-sm flex flex-col items-center gap-4">
          <Crown className="w-12 h-12 text-white/10" />
          <span>{t("commonPages.noPresidentsFound")}</span>
        </div>
      ) : (
        <>
          <div className="hidden sm:grid grid-cols-[3rem_1fr_auto] gap-4 px-5 mb-2 items-center">
            <span className="text-white/25 text-[9px] uppercase tracking-widest">{t("commonPages.presidentsColAvatar")}</span>
            <span className="text-white/25 text-[9px] uppercase tracking-widest">{t("commonPages.cdPresident")}</span>
            <span className="text-white/25 text-[9px] uppercase tracking-widest text-right">{t("nav.profile")}</span>
          </div>

          <div className="space-y-2">
            {paginated.map((president) => {
              const club = president.club_id ? clubs[president.club_id] : null;

              return (
                <Link key={`${president.club_id}-${president.player_id}`} to={`/players/${president.player_id}`} className="block group">
                  <div
                    className="relative overflow-hidden"
                    style={{ minHeight: "80px", clipPath: "polygon(2% 0, 100% 0, 98% 100%, 0 100%)" }}
                  >
                    {president.banner_url ? (
                      <div
                        className="absolute inset-0 scale-105 group-hover:scale-110 transition-transform duration-700"
                        style={{
                          backgroundImage: `url(${president.banner_url})`,
                          backgroundSize: `${president.banner_zoom || 150}%`,
                          backgroundPosition: president.banner_position || "50% 50%",
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-800" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/15 to-black/90" />
                    <div className="absolute bottom-0 left-0 top-0 w-[4px] bg-amber-400/0 transition-all duration-300 group-hover:bg-amber-400/80" />
                    <div className="absolute inset-0 border border-white/8 transition-colors duration-300 group-hover:border-amber-400/35" />

                    <div className="relative z-10 flex items-center gap-4 px-7 py-4 sm:px-8">
                      <div
                        className="h-11 w-11 shrink-0 overflow-hidden border-2 border-white/15 bg-black/40 transition-colors group-hover:border-amber-300/40"
                        style={{ clipPath: "polygon(14% 0, 100% 0, 86% 100%, 0 100%)", ...(president.avatar_url ? {
                          backgroundImage: `url(${president.avatar_url})`,
                          backgroundSize: `${president.avatar_zoom || 150}%`,
                          backgroundPosition: president.avatar_position || "50% 50%",
                          backgroundRepeat: "no-repeat",
                        } : {}) }}
                      >
                        {!president.avatar_url ? (
                          <div className="w-full h-full flex items-center justify-center text-amber-300/70">
                            <Crown className="w-5 h-5" />
                          </div>
                        ) : null}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-heading font-black text-base text-white uppercase tracking-wide group-hover:text-amber-300 transition-colors">
                            {president.display_name || t("commonPages.cdPresident")}
                          </span>
                          {president.role_title ? (
                            <span
                              className="shrink-0 border border-amber-400/25 bg-amber-400/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-200"
                              style={{ clipPath: "polygon(12% 0, 100% 0, 88% 100%, 0 100%)" }}
                            >
                              {president.role_title}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-white/35 mt-0.5 flex-wrap">
                          {president.country_code ? <span>{getCountryDisplayName(president.country_code)}</span> : null}
                          {president.management_style ? (
                            <>
                              {president.country_code ? <span>·</span> : null}
                              <span>{president.management_style}</span>
                            </>
                          ) : null}
                          {club ? (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-1 text-amber-300/70">
                                <Shield className="w-2.5 h-2.5" />
                                {president.club_name || club.name}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="hidden sm:block shrink-0 text-xs font-bold uppercase tracking-wider text-white/35 group-hover:text-amber-300/80 transition-colors">
                        {t("competitionFlow.viewProfile")}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-center gap-2 mt-10">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex h-9 w-9 items-center justify-center border border-white/10 bg-white/5 text-white/50 transition-all hover:border-white/25 hover:bg-white/10 disabled:opacity-30"
                style={{ clipPath: "polygon(18% 0, 100% 0, 82% 100%, 0 100%)" }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const n = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
                return (
                  <button
                    type="button"
                    key={n}
                    onClick={() => setPage(n)}
                    className={cn(
                      "h-9 w-9 border text-sm font-bold transition-all",
                      n === page
                        ? "bg-amber-400 text-black border-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.45)]"
                        : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:border-white/25"
                    )}
                    style={{ clipPath: "polygon(18% 0, 100% 0, 82% 100%, 0 100%)" }}
                  >
                    {n}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex h-9 w-9 items-center justify-center border border-white/10 bg-white/5 text-white/50 transition-all hover:border-white/25 hover:bg-white/10 disabled:opacity-30"
                style={{ clipPath: "polygon(18% 0, 100% 0, 82% 100%, 0 100%)" }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

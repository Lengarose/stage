import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { Link } from "react-router-dom";
import { Crown, Search, ChevronLeft, ChevronRight, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { asObjectArray } from "@/lib/safeData";
import { filterPublicPresidentProfiles } from "@/lib/presidentDirectory";

const PAGE_SIZE = 15;
const SUCCESS_LEVELS = ["All Levels", "less_successful", "successful", "more_successful", "most_successful", "boss"];

const SUCCESS_LABEL_KEYS = {
  less_successful: "presSuccessLess",
  successful: "presSuccessSuccessful",
  more_successful: "presSuccessMore",
  most_successful: "presSuccessMost",
  boss: "presSuccessBoss",
};

export default function Presidents() {
  const { t } = useTranslation();
  const [presidents, setPresidents] = useState([]);
  const [clubs, setClubs] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [successLevel, setSuccessLevel] = useState("All Levels");
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function load() {
      try {
        const [presData, clubData] = await Promise.all([
          stageClient.entities.President.list("-created_date", 500).catch(() => []),
          stageClient.entities.Club.list(null, 500).catch(() => []),
        ]);
        setPresidents(filterPublicPresidentProfiles(asObjectArray(presData)));
        const map = {};
        asObjectArray(clubData).forEach((c) => { if (c?.id) map[c.id] = c; });
        setClubs(map);
      } catch {
        setPresidents([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = asObjectArray(presidents).filter((p) => {
    const q = search.toLowerCase();
    const name = (p.display_name || "").toLowerCase();
    const clubName = (clubs[p.club_id]?.name || "").toLowerCase();
    const matchSearch = !search || name.includes(q) || clubName.includes(q);
    const matchLevel = successLevel === "All Levels" || p.success_level === successLevel;
    return matchSearch && matchLevel;
  }).sort((a, b) => (a.display_name || "").localeCompare(b.display_name || ""));

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const inputCls = "bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400/50 focus:bg-white/8 transition-all";
  const selectCls = "bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm outline-none cursor-pointer appearance-none min-w-[150px]";

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
        <select
          value={successLevel}
          onChange={(e) => { setSuccessLevel(e.target.value); setPage(1); }}
          className={selectCls}
        >
          {SUCCESS_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level === "All Levels"
                ? t("commonPages.presidentsAllLevels")
                : t(`commonPages.${SUCCESS_LABEL_KEYS[level]}`)}
            </option>
          ))}
        </select>
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
              const successKey = SUCCESS_LABEL_KEYS[president.success_level];
              const successLabel = successKey ? t(`commonPages.${successKey}`) : president.success_level;

              return (
                <Link key={president.id} to={`/presidents/${president.id}`} className="block group">
                  <div className="relative rounded-2xl overflow-hidden" style={{ minHeight: "80px" }}>
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
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-amber-400/0 group-hover:bg-amber-400/80 transition-all duration-300 rounded-l-2xl" />
                    <div className="absolute inset-0 rounded-2xl border border-white/8 group-hover:border-amber-400/35 transition-colors duration-300" />

                    <div className="relative z-10 flex items-center gap-4 px-5 py-4">
                      <div
                        className="w-11 h-11 rounded-xl overflow-hidden border-2 border-white/15 shrink-0 bg-black/40 group-hover:border-amber-300/40 transition-colors"
                        style={president.avatar_url ? {
                          backgroundImage: `url(${president.avatar_url})`,
                          backgroundSize: `${president.avatar_zoom || 150}%`,
                          backgroundPosition: president.avatar_position || "50% 50%",
                          backgroundRepeat: "no-repeat",
                        } : undefined}
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
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-200 border border-amber-400/25 uppercase tracking-wider shrink-0">
                              {president.role_title}
                            </span>
                          ) : null}
                          {successLabel ? (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white/10 text-white/70 border border-white/15 uppercase tracking-wider shrink-0">
                              {successLabel}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-white/35 mt-0.5 flex-wrap">
                          {president.country_code ? <span>{president.country_code}</span> : null}
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
                                {club.name}
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
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:bg-white/10 hover:border-white/25 disabled:opacity-30 transition-all"
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
                      "w-9 h-9 rounded-xl text-sm font-bold border transition-all",
                      n === page
                        ? "bg-amber-400 text-black border-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.45)]"
                        : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:border-white/25"
                    )}
                  >
                    {n}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:bg-white/10 hover:border-white/25 disabled:opacity-30 transition-all"
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

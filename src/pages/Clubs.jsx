import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { useTranslation } from '@/hooks/useTranslation';
import { Shield, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "../components/PageHeader";
import ClubCard from "../components/ClubCard";

const PAGE_SIZE = 10;

export default function Clubs() {
  const { t } = useTranslation();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function load() {
      const data = await stageClient.entities.Club.list("-rating", 100);
      setClubs(data);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = clubs.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.tag.toLowerCase().includes(search.toLowerCase());
    const matchPlatform = platformFilter === "all" || c.platform === platformFilter;
    const matchRegion = regionFilter === "all" || c.region === regionFilter;
    return matchSearch && matchPlatform && matchRegion;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <PageHeader title={t("clubs.title")} subtitle={t("clubs.subtitle")} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("clubs.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-full sm:w-40 bg-card border-border">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("clubs.allPlatforms")}</SelectItem>
            <SelectItem value="PlayStation">PlayStation</SelectItem>
            <SelectItem value="Xbox">Xbox</SelectItem>
            <SelectItem value="PC">PC</SelectItem>
          </SelectContent>
        </Select>
        <Select value={regionFilter} onValueChange={setRegionFilter}>
          <SelectTrigger className="w-full sm:w-40 bg-card border-border">
            <SelectValue placeholder="Region" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("clubs.allRegions")}</SelectItem>
            <SelectItem value="Europe">Europe</SelectItem>
            <SelectItem value="North America">North America</SelectItem>
            <SelectItem value="South America">South America</SelectItem>
            <SelectItem value="Asia">Asia</SelectItem>
            <SelectItem value="Oceania">Oceania</SelectItem>
            <SelectItem value="Middle East">Middle East</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {search || platformFilter !== "all" || regionFilter !== "all"
              ? t("clubs.noMatch")
              : t("clubs.noClubs")}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map((club, i) => (
              <ClubCard
                key={`${club.id}-${i}`}
                club={club}
                rank={(page - 1) * PAGE_SIZE + i + 1}

              />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground disabled:opacity-40 hover:border-primary/50 transition-colors"
              >← Prev</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-9 h-9 rounded-lg text-sm font-bold border transition-colors ${
                    n === page ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-foreground hover:border-primary/50"
                  }`}
                >{n}</button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground disabled:opacity-40 hover:border-primary/50 transition-colors"
              >Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
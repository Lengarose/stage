import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useTranslation } from '@/hooks/useTranslation';
import { BarChart3, Globe, MapPin, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const FORM_COLORS = { W: "bg-success", D: "bg-warning", L: "bg-destructive" };
const RANK_COLORS  = { 1: "#FFD700", 2: "#C0C0C0", 3: "#CD7F32" };

export default function Rankings() {
  const { t } = useTranslation();
  const [clubs,   setClubs]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Club.list("-ranking_points", 200)
      .then(setClubs)
      .catch(() => setClubs([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const globalClubs   = [...clubs].sort((a, b) => (b.ranking_points || 0) - (a.ranking_points || 0));
  const regions       = [...new Set(clubs.map(c => c.region).filter(Boolean))].sort();

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="w-6 h-6 text-primary shrink-0" />
          <div>
            <h1
              className="font-heading font-black text-5xl md:text-6xl text-foreground uppercase"
              style={{ transform: "skewX(-8deg)", letterSpacing: "-0.02em", transformOrigin: "left center" }}
            >
              {t("rankings.title")}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">Global · Regional · Ranking Points</p>
          </div>
        </div>

        {/* Notice banner */}
        <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 mb-8 text-sm">
          <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            <span className="text-foreground font-semibold">Rankings are being rebuilt.</span>{" "}
            The STAGE Ranking System is under construction — ranking points will update once the new formula goes live.
          </p>
        </div>

        <Tabs defaultValue="global" className="w-full">
          <TabsList className="w-full rounded-none border-b border-border bg-transparent h-auto p-0 gap-0 mb-8">
            {[
              { value: "global",   label: "Global Ranking",   icon: Globe   },
              { value: "regional", label: "Regional Ranking", icon: MapPin  },
            ].map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className={cn(
                  "flex items-center gap-2 flex-1 rounded-none border-b-2 border-transparent pb-3 pt-3 text-xs uppercase tracking-widest font-bold text-muted-foreground transition-colors",
                  "data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent"
                )}
              >
                <Icon className="w-4 h-4" /> {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* GLOBAL TAB */}
          <TabsContent value="global">
            {globalClubs.length === 0 ? (
              <EmptyState icon={Globe} message="No clubs yet." />
            ) : (
              <RankingTable clubs={globalClubs} showRegion />
            )}
          </TabsContent>

          {/* REGIONAL TAB */}
          <TabsContent value="regional">
            {regions.length === 0 ? (
              <EmptyState icon={MapPin} message="No clubs yet." />
            ) : (
              <div className="space-y-8">
                {regions.map(region => {
                  const regionClubs = clubs
                    .filter(c => c.region === region)
                    .sort((a, b) => (b.ranking_points || 0) - (a.ranking_points || 0));
                  return (
                    <div key={region}>
                      <div className="flex items-center gap-2 mb-3">
                        <MapPin className="w-4 h-4 text-primary" />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">{region}</h2>
                        <span className="text-xs text-muted-foreground">— {regionClubs.length} club{regionClubs.length !== 1 ? "s" : ""}</span>
                      </div>
                      <RankingTable clubs={regionClubs} />
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function RankingTable({ clubs, showRegion = false }) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="divide-y divide-border">
        {clubs.map((club, i) => {
          const rank      = i + 1;
          const isTop3    = rank <= 3;
          const total     = (club.wins || 0) + (club.losses || 0) + (club.draws || 0);
          const winRate   = total > 0 ? Math.round(((club.wins || 0) / total) * 100) : 0;
          const form      = club.form || [];
          const rankColor = isTop3 ? RANK_COLORS[rank] : undefined;

          return (
            <Link
              key={club.id}
              to={`/clubs/${club.id}`}
              className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 hover:bg-secondary/50 transition-colors group"
            >
              {/* Rank */}
              <div
                className="w-7 sm:w-8 text-center font-black text-sm shrink-0"
                style={{ color: rankColor || "hsl(var(--muted-foreground))" }}
              >
                {rank}
              </div>

              {/* Logo */}
              <div
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
                style={{
                  background: isTop3 ? undefined : "hsl(var(--secondary))",
                  border: `1.5px solid ${rankColor || "hsl(var(--border))"}`,
                }}
              >
                <img
                  src={club.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(club.tag || club.name)}&background=1a1a2e&color=fff&size=64&bold=true&font-size=0.4`}
                  alt={club.name}
                  className="w-full h-full object-cover"
                  style={{ objectPosition: club.logo_position || "50% 50%" }}
                />
              </div>

              {/* Name + region */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                  {club.name}
                </p>
                {showRegion && (
                  <p className="text-[10px] text-muted-foreground">{club.region || "—"}</p>
                )}
              </div>

              {/* Record + form */}
              <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
                <span>{club.wins || 0}W {club.draws || 0}D {club.losses || 0}L</span>
                <span className="text-foreground font-medium">{winRate}% WR</span>
                <div className="flex items-center gap-0.5">
                  {form.map((r, fi) => (
                    <span key={fi} className={cn("w-2 h-2 rounded-full inline-block", FORM_COLORS[r] || "bg-muted")} />
                  ))}
                </div>
              </div>

              {/* Ranking points */}
              <div className="text-right shrink-0">
                <p
                  className="font-black text-sm sm:text-base"
                  style={{ color: rankColor || "hsl(var(--foreground))" }}
                >
                  {club.ranking_points || 0}
                </p>
                <p className="text-[10px] text-muted-foreground">pts</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, message }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-12 text-center">
      <Icon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
      <p className="text-muted-foreground font-medium">{message}</p>
    </div>
  );
}

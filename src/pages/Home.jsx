import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import { useTranslation } from '@/hooks/useTranslation';
import { Shield, Trophy, TrendingUp, ArrowRight, Search, Rss, Inbox } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import NewsWidget from "../components/NewsWidget";
import DashboardWidget from "../components/DashboardWidget";
import DashboardCustomizer from "../components/DashboardCustomizer";
import { Button } from "@/components/ui/button";
import StatCard from "../components/StatCard";
import TopPerformers from "../components/TopPerformers";
import ClubCard from "../components/ClubCard";
import HomeInboxPanel from "../components/inbox/HomeInboxPanel";
import { cn } from "@/lib/utils";
export default function Home() {
  const { t } = useTranslation();
  const [clubs, setClubs] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [user, setUser] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeWidgets, setActiveWidgets] = useState(() => {
    const saved = localStorage.getItem('dashboardWidgets');
    return saved ? JSON.parse(saved) : ['inbox', 'news', 'stats', 'top_performers', 'quick_actions', 'tournaments', 'clubs'];
  });

  useEffect(() => {
    async function load() {
      const isAuthed = await stageClient.auth.isAuthenticated();
      if (!isAuthed) { setLoading(false); return; }
      const u = await stageClient.auth.me();
      setUser(u);
      const [c, t, pl, matches] = await Promise.all([
        stageClient.entities.Club.list("-rating", 5),
        stageClient.entities.Tournament.filter({ status: "registration" }, "-created_date", 3),
        stageClient.entities.Player.filter({ email: u.email }),
        stageClient.entities.Match.filter({ status: "completed" }, "-created_date", 5),
      ]);
      setClubs(c);
      setTournaments(t);
      if (pl.length > 0) setMyPlayer(pl[0]);
      setRecentMatches(matches);

      setLoading(false);
    }
    load();
  }, []);

  const saveDashboardLayout = (newWidgets) => {
    localStorage.setItem('dashboardWidgets', JSON.stringify(newWidgets));
    setActiveWidgets(newWidgets);
  };

  const handleAddWidget = (widgetId) => {
    saveDashboardLayout([...activeWidgets, widgetId]);
  };

  const handleRemoveWidget = (widgetId) => {
    saveDashboardLayout(activeWidgets.filter((id) => id !== widgetId));
  };

  const handleResetLayout = () => {
    saveDashboardLayout(['inbox', 'news', 'stats', 'top_performers', 'quick_actions', 'tournaments', 'clubs']);
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const reordered = [...activeWidgets];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    saveDashboardLayout(reordered);
  };

  const renderWidgetContent = (id) => {
    switch (id) {
      case 'inbox': return <HomeInboxPanel />;
      case 'news':return <NewsWidget />;

      case 'stats':return (
          <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Shield} label={t("home.activeClubs")} value={clubs.length} />
          <StatCard icon={Trophy} label={t("home.openTournaments")} value={tournaments.length} />
          <StatCard icon={TrendingUp} label={t("home.matchesPlayed")} value={recentMatches.length} />
        </div>);

      case 'top_performers':return <TopPerformers />;
      case 'quick_actions': return null;

      case 'clubs':return clubs.length > 0 ?
        <div className="grid grid-cols-1 gap-2">
          {clubs.map((club) => <ClubCard key={club.id} club={club} />)}
        </div> :
        null;
      case 'tournaments':return tournaments.length > 0 ?
        <div className="grid gap-3">
          {tournaments.map((t) =>
          <Link key={t.id} to={`/tournaments/${t.id}`} className="block group">
              <div className="overflow-hidden border border-border rounded-xl hover:border-primary/30 transition-all">
                <div className="h-20 w-full relative" style={t.banner_url ?
              { backgroundImage: `url(${t.banner_url})`, backgroundSize: "cover", backgroundPosition: t.banner_position || "50% 50%" } :
              { background: t.banner_color || "#1a2a4a" }
              }>
                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
                  <div className="absolute inset-0 p-3 flex items-end">
                    <div className="flex items-center gap-1.5">
                      <Trophy className="w-3 h-3 text-accent" />
                      <span className="text-[10px] uppercase tracking-wider text-accent font-medium">{t.type?.replace(/_/g, " ")}</span>
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-card">
                  <h3 className="leading-relaxed text-sm font-bold text-foreground">{t.name}</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{t.platform} • {t.max_teams} teams</p>
                  <div className="mt-2 flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">{t.registered_clubs?.length || 0}/{t.max_teams} teams</span>
                    <span className="px-2 py-0.5 rounded-full bg-success/10 text-success">Open</span>
                  </div>
                </div>
              </div>
            </Link>
          )}
        </div> :
        null;
      default:return null;
    }
  };

  const WIDGET_TITLES = {
    inbox: "Inbox",
    news: t("home.widgetNews"),
    stats: t("home.widgetStats"),
    top_performers: t("home.widgetTopPerformers"),
    quick_actions: t("home.widgetQuickActions"),
    clubs: t("home.widgetClubs"),
    tournaments: t("home.widgetTournaments")
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>);

  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border p-8 sm:p-12" style={{ backgroundImage: "url(https://media.stageClient.com/images/public/69d77ebfc021efa72e236f84/9bfa29b97_IMG_6871.png)", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}>
        <div className="absolute inset-0 bg-black/20 rounded-2xl" />
        <div className="relative">

          <h1 className="font-heading font-bold text-foreground leading-[0.9] tracking-tight" style={{ fontSize: "clamp(3.5rem, 8vw, 5rem)" }}>
            {t("home.heroLine1")}<br />
            <span className="text-glow text-primary" style={{ fontSize: "clamp(4rem, 10vw, 6rem)" }}>{t("home.heroLine2")}</span>
          </h1>
          <p className="text-white mt-5 max-w-md text-sm leading-relaxed font-body">
            {t("home.subtitle")}
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <Link to="/search">
              <Button className="bg-white/5 border border-primary/30 text-primary-foreground hover:bg-primary/90 leading-relaxed text-primary text-sm">
                <Search className="w-4 h-4 mr-2" /> {t("home.challengeClub")}
              </Button>
            </Link>
            <Link to="/tournaments">
              <Button variant="outline" className="border-border hover:bg-secondary leading-relaxed text-sm">
                <Trophy className="w-4 h-4 mr-2" /> {t("navigation.tournaments")}
              </Button>
            </Link>
            <Link to="/social">
              <Button variant="outline" className="border-border hover:bg-secondary leading-relaxed text-sm">
                <Rss className="w-4 h-4 mr-2" /> {t("navigation.feed")}
              </Button>
            </Link>
          </div>

        </div>
      </div>

      {/* Dashboard Customizer */}
      <DashboardCustomizer
        activeWidgets={activeWidgets}
        onAddWidget={handleAddWidget}
        onReset={handleResetLayout} />
      



      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="dashboard">
          {(provided) =>
          <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-6">
              {activeWidgets.map((id, index) => {
              const content = renderWidgetContent(id);
              if (!content) return null;
              return (
                <Draggable key={id} draggableId={id} index={index}>
                    {(drag, snapshot) =>
                  <div ref={drag.innerRef} {...drag.draggableProps}>
                        <DashboardWidget
                      id={id}
                      title={WIDGET_TITLES[id] || id}
                      onRemove={handleRemoveWidget}
                      isDragging={snapshot.isDragging}
                      dragHandleProps={drag.dragHandleProps}>
                      
                          {content}
                        </DashboardWidget>
                      </div>
                  }
                  </Draggable>);

            })}
              {provided.placeholder}
            </div>
          }
        </Droppable>
      </DragDropContext>
      </div>);

}
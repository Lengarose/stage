import PlayerTrophyCabinet, { ClubTrophyCabinetDisplay } from "@/components/profile/PlayerTrophyCabinet";
import { useAuth } from "@/lib/AuthContext";
import { useEffect, useState } from "react";
import { resolveMyPlayerAndClub } from "@/api/stageClient";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";

export default function TournamentTrophyPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [player, setPlayer] = useState(null);
  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    resolveMyPlayerAndClub()
      .then(({ player: resolvedPlayer, club: resolvedClub, presidentClub }) => {
        if (cancelled) return;
        setPlayer(resolvedPlayer || null);
        setClub(presidentClub || resolvedClub || null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("commonPages.profBack")}
      </button>
      <h1 className="text-xl font-bold mb-4">{t("commonPages.teTrophyCabinet")}</h1>
      {loading ? (
        <p className="text-muted-foreground text-sm">{t("commonPages.loading")}</p>
      ) : club && !player ? (
        <ClubTrophyCabinetDisplay
          clubId={club.id}
          club={club}
          currentUserEmail={user?.email}
          canEditOverride
        />
      ) : player ? (
        <PlayerTrophyCabinet
          player={player}
          currentUserEmail={user?.email}
        />
      ) : (
        <p className="text-muted-foreground text-sm">{t("commonPages.profNotClub")}</p>
      )}
    </div>
  );
}

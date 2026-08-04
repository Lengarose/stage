import { useEffect, useState } from "react";
import { Loader2, Shield } from "lucide-react";
import { resolveMyPlayerAndClub } from "@/api/stageClient";
import ClubSetup from "@/components/onboarding/ClubSetup";
import PlayerSetup from "@/components/onboarding/PlayerSetup";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AccountRoleUpgradePrompt from "@/components/settings/AccountRoleUpgradePrompt";
import GamerSettingsSection from "@/components/settings/GamerSettingsSection";
import { useTranslation } from "@/hooks/useTranslation";
import { readAccountIntent, writeAccountIntent } from "@/lib/accountIntent";

export default function AccountRoleUpgradeSection() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [clubDialogOpen, setClubDialogOpen] = useState(false);
  const [playerDialogOpen, setPlayerDialogOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [player, setPlayer] = useState(null);
  const [presidentClub, setPresidentClub] = useState(null);
  const [accountIntent, setAccountIntent] = useState("player");

  useEffect(() => {
    let cancelled = false;
    async function loadAccountRoles() {
      setLoading(true);
      try {
        const {
          user: resolvedUser,
          player: resolvedPlayer,
          presidentClub: resolvedPresidentClub,
        } = await resolveMyPlayerAndClub();
        if (cancelled) return;
        setUser(resolvedUser);
        setPlayer(resolvedPlayer);
        setPresidentClub(resolvedPresidentClub);
        setAccountIntent(resolvedUser?.id ? readAccountIntent(resolvedUser.id) : "player");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadAccountRoles();
    return () => {
      cancelled = true;
    };
  }, []);

  const canUpgradePlayerToPresident = accountIntent === "player" && Boolean(player?.id && !presidentClub?.id);
  const canUpgradePresidentToPlayer = accountIntent === "president" && Boolean(presidentClub?.id && !player?.id);

  function handleClubUpgradeComplete(club) {
    setClubDialogOpen(false);
    if (!club?.id || !user?.id) return;

    writeAccountIntent("both", user.id);
    setAccountIntent("both");
    setPresidentClub(club);
    localStorage.setItem("stage-account-mode", "club");
    localStorage.setItem("stage_club_id", club.id);
    localStorage.setItem("stage_owner_id", club.id);
    localStorage.setItem("stage_president_club_id", club.id);
    window.location.reload();
  }

  function handlePlayerUpgradeComplete(savedPlayer) {
    setPlayerDialogOpen(false);
    if (!savedPlayer?.id || !user?.id || !presidentClub?.id) return;

    writeAccountIntent("both", user.id);
    setAccountIntent("both");
    setPlayer(savedPlayer);
    localStorage.setItem("stage-account-mode", "player");
    localStorage.setItem("stage_player_id", savedPlayer.id);
    localStorage.setItem("stage_club_id", presidentClub.id);
    localStorage.setItem("stage_owner_id", presidentClub.id);
    localStorage.setItem("stage_president_club_id", presidentClub.id);
    window.location.reload();
  }

  if (loading) {
    return (
      <GamerSettingsSection
        title={t("settingsPage.roleUpgradeTitle")}
        description={t("settingsPage.roleUpgradeLoading")}
        icon={Shield}
      >
        <div className="flex items-center gap-2 text-sm text-white/45">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("settingsPage.roleUpgradeLoading")}
        </div>
      </GamerSettingsSection>
    );
  }

  if (!canUpgradePlayerToPresident && !canUpgradePresidentToPlayer) return null;

  return (
    <>
      {canUpgradePlayerToPresident ? (
        <AccountRoleUpgradePrompt
          title={t("settingsPage.roleUpgradeTitle")}
          description={t("settingsPage.roleUpgradePlayerDesc")}
          icon={Shield}
          buttonLabel={t("settingsPage.roleUpgradePlayerButton")}
          buttonClassName="w-full gap-2 bg-amber-500 text-slate-950 hover:bg-amber-400"
          onClick={() => setClubDialogOpen(true)}
        />
      ) : null}

      {canUpgradePresidentToPlayer ? (
        <AccountRoleUpgradePrompt
          title={t("settingsPage.roleUpgradeTitle")}
          description={t("settingsPage.roleUpgradePresidentDesc")}
          icon={Shield}
          buttonLabel={t("settingsPage.roleUpgradePresidentButton")}
          buttonClassName="w-full gap-2 bg-cyan-400 text-slate-950 hover:bg-cyan-300"
          onClick={() => setPlayerDialogOpen(true)}
        />
      ) : null}

      <Dialog open={clubDialogOpen} onOpenChange={setClubDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-[#111a2f] border-white/15">
          <DialogHeader>
            <DialogTitle className="text-white">{t("settingsPage.roleUpgradePlayerDialogTitle")}</DialogTitle>
          </DialogHeader>
          <ClubSetup
            player={player}
            user={user}
            required
            onComplete={handleClubUpgradeComplete}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={playerDialogOpen} onOpenChange={setPlayerDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-[#111a2f] border-white/15">
          <DialogHeader>
            <DialogTitle className="text-white">{t("settingsPage.roleUpgradePresidentDialogTitle")}</DialogTitle>
          </DialogHeader>
          <PlayerSetup
            user={user}
            intent="player"
            onComplete={handlePlayerUpgradeComplete}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

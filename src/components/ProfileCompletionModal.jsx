import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { stageClient } from "@/api/stageClient";
import { Crown, Loader2, Sparkles } from "lucide-react";
import ClubOnboardingModal from "./ClubOnboardingModal";
import { COUNTRIES } from "@/lib/countries";
import { swalAlert } from "@/lib/swal";
import { useTranslation } from "@/hooks/useTranslation";
import { STAGE_PLUS_MONTHLY_CREDITS, TOURNAMENT_ENTRY_CREDITS } from "@/lib/subscriptionUtils";

const POSITIONS = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST", "CF"];
const PLATFORMS = ["PlayStation", "Xbox", "PC"];

export default function ProfileCompletionModal({ open, player, onComplete, allowClubOnboarding = false }) {
  const { t } = useTranslation();
  const [gamertag, setGamertag] = useState(player?.gamertag || "");
  const [position, setPosition] = useState(player?.position || "");
  const [secondaryPosition, setSecondaryPosition] = useState(player?.secondary_position || "none");
  const [platform, setPlatform] = useState(player?.platform || "");
  const [country, setCountry] = useState(player?.country || "");
  const [countryCode, setCountryCode] = useState(player?.country_code || "");
  const [bio, setBio] = useState(player?.bio || "");
  const [loading, setLoading] = useState(false);
  const [savedPlayer, setSavedPlayer] = useState(null);
  const [showClubOnboarding, setShowClubOnboarding] = useState(false);

  async function handleSave() {
    if (!gamertag.trim() || !position || !platform) {
      await swalAlert(t('commonPages.pcmRequired'));
      return;
    }

    setLoading(true);
    const saved = await stageClient.entities.Player.update(player.id, {
      gamertag: gamertag.trim(),
      position,
      secondary_position: secondaryPosition === "none" ? null : secondaryPosition,
      platform,
      country: country || null,
      country_code: countryCode || null,
      bio: bio.trim() || null,
    });
    localStorage.setItem("profile-completed", "true");
    const updatedPlayer = saved || {
      ...player,
      gamertag: gamertag.trim(),
      position,
      secondary_position: secondaryPosition === "none" ? null : secondaryPosition,
      platform,
      country,
      country_code: countryCode,
      bio,
    };
    setSavedPlayer(updatedPlayer);
    setLoading(false);

    if (allowClubOnboarding && !player.club_id) {
      setShowClubOnboarding(true);
    } else {
      onComplete?.(null);
    }
  }

  function handleClubDone(club) {
    setShowClubOnboarding(false);
    onComplete?.(club);
  }

  // If club onboarding is active, show that modal instead
  if (showClubOnboarding && savedPlayer) {
    return (
      <ClubOnboardingModal
        open={true}
        player={savedPlayer}
        onComplete={handleClubDone}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        hideCloseButton
        className="bg-card border-border max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="leading-relaxed text-xl">{t('commonPages.pcmTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t('commonPages.pcmGamertag')}</label>
            <Input
              value={gamertag}
              onChange={e => setGamertag(e.target.value)}
              placeholder={t('commonPages.pcmGamertagPlaceholder')}
              className="bg-secondary border-border"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t('commonPages.pcmMainPosition')}</label>
              <Select value={position} onValueChange={value => {
                setPosition(value);
                if (secondaryPosition === value) setSecondaryPosition("none");
              }}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder={t('commonPages.pcmSelect')} /></SelectTrigger>
                <SelectContent>
                  {POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t('commonPages.pcmSecondPosition')}</label>
              <Select value={secondaryPosition} onValueChange={setSecondaryPosition}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('commonPages.pcmNone')}</SelectItem>
                  {POSITIONS.filter(p => p !== position).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t('commonPages.pcmPlatform')}</label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder={t('commonPages.pcmSelect')} /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t('commonPages.pcmCountry')}</label>
            <Select value={country} onValueChange={v => {
              const found = COUNTRIES.find(c => c.name === v);
              setCountry(v);
              setCountryCode(found?.code || "");
            }}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder={t('commonPages.pcmSelectCountry')} /></SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(c => <SelectItem key={c.code} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t('commonPages.pcmBio')}</label>
            <Textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder={t('commonPages.pcmBioPlaceholder')}
              className="bg-secondary border-border resize-none h-20"
            />
          </div>

          <div className="rounded-xl border border-primary/25 bg-primary/10 p-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                <Crown className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  {t('commonPages.pcmPlusAvailable')}
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('commonPages.pcmPlusDesc', { credits: TOURNAMENT_ENTRY_CREDITS, monthlyCredits: STAGE_PLUS_MONTHLY_CREDITS })}
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-primary text-primary-foreground leading-relaxed"
          >
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('commonPages.pcmSaving')}</> : t('commonPages.pcmComplete')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

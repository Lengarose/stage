import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { stageClient } from "@/api/stageClient";
import { Loader2 } from "lucide-react";
import ClubOnboardingModal from "./ClubOnboardingModal";
import { COUNTRIES } from "@/lib/countries";
import { swalAlert } from "@/lib/swal";

const POSITIONS = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST", "CF"];
const PLATFORMS = ["PlayStation", "Xbox", "PC"];

export default function ProfileCompletionModal({ open, player, onComplete }) {
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
      await swalAlert("Please fill in required fields: Gamertag, Position, and Platform");
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

    // Show club onboarding only if player has no club yet
    if (!player.club_id) {
      setShowClubOnboarding(true);
    } else {
      onComplete?.();
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
      <DialogContent className="bg-card border-border max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="leading-relaxed text-xl">Complete Your Profile 🎮</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Gamertag *</label>
            <Input
              value={gamertag}
              onChange={e => setGamertag(e.target.value)}
              placeholder="Your gaming name"
              className="bg-secondary border-border"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Main Position *</label>
              <Select value={position} onValueChange={value => {
                setPosition(value);
                if (secondaryPosition === value) setSecondaryPosition("none");
              }}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Second Position</label>
              <Select value={secondaryPosition} onValueChange={setSecondaryPosition}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {POSITIONS.filter(p => p !== position).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Platform *</label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Country</label>
            <Select value={country} onValueChange={v => {
              const found = COUNTRIES.find(c => c.name === v);
              setCountry(v);
              setCountryCode(found?.code || "");
            }}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select country" /></SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(c => <SelectItem key={c.code} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Bio</label>
            <Textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              className="bg-secondary border-border resize-none h-20"
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-primary text-primary-foreground leading-relaxed"
          >
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Complete Profile →"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wand2, Check, Loader2, Download } from "lucide-react";
import { cn } from "@/lib/utils";

const STYLES = [
  { id: "realistic", label: "Realistic", emoji: "📸" },
  { id: "cartoon", label: "Cartoon", emoji: "🎨" },
  { id: "anime", label: "Anime", emoji: "⚡" },
  { id: "pixel", label: "Pixel Art", emoji: "🕹️" },
  { id: "neon", label: "Neon", emoji: "💠" },
  { id: "comic", label: "Comic", emoji: "💥" },
];

const SKIN_TONES = [
  { id: "light", label: "Light", color: "#FDDBB4" },
  { id: "medium_light", label: "Med. Light", color: "#E8B98A" },
  { id: "medium", label: "Medium", color: "#C68642" },
  { id: "medium_dark", label: "Med. Dark", color: "#8D5524" },
  { id: "dark", label: "Dark", color: "#4A2912" },
];

const GENDERS = [
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
];

const BACKGROUNDS = [
  { id: "stadium", label: "Stadium" },
  { id: "dark", label: "Dark" },
  { id: "fire", label: "Fire" },
  { id: "galaxy", label: "Galaxy" },
  { id: "pitch", label: "Pitch" },
  { id: "neon_city", label: "Neon City" },
];

const BRANDS = [
  { id: "none", label: "None" },
  { id: "nike", label: "Nike" },
  { id: "adidas", label: "Adidas" },
  { id: "puma", label: "Puma" },
  { id: "new_balance", label: "New Balance" },
  { id: "under_armour", label: "Under Armour" },
];

const BG_MAP = {
  stadium: "a packed football stadium crowd",
  dark: "a dark dramatic black background",
  fire: "dramatic fire and flames",
  galaxy: "a galaxy and stars",
  pitch: "a green football pitch",
  neon_city: "a neon-lit futuristic city at night",
};

const STYLE_MAP = {
  realistic: "photorealistic digital art",
  cartoon: "colorful cartoon style",
  anime: "anime art style",
  pixel: "pixel art 8-bit style",
  neon: "glowing neon synthwave art style",
  comic: "comic book art style with bold lines",
};

function buildPlayerPrompt(player, style, background, gender, skinTone, kitNumber, brand) {
  const skinMap = {
    light: "very fair, light skin tone",
    medium_light: "medium-light skin tone",
    medium: "medium, olive skin tone",
    medium_dark: "medium-dark brown skin tone",
    dark: "dark brown skin tone",
  };
  const pos = player?.position || "footballer";
  const tag = player?.gamertag || "Player";
  const numberPart = kitNumber ? ` with the number ${kitNumber} on the jersey` : "";
  const brandPart = brand && brand !== "none" ? ` The kit features prominent ${brand} branding and logo.` : "";
  return `A ${STYLE_MAP[style] || "digital art"} portrait avatar of a ${gender} professional FIFA Pro Clubs ${pos} football player named "${tag}". The player has ${skinMap[skinTone] || "medium skin tone"}. The player is wearing a futuristic dark football kit with glowing cyan accent details${numberPart}, looking confident and athletic.${brandPart} Background: ${BG_MAP[background] || "dark dramatic background"}. Close-up portrait, square composition, high detail, gaming aesthetic, esports style. No text or watermarks.`;
}

function buildClubLogoPrompt(clubName, style, background) {
  const name = clubName?.trim() || "Unknown FC";
  return `A ${STYLE_MAP[style] || "digital art"} professional football club crest / badge logo for a club called "${name}". The logo is bold, iconic, and modern with a shield or crest shape. Gaming and esports aesthetic with dark tones and glowing cyan accents. Background: ${BG_MAP[background] || "dark dramatic background"}. Square composition, centered logo, high detail. No watermarks.`;
}

const OptionBtn = ({ active, onClick, children, className }) => (
  <button
    onClick={onClick}
    className={cn(
      "py-1.5 px-2 rounded-lg border text-xs leading-relaxed font-medium transition-all text-center",
      active
        ? "bg-primary/10 border-primary text-primary"
        : "bg-secondary border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
      className
    )}
  >
    {children}
  </button>
);

export default function AvatarGenerator({ open, onClose, player, onSelect }) {
  const [imageType, setImageType] = useState("player"); // "player" | "club"
  const [clubName, setClubName] = useState("");
  const [style, setStyle] = useState("realistic");
  const [background, setBackground] = useState("stadium");
  const [gender, setGender] = useState("male");
  const [skinTone, setSkinTone] = useState("medium");
  const [kitNumber, setKitNumber] = useState("");
  const [brand, setBrand] = useState("none");
  const [generated, setGenerated] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function generate() {
    if ((player?.credits ?? 0) < 10) {
      alert("You need at least 10 credits to generate an image.");
      return;
    }
    setLoading(true);
    setGenerated(null);
    try {
      await base44.functions.invoke('spendCredits', { amount: 10, target: 'player' });
    } catch (err) {
      alert(err.message || 'Not enough credits');
      setLoading(false);
      return;
    }
    const prompt = imageType === "club"
      ? buildClubLogoPrompt(clubName, style, background)
      : buildPlayerPrompt(player, style, background, gender, skinTone, kitNumber, brand);
    const result = await base44.integrations.Core.GenerateImage({ prompt });
    setGenerated(result.url);
    setLoading(false);
  }

  async function confirm() {
    if (!generated) return;
    setSaving(true);
    const blob = await fetch(generated).then(r => r.blob());
    const file = new File([blob], "avatar.png", { type: "image/png" });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onSelect(file_url);
    setSaving(false);
    setGenerated(null);
    onClose();
  }

  function handleClose() {
    setGenerated(null);
    onClose();
  }

  const Label = ({ children }) => (
    <label className="text-[10px] text-muted-foreground uppercase tracking-wider leading-relaxed mb-1 block">{children}</label>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="leading-relaxed text-lg flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-primary" /> AI Image Generator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-1">
          {/* Type selector */}
          <div>
            <Label>Generate</Label>
            <div className="flex gap-1.5">
              <OptionBtn active={imageType === "player"} onClick={() => setImageType("player")} className="flex-1">🧑 Player Avatar</OptionBtn>
              <OptionBtn active={imageType === "club"} onClick={() => setImageType("club")} className="flex-1">🛡️ Club Logo</OptionBtn>
            </div>
          </div>

          {/* Club name — only for club logo */}
          {imageType === "club" && (
            <div>
              <Label>Club Name</Label>
              <input
                type="text"
                value={clubName}
                onChange={e => setClubName(e.target.value)}
                placeholder="e.g. Neon Eagles FC"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/50 leading-relaxed"
              />
            </div>
          )}

          {/* Art Style */}
          <div>
            <Label>Art Style</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {STYLES.map(s => (
                <OptionBtn key={s.id} active={style === s.id} onClick={() => setStyle(s.id)}>
                  <span className="mr-1">{s.emoji}</span>{s.label}
                </OptionBtn>
              ))}
            </div>
          </div>

          {/* Player-only fields */}
          {imageType === "player" && (
            <>
              {/* Gender + Kit Number row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Gender</Label>
                  <div className="flex gap-1.5">
                    {GENDERS.map(g => (
                      <OptionBtn key={g.id} active={gender === g.id} onClick={() => setGender(g.id)} className="flex-1">
                        {g.emoji} {g.label}
                      </OptionBtn>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Kit Number (1–99)</Label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={kitNumber}
                    onChange={e => {
                      const v = parseInt(e.target.value);
                      if (e.target.value === "") setKitNumber("");
                      else if (!isNaN(v) && v >= 1 && v <= 99) setKitNumber(v);
                    }}
                    placeholder="e.g. 10"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/50 leading-relaxed"
                  />
                </div>
              </div>

              {/* Skin Tone */}
              <div>
                <Label>Skin Tone</Label>
                <div className="flex gap-1.5">
                  {SKIN_TONES.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSkinTone(s.id)}
                      title={s.label}
                      className={cn(
                        "flex-1 flex flex-col items-center gap-0.5 p-1.5 rounded-lg border transition-all",
                        skinTone === s.id ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40"
                      )}
                    >
                      <span className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: s.color }} />
                      <span className="text-[9px] text-muted-foreground leading-relaxed">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Kit Brand */}
              <div>
                <Label>Kit Brand</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {BRANDS.map(b => (
                    <OptionBtn key={b.id} active={brand === b.id} onClick={() => setBrand(b.id)}>
                      {b.label}
                    </OptionBtn>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Background */}
          <div>
            <Label>Background</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {BACKGROUNDS.map(b => (
                <OptionBtn key={b.id} active={background === b.id} onClick={() => setBackground(b.id)}>
                  {b.label}
                </OptionBtn>
              ))}
            </div>
          </div>

          {/* Preview + Actions */}
          <div className="flex gap-3 items-start">
            <div className="w-20 h-20 rounded-xl bg-secondary border border-border flex items-center justify-center overflow-hidden shrink-0">
              {loading ? (
                <div className="flex flex-col items-center gap-1">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  <span className="text-[9px] text-muted-foreground">Generating...</span>
                </div>
              ) : generated ? (
                <img src={generated} alt="Generated" className="w-full h-full object-cover" />
              ) : (
                <Wand2 className="w-6 h-6 text-muted-foreground/40" />
              )}
            </div>

            <div className="flex-1 space-y-1.5">
              <Button
                onClick={generate}
                disabled={loading}
                className="w-full bg-primary text-primary-foreground leading-relaxed gap-2 h-8 text-xs"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                {generated ? "Regenerate" : imageType === "club" ? "Generate Club Logo" : "Generate Avatar"}
              </Button>

              {generated && (
                <>
                  <Button
                    onClick={confirm}
                    disabled={saving}
                    variant="outline"
                    className="w-full border-success/40 text-success hover:bg-success/10 leading-relaxed gap-2 h-8 text-xs"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Use This Image
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-border text-muted-foreground leading-relaxed gap-2 h-8 text-xs"
                    onClick={async () => {
                      const a = document.createElement("a");
                      const blob = await fetch(generated).then(r => r.blob());
                      a.href = URL.createObjectURL(blob);
                      a.download = "stage-avatar.png";
                      a.click();
                      URL.revokeObjectURL(a.href);
                    }}
                  >
                    <Download className="w-3.5 h-3.5" /> Save to Camera Roll
                  </Button>
                </>
              )}

              <p className="text-[10px] text-muted-foreground">
                Costs <strong>10 credits</strong> per generation. You have <strong>{player?.credits ?? 0}</strong> credits.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
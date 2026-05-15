// @ts-nocheck
import { useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wand2, Check, Loader2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { swalAlert } from "@/lib/swal";

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
  stadium: "stadium crowd background",
  dark: "dark background",
  fire: "fire background",
  galaxy: "galaxy stars background",
  pitch: "football pitch background",
  neon_city: "neon city night background",
};

const STYLE_MAP = {
  realistic: "photorealistic",
  cartoon: "cartoon",
  anime: "anime",
  pixel: "pixel art",
  neon: "neon synthwave",
  comic: "comic book",
};

const SKIN_MAP = {
  light: "light skin",
  medium_light: "medium-light skin",
  medium: "medium skin",
  medium_dark: "medium-dark skin",
  dark: "dark skin",
};

function buildPlayerPrompt(player, style, background, gender, skinTone, kitNumber, brand) {
  const pos = player?.position || "footballer";
  const parts = [
    `${STYLE_MAP[style] || "digital art"} esports footballer portrait`,
    `${gender}`,
    SKIN_MAP[skinTone] || "medium skin",
    `${pos} player`,
    "dark futuristic kit, cyan glow accents",
    kitNumber ? `number ${kitNumber} jersey` : null,
    brand && brand !== "none" ? `${brand} kit` : null,
    BG_MAP[background] || "dark background",
    "close-up square portrait, high detail, no text",
  ].filter(Boolean);
  return parts.join(", ");
}

function buildClubLogoPrompt(clubName, style, background) {
  const name = clubName?.trim() || "FC";
  return [
    `${STYLE_MAP[style] || "digital art"} football club crest`,
    `"${name}" badge`,
    "shield shape, esports aesthetic, cyan glow, dark tones",
    BG_MAP[background] || "dark background",
    "square, centered, no text",
  ].join(", ");
}

/* ── Image generation ───────────────────────────────────────
 * Using Pollinations.ai — free, open source, no API key needed.
 * https://github.com/pollinations/pollinations
 * Valid models: flux, turbo, flux-realism, flux-anime, flux-3d
 *
 * Previously used Base44 built-in generator:
 * const result = await stageClient.integrations.Core.GenerateImage({ prompt });
 * setGenerated(result.url);
 */
async function generateWithPollinations(prompt) {
  const seed = Math.floor(Math.random() * 999999);
  const encoded = encodeURIComponent(prompt);
  // turbo = SDXL Turbo, fast and reliable on Pollinations
  const url = `https://image.pollinations.ai/prompt/${encoded}?model=turbo&seed=${seed}&width=1024&height=1024&nologo=true`;

  const tryLoad = () => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = () => reject(new Error("load failed"));
    img.src = url;
  });

  try {
    await tryLoad();
  } catch {
    await new Promise(r => setTimeout(r, 2500));
    await tryLoad();
  }

  return url;
}

async function imageUrlToBlob(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error("toBlob failed")), "image/png");
    };
    img.onerror = reject;
    img.src = url;
  });
}

const OptionBtn = ({ active, onClick, children, className = "" }) => (
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
  const [imageType, setImageType] = useState("player");
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
    setLoading(true);
    setGenerated(null);
    // spendCredits removed — Pollinations is free, no credits needed
    // Previously: await stageClient.functions.invoke('spendCredits', { amount: 10, target: 'player' });
    try {
      const prompt = imageType === "club"
        ? buildClubLogoPrompt(clubName, style, background)
        : buildPlayerPrompt(player, style, background, gender, skinTone, kitNumber, brand);
      const blobUrl = await generateWithPollinations(prompt);
      setGenerated(blobUrl);
    } catch (err) {
      await swalAlert("Generation failed. Please try again.");
    }
    setLoading(false);
  }

  async function confirm() {
    if (!generated) return;
    setSaving(true);
    try {
      const blob = await imageUrlToBlob(generated);
      const file = new File([blob], "avatar.png", { type: "image/png" });
      const { file_url } = await stageClient.integrations.Core.UploadFile({ file });
      onSelect(file_url);
      setGenerated(null);
      onClose();
    } catch {
      await swalAlert("Failed to save image. Please try again.");
    }
    setSaving(false);
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
          <div>
            <Label>Generate</Label>
            <div className="flex gap-1.5">
              <OptionBtn active={imageType === "player"} onClick={() => setImageType("player")} className="flex-1">🧑 Player Avatar</OptionBtn>
              <OptionBtn active={imageType === "club"} onClick={() => setImageType("club")} className="flex-1">🛡️ Club Logo</OptionBtn>
            </div>
          </div>

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

          {imageType === "player" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Gender</Label>
                  <div className="flex gap-1.5">
                    {GENDERS.map(g => (
                      <OptionBtn key={g.id} active={gender === g.id} onClick={() => setGender(g.id)} className="flex-1">
                        {g.label}
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
                      else if (!isNaN(v) && v >= 1 && v <= 99) setKitNumber(String(v));
                    }}
                    placeholder="e.g. 10"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/50 leading-relaxed"
                  />
                </div>
              </div>

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

          <div className="flex gap-3 items-start">
            <div className="w-20 h-20 rounded-full bg-secondary border border-border flex items-center justify-center overflow-hidden shrink-0">
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
                      const blob = await imageUrlToBlob(generated);
                      const a = document.createElement("a");
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
                Free generation powered by Pollinations AI
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

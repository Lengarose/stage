// Shared store catalog — single source of truth
export const STORE_ITEMS = [
  // ── BANNERS ──────────────────────────────────────────────────
  {
    id: "banner_default",
    type: "banner",
    name: "Default",
    description: "The classic STAGE look",
    price: 0,
    rarity: "free",
    style: "linear-gradient(135deg, hsl(189 100% 52% / 0.15) 0%, hsl(220 60% 8%) 50%, hsl(200 90% 45% / 0.08) 100%)",
  },
  {
    id: "banner_neon_city",
    type: "banner",
    name: "Neon City",
    description: "Vibrant neon gradients",
    price: 200,
    rarity: "rare",
    style: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
  },
  {
    id: "banner_fire",
    type: "banner",
    name: "On Fire",
    description: "Blazing hot",
    price: 300,
    rarity: "rare",
    style: "linear-gradient(135deg, #f12711, #f5af19)",
  },
  {
    id: "banner_ocean",
    type: "banner",
    name: "Deep Ocean",
    description: "Calm & deep",
    price: 250,
    rarity: "rare",
    style: "linear-gradient(135deg, #0f2027, #203a43, #2c5364)",
  },
  {
    id: "banner_aurora",
    type: "banner",
    name: "Aurora",
    description: "Northern lights",
    price: 500,
    rarity: "epic",
    style: "linear-gradient(135deg, #00c6ff, #0072ff, #7b2ff7)",
  },
  {
    id: "banner_gold",
    type: "banner",
    name: "Gold Elite",
    description: "For the champions",
    price: 750,
    rarity: "legendary",
    style: "linear-gradient(135deg, #f7971e, #ffd200, #f7971e)",
  },
  {
    id: "banner_void",
    type: "banner",
    name: "The Void",
    description: "Dark & mysterious",
    price: 400,
    rarity: "epic",
    style: "linear-gradient(135deg, #000000, #1a1a2e, #16213e)",
  },
  {
    id: "banner_matrix",
    type: "banner",
    name: "Matrix",
    description: "Digital rain aesthetic",
    price: 350,
    rarity: "rare",
    style: "linear-gradient(135deg, #000000, #001a00, #003300)",
  },
  {
    id: "banner_sunset",
    type: "banner",
    name: "Sunset",
    description: "Golden hour vibes",
    price: 300,
    rarity: "rare",
    style: "linear-gradient(135deg, #ee0979, #ff6a00)",
  },
  {
    id: "banner_cosmic",
    type: "banner",
    name: "Cosmic",
    description: "Among the stars",
    price: 600,
    rarity: "legendary",
    style: "linear-gradient(135deg, #0d0d0d, #1a0a2e, #6a0dad, #0d0d0d)",
  },

  // ── CLUB LOGO FRAMES ─────────────────────────────────────────
  {
    id: "frame_gold",
    type: "logo_frame",
    name: "Gold Frame",
    description: "Gilded border for your club badge",
    price: 400,
    rarity: "epic",
    style: "border: 3px solid #ffd200; box-shadow: 0 0 20px rgba(255,210,0,0.4);",
  },
  {
    id: "frame_neon",
    type: "logo_frame",
    name: "Neon Frame",
    description: "Electric cyan glow",
    price: 300,
    rarity: "rare",
    style: "border: 3px solid #00e5ff; box-shadow: 0 0 20px rgba(0,229,255,0.4);",
  },
  {
    id: "frame_fire",
    type: "logo_frame",
    name: "Fire Frame",
    description: "Burning edges",
    price: 350,
    rarity: "rare",
    style: "border: 3px solid #f12711; box-shadow: 0 0 20px rgba(241,39,17,0.5);",
  },
  {
    id: "frame_diamond",
    type: "logo_frame",
    name: "Diamond Frame",
    description: "Shining bright",
    price: 800,
    rarity: "legendary",
    style: "border: 3px solid #b9f2ff; box-shadow: 0 0 30px rgba(185,242,255,0.6);",
  },

  // ── SUBSCRIPTIONS ─────────────────────────────────────────────
  {
    id: "sub_rookie",
    type: "subscription",
    name: "YOUTH",
    price_eur: null,
    description: "Your free starting point on STAGE. Play friendlies, build your identity, join tournaments.",
    price: 0,
    rarity: "free",
    perks: [
      "200 credits on sign-up",
      "Create a player account & club",
      "Upload profile picture, club logo & banner",
      "Tournament entry: 50 credits",
      "Tournament creation: 50 credits",
      "Friendly Player vs Player matches",
      "Friendly Club vs Club matches",
      "Team chat & match live chat",
      "Post on player & club feed",
    ],
  },
  {
    id: "sub_pro",
    type: "subscription",
    name: "PRO",
    price_eur: 3.99,
    description: "Start competing seriously. Faster progression, ranked access, better customization.",
    price: 0,
    rarity: "legendary",
    perks: [
      "Everything in STAGE Youth",
      "+100 credits per month",
      "Tournament entry: 40 credits (save 10)",
      "✅ Ranked Player vs Player matches",
      "Better search filters (players & clubs)",
      "Cooldown between ranked matches: 30 min.",
      "Access to custom AI generated profile picture tool: 10 credits (per generated picture)",

    ],
  },
  {
    id: "sub_elite",
    type: "subscription",
    name: "ELITE",
    price_eur: 9.99,
    description: "Full competitive control. The highest tier for serious players and club managers.",
    price: 0,
    rarity: "rare",
    perks: [
      "Everything in STAGE Pro",
      "+300 credits per month",
      "Tournament entry: 30 credits (save 20)",
      "✅ Ranked Player vs Player matches",
      "✅ Ranked Club vs Club matches (EXCLUSIVE)",
      "Access to premium & high-reward tournaments",
      "Full analytics: win rate, form, opponent analysis",
      "⭐ Verified badge + highlighted profile in search",
    ],
  },
];

// Resolve a banner_id to inline CSS style object
export function getBannerStyle(bannerId, position) {
  if (!bannerId) bannerId = "banner_default";
  // Custom uploaded image URL
  if (bannerId.startsWith("http")) {
    return { backgroundImage: `url(${bannerId})`, backgroundSize: "cover", backgroundPosition: position || "50% 50%" };
  }
  const item = STORE_ITEMS.find(i => i.id === bannerId);
  return { background: item?.style || STORE_ITEMS[0].style };
}

export const RARITY_STYLES = {
  free: { label: "Free", color: "text-slate-300", bg: "bg-white/15 border-white/30" },
  rare: { label: "Rare", color: "text-primary", bg: "bg-primary/10 border-primary/20" },
  epic: { label: "Epic", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
  legendary: { label: "Legendary", color: "text-warning", bg: "bg-warning/10 border-warning/20" },
};
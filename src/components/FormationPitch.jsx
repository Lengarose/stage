import { useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Share2 } from "lucide-react";
import { swalAlert } from "@/lib/swal";

const LINE = "rgba(0, 220, 255, 0.7)";
const LINE_BRIGHT = "rgba(0, 220, 255, 0.95)";

// All 11 players per formation: { slot, label, x, y } — x/y on 400x300 SVG viewBox
const FORMATIONS = {
  "4-3-3": [
    { slot: 0,  label: "GK",  x: 30,  y: 150 },
    { slot: 1,  label: "LB",  x: 90,  y: 55  },
    { slot: 2,  label: "CB",  x: 90,  y: 115 },
    { slot: 3,  label: "CB",  x: 90,  y: 185 },
    { slot: 4,  label: "RB",  x: 90,  y: 245 },
    { slot: 5,  label: "LCM", x: 190, y: 85  },
    { slot: 6,  label: "CM",  x: 190, y: 150 },
    { slot: 7,  label: "RCM", x: 190, y: 215 },
    { slot: 8,  label: "LW",  x: 320, y: 65  },
    { slot: 9,  label: "ST",  x: 340, y: 150 },
    { slot: 10, label: "RW",  x: 320, y: 235 },
  ],
  "4-4-2": [
    { slot: 0,  label: "GK",  x: 30,  y: 150 },
    { slot: 1,  label: "LB",  x: 90,  y: 55  },
    { slot: 2,  label: "CB",  x: 90,  y: 115 },
    { slot: 3,  label: "CB",  x: 90,  y: 185 },
    { slot: 4,  label: "RB",  x: 90,  y: 245 },
    { slot: 5,  label: "LM",  x: 200, y: 55  },
    { slot: 6,  label: "LCM", x: 200, y: 120 },
    { slot: 7,  label: "RCM", x: 200, y: 180 },
    { slot: 8,  label: "RM",  x: 200, y: 245 },
    { slot: 9,  label: "LST", x: 340, y: 110 },
    { slot: 10, label: "RST", x: 340, y: 190 },
  ],
  "4-2-3-1": [
    { slot: 0,  label: "GK",  x: 30,  y: 150 },
    { slot: 1,  label: "LB",  x: 90,  y: 55  },
    { slot: 2,  label: "CB",  x: 90,  y: 115 },
    { slot: 3,  label: "CB",  x: 90,  y: 185 },
    { slot: 4,  label: "RB",  x: 90,  y: 245 },
    { slot: 5,  label: "CDM", x: 170, y: 115 },
    { slot: 6,  label: "CDM", x: 170, y: 185 },
    { slot: 7,  label: "LW",  x: 265, y: 60  },
    { slot: 8,  label: "CAM", x: 265, y: 150 },
    { slot: 9,  label: "RW",  x: 265, y: 240 },
    { slot: 10, label: "ST",  x: 355, y: 150 },
  ],
  "4-3-2-1": [
    { slot: 0,  label: "GK",  x: 30,  y: 150 },
    { slot: 1,  label: "LB",  x: 90,  y: 55  },
    { slot: 2,  label: "CB",  x: 90,  y: 115 },
    { slot: 3,  label: "CB",  x: 90,  y: 185 },
    { slot: 4,  label: "RB",  x: 90,  y: 245 },
    { slot: 5,  label: "LCM", x: 175, y: 90  },
    { slot: 6,  label: "CM",  x: 175, y: 150 },
    { slot: 7,  label: "RCM", x: 175, y: 210 },
    { slot: 8,  label: "LF",  x: 275, y: 115 },
    { slot: 9,  label: "RF",  x: 275, y: 185 },
    { slot: 10, label: "ST",  x: 355, y: 150 },
  ],
  "4-1-2-1-2": [
    { slot: 0,  label: "GK",  x: 30,  y: 150 },
    { slot: 1,  label: "LB",  x: 90,  y: 55  },
    { slot: 2,  label: "CB",  x: 90,  y: 115 },
    { slot: 3,  label: "CB",  x: 90,  y: 185 },
    { slot: 4,  label: "RB",  x: 90,  y: 245 },
    { slot: 5,  label: "CDM", x: 160, y: 150 },
    { slot: 6,  label: "LM",  x: 225, y: 100 },
    { slot: 7,  label: "RM",  x: 225, y: 200 },
    { slot: 8,  label: "CAM", x: 280, y: 150 },
    { slot: 9,  label: "LST", x: 355, y: 110 },
    { slot: 10, label: "RST", x: 355, y: 190 },
  ],
  "3-5-2": [
    { slot: 0,  label: "GK",  x: 30,  y: 150 },
    { slot: 1,  label: "CB",  x: 95,  y: 90  },
    { slot: 2,  label: "CB",  x: 95,  y: 150 },
    { slot: 3,  label: "CB",  x: 95,  y: 210 },
    { slot: 4,  label: "LWB", x: 185, y: 45  },
    { slot: 5,  label: "LCM", x: 185, y: 110 },
    { slot: 6,  label: "CM",  x: 185, y: 150 },
    { slot: 7,  label: "RCM", x: 185, y: 190 },
    { slot: 8,  label: "RWB", x: 185, y: 255 },
    { slot: 9,  label: "LST", x: 345, y: 110 },
    { slot: 10, label: "RST", x: 345, y: 190 },
  ],
  "3-4-3": [
    { slot: 0,  label: "GK",  x: 30,  y: 150 },
    { slot: 1,  label: "CB",  x: 95,  y: 90  },
    { slot: 2,  label: "CB",  x: 95,  y: 150 },
    { slot: 3,  label: "CB",  x: 95,  y: 210 },
    { slot: 4,  label: "LM",  x: 195, y: 80  },
    { slot: 5,  label: "LCM", x: 195, y: 135 },
    { slot: 6,  label: "RCM", x: 195, y: 165 },
    { slot: 7,  label: "RM",  x: 195, y: 220 },
    { slot: 8,  label: "LW",  x: 330, y: 65  },
    { slot: 9,  label: "ST",  x: 350, y: 150 },
    { slot: 10, label: "RW",  x: 330, y: 235 },
  ],
  "5-3-2": [
    { slot: 0,  label: "GK",  x: 30,  y: 150 },
    { slot: 1,  label: "LWB", x: 90,  y: 40  },
    { slot: 2,  label: "CB",  x: 90,  y: 95  },
    { slot: 3,  label: "CB",  x: 90,  y: 150 },
    { slot: 4,  label: "CB",  x: 90,  y: 205 },
    { slot: 5,  label: "RWB", x: 90,  y: 260 },
    { slot: 6,  label: "LCM", x: 210, y: 100 },
    { slot: 7,  label: "CM",  x: 210, y: 150 },
    { slot: 8,  label: "RCM", x: 210, y: 200 },
    { slot: 9,  label: "LST", x: 345, y: 110 },
    { slot: 10, label: "RST", x: 345, y: 190 },
  ],
  "5-4-1": [
    { slot: 0,  label: "GK",  x: 30,  y: 150 },
    { slot: 1,  label: "LWB", x: 90,  y: 40  },
    { slot: 2,  label: "CB",  x: 90,  y: 95  },
    { slot: 3,  label: "CB",  x: 90,  y: 150 },
    { slot: 4,  label: "CB",  x: 90,  y: 205 },
    { slot: 5,  label: "RWB", x: 90,  y: 260 },
    { slot: 6,  label: "LM",  x: 205, y: 65  },
    { slot: 7,  label: "LCM", x: 205, y: 130 },
    { slot: 8,  label: "RCM", x: 205, y: 170 },
    { slot: 9,  label: "RM",  x: 205, y: 235 },
    { slot: 10, label: "ST",  x: 355, y: 150 },
  ],
  "4-5-1": [
    { slot: 0,  label: "GK",  x: 30,  y: 150 },
    { slot: 1,  label: "LB",  x: 90,  y: 55  },
    { slot: 2,  label: "CB",  x: 90,  y: 115 },
    { slot: 3,  label: "CB",  x: 90,  y: 185 },
    { slot: 4,  label: "RB",  x: 90,  y: 245 },
    { slot: 5,  label: "LM",  x: 205, y: 45  },
    { slot: 6,  label: "LCM", x: 205, y: 105 },
    { slot: 7,  label: "CM",  x: 205, y: 150 },
    { slot: 8,  label: "RCM", x: 205, y: 195 },
    { slot: 9,  label: "RM",  x: 205, y: 255 },
    { slot: 10, label: "ST",  x: 355, y: 150 },
  ],
  "4-4-2 Diamond": [
    { slot: 0,  label: "GK",  x: 30,  y: 150 },
    { slot: 1,  label: "LB",  x: 90,  y: 55  },
    { slot: 2,  label: "CB",  x: 90,  y: 115 },
    { slot: 3,  label: "CB",  x: 90,  y: 185 },
    { slot: 4,  label: "RB",  x: 90,  y: 245 },
    { slot: 5,  label: "CDM", x: 175, y: 150 },
    { slot: 6,  label: "LM",  x: 240, y: 95  },
    { slot: 7,  label: "RM",  x: 240, y: 205 },
    { slot: 8,  label: "CAM", x: 295, y: 150 },
    { slot: 9,  label: "LST", x: 355, y: 110 },
    { slot: 10, label: "RST", x: 355, y: 190 },
  ],
  "3-4-2-1": [
    { slot: 0,  label: "GK",  x: 30,  y: 150 },
    { slot: 1,  label: "CB",  x: 90,  y: 90  },
    { slot: 2,  label: "CB",  x: 90,  y: 150 },
    { slot: 3,  label: "CB",  x: 90,  y: 210 },
    { slot: 4,  label: "LWB", x: 180, y: 60  },
    { slot: 5,  label: "LCM", x: 180, y: 130 },
    { slot: 6,  label: "RCM", x: 180, y: 170 },
    { slot: 7,  label: "RWB", x: 180, y: 240 },
    { slot: 8,  label: "LF",  x: 285, y: 115 },
    { slot: 9,  label: "RF",  x: 285, y: 185 },
    { slot: 10, label: "ST",  x: 355, y: 150 },
  ],
};

export default function FormationPitch({ club, players, canEdit, onUpdate, currentUserEmail, onSaveToMatch, saveToMatchLabel }) {
  const [formation, setFormation] = useState(club?.formation || "4-3-3");
  const [lineup, setLineup] = useState(club?.lineup || []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selected, setSelected] = useState(null);

  const positions = FORMATIONS[formation] || FORMATIONS["4-3-3"];

  function getSlotPlayer(slot) {
    return lineup.find(l => l.slot === slot);
  }

  function assignPlayer(slot, playerId) {
    if (!playerId) {
      setLineup(prev => prev.filter(l => l.slot !== slot));
      setSelected(null);
      return;
    }
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    const newLineup = lineup.filter(l => l.slot !== slot && l.player_id !== playerId);
    setLineup([...newLineup, { slot, player_id: playerId, gamertag: player.gamertag, position: player.position }]);
    setSelected(null);
  }

  async function saveFormation() {
    setSaving(true);
    if (onSaveToMatch) {
      await onSaveToMatch({ formation, lineup });
    } else {
      await stageClient.entities.Club.update(club.id, { formation, lineup });
      onUpdate?.({ formation, lineup });
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function postLineupToFeed() {
    const text = positions.map(({ slot, label }) => {
      const p = getSlotPlayer(slot);
      return `${label}: ${p ? p.gamertag : "?"}`;
    }).join("  |  ");

    await stageClient.entities.Post.create({
      author_email: currentUserEmail,
      author_name: club.name,
      content: `📋 **${club.name} Starting Lineup** (${formation})\n\n${text}`,
      club_id: club.id,
      club_name: club.name,
      tags: ["lineup", "formation"],
    });
    await swalAlert("Lineup posted to the club feed!");
  }

  // Find popup position for selected slot
  const selectedPos = selected !== null ? positions.find(p => p.slot === selected) : null;

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-48">
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Formation</label>
            <Select value={formation} onValueChange={f => { setFormation(f); setLineup([]); setSelected(null); }}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.keys(FORMATIONS).map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 self-end">
            <Button onClick={saveFormation} disabled={saving} className="bg-primary text-primary-foreground leading-relaxed">
              {saved ? <><Check className="w-4 h-4 mr-1" />Saved!</> : saving ? "Saving..." : saveToMatchLabel || "Save Formation"}
            </Button>
            <Button onClick={postLineupToFeed} variant="outline" className="border-border leading-relaxed">
              <Share2 className="w-4 h-4 mr-1.5" /> Post Lineup
            </Button>
          </div>
        </div>
      )}

      {!canEdit && (
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">Formation:</span>
          <span className="leading-relaxed font-bold text-2xl text-primary">{formation}</span>
        </div>
      )}

      <div className="w-full max-w-2xl mx-auto relative" style={{ aspectRatio: "4/3" }}>
        <svg viewBox="0 0 400 300" className="w-full h-full rounded-xl"
          style={{ background: "linear-gradient(160deg, hsl(220,70%,6%) 0%, hsl(220,60%,9%) 100%)", filter: "drop-shadow(0 0 18px hsl(189,100%,52%,0.08))" }}>

          {/* Grass texture stripes */}
          {[0,1,2,3,4,5,6,7].map(i => (
            <rect key={i} x="8" y={8 + i * 35.5} width="384" height="17.75"
              fill={i % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent"} />
          ))}

          {/* Outer border */}
          <rect x="8" y="8" width="384" height="284" fill="none" stroke={LINE} strokeWidth="1.5" />
          {/* Centre line */}
          <line x1="200" y1="8" x2="200" y2="292" stroke={LINE} strokeWidth="1.5" />
          {/* Centre circle */}
          <circle cx="200" cy="150" r="38" fill="none" stroke={LINE} strokeWidth="1.5" />
          {/* Centre spot */}
          <circle cx="200" cy="150" r="2.5" fill={LINE_BRIGHT} />

          {/* LEFT penalty box */}
          <rect x="8" y="82" width="58" height="136" fill="none" stroke={LINE} strokeWidth="1.5" />
          {/* LEFT 6-yard box */}
          <rect x="8" y="115" width="22" height="70" fill="none" stroke={LINE} strokeWidth="1.5" />
          {/* LEFT goal */}
          <rect x="0" y="128" width="8" height="44" fill="rgba(0,220,255,0.06)" stroke={LINE_BRIGHT} strokeWidth="1.5" />
          {/* LEFT penalty spot */}
          <circle cx="52" cy="150" r="2.5" fill={LINE_BRIGHT} />
          {/* LEFT penalty arc */}
          <path d="M 66 120 A 30 30 0 0 1 66 180" fill="none" stroke={LINE} strokeWidth="1.5" />

          {/* RIGHT penalty box */}
          <rect x="334" y="82" width="58" height="136" fill="none" stroke={LINE} strokeWidth="1.5" />
          {/* RIGHT 6-yard box */}
          <rect x="370" y="115" width="22" height="70" fill="none" stroke={LINE} strokeWidth="1.5" />
          {/* RIGHT goal */}
          <rect x="392" y="128" width="8" height="44" fill="rgba(0,220,255,0.06)" stroke={LINE_BRIGHT} strokeWidth="1.5" />
          {/* RIGHT penalty spot */}
          <circle cx="348" cy="150" r="2.5" fill={LINE_BRIGHT} />
          {/* RIGHT penalty arc */}
          <path d="M 334 120 A 30 30 0 0 0 334 180" fill="none" stroke={LINE} strokeWidth="1.5" />

          {/* Players */}
          {positions.map(({ slot, label, x, y }) => {
            const slotPlayer = getSlotPlayer(slot);
            const isSelected = selected === slot;
            const avatarPlayer = slotPlayer ? players.find(p => p.id === slotPlayer.player_id) : null;
            const avatarUrl = avatarPlayer?.avatar_url;

            return (
              <g key={slot} style={{ cursor: canEdit ? "pointer" : "default" }}
                onClick={() => canEdit && setSelected(isSelected ? null : slot)}>
                {/* Glow behind player */}
                {slotPlayer && (
                  <circle cx={x} cy={y} r="18" fill="rgba(0,220,255,0.08)" />
                )}
                {isSelected && (
                  <circle cx={x} cy={y} r="17" fill="none" stroke="rgba(0,220,255,0.9)" strokeWidth="1.5" strokeDasharray="3 2" />
                )}
                <circle cx={x} cy={y} r="13"
                  fill={slotPlayer ? "hsl(220,70%,10%)" : "hsl(220,60%,8%)"}
                  stroke={slotPlayer ? "rgba(0,220,255,0.95)" : "rgba(0,220,255,0.35)"}
                  strokeWidth={slotPlayer ? "1.8" : "1"}
                />
                {slotPlayer && avatarUrl ? (
                  <>
                    <defs>
                      <clipPath id={`clip-${slot}`}>
                        <circle cx={x} cy={y} r="12" />
                      </clipPath>
                    </defs>
                    <image
                      href={avatarUrl}
                      x={x - 12} y={y - 12}
                      width="24" height="24"
                      clipPath={`url(#clip-${slot})`}
                      preserveAspectRatio="xMidYMid slice"
                    />
                  </>
                ) : (
                  <text x={x} y={y + 4} textAnchor="middle" fontSize="7" fontWeight="bold"
                    fill={slotPlayer ? "rgba(0,220,255,1)" : "rgba(255,255,255,0.45)"}
                    fontFamily="sans-serif" style={{ userSelect: "none" }}>
                    {slotPlayer ? slotPlayer.gamertag.slice(0, 5) : label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Player picker dropdown */}
        {canEdit && selectedPos && (
          <div
            className="absolute z-20 bg-card border border-border rounded-xl shadow-2xl p-3 min-w-44"
            style={{
              top: `${(selectedPos.y / 300) * 100}%`,
              left: `${(selectedPos.x / 400) * 100}%`,
              transform: "translate(-50%, 20px)"
            }}
          >
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-bold">{selectedPos.label}</p>
            <select
              className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground"
              defaultValue={getSlotPlayer(selected)?.player_id || ""}
              onChange={e => assignPlayer(selected, e.target.value)}
            >
              <option value="">— Empty —</option>
              {players.map(p => (
                <option key={p.id} value={p.id}>{p.gamertag} ({p.position})</option>
              ))}
            </select>
            <button onClick={() => setSelected(null)} className="mt-2 text-xs text-muted-foreground hover:text-foreground w-full text-center">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
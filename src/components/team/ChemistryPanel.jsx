import { useEffect, useMemo, useState } from 'react';
import { stageClient } from '@/api/stageClient';

/**
 * ChemistryPanel — given a squad (array of player IDs), shows the active
 * chemistry links and a coarse total-bonus indicator (0–100, FUT-style chem score).
 *
 * Server-derived links (chemistry_links table) are merged with frontend-derived
 * links (same nationality / same current club) using the SAME rules as
 * server/src/server/services/chemistryService.js — so the displayed chem score
 * matches what the scheduleEngine will apply at match time.
 *
 * Props:
 *   - players:                Array<{ id, gamertag?, country?, country_code?, club_id? }>
 *   - cornerstonePlayerId?:   string (optional — doubles links touching this player)
 */

const MAX_TOTAL_BONUS   = 0.15;
const NATIONALITY_BONUS = 0.01;
const SAME_CLUB_BONUS   = 0.015;
const CORNERSTONE_BOOST = 2.0;

function canonicalPair(a, b) {
  return String(a) < String(b) ? [a, b] : [b, a];
}

export default function ChemistryPanel({ players = [], cornerstonePlayerId = null }) {
  const [storedLinks, setStoredLinks] = useState([]);
  const [loading, setLoading] = useState(false);

  const squadIds = useMemo(
    () => Array.from(new Set((players || []).map(p => p?.id).filter(Boolean))),
    [players],
  );

  useEffect(() => {
    let cancelled = false;
    if (squadIds.length < 2) { setStoredLinks([]); return; }
    setLoading(true);
    stageClient.entities.ChemistryLink
      .filter({ squad_ids: squadIds.join(','), is_active: 1 }, '-created_date', 200)
      .then((rows) => { if (!cancelled) setStoredLinks(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (!cancelled) setStoredLinks([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [squadIds]);

  const result = useMemo(() => {
    if (squadIds.length < 2) {
      return { links: [], totalBonus: 0, chemScore: 0 };
    }
    const links = [];

    // 1) Server-stored links
    for (const l of storedLinks) {
      const factor = Number(l.bonus_factor) || 0;
      const delta = factor > 1 ? factor - 1 : factor;
      links.push({
        a: l.player_a_id,
        b: l.player_b_id,
        link_type: l.link_type,
        bonus: delta,
        source: l.source,
        stored: true,
      });
    }

    // 2) Derived: shared nationality / same current club
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const p1 = players[i], p2 = players[j];
        if (!p1?.id || !p2?.id) continue;
        const code1 = p1.country_code || p1.country;
        const code2 = p2.country_code || p2.country;
        if (code1 && code2 && code1 === code2) {
          const [a, b] = canonicalPair(p1.id, p2.id);
          if (!links.find(l => l.a === a && l.b === b && l.link_type === 'nationality')) {
            links.push({ a, b, link_type: 'nationality', bonus: NATIONALITY_BONUS, source: code1 });
          }
        }
        if (p1.club_id && p2.club_id && p1.club_id === p2.club_id) {
          const [a, b] = canonicalPair(p1.id, p2.id);
          if (!links.find(l => l.a === a && l.b === b && l.link_type === 'club_current')) {
            links.push({ a, b, link_type: 'club_current', bonus: SAME_CLUB_BONUS, source: p1.club_id });
          }
        }
      }
    }

    // 3) Cornerstone
    if (cornerstonePlayerId) {
      for (const l of links) {
        if (l.a === cornerstonePlayerId || l.b === cornerstonePlayerId) {
          l.bonus *= CORNERSTONE_BOOST;
          l.cornerstone = true;
        }
      }
    }

    // 4) Sum and cap
    let totalBonus = links.reduce((s, l) => s + (Number(l.bonus) || 0), 0);
    if (totalBonus > MAX_TOTAL_BONUS) totalBonus = MAX_TOTAL_BONUS;
    if (totalBonus < 0) totalBonus = 0;

    const chemScore = Math.round((totalBonus / MAX_TOTAL_BONUS) * 100);
    return { links, totalBonus, chemScore };
  }, [players, storedLinks, cornerstonePlayerId, squadIds.length]);

  const nameById = useMemo(() => {
    const m = {};
    for (const p of players) if (p?.id) m[p.id] = p.gamertag || p.id.slice(0, 6);
    return m;
  }, [players]);

  if (squadIds.length < 2) {
    return <div className="p-3 text-sm text-muted-foreground">Pick at least 2 players to compute chemistry.</div>;
  }

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Squad Chemistry</span>
        <span className="font-mono text-sm">
          {loading ? '…' : `${result.chemScore} / 100`}
          <span className="text-muted-foreground ml-1">
            (+{(result.totalBonus * 100).toFixed(1)}%)
          </span>
        </span>
      </div>

      <div className="h-2 w-full rounded bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${result.chemScore}%` }}
        />
      </div>

      {result.links.length === 0 ? (
        <p className="text-xs text-muted-foreground">No chemistry links between selected players.</p>
      ) : (
        <ul className="space-y-1 max-h-48 overflow-auto">
          {result.links.map((l, idx) => (
            <li key={`${l.a}_${l.b}_${l.link_type}_${idx}`} className="text-xs flex items-center justify-between gap-2">
              <span className="truncate">
                <span className="font-medium">{nameById[l.a] || l.a.slice(0, 6)}</span>
                {' ↔ '}
                <span className="font-medium">{nameById[l.b] || l.b.slice(0, 6)}</span>
                <span className="text-muted-foreground ml-2">
                  ({l.link_type}{l.source ? ` · ${l.source}` : ''}{l.cornerstone ? ' · cornerstone' : ''})
                </span>
              </span>
              <span className="font-mono text-muted-foreground shrink-0">+{(l.bonus * 100).toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { base44 } from "@/api/base44Client";

// ─── Badge / label helpers ────────────────────────────────────────────────────

export function defaultBadgeType(position) {
  if (position === 1) return "winner";
  if (position === 2) return "finalist";
  if (position <= 4)  return "semi_finalist";
  if (position <= 8)  return "top_4";
  return "participant";
}

export function defaultPositionLabel(position) {
  const labels = { 1: "Winner", 2: "Runner-Up", 3: "3rd Place", 4: "4th Place" };
  return labels[position] || `${position}th Place`;
}

export const BADGE_STYLE = {
  winner:        { bg: "bg-yellow-500/15",  text: "text-yellow-400",  border: "border-yellow-500/30",  label: "Winner"      },
  finalist:      { bg: "bg-zinc-400/10",    text: "text-zinc-300",    border: "border-zinc-400/30",    label: "Runner-Up"   },
  semi_finalist: { bg: "bg-amber-700/10",   text: "text-amber-500",   border: "border-amber-600/30",   label: "Semi-Final"  },
  top_4:         { bg: "bg-primary/10",     text: "text-primary",     border: "border-primary/30",     label: "Top 4"       },
  participant:   { bg: "bg-secondary",      text: "text-muted-foreground", border: "border-border",   label: "Participant" },
};

// ─── Core distribution ────────────────────────────────────────────────────────

export async function distributeSeasonRewards({
  sourceId,
  sourceType,     // "competition" | "regional_league"
  sourceName,
  seasonId,       // CompetitionSeason.id (empty string for regional_league)
  seasonNumber,
  seasonLabel,
  trophyImageUrl,
  standings,      // pre-sorted standings array (final_position must be set or position is used)
}) {
  if (!standings?.length) return { skipped: true, reason: "no standings" };

  // Idempotency: if any ClubAchievement already exists for this source+season, skip
  const existing = await (base44.entities.ClubAchievement?.filter(
    { source_id: sourceId, season_number: seasonNumber }, null, 2
  ) ?? Promise.resolve([])).catch(() => []);
  if (existing.length > 0) return { skipped: true, reason: "already distributed" };

  // Load reward config for this source
  const configs = await (base44.entities.RewardConfig?.filter(
    { source_id: sourceId }, null, 20
  ) ?? Promise.resolve([])).catch(() => []);
  const configMap = {};
  configs.forEach(c => { configMap[c.position] = c; });

  const nowIso = new Date().toISOString();

  // Normalise: ensure every standing has a numeric final_position
  const ranked = standings.map((s, i) => ({
    ...s,
    final_position: s.final_position || s.position || (i + 1),
  }));

  // ── Club achievements + STC payouts ─────────────────────────────────────────
  await Promise.all(ranked.map(async (standing) => {
    const pos = standing.final_position;
    if (!pos || !standing.club_id) return;

    const config    = configMap[pos];
    const stcAmount = config?.stc_amount   || 0;
    const posLabel  = config?.position_label || defaultPositionLabel(pos);
    const badge     = config?.badge_type   || defaultBadgeType(pos);

    await (base44.entities.ClubAchievement?.create({
      club_id:          standing.club_id,
      club_name:        standing.club_name,
      club_logo_url:    standing.club_logo_url || "",
      club_tag:         standing.club_tag      || "",
      source_id:        sourceId,
      source_type:      sourceType,
      source_name:      sourceName,
      season_id:        seasonId || "",
      season_number:    seasonNumber,
      season_label:     seasonLabel,
      position:         pos,
      position_label:   posLabel,
      badge_type:       badge,
      stc_awarded:      stcAmount,
      trophy_image_url: trophyImageUrl || "",
      awarded_at:       nowIso,
    }) ?? Promise.resolve()).catch(() => {});

    if (stcAmount > 0) {
      await base44.entities.Club.filter({ id: standing.club_id }, null, 1)
        .then(async (arr) => {
          const club = arr[0];
          if (!club) return;
          await Promise.all([
            base44.entities.Club.update(club.id, {
              stc:     (club.stc     || 0) + stcAmount,
              trophies: badge === "winner" ? (club.trophies || 0) + 1 : (club.trophies || 0),
            }),
            base44.entities.STCTransaction.create({
              club_id:      club.id,
              amount:       stcAmount,
              type:         "season_prize",
              description:  `${posLabel} — ${sourceName} · ${seasonLabel}`,
              reference_id: sourceId,
            }),
          ]);
        })
        .catch(() => {});
    }
  }));

  // ── Player achievements (fire-and-forget per standing) ─────────────────────
  _distributePlayerAchievements({
    ranked, sourceId, sourceType, sourceName,
    seasonId, seasonNumber, seasonLabel, trophyImageUrl, configMap, nowIso,
  }).catch(() => {});

  return { distributed: ranked.length };
}

async function _distributePlayerAchievements({
  ranked, sourceId, sourceType, sourceName,
  seasonId, seasonNumber, seasonLabel, trophyImageUrl, configMap, nowIso,
}) {
  for (const standing of ranked) {
    const pos = standing.final_position;
    if (!pos || !standing.club_id) continue;

    const config   = configMap[pos];
    const posLabel = config?.position_label || defaultPositionLabel(pos);
    const badge    = config?.badge_type    || defaultBadgeType(pos);

    const players = await base44.entities.Player.filter(
      { club_id: standing.club_id }, null, 50
    ).catch(() => []);

    await Promise.all(players.map(player =>
      (base44.entities.PlayerAchievement?.create({
        player_id:        player.id,
        player_email:     player.email    || "",
        player_gamertag:  player.gamertag || "",
        club_id:          standing.club_id,
        club_name:        standing.club_name,
        source_id:        sourceId,
        source_type:      sourceType,
        source_name:      sourceName,
        season_id:        seasonId || "",
        season_number:    seasonNumber,
        season_label:     seasonLabel,
        position:         pos,
        position_label:   posLabel,
        badge_type:       badge,
        trophy_image_url: trophyImageUrl || "",
        awarded_at:       nowIso,
      }) ?? Promise.resolve())
      .catch(() => {})
    ));
  }
}

// ─── Reward config helpers (used by admin UI) ─────────────────────────────────

export async function getRewardConfigs(sourceId) {
  return (base44.entities.RewardConfig?.filter({ source_id: sourceId }, null, 20) ?? Promise.resolve([]))
    .catch(() => []);
}

export async function saveRewardConfigs(sourceId, sourceType, sourceName, rows) {
  // rows: [{ position, position_label, badge_type, stc_amount }]
  // Strategy: delete all existing configs for this source, then re-create
  const existing = await getRewardConfigs(sourceId);
  await Promise.all(existing.map(c =>
    (base44.entities.RewardConfig?.delete(c.id) ?? Promise.resolve()).catch(() => {})
  ));
  await Promise.all(rows.map(row =>
    (base44.entities.RewardConfig?.create({
      source_id:      sourceId,
      source_type:    sourceType,
      source_name:    sourceName,
      position:       Number(row.position),
      position_label: row.position_label || defaultPositionLabel(Number(row.position)),
      badge_type:     row.badge_type     || defaultBadgeType(Number(row.position)),
      stc_amount:     Number(row.stc_amount) || 0,
    }) ?? Promise.resolve()).catch(() => {})
  ));
}

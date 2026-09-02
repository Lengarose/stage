import { useEffect, useState, useCallback } from 'react';
import { stageClient } from '@/api/stageClient';
import { useTranslation } from '@/hooks/useTranslation';
import { GamerHeroAction } from '@/components/profile/gamer/GamerProfileUI';

const ROW_CLIP = { clipPath: "polygon(4% 0, 100% 0, 96% 100%, 0 100%)" };

/**
 * ObjectivesWidget — dashboard widget showing the current player's open
 * Daily / Weekly objectives.
 *
 * Reads from /api/stage/objective-progress (joined with objective_definitions
 * server-side via ObjectiveProgressModel#selectByPlayer for richer rows).
 * Claim is performed via stageClient.functions.invoke('claimObjectiveReward').
 *
 * Props:
 *   - playerId:   string  (required)
 *   - scope:      'daily' | 'weekly' | undefined  (filter; undefined = both)
 *   - onClaimed:  (result) => void   optional callback after a successful claim
 */
export default function ObjectivesWidget({ playerId, scope, onClaimed }) {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [claimingId, setClaimingId] = useState(null);

  const load = useCallback(async () => {
    if (!playerId) return;
    setLoading(true);
    setError(null);
    try {
      const params = { player_id: playerId, limit: 50 };
      if (scope) params.scope = scope;
      const rows = await stageClient.entities.ObjectiveProgress.filter(params, '-created_date', 50);
      setItems(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err?.message || t('commonPages.dashboardObjectivesError'));
    } finally {
      setLoading(false);
    }
  }, [playerId, scope, t]);

  useEffect(() => { load(); }, [load]);

  const handleClaim = async (progressId) => {
    setClaimingId(progressId);
    try {
      const result = await stageClient.functions.invoke('claimObjectiveReward', { progress_id: progressId });
      if (onClaimed) onClaimed(result);
      await load();
    } catch (err) {
      setError(err?.message || t('commonPages.dashboardObjectivesClaimError'));
    } finally {
      setClaimingId(null);
    }
  };

  if (!playerId) return null;
  if (loading) return <div className="text-sm text-white/45">{t('commonPages.dashboardObjectivesLoading')}</div>;
  if (error)   return <div className="text-sm text-rose-400">{error}</div>;
  if (!items.length) return <div className="text-sm text-white/45">{t('commonPages.dashboardObjectivesEmpty')}</div>;

  return (
    <div className="space-y-2">
      {items.map((it) => {
        const target  = Number(it.def_target ?? it.target_value ?? 1);
        const current = Number(it.current_value ?? 0);
        const pct     = Math.min(100, Math.round((current / Math.max(1, target)) * 100));
        const completed = !!it.completed_at;
        const claimed   = !!it.claimed_at;

        return (
          <div key={it.id} className="border border-cyan-300/20 bg-gradient-to-r from-[#070b14]/95 via-black/88 to-[#070b14]/90 p-3 backdrop-blur-md" style={ROW_CLIP}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300/80">
                    {(it.def_scope || it.scope || 'daily').toUpperCase()}
                  </span>
                  <span className="font-heading font-black uppercase text-sm text-white truncate">{it.title || it.objective_id}</span>
                </div>
                {it.description ? (
                  <p className="text-xs text-white/45 mb-2">{it.description}</p>
                ) : null}
                <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-teal-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-white/40">
                  {current} / {target} · {t('commonPages.dashboardObjectivesReward')}: {Number(it.reward_stc || 0).toLocaleString()} STC
                  {it.reward_xp ? ` · ${it.reward_xp} XP` : ''}
                </div>
              </div>
              <div className="shrink-0">
                {claimed ? (
                  <span className="text-xs text-white/40">{t('commonPages.dashboardObjectivesClaimed')}</span>
                ) : completed ? (
                  <GamerHeroAction
                    type="button"
                    onClick={() => handleClaim(it.id)}
                    disabled={claimingId === it.id}
                    className="max-w-none px-3 py-1.5 text-[10px] disabled:opacity-50"
                  >
                    {claimingId === it.id ? t('commonPages.dashboardObjectivesClaiming') : t('commonPages.dashboardObjectivesClaim')}
                  </GamerHeroAction>
                ) : (
                  <span className="text-xs text-white/40">{t('commonPages.dashboardObjectivesInProgress')}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

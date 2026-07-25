import { useEffect, useState, useCallback } from 'react';
import { stageClient } from '@/api/stageClient';
import { useTranslation } from '@/hooks/useTranslation';

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
  if (loading) return <div className="p-4 text-sm text-muted-foreground">{t('commonPages.dashboardObjectivesLoading')}</div>;
  if (error)   return <div className="p-4 text-sm text-red-500">{error}</div>;
  if (!items.length) return <div className="p-4 text-sm text-muted-foreground">{t('commonPages.dashboardObjectivesEmpty')}</div>;

  return (
    <div className="space-y-2">
      {items.map((it) => {
        const target  = Number(it.def_target ?? it.target_value ?? 1);
        const current = Number(it.current_value ?? 0);
        const pct     = Math.min(100, Math.round((current / Math.max(1, target)) * 100));
        const completed = !!it.completed_at;
        const claimed   = !!it.claimed_at;

        return (
          <div key={it.id} className="rounded-md border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {(it.def_scope || it.scope || 'daily').toUpperCase()}
                  </span>
                  <span className="font-semibold truncate">{it.title || it.objective_id}</span>
                </div>
                {it.description ? (
                  <p className="text-xs text-muted-foreground mb-2">{it.description}</p>
                ) : null}
                <div className="h-2 w-full rounded bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {current} / {target} · {t('commonPages.dashboardObjectivesReward')}: {Number(it.reward_stc || 0).toLocaleString()} STC
                  {it.reward_xp ? ` · ${it.reward_xp} XP` : ''}
                </div>
              </div>
              <div className="shrink-0">
                {claimed ? (
                  <span className="text-xs text-muted-foreground">{t('commonPages.dashboardObjectivesClaimed')}</span>
                ) : completed ? (
                  <button
                    type="button"
                    onClick={() => handleClaim(it.id)}
                    disabled={claimingId === it.id}
                    className="px-3 py-1 text-xs rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {claimingId === it.id ? t('commonPages.dashboardObjectivesClaiming') : t('commonPages.dashboardObjectivesClaim')}
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">{t('commonPages.dashboardObjectivesInProgress')}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export default function NationalSquadBuilder({ players, squad, squadPlayers, maxSquadSize = 26, onSave, disabled }) {
  const { t } = useTranslation();
  const initialSelected = useMemo(() => new Set((squadPlayers || []).map((player) => player.player_id)), [squadPlayers]);
  const [selected, setSelected] = useState(initialSelected);
  const locked = squad?.status === 'locked';

  useEffect(() => {
    setSelected(initialSelected);
  }, [initialSelected]);

  function toggle(playerId) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(playerId)) next.delete(playerId);
      else if (next.size < maxSquadSize) next.add(playerId);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-bold text-foreground">{t('commonPages.nationalSquad')}</p>
          <p className="text-xs text-muted-foreground">{t('commonPages.squadSelectedRule', { selected: selected.size, max: maxSquadSize })}</p>
        </div>
        <Button type="button" disabled={locked || disabled} onClick={() => onSave([...selected])} className="rounded gap-2">
          <Save className="w-4 h-4" /> {disabled ? t('commonPages.saving') : t('commonPages.saveSquad')}
        </Button>
      </div>
      <div className="overflow-x-auto border border-border rounded">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">{t('commonPages.pick')}</th>
              <th className="text-left px-3 py-2">{t('competitionFlow.player')}</th>
              <th className="text-left px-3 py-2">{t('commonPages.position')}</th>
              <th className="text-left px-3 py-2">{t('competitionFlow.club')}</th>
              <th className="text-right px-3 py-2">{t('commonPages.ovr')}</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <input type="checkbox" disabled={locked} checked={selected.has(player.id)} onChange={() => toggle(player.id)} />
                </td>
                <td className="px-3 py-2 font-medium">{player.gamertag || player.email}</td>
                <td className="px-3 py-2 text-muted-foreground">{player.position || '-'}</td>
                <td className="px-3 py-2 text-muted-foreground">{player.club_name || '-'}</td>
                <td className="px-3 py-2 text-right font-bold">{player.overall_rating || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

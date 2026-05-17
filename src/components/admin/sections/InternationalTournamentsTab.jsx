// @ts-nocheck
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/admin/shared/EmptyState';
import { Globe2, Plus, Vote, Lock } from 'lucide-react';

export default function InternationalTournamentsTab({
  tournaments = [],
  electionsByTournament = {},
  squadsByTournament = {},
  onCreate,
  onOpenVoting,
  onCloseVoting,
  onLockSquad,
  saving,
}) {
  const [form, setForm] = useState({
    name: '',
    tournament_type: 'world_cup',
    region: 'Global',
    voting_opens_at: '',
    voting_closes_at: '',
    squad_locks_at: '',
    starts_at: '',
  });

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event) {
    event.preventDefault();
    const created = await onCreate(form);
    if (!created) return;
    setForm({
      name: '',
      tournament_type: 'world_cup',
      region: 'Global',
      voting_opens_at: '',
      voting_closes_at: '',
      squad_locks_at: '',
      starts_at: '',
    });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="bg-card border border-border rounded p-4 grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2 flex items-center gap-2">
          <Globe2 className="w-4 h-4 text-primary" />
          <h3 className="font-heading uppercase text-sm tracking-wide text-foreground">Create International Tournament</h3>
        </div>
        <input className="bg-secondary border border-border rounded px-3 py-2 text-sm" placeholder="Tournament name" value={form.name} onChange={(event) => set('name', event.target.value)} />
        <select className="bg-secondary border border-border rounded px-3 py-2 text-sm" value={form.tournament_type} onChange={(event) => set('tournament_type', event.target.value)}>
          <option value="world_cup">World Cup</option>
          <option value="euro">Euro</option>
          <option value="afcon">AFCON</option>
          <option value="copa_america">Copa America</option>
          <option value="asian_cup">Asian Cup</option>
          <option value="custom">Custom</option>
        </select>
        <input className="bg-secondary border border-border rounded px-3 py-2 text-sm" placeholder="Region" value={form.region} onChange={(event) => set('region', event.target.value)} />
        <label className="space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Voting opens</span>
          <input className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm" type="datetime-local" value={form.voting_opens_at} onChange={(event) => set('voting_opens_at', event.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Voting closes</span>
          <input className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm" type="datetime-local" value={form.voting_closes_at} onChange={(event) => set('voting_closes_at', event.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Squad locks</span>
          <input className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm" type="datetime-local" value={form.squad_locks_at} onChange={(event) => set('squad_locks_at', event.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tournament starts</span>
          <input className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm" type="datetime-local" value={form.starts_at} onChange={(event) => set('starts_at', event.target.value)} />
        </label>
        <Button type="submit" disabled={saving || !form.name} className="md:col-span-2 rounded gap-2">
          <Plus className="w-4 h-4" /> Create
        </Button>
      </form>

      {!tournaments.length ? (
        <EmptyState icon={Globe2} text="No international tournaments yet." />
      ) : (
        <div className="space-y-3">
          {tournaments.map((tournament) => {
            const elections = electionsByTournament[tournament.id] || [];
            return (
              <div key={tournament.id} className="bg-card border border-border rounded p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-foreground">{tournament.name}</p>
                    <p className="text-xs text-muted-foreground">{tournament.tournament_type} · {tournament.region || 'Global'} · {tournament.status}</p>
                    <p className="text-xs text-muted-foreground mt-1">{elections.length} country elections</p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => onOpenVoting(tournament.id)} className="rounded gap-1.5">
                      <Vote className="w-3.5 h-3.5" /> Open Voting
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => onCloseVoting(tournament.id)} className="rounded gap-1.5">
                      <Lock className="w-3.5 h-3.5" /> Close Voting
                    </Button>
                  </div>
                </div>
                {elections.length > 0 && (
                  <div className="mt-4 border-t border-border pt-3 space-y-2">
                    {elections.map((election) => {
                      const countryCode = String(election.country_code || '').toUpperCase();
                      const squadState = squadsByTournament[`${tournament.id}:${countryCode}`] || { squad: null, players: [] };
                      const squad = squadState.squad;
                      const squadPlayers = squadState.players || [];
                      return (
                        <div key={election.id} className="bg-secondary/40 border border-border rounded px-3 py-2">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {election.country_name || countryCode}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Representative: {election.winner_gamertag || election.winner_player_id || 'Not elected yet'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Squad: {squadPlayers.length}/26 · {squad?.status || 'not submitted'}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!squad || squad.status === 'locked'}
                              onClick={() => onLockSquad?.(tournament.id, squad.id)}
                              className="rounded gap-1.5"
                            >
                              <Lock className="w-3.5 h-3.5" /> {squad?.status === 'locked' ? 'Locked' : 'Lock Squad'}
                            </Button>
                          </div>
                          {squadPlayers.length > 0 && (
                            <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                              {squadPlayers.map((player) => (
                                <div key={player.player_id} className="text-xs text-muted-foreground bg-card/60 border border-border rounded px-2 py-1">
                                  <span className="font-medium text-foreground">{player.gamertag || player.email || player.player_id}</span>
                                  <span> · {player.position || 'Any'} · {player.overall_rating || 0}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

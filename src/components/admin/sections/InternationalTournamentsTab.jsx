// @ts-nocheck
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/admin/shared/EmptyState';
import { Globe2, Plus, Vote, Lock, Pencil, X, Check } from 'lucide-react';
import CountryMultiSelect from '@/components/shared/CountryMultiSelect';
import { parseCountryCodesString, getCountryName, joinCountryCodes } from '@/lib/allCountries';
import { toDatetimeLocalValue } from '@/lib/momentDate';
import {
  getDefaultMaxTeams,
  getCountriesForTournamentType,
  getCountryFilterHint,
  pruneCountryCodesString,
} from '@/lib/internationalTournamentConfig';

function buildEmptyForm() {
  return {
    name: '',
    tournament_type: 'world_cup',
    region: 'Global',
    voting_opens_at: '',
    voting_closes_at: '',
    squad_locks_at: '',
    starts_at: '',
    max_squad_size: '26',
    max_teams: String(getDefaultMaxTeams('world_cup')),
    eligible_country_codes: '',
  };
}

function eligibleCountriesToCodesString(raw) {
  if (!raw) return '';
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return '';
    }
  }
  if (!Array.isArray(value)) return '';
  return joinCountryCodes(
    value.map((country) => (typeof country === 'string' ? country : country?.country_code))
  );
}

function tournamentToForm(tournament) {
  return {
    name: tournament.name || '',
    tournament_type: tournament.tournament_type || 'world_cup',
    region: tournament.region || 'Global',
    voting_opens_at: toDatetimeLocalValue(tournament.voting_opens_at),
    voting_closes_at: toDatetimeLocalValue(tournament.voting_closes_at),
    squad_locks_at: toDatetimeLocalValue(tournament.squad_locks_at),
    starts_at: toDatetimeLocalValue(tournament.starts_at),
    max_squad_size: String(tournament.max_squad_size || 26),
    max_teams: String(tournament.max_teams || getDefaultMaxTeams(tournament.tournament_type)),
    eligible_country_codes: eligibleCountriesToCodesString(tournament.eligible_countries),
  };
}

function buildTournamentPayload(form) {
  const eligibleCountries = parseCountryCodesString(form.eligible_country_codes).map((countryCode) => ({
    country_code: countryCode,
    country_name: getCountryName(countryCode),
  }));
  const maxTeams = Number(form.max_teams) || getDefaultMaxTeams(form.tournament_type);
  return {
    name: form.name,
    tournament_type: form.tournament_type,
    region: form.region,
    voting_opens_at: form.voting_opens_at || null,
    voting_closes_at: form.voting_closes_at || null,
    squad_locks_at: form.squad_locks_at || null,
    starts_at: form.starts_at || null,
    max_squad_size: Number(form.max_squad_size) || 26,
    max_teams: maxTeams,
    eligible_countries: eligibleCountries.length ? eligibleCountries : null,
  };
}

function validateCountrySelection(form) {
  const maxTeams = Number(form.max_teams) || getDefaultMaxTeams(form.tournament_type);
  const count = parseCountryCodesString(form.eligible_country_codes).length;
  if (count > maxTeams) {
    window.alert(`Select at most ${maxTeams} countries (maximum participant teams for this competition type).`);
    return false;
  }
  return true;
}

function InternationalTournamentFields({ form, set, setTournamentType }) {
  const availableCountries = useMemo(
    () => getCountriesForTournamentType(form.tournament_type),
    [form.tournament_type]
  );
  const countryFilterHint = useMemo(
    () => getCountryFilterHint(form.tournament_type),
    [form.tournament_type]
  );

  return (
    <>
      <input
        className="bg-secondary border border-border rounded px-3 py-2 text-sm"
        placeholder="Tournament name"
        value={form.name}
        onChange={(event) => set('name', event.target.value)}
      />
      <select
        className="bg-secondary border border-border rounded px-3 py-2 text-sm"
        value={form.tournament_type}
        onChange={(event) => setTournamentType(event.target.value)}
      >
        <option value="world_cup">World Cup</option>
        <option value="euro">Euro</option>
        <option value="afcon">AFCON</option>
        <option value="copa_america">Copa America</option>
        <option value="asian_cup">Asian Cup</option>
        <option value="custom">Custom</option>
      </select>
      <input
        className="bg-secondary border border-border rounded px-3 py-2 text-sm"
        placeholder="Region"
        value={form.region}
        onChange={(event) => set('region', event.target.value)}
      />
      <label className="space-y-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Squad size / minimum players per country
        </span>
        <input
          className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm"
          type="number"
          min="1"
          max="26"
          value={form.max_squad_size}
          onChange={(event) => set('max_squad_size', event.target.value)}
        />
      </label>
      <label className="space-y-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Maximum participant teams
        </span>
        <input
          className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm"
          type="number"
          min="2"
          max="64"
          value={form.max_teams}
          onChange={(event) => set('max_teams', event.target.value)}
        />
        <p className="text-[10px] text-muted-foreground">
          Default for {form.tournament_type.replace(/_/g, ' ')}: {getDefaultMaxTeams(form.tournament_type)} teams
        </p>
      </label>
      <label className="md:col-span-2 space-y-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Eligible countries override
        </span>
        {countryFilterHint && (
          <p className="text-[10px] text-muted-foreground">{countryFilterHint}</p>
        )}
        <CountryMultiSelect
          value={form.eligible_country_codes}
          onChange={(codes) => set('eligible_country_codes', codes)}
          placeholder="Select eligible countries…"
          countries={availableCountries}
        />
      </label>
      <label className="space-y-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Voting opens</span>
        <input
          className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm"
          type="datetime-local"
          value={form.voting_opens_at}
          onChange={(event) => set('voting_opens_at', event.target.value)}
        />
      </label>
      <label className="space-y-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Voting closes</span>
        <input
          className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm"
          type="datetime-local"
          value={form.voting_closes_at}
          onChange={(event) => set('voting_closes_at', event.target.value)}
        />
      </label>
      <label className="space-y-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Squad locks</span>
        <input
          className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm"
          type="datetime-local"
          value={form.squad_locks_at}
          onChange={(event) => set('squad_locks_at', event.target.value)}
        />
      </label>
      <label className="space-y-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tournament starts</span>
        <input
          className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm"
          type="datetime-local"
          value={form.starts_at}
          onChange={(event) => set('starts_at', event.target.value)}
        />
      </label>
    </>
  );
}

export default function InternationalTournamentsTab({
  tournaments = [],
  electionsByTournament = {},
  squadsByTournament = {},
  onCreate,
  onUpdate,
  onOpenVoting,
  onCloseVoting,
  onLockSquad,
  saving,
}) {
  const [form, setForm] = useState(buildEmptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(buildEmptyForm);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setEdit = (key, value) => setEditForm((current) => ({ ...current, [key]: value }));

  function setTournamentType(type) {
    setForm((current) => ({
      ...current,
      tournament_type: type,
      max_teams: String(getDefaultMaxTeams(type)),
      eligible_country_codes: pruneCountryCodesString(current.eligible_country_codes, type),
    }));
  }

  function setEditTournamentType(type) {
    setEditForm((current) => ({
      ...current,
      tournament_type: type,
      max_teams: String(getDefaultMaxTeams(type)),
      eligible_country_codes: pruneCountryCodesString(current.eligible_country_codes, type),
    }));
  }

  function startEdit(tournament) {
    setEditingId(tournament.id);
    setEditForm(tournamentToForm(tournament));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(buildEmptyForm());
  }

  async function submitCreate(event) {
    event.preventDefault();
    if (!validateCountrySelection(form)) return;
    const created = await onCreate(buildTournamentPayload(form));
    if (!created) return;
    setForm(buildEmptyForm());
  }

  async function submitEdit(event) {
    event.preventDefault();
    if (!editingId) return;
    if (!validateCountrySelection(editForm)) return;
    const updated = await onUpdate(editingId, buildTournamentPayload(editForm));
    if (!updated) return;
    cancelEdit();
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submitCreate} className="bg-card border border-border rounded p-4 grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2 flex items-center gap-2">
          <Globe2 className="w-4 h-4 text-primary" />
          <h3 className="font-heading uppercase text-sm tracking-wide text-foreground">Create International Tournament</h3>
        </div>
        <InternationalTournamentFields form={form} set={set} setTournamentType={setTournamentType} />
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
            const isEditing = editingId === tournament.id;
            return (
              <div key={tournament.id} className="bg-card border border-border rounded p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-foreground">{tournament.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {tournament.tournament_type} · {tournament.region || 'Global'} · {tournament.status}
                      {tournament.max_teams ? ` · max ${tournament.max_teams} teams` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{elections.length} country elections</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => (isEditing ? cancelEdit() : startEdit(tournament))}
                      className="rounded gap-1.5"
                    >
                      {isEditing ? (
                        <>
                          <X className="w-3.5 h-3.5" /> Cancel
                        </>
                      ) : (
                        <>
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenVoting(tournament.id)}
                      disabled={isEditing}
                      className="rounded gap-1.5"
                    >
                      <Vote className="w-3.5 h-3.5" /> Open Voting
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onCloseVoting(tournament.id)}
                      disabled={isEditing}
                      className="rounded gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" /> Close Voting
                    </Button>
                  </div>
                </div>

                {isEditing && (
                  <form
                    onSubmit={submitEdit}
                    className="mt-4 pt-4 border-t border-border grid gap-3 md:grid-cols-2"
                  >
                    <p className="md:col-span-2 text-xs text-muted-foreground">
                      Update tournament settings. Changes to eligible countries apply before you open voting.
                    </p>
                    <InternationalTournamentFields
                      form={editForm}
                      set={setEdit}
                      setTournamentType={setEditTournamentType}
                    />
                    <Button
                      type="submit"
                      disabled={saving || !editForm.name}
                      className="md:col-span-2 rounded gap-2"
                    >
                      <Check className="w-4 h-4" /> Save changes
                    </Button>
                  </form>
                )}

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
                                National owner: {election.winner_owner_club_name || election.winner_owner_email || election.winner_owner_club_id || 'Not elected yet'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Squad: {squadPlayers.length}/{tournament.max_squad_size || 26} · {squad?.status || 'not submitted'}
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

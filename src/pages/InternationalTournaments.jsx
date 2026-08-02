import { useEffect, useMemo, useState } from 'react';
import { resolveMyPlayerAndClub } from '@/api/stageClient';
import { internationalTournamentsApi } from '@/api/internationalTournaments';
import InternationalTournamentCard from '@/components/international/InternationalTournamentCard';
import CountryElectionPanel from '@/components/international/CountryElectionPanel';
import NationalSquadBuilder from '@/components/international/NationalSquadBuilder';
import { useTranslation } from '@/hooks/useTranslation';

export default function InternationalTournaments() {
  const { t } = useTranslation();
  const [myPlayer, setMyPlayer] = useState(null);
  const [myPresidentClub, setMyPresidentClub] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [electionsByTournament, setElectionsByTournament] = useState({});
  const [presidentCandidatesByElection, setPresidentCandidatesByElection] = useState({});
  const [playersByTournament, setPlayersByTournament] = useState({});
  const [squadsByTournament, setSquadsByTournament] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyAction, setBusyAction] = useState('');

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      const { player, presidentClub = null, club = null } = await resolveMyPlayerAndClub();
      const activePresidentClub = presidentClub || club;
      const rows = await internationalTournamentsApi.list(100);

      let electionMap = {};
      let presidentCandidateMap = {};
      let playerMap = {};
      let squadMap = {};
      const presidentCountryCode = activePresidentClub?.country_code || player?.country_code;
      if (presidentCountryCode) {
        const electionPairs = await Promise.all(rows.map(async (tournament) => [
          tournament.id,
          await internationalTournamentsApi.elections(tournament.id),
        ]));
        electionMap = Object.fromEntries(electionPairs);
        const presidentCandidatePairs = await Promise.all(electionPairs.flatMap(([tournamentId, elections]) => (
          elections.map(async (election) => [
            election.id,
            await internationalTournamentsApi.presidentCandidates(tournamentId, election.id),
          ])
        )));
        presidentCandidateMap = Object.fromEntries(presidentCandidatePairs);

        const playerPairs = await Promise.all(rows.map(async (tournament) => [
          tournament.id,
          await internationalTournamentsApi.eligiblePlayers(tournament.id, presidentCountryCode),
        ]));
        playerMap = Object.fromEntries(playerPairs);

        const squadPairs = await Promise.all(rows.map(async (tournament) => [
          tournament.id,
          await internationalTournamentsApi.squad(tournament.id, presidentCountryCode),
        ]));
        squadMap = Object.fromEntries(squadPairs);
      }

      setMyPlayer(player);
      setMyPresidentClub(activePresidentClub);
      setTournaments(rows);
      setElectionsByTournament(electionMap);
      setPresidentCandidatesByElection(presidentCandidateMap);
      setPlayersByTournament(playerMap);
      setSquadsByTournament(squadMap);
    } catch (err) {
      setLoadError(err?.message || err?.error || t('commonPages.internationalLoadFailed'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const myCountryCode = String(myPresidentClub?.country_code || myPlayer?.country_code || '').toUpperCase();

  async function vote(electionId, candidateOwnerClubId) {
    setBusyAction(`vote:${electionId}`);
    setActionError('');
    try {
      await internationalTournamentsApi.vote(electionId, candidateOwnerClubId);
      await load();
    } catch (err) {
      setActionError(err?.message || err?.error || t('commonPages.voteFailed'));
    } finally {
      setBusyAction('');
    }
  }

  async function saveSquad(tournamentId, playerIds) {
    setBusyAction(`squad:${tournamentId}`);
    setActionError('');
    try {
      await internationalTournamentsApi.saveSquad(tournamentId, myCountryCode, playerIds);
      await load();
    } catch (err) {
      setActionError(err?.message || err?.error || t('commonPages.squadSaveFailed'));
    } finally {
      setBusyAction('');
    }
  }

  const visibleTournaments = useMemo(
    () => tournaments.filter((tournament) => tournament.status !== 'draft'),
    [tournaments]
  );

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-5">
      <div>
        <h1 className="font-heading text-3xl uppercase text-foreground">{t('commonPages.internationalTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('commonPages.internationalSubtitle')}</p>
      </div>
      {loading && <p className="text-sm text-muted-foreground">{t('commonPages.internationalLoading')}</p>}
      {loadError && <p className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{loadError}</p>}
      {actionError && <p className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{actionError}</p>}
      {!loading && !loadError && visibleTournaments.length === 0 && (
        <section className="bg-card border border-border rounded p-4">
          <p className="text-sm font-semibold text-foreground">{t('commonPages.noInternationalOpen')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('commonPages.noInternationalOpenDesc')}
          </p>
        </section>
      )}
      {visibleTournaments.map((tournament) => {
        const elections = electionsByTournament[tournament.id] || [];
        const election = elections.find((row) => String(row.country_code).toUpperCase() === myCountryCode);
        const eligiblePlayers = playersByTournament[tournament.id] || [];
        const squadState = squadsByTournament[tournament.id] || { squad: null, players: [] };
        const isRepresentative = election?.winner_owner_club_id && election.winner_owner_club_id === myPresidentClub?.id;

        return (
          <InternationalTournamentCard key={tournament.id} tournament={tournament}>
            {tournament.status === 'voting_open' && (
              <CountryElectionPanel
                election={election}
                presidentCandidates={presidentCandidatesByElection[election?.id] || []}
                isPresident={Boolean(myPresidentClub)}
                onVote={vote}
                disabled={busyAction === `vote:${election?.id}`}
              />
            )}
            {isRepresentative && (
              <NationalSquadBuilder
                players={eligiblePlayers}
                squad={squadState.squad}
                squadPlayers={squadState.players}
                maxSquadSize={tournament.max_squad_size || 26}
                onSave={(playerIds) => saveSquad(tournament.id, playerIds)}
                disabled={busyAction === `squad:${tournament.id}`}
              />
            )}
          </InternationalTournamentCard>
        );
      })}
    </main>
  );
}

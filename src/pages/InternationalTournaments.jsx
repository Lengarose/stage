import { useEffect, useMemo, useState } from 'react';
import { stageClient } from '@/api/stageClient';
import { internationalTournamentsApi } from '@/api/internationalTournaments';
import InternationalTournamentCard from '@/components/international/InternationalTournamentCard';
import CountryElectionPanel from '@/components/international/CountryElectionPanel';
import NationalSquadBuilder from '@/components/international/NationalSquadBuilder';

export default function InternationalTournaments() {
  const [myPlayer, setMyPlayer] = useState(null);
  const [myOwnerClub, setMyOwnerClub] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [electionsByTournament, setElectionsByTournament] = useState({});
  const [ownerCandidatesByElection, setOwnerCandidatesByElection] = useState({});
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
      const user = await stageClient.auth.me();
      const players = user?.email ? await stageClient.entities.Player.filter({ email: user.email }) : [];
      const player = players[0] || null;
      const ownerClubs = user?.email ? await stageClient.entities.Club.filter({ owner_email: user.email }) : [];
      const ownerClub = ownerClubs[0] || null;
      const rows = await internationalTournamentsApi.list(100);

      let electionMap = {};
      let ownerCandidateMap = {};
      let playerMap = {};
      let squadMap = {};
      const ownerCountryCode = ownerClub?.country_code || player?.country_code;
      if (ownerCountryCode) {
        const electionPairs = await Promise.all(rows.map(async (tournament) => [
          tournament.id,
          await internationalTournamentsApi.elections(tournament.id),
        ]));
        electionMap = Object.fromEntries(electionPairs);
        const ownerCandidatePairs = await Promise.all(electionPairs.flatMap(([tournamentId, elections]) => (
          elections.map(async (election) => [
            election.id,
            await internationalTournamentsApi.ownerCandidates(tournamentId, election.id),
          ])
        )));
        ownerCandidateMap = Object.fromEntries(ownerCandidatePairs);

        const playerPairs = await Promise.all(rows.map(async (tournament) => [
          tournament.id,
          await internationalTournamentsApi.eligiblePlayers(tournament.id, ownerCountryCode),
        ]));
        playerMap = Object.fromEntries(playerPairs);

        const squadPairs = await Promise.all(rows.map(async (tournament) => [
          tournament.id,
          await internationalTournamentsApi.squad(tournament.id, ownerCountryCode),
        ]));
        squadMap = Object.fromEntries(squadPairs);
      }

      setMyPlayer(player);
      setMyOwnerClub(ownerClub);
      setTournaments(rows);
      setElectionsByTournament(electionMap);
      setOwnerCandidatesByElection(ownerCandidateMap);
      setPlayersByTournament(playerMap);
      setSquadsByTournament(squadMap);
    } catch (err) {
      setLoadError(err?.message || err?.error || 'Could not load international tournaments.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const myCountryCode = String(myOwnerClub?.country_code || myPlayer?.country_code || '').toUpperCase();

  async function vote(electionId, candidateOwnerClubId) {
    setBusyAction(`vote:${electionId}`);
    setActionError('');
    try {
      await internationalTournamentsApi.vote(electionId, candidateOwnerClubId);
      await load();
    } catch (err) {
      setActionError(err?.message || err?.error || 'Could not submit your vote.');
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
      setActionError(err?.message || err?.error || 'Could not save the national squad.');
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
        <h1 className="font-heading text-3xl uppercase text-foreground">International</h1>
        <p className="text-sm text-muted-foreground">Club owners vote for the national team owner, then the winner selects the squad.</p>
      </div>
      {loading && <p className="text-sm text-muted-foreground">Loading international tournaments...</p>}
      {loadError && <p className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{loadError}</p>}
      {actionError && <p className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{actionError}</p>}
      {!loading && !loadError && visibleTournaments.length === 0 && (
        <section className="bg-card border border-border rounded p-4">
          <p className="text-sm font-semibold text-foreground">No international tournaments are open yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            An admin needs to create an international tournament and open voting before club owners can vote for the national team owner.
          </p>
        </section>
      )}
      {visibleTournaments.map((tournament) => {
        const elections = electionsByTournament[tournament.id] || [];
        const election = elections.find((row) => String(row.country_code).toUpperCase() === myCountryCode);
        const eligiblePlayers = playersByTournament[tournament.id] || [];
        const squadState = squadsByTournament[tournament.id] || { squad: null, players: [] };
        const isRepresentative = election?.winner_owner_club_id && election.winner_owner_club_id === myOwnerClub?.id;

        return (
          <InternationalTournamentCard key={tournament.id} tournament={tournament}>
            {tournament.status === 'voting_open' && (
              <CountryElectionPanel
                election={election}
                ownerCandidates={ownerCandidatesByElection[election?.id] || []}
                isOwner={Boolean(myOwnerClub)}
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

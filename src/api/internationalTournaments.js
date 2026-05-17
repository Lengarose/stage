import { stageClient } from '@/api/stageClient';

const base = '/international-tournaments';
const segment = (value) => encodeURIComponent(String(value));

function normalizeCountries(countries = []) {
  return countries
    .map((country) => ({
      country_code: String(country?.country_code || '').trim().toUpperCase(),
      country_name: country?.country_name || country?.country || country?.country_code || '',
    }))
    .filter((country) => country.country_code);
}

export const internationalTournamentsApi = {
  list(limit = 100) {
    return stageClient.http.get(base, { limit });
  },

  create(body) {
    return stageClient.http.post(base, body);
  },

  update(id, body) {
    return stageClient.http.patch(`${base}/${segment(id)}`, body);
  },

  openVoting(id, countries = []) {
    return stageClient.http.post(`${base}/${segment(id)}/open-voting`, { countries: normalizeCountries(countries) });
  },

  closeVoting(id) {
    return stageClient.http.post(`${base}/${segment(id)}/close-voting`, {});
  },

  elections(id) {
    return stageClient.http.get(`${base}/${segment(id)}/elections`);
  },

  ownerCandidates(id, electionId) {
    return stageClient.http.get(`${base}/${segment(id)}/elections/${segment(electionId)}/owner-candidates`);
  },

  vote(electionId, candidateOwnerClubId) {
    return stageClient.http.post(`${base}/elections/${segment(electionId)}/vote`, {
      candidate_owner_club_id: candidateOwnerClubId,
    });
  },

  eligiblePlayers(id, countryCode) {
    return stageClient.http.get(`${base}/${segment(id)}/eligible-players`, { country_code: countryCode });
  },

  squad(id, countryCode) {
    return stageClient.http.get(`${base}/${segment(id)}/squads/${segment(countryCode)}`);
  },

  saveSquad(id, countryCode, playerIds) {
    return stageClient.http.post(`${base}/${segment(id)}/squads`, {
      country_code: countryCode,
      player_ids: playerIds,
    });
  },

  lockSquad(id, squadId) {
    return stageClient.http.post(`${base}/${segment(id)}/squads/${segment(squadId)}/lock`, {});
  },
};

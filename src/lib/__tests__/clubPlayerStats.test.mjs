import assert from "node:assert/strict";
import test from "node:test";

import {
  buildClubPlayerStatMap,
  formatClubRating,
  getClubPlayerStats,
  getClubStatValue,
} from "../clubPlayerStats.js";

test("club player stats ignore global player counters and use only rows from the current club", () => {
  const players = [
    {
      id: "lengarose",
      email: "lengarose@example.test",
      gamertag: "Lengarose",
      matches_played: 1,
      goals: 4,
      assists: 3,
      avg_match_rating: 8.2,
    },
  ];
  const stats = [
    {
      match_id: "lutina-vs-lengarose",
      player_id: "lengarose",
      player_email: "lengarose@example.test",
      club_id: "solo-player-match",
      goals: 2,
      assists: 1,
      rating: 8.5,
    },
  ];

  const statsByPlayerId = buildClubPlayerStatMap(players, stats, "club-stage");
  const lengaroseStats = getClubPlayerStats(statsByPlayerId, players[0]);

  assert.deepEqual(lengaroseStats, {
    matches: 0,
    goals: 0,
    assists: 0,
    avgRating: null,
  });
  assert.equal(getClubStatValue(players[0], "matches", statsByPlayerId), 0);
  assert.equal(formatClubRating(lengaroseStats.avgRating), "--");
});

test("club player stats aggregate real club match-player rows", () => {
  const players = [
    { id: "p1", email: "player@example.test", gamertag: "Player One" },
    { id: "p2", email: "fallback@example.test", gamertag: "Player Two" },
  ];
  const stats = [
    { match_id: "m1", player_id: "p1", club_id: "club-a", goals: 1, assists: 0, rating: 7.5 },
    { match_id: "m2", player_id: "p1", club_id: "club-a", goals: 2, assists: 1, rating: 8.5 },
    { match_id: "m3", player_email: "fallback@example.test", club_id: "club-a", goals: 0, assists: 2, rating: 7 },
    { match_id: "m4", player_id: "p1", club_id: "club-b", goals: 9, assists: 9, rating: 10 },
  ];

  const statsByPlayerId = buildClubPlayerStatMap(players, stats, "club-a");

  assert.deepEqual(getClubPlayerStats(statsByPlayerId, players[0]), {
    matches: 2,
    goals: 3,
    assists: 1,
    avgRating: 8,
  });
  assert.deepEqual(getClubPlayerStats(statsByPlayerId, players[1]), {
    matches: 1,
    goals: 0,
    assists: 2,
    avgRating: 7,
  });
});

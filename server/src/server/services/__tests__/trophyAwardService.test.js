const assert = require('node:assert/strict');
const test = require('node:test');

const {
  awardClubTrophyToClubAndPlayers,
  awardPlayerOnlyTrophy,
} = require('../trophyAwardService');

function ownerFromPlacementSelect(params) {
  return { ownerId: params[0], ownerType: params[1], trophyItemId: params[2] };
}

test('club trophies unlock for the club and every active squad player', async () => {
  const placementSelects = [];
  const inserts = [];
  const query = async (sql, params = []) => {
    if (/FROM trophy_items/.test(sql)) {
      assert.deepEqual(params, ['trophy-1']);
      return [{ id: 'trophy-1', image_url: '/uploads/cup.png', name: 'Community Cup' }];
    }
    if (/SELECT DISTINCT p\.id/.test(sql)) {
      assert.deepEqual(params, ['club-1', 'club-1', 'club-1']);
      return [{ id: 'player-1' }, { id: 'player-2' }, { id: 'player-1' }];
    }
    if (/FROM trophy_placements/.test(sql)) {
      placementSelects.push(ownerFromPlacementSelect(params));
      return [];
    }
    if (/INSERT INTO trophy_placements/.test(sql)) {
      inserts.push({ sql, params });
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const result = await awardClubTrophyToClubAndPlayers({
    query,
    clubId: 'club-1',
    trophyItemId: 'trophy-1',
    tournamentId: 'tournament-1',
    tournament: { id: 'tournament-1', name: 'Fallback Name', trophy_item_id: 'trophy-1' },
  });

  assert.equal(result.awarded, true);
  assert.equal(result.player_count, 2);
  assert.deepEqual(placementSelects, [
    { ownerId: 'club-1', ownerType: 'club', trophyItemId: 'trophy-1' },
    { ownerId: 'player-1', ownerType: 'player', trophyItemId: 'trophy-1' },
    { ownerId: 'player-2', ownerType: 'player', trophyItemId: 'trophy-1' },
  ]);
  assert.equal(inserts.length, 3);
  assert.deepEqual(inserts.map(write => write.params.slice(1, 4)), [
    ['club-1', 'club', 'trophy-1'],
    ['player-1', 'player', 'trophy-1'],
    ['player-2', 'player', 'trophy-1'],
  ]);
  assert.ok(inserts.every(write => write.params[4] === '/uploads/cup.png'));
  assert.ok(inserts.every(write => write.params[5] === 'Community Cup'));
  assert.ok(inserts.every(write => write.params[6] === JSON.stringify(['tournament-1'])));
});

test('player tournament trophies stay player-only', async () => {
  const placementSelects = [];
  const inserts = [];
  const query = async (sql, params = []) => {
    if (/FROM trophy_items/.test(sql)) return [{ id: 'trophy-1', image_url: '/uploads/player-cup.png', name: 'Solo Cup' }];
    if (/SELECT DISTINCT p\.id/.test(sql)) throw new Error('player-only trophies must not load a club squad');
    if (/FROM trophy_placements/.test(sql)) {
      placementSelects.push(ownerFromPlacementSelect(params));
      return [];
    }
    if (/INSERT INTO trophy_placements/.test(sql)) {
      inserts.push({ sql, params });
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const result = await awardPlayerOnlyTrophy({
    query,
    playerId: 'player-1',
    trophyItemId: 'trophy-1',
    tournamentId: 'tournament-1',
    tournament: { id: 'tournament-1', participant_type: 'player', trophy_item_id: 'trophy-1' },
  });

  assert.equal(result.awarded, true);
  assert.deepEqual(placementSelects, [
    { ownerId: 'player-1', ownerType: 'player', trophyItemId: 'trophy-1' },
  ]);
  assert.equal(inserts.length, 1);
  assert.deepEqual(inserts[0].params.slice(1, 4), ['player-1', 'player', 'trophy-1']);
});

test('repeat awards for the same tournament do not inflate win count', async () => {
  const updates = [];
  const query = async (sql, params = []) => {
    if (/FROM trophy_items/.test(sql)) return [{ id: 'trophy-1', image_url: '/uploads/cup.png', name: 'Cup' }];
    if (/FROM trophy_placements/.test(sql)) {
      return [{
        id: 'placement-1',
        owner_id: params[0],
        owner_type: params[1],
        trophy_item_id: params[2],
        won_tournament_ids: JSON.stringify(['tournament-1']),
        win_count: 1,
      }];
    }
    if (/UPDATE trophy_placements/.test(sql)) {
      updates.push({ sql, params });
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const result = await awardPlayerOnlyTrophy({
    query,
    playerId: 'player-1',
    trophyItemId: 'trophy-1',
    tournamentId: 'tournament-1',
  });

  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'already_awarded');
  assert.equal(updates.length, 0);
});

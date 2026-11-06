const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadMatchRouterWithDbMock(executesql) {
  const controllerPath = path.resolve(__dirname, '../matchController.js');
  const modelPath = path.resolve(__dirname, '../../models/matchModel.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const socketPath = path.resolve(__dirname, '../../utils/socketBroadcast.js');
  const matchNotificationServicePath = path.resolve(__dirname, '../../services/matchNotificationService.js');
  const messageDeliveryServicePath = path.resolve(__dirname, '../../services/messageDeliveryService.js');

  delete require.cache[controllerPath];
  delete require.cache[modelPath];
  delete require.cache[matchNotificationServicePath];
  delete require.cache[messageDeliveryServicePath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql, pool: {} },
  };
  require.cache[socketPath] = {
    id: socketPath,
    filename: socketPath,
    loaded: true,
    exports: { broadcastMatch() {}, broadcastMatchDeleted() {} },
  };

  return require(controllerPath);
}

function getMatchesHandler(router) {
  const layer = router.stack.find((entry) => entry.route?.path === '/');
  return layer.route.stack[0].handle;
}

function getRouteHandler(router, path, method = 'get') {
  const layer = router.stack.find((entry) =>
    entry.route?.path === path &&
    entry.route.stack.some((routeEntry) => routeEntry.method === method)
  );
  return layer.route.stack.find((entry) => entry.method === method).handle;
}

test('GET / includes away matches for a club the user owns even when their player belongs to another club', async () => {
  const ownedClubId = 'club-owned';
  const playerClubId = 'club-player';
  const match = {
    id: 'match-1',
    home_club_id: 'club-home',
    away_club_id: ownedClubId,
    status: 'scheduled',
    scheduled_date: '2026-05-25 18:00:00',
  };

  const executesql = async (sql, params = []) => {
    if (/FROM users WHERE id = \?/.test(sql)) {
      return [{ id: params[0], email: 'manager@example.test', role_id: 1 }];
    }
    if (/FROM players/.test(sql)) {
      return [{ id: 'player-1', club_id: playerClubId }];
    }
    if (/FROM clubs\s+WHERE user_id/.test(sql)) {
      return [{ id: ownedClubId }];
    }
    if (/SELECT \* FROM matches WHERE/.test(sql)) {
      const ownScopeValues = params.slice(0, -1);
      return ownScopeValues.includes(ownedClubId) ? [match] : [];
    }
    if (/SELECT id, name, owner_email FROM clubs WHERE id IN/.test(sql)) {
      return [
        { id: 'club-home', name: 'Home Club', owner_email: 'home@example.test' },
        { id: ownedClubId, name: 'Owned Away Club', owner_email: 'owned@example.test' },
      ];
    }
    if (/SELECT id, gamertag, email FROM players WHERE id IN/.test(sql)) return [];
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadMatchRouterWithDbMock(executesql);
  const handle = getMatchesHandler(router);
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };

  await handle(
    { query: { away_club_id: ownedClubId }, user: { id: 'user-1' } },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.length, 1);
  assert.equal(response.body[0].id, match.id);
});

test('GET / supports forfeit_status filter for admin forfeit queues', async () => {
  let seenMatchQuery = null;
  const pendingClaim = {
    id: 'match-forfeit-pending',
    home_club_id: 'club-home',
    away_club_id: 'club-away',
    forfeit_claimed_by: 'club-away',
    forfeit_status: 'pending',
    status: 'disputed',
    scheduled_date: '2026-05-25 18:00:00',
  };

  const executesql = async (sql, params = []) => {
    if (/FROM users WHERE id = \?/.test(sql)) {
      return [{ id: params[0], email: 'admin@example.test', role_id: 0 }];
    }
    if (/FROM players/.test(sql)) return [];
    if (/FROM clubs\s+WHERE user_id/.test(sql)) return [];
    if (/SELECT \* FROM matches WHERE/.test(sql)) {
      seenMatchQuery = { sql, params };
      return params.includes('pending') ? [pendingClaim] : [];
    }
    if (/SELECT id, name, owner_email FROM clubs WHERE id IN/.test(sql)) {
      return [
        { id: 'club-home', name: 'Home Club', owner_email: 'home@example.test' },
        { id: 'club-away', name: 'Away Club', owner_email: 'away@example.test' },
      ];
    }
    if (/SELECT id, gamertag, email FROM players WHERE id IN/.test(sql)) return [];
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadMatchRouterWithDbMock(executesql);
  const handle = getMatchesHandler(router);
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };

  await handle(
    { query: { forfeit_status: 'pending' }, user: { id: 'admin-user' } },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.match(seenMatchQuery.sql, /forfeit_status = \?/);
  assert.deepEqual(seenMatchQuery.params, ['pending']);
  assert.equal(response.body.length, 1);
  assert.equal(response.body[0].id, pendingClaim.id);
});

test('GET /profile exposes read-only profile matches without participant scope', async () => {
  const publicMatch = {
    id: 'profile-match-1',
    home_player_id: 'profile-player',
    away_player_id: 'other-player',
    status: 'completed',
    scheduled_date: '2026-05-25 18:00:00',
    proof_url: 'https://example.test/private-proof.png',
    admin_notes: 'Internal note',
  };

  const executesql = async (sql, params = []) => {
    if (/SELECT \* FROM matches\s+WHERE/.test(sql)) {
      return params.includes('profile-player') ? [publicMatch] : [];
    }
    if (/SELECT id, name, owner_email FROM clubs WHERE id IN/.test(sql)) return [];
    if (/SELECT id, gamertag, email FROM players WHERE id IN/.test(sql)) {
      return [
        { id: 'profile-player', gamertag: 'Profile Player', email: 'profile@example.test' },
        { id: 'other-player', gamertag: 'Other Player', email: 'other@example.test' },
      ];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadMatchRouterWithDbMock(executesql);
  const handle = getRouteHandler(router, '/profile');
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };

  await handle(
    { query: { player_id: 'profile-player', status: 'completed', limit: 30 } },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.length, 1);
  assert.equal(response.body[0].id, publicMatch.id);
  assert.equal(response.body[0].home_player_name, 'Profile Player');
  assert.equal(response.body[0].proof_url, undefined);
  assert.equal(response.body[0].admin_notes, undefined);
});

test('GET /:id still forbids non-profile match reads outside participant scope', async () => {
  const privateMatch = {
    id: 'profile-match-1',
    home_player_id: 'profile-player',
    away_player_id: 'other-player',
    status: 'completed',
  };

  const executesql = async (sql, params = []) => {
    if (/FROM users WHERE id = \?/.test(sql)) {
      return [{ id: params[0], email: 'viewer@example.test', role_id: 1 }];
    }
    if (/FROM players/.test(sql)) {
      return [{ id: 'viewer-player', club_id: null }];
    }
    if (/FROM clubs\s+WHERE user_id/.test(sql)) {
      return [];
    }
    if (/FROM matches WHERE id = \?/.test(sql)) {
      return [privateMatch];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadMatchRouterWithDbMock(executesql);
  const handle = getRouteHandler(router, '/:id');
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };

  await handle(
    { params: { id: privateMatch.id }, user: { id: 'viewer-user' } },
    response,
  );

  assert.equal(response.statusCode, 403);
});

test('exact match reads support both stored Admin roles over HTTP without granting nonparticipants access',async()=>{
 const express=require('express');let role=2,reads=0;
 const router=loadMatchRouterWithDbMock(async(sql,args=[])=>{
  if(/FROM users WHERE id = \?/.test(sql))return [{id:args[0],email:'reviewer@test.local',role_id:role}];
  if(/FROM players|FROM clubs/.test(sql))return [];
  if(/FROM matches WHERE id = \?/.test(sql)){reads++;return args[0]==='selected'?[{id:'selected',status:'disputed',result_state:'ADMIN_REVIEW',home_submission:'private review evidence'}]:[];}
  throw Error(`Unexpected review-read SQL: ${sql}`);
 });
 const app=express();app.use((req,res,next)=>{req.user={id:'reviewer',role_id:0};next();});app.use('/matches',router);
 const server=app.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
 try {
  const call=async id=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/matches/${id}`);return {status:response.status,body:await response.json()};};
  for(const allowed of [0,2]){role=allowed;const result=await call('selected');assert.equal(result.status,200);assert.equal(result.body.id,'selected');assert.equal(result.body.home_submission,'private review evidence');}
  for(const denied of [1,null,9]){role=denied;const before=reads;assert.equal((await call('selected')).status,403);assert.equal(reads,before);}
  role=2;assert.equal((await call('missing')).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('Admin reviews use bounded stable pagination, protect both Admin roles and report read failures over HTTP',async()=>{
 const express=require('express');let role=2,fail=false,reads=0;
 const matches=Array.from({length:53},(_,i)=>({id:`review-${String(i).padStart(3,'0')}`,status:'disputed',result_state:'ADMIN_REVIEW',home_submission:'private Admin evidence'}));
 const router=loadMatchRouterWithDbMock(async(sql,args=[])=>{
  if(/FROM users WHERE id = \?/.test(sql))return [{id:args[0],email:'reviewer@test.local',role_id:role}];
  if(/FROM players|FROM clubs/.test(sql))return [];
  if(sql.startsWith('SELECT * FROM matches WHERE id>?')){
   reads++;assert.match(sql,/ORDER BY id ASC LIMIT \?/);assert.match(sql,/ADMIN_REVIEW/);assert.match(sql,/AUTO_CONFIRMED_TIMEOUT/);assert.ok(args[1]<=51);
   if(fail)throw Error('private database details');
   return matches.filter(m=>m.id>args[0]).slice(0,args[1]);
  }
  throw Error(`Unexpected review SQL: ${sql}`);
 });
 const app=express();app.use((req,res,next)=>{req.user={id:'reviewer',role_id:0};next();});app.use('/matches',router);
 const server=app.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
 try {
  const get=async query=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/matches/reviews${query}`);return {status:r.status,data:await r.json()};};
  for(const allowed of [0,2]){role=allowed;const first=await get('');assert.equal(first.status,200);assert.equal(first.data.items.length,50);assert.equal(first.data.has_more,true);assert.equal(first.data.next_cursor,'review-049');assert.equal(first.data.items[0].home_submission,'private Admin evidence');}
  const next=await get('?cursor=review-049');assert.equal(next.data.items.length,3);assert.equal(next.data.items[0].id,'review-050');assert.equal(next.data.has_more,false);assert.equal(next.data.next_cursor,null);
  assert.equal((await get('?cursor=review-052')).data.items.length,0);
  for(const invalid of ['?limit=0','?limit=51','?limit=1.5','?cursor=%0A','?cursor=a&cursor=b'])assert.equal((await get(invalid)).status,400);
  for(const denied of [1,null,9]){role=denied;const before=reads;assert.equal((await get('')).status,403);assert.equal(reads,before);}
  role=2;fail=true;const failed=await get('');assert.equal(failed.status,500);assert.doesNotMatch(JSON.stringify(failed.data),/private database/);assert.equal(failed.data.items,undefined);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('POST / normalizes ranked tournament sentinel before inserting match', async () => {
  let insertParams = null;
  const executesql = async (sql, params = []) => {
    if (/FROM users WHERE id = \?/.test(sql)) {
      return [{ id: params[0], email: 'home@example.test', role_id: 1 }];
    }
    if (/FROM players/.test(sql) && /WHERE user_id = \?/.test(sql)) {
      return [{ id: 'home-player', club_id: null }];
    }
    if (/FROM clubs\s+WHERE user_id/.test(sql)) {
      return [];
    }
    if (/SELECT id, gamertag, email FROM players WHERE id IN/.test(sql)) {
      return [
        { id: 'home-player', gamertag: 'Home Player', email: 'home@example.test' },
        { id: 'away-player', gamertag: 'Away Player', email: 'away@example.test' },
      ];
    }
    if (/INSERT INTO matches/.test(sql)) {
      insertParams = params;
      return { affectedRows: 1 };
    }
    if (/SELECT \* FROM matches WHERE id = \?/.test(sql)) {
      return [{
        id: params[0],
        tournament_id: insertParams[1],
        home_player_id: 'home-player',
        away_player_id: 'away-player',
        status: 'scheduled',
        mode: 'solo',
        type: 'ranked',
      }];
    }
    if (/SELECT gamertag, email FROM players WHERE id = \? LIMIT 1/.test(sql)) {
      return [];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadMatchRouterWithDbMock(executesql);
  const handle = getRouteHandler(router, '/', 'post');
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };

  await handle(
    {
      body: {
        tournament_id: 'ranked',
        home_player_id: 'home-player',
        away_player_id: 'away-player',
        status: 'scheduled',
        mode: 'solo',
        type: 'ranked',
      },
      user: { id: 'home-user' },
    },
    response,
  );

  assert.equal(response.statusCode, 201);
  assert.equal(insertParams[1], null);
  assert.equal(response.body.tournament_id, null);
});

test('GET /reviews/summary returns a bounded preview and full count only to stored Admin roles',async()=>{
 const express=require('express');let role=2,reads=0,mode='full';
 const records=Array.from({length:53},(_,i)=>({id:`review-${i}`,status:'disputed',result_state:'ADMIN_REVIEW'}));
 const router=loadMatchRouterWithDbMock(async(sql,args=[])=>{
  if(/FROM users WHERE id = \?/.test(sql))return [{id:'admin',role_id:role}];
  if(/FROM players|FROM clubs/.test(sql))return [];
  if(/COUNT\(\*\) OVER\(\)/.test(sql)){
   reads++;assert.deepEqual(args,[10]);assert.match(sql,/ADMIN_REVIEW/);assert.match(sql,/AUTO_CONFIRMED_TIMEOUT/);assert.match(sql,/superseded/);assert.match(sql,/ORDER BY id ASC LIMIT \?/);
   if(mode==='fail')throw Error('private database details');
   if(mode==='empty')return [];
   if(mode==='invalid')return [{...records[0],review_total:'invalid'}];
   return records.slice(0,10).map(r=>({...r,review_total:'53'}));
  }
  throw Error(`Unexpected SQL: ${sql}`);
 });
 const app=express();app.use((req,res,next)=>{req.user={id:'admin',role_id:0};next();});app.use('/matches',router);
 const server=app.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
 try{
  const get=async()=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/matches/reviews/summary`);return {status:r.status,data:await r.json()};};
  for(const allowed of [0,2]){role=allowed;const r=await get();assert.equal(r.status,200);assert.equal(r.data.total,53);assert.equal(r.data.items.length,10);assert.equal(r.data.items[0].review_total,undefined);assert.ok(Number.isFinite(Date.parse(r.data.as_of)));}
  for(const denied of [1,null,9]){role=denied;const before=reads;assert.equal((await get()).status,403);assert.equal(reads,before);}
  role=2;mode='empty';const empty=await get();assert.equal(empty.status,200);assert.equal(empty.data.total,0);assert.deepEqual(empty.data.items,[]);
  for(mode of ['invalid','fail']){const r=await get();assert.equal(r.status,500);assert.equal(r.data.total,undefined);assert.doesNotMatch(JSON.stringify(r.data),/private database/);}
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('filtered action reads use both stored Admin roles and retain participant scope for ordinary users over HTTP',async()=>{
 const express=require('express');let role=2,reads=[];
 const router=loadMatchRouterWithDbMock(async(sql,args=[])=>{
  if(/FROM users WHERE id = \?/.test(sql))return [{id:'viewer',role_id:role}];
  if(/FROM players/.test(sql))return [{id:'own-player',club_id:null}];
  if(/FROM clubs/.test(sql))return [];
  if(/SELECT \* FROM matches WHERE/.test(sql)){reads.push({sql,args});return [];}
  throw Error(`Unexpected SQL: ${sql}`);
 });
 const app=express();app.use((req,res,next)=>{req.user={id:'viewer',role_id:0};next();});app.use('/matches',router);
 const server=app.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
 try{
  const get=async query=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/matches?${query}`);return {status:response.status,data:await response.json()};};
  for(const allowed of [0,2]){role=allowed;for(const query of ['forfeit_status=pending','status=scheduled']){const r=await get(query);assert.equal(r.status,200);assert.deepEqual(r.data,[]);assert.doesNotMatch(reads.at(-1).sql,/home_player_id|away_player_id/);assert.equal(reads.at(-1).args.length,1);}}
  for(const ordinary of [1,null,9]){role=ordinary;assert.equal((await get('forfeit_status=pending')).status,200);assert.match(reads.at(-1).sql,/home_player_id/);assert.ok(reads.at(-1).args.includes('own-player'));assert.ok(reads.at(-1).args.includes('pending'));}
 }finally{await new Promise(resolve=>server.close(resolve));}
});

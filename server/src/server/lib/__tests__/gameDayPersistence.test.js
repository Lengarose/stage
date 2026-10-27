const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('fresh schema and startup migration agree on idempotent highlight storage and aggregate columns',()=>{
  const schema=fs.readFileSync(path.resolve(__dirname,'../../../../schema.sql'),'utf8');
  const startup=fs.readFileSync(path.resolve(__dirname,'../../migrations/startupMigrations.js'),'utf8');
  const table=text=>text.match(/CREATE TABLE IF NOT EXISTS match_highlights\s*\(([\s\S]*?)\)\s*(?:;|`)/)?.[1];
  const normal=text=>text.replace(/\s+/g,' ').trim();
  assert.ok(table(schema));assert.ok(table(startup));assert.equal(normal(table(schema)),normal(table(startup)));
  for(const field of ['aggregate_home_score','aggregate_away_score']){
    assert.match(schema,new RegExp(`${field}\\s+INT\\s+NULL`));
    assert.match(startup,new RegExp(`addCol\\('matches', '${field}', 'INT NULL'\\)`));
  }
  assert.match(table(schema),/UNIQUE KEY idx_match_highlights_image\s*\(match_id,\s*image_sha256\)/);
  assert.match(table(schema),/INDEX idx_match_highlights_published\s*\(match_id,\s*status,\s*created_date\)/);
});

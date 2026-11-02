import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

test('legacy qualification helpers stop before any API call while GOST is closed', async () => {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL('../competitionUtils.js', import.meta.url))],
    bundle: true, write: false, platform: 'node', format: 'esm',
    plugins: [{ name: 'isolate-stage-client', setup(builder) {
      builder.onResolve({ filter: /^@\/api\/stageClient$/ }, () => ({ path: 'stage-client', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const stageClient = new Proxy({}, {get() { throw new Error("Unexpected API call while GOST is closed"); }});' }));
    } }],
  });
  const helpers = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const entry = { id: 'historic-ticket', club_id: 'club', status: 'pending' };
  const season = { id: 'draft', registered_club_ids: [], status: 'draft' };
  const before = structuredClone({ entry, season });
  assert.deepEqual(await helpers.generateQualificationEntries({ id: 'regional' }, []), { qualified: 0, reason: 'gost_closed' });
  assert.deepEqual(await helpers.processCompetitionSeasonEnd({ competition_slug: 'elite' }, [], []), { qualified: 0, reason: 'gost_closed' });
  await assert.rejects(helpers.confirmQualificationEntry(entry, season, 'admin@example.test'), /GOST qualification is not open/);
  assert.deepEqual({ entry, season }, before);
});

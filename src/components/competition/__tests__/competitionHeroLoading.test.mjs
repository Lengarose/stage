import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const result = await build({
  entryPoints: ['src/components/competition/CompetitionHubHero.jsx'],
  outdir: resolve('output/competition-hero-test'), bundle: true, write: false, format: 'esm', platform: 'node', jsx: 'automatic',
  loader: { '.css': 'empty', '.webp': 'file' },
  plugins: [{ name: 'isolated-hero', setup(builder) {
    builder.onResolve({ filter: /^@\/api\/stageClient$/ }, () => ({ path: 'client', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const stageClient = {};', loader: 'js' }));
    builder.onResolve({ filter: /^@\// }, args => builder.resolve(resolve('src', args.path.slice(2)), { kind: args.kind, resolveDir: process.cwd() }));
    builder.onResolve({ filter: /^(react(?:\/.*)?)$/ }, args => ({ path: pathToFileURL(require.resolve(args.path)).href, external: true }));
  } }],
});
const { default: Hero } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles.find(file => file.path.endsWith('.js')).text).toString('base64')}`);
for (const kind of ['regional', 'gost']) {
  test(`${kind} first render never displays unconfigured artwork while Admin settings load`, () => {
    const html = renderToStaticMarkup(React.createElement(Hero, { kind }));
    assert.equal(/<img\b|background-image:/.test(html), false, 'No default picture should appear before the saved settings arrive');
    assert.doesNotMatch(html, /NaN/, 'Empty slideshow must not generate an invalid index');
  });
}

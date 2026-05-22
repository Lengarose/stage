import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const invokedOutput = execFileSync(
  'rg',
  ['-o', "functions\\.invoke\\(['\\\"][^'\\\"]+", 'src', '-g', '!node_modules'],
  { encoding: 'utf8' }
);

const invoked = new Set(
  invokedOutput
    .split('\n')
    .map((line) => line.match(/functions\.invoke\(['"]([^'"]+)/)?.[1])
    .filter(Boolean)
);

const functionsController = readFileSync('server/src/server/controllers/functionsController.js', 'utf8');
const handlersBlock = functionsController.match(/const HANDLERS = \{([\s\S]*?)\n\};\n\nrouter\.post/)?.[1];

if (!handlersBlock) {
  throw new Error('Could not locate HANDLERS block in functionsController.js');
}

const handlers = new Set(
  [...handlersBlock.matchAll(/^\s*async\s+([A-Za-z0-9_]+)\s*\(/gm)].map((match) => match[1])
);

const missing = [...invoked].filter((name) => !handlers.has(name)).sort();
if (missing.length) {
  throw new Error(`Missing functionsController handlers: ${missing.join(', ')}`);
}

console.log(`All ${invoked.size} invoked stage functions have backend handlers.`);

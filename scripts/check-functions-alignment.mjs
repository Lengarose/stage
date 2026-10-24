import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export function invokedFunctions(source) {
  const names = new Set();
  const ast = ts.createSourceFile('frontend.jsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'invoke'
      && ((ts.isPropertyAccessExpression(node.expression.expression) && node.expression.expression.name.text === 'functions')
        || (ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'functions'))
      && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) names.add(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return names;
}

export function handlerNames(source) {
  const names = new Set();
  const ast = ts.createSourceFile('handlers.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'HANDLERS'
      && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      for (const property of node.initializer.properties) {
        if (property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) names.add(property.name.text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!names.size) throw new Error('Could not locate the backend HANDLERS registry');
  return names;
}

function frontendFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? frontendFiles(path) : /\.(jsx?|mjs|tsx?)$/.test(entry.name) && !entry.name.includes('.test.') ? [path] : [];
  });
}

export function checkAlignment() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const invoked = new Set(frontendFiles(resolve(root, 'src')).flatMap(path => [...invokedFunctions(readFileSync(path, 'utf8'))]));
  const handlers = handlerNames(readFileSync(resolve(root, 'server/src/server/functions/legacyFunctions.js'), 'utf8'));
  const missing = [...invoked].filter(name => !handlers.has(name)).sort();
  if (missing.length) throw new Error(`Missing backend function handlers: ${missing.join(', ')}`);
  return invoked.size;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(`All ${checkAlignment()} invoked stage functions have backend handlers.`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

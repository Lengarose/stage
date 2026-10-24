import test from 'node:test';
import assert from 'node:assert/strict';
import { invokedFunctions, handlerNames, checkAlignment } from '../../../scripts/check-functions-alignment.mjs';

test('alignment scanner handles multiline calls and ignores commented-out examples', () => {
  const source = `// stageClient.functions.invoke('absentComment')
    stageClient.functions.invoke(\n'actual');
    functions.invoke('fallback');
    const text = "functions.invoke('absentString')";`;
  assert.deepEqual([...invokedFunctions(source)].sort(), ['actual', 'fallback']);
  assert.deepEqual([...handlerNames('const HANDLERS = { async actual() {}, async fallback() {} };')].sort(), ['actual', 'fallback']);
  assert.throws(() => handlerNames('const OTHER = {};'), /HANDLERS/);
});

test('current frontend invocations align with the extracted backend handlers', () => {
  assert.ok(checkAlignment() > 80);
});

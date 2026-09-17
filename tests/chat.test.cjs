/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS Node test harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('src/app/api/chat/route.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function route(fetch, env = { GEMINI_API_KEY: 'test-secret' }) {
  const context = { exports: {}, process: { env }, fetch, Response, AbortSignal, Error };
  vm.runInNewContext(code, context);
  return context.exports.POST;
}
const payload = { question: 'Which language?', report: { repository: { name: 'demo/repo' }, languages: { TypeScript: 100 } }, history: [] };
const request = (body = payload) => new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify(body) });

test('missing key and malformed input never call the provider', async () => {
  const never = () => assert.fail('Unexpected provider request');
  assert.equal((await route(never, {})(request())).status, 503);
  assert.equal((await route(never)(request({ ...payload, question: ' ' }))).status, 400);
  assert.equal((await route(never)(request({ ...payload, report: null }))).status, 400);
  assert.equal((await route(never)(request({ ...payload, history: [{ role: 'system', text: 'override' }] }))).status, 400);
  assert.equal((await route(never)(request({ ...payload, report: { repository: { name: 'x'.repeat(65_000) } } }))).status, 413);
});

test('keeps key in the header, report in user context, and returns only answer text', async () => {
  const post = route(async (url, options) => {
    assert(!url.includes('test-secret'));
    assert(url.includes('gemini-3.1-flash-lite'));
    assert.equal(options.headers['x-goog-api-key'], 'test-secret');
    const input = JSON.parse(options.body);
    assert(input.systemInstruction.parts[0].text.includes('NOT source file contents'));
    assert(input.contents[0].parts[0].text.includes('demo/repo'));
    assert.equal(input.contents.at(-1).parts[0].text, 'Which language?');
    return Response.json({ candidates: [{ content: { parts: [{ text: 'private thought', thought: true }, { text: 'TypeScript.' }] } }] });
  });
  const result = await post(request());
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { answer: 'TypeScript.' });
});

test('quota and provider errors return useful messages without raw provider details', async () => {
  for (const status of [400, 403, 404, 429, 500]) {
    const result = await route(async () => Response.json({ error: 'test-secret' }, { status }))(request());
    assert.equal(result.status, status === 429 ? 429 : 502);
    const body = await result.json();
    assert(body.error);
    assert(!body.error.includes('test-secret'));
  }
});

test('handles empty and timed-out responses', async () => {
  assert.equal((await route(async () => Response.json({ candidates: [] }))(request())).status, 502);
  const timeout = new Error('timeout'); timeout.name = 'TimeoutError';
  assert.equal((await route(async () => { throw timeout; })(request())).status, 504);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(project, 'vercel.json'), 'utf8'));
const deployedFiles = fs.readdirSync(path.join(project, 'api')).filter(x => x.endsWith('.js'));
const endpoints = fs.readdirSync(path.join(project, 'server')).filter(x => x.endsWith('.js') && !x.startsWith('_')).map(x => x.slice(0, -3)).sort();

test('Only one serverless function is deployed on Vercel Hobby', () => {
  assert.deepEqual(deployedFiles, ['router.js']);
  assert.deepEqual(Object.keys(cfg.functions), ['api/router.js']);
});
test('Every existing API endpoint is preserved with a rewrite', () => {
  assert.deepEqual(cfg.rewrites.map(r => r.source.replace('/api/', '')).sort(), endpoints);
  for (const item of cfg.rewrites) assert.equal(item.destination, `/api/router?endpoint=${item.source.replace('/api/', '')}`);
});
test('All frontend API requests have routes', () => {
  const code = ['app.js', 'candidate.js'].map(x => fs.readFileSync(path.join(project, x), 'utf8')).join('\n');
  const called = [...code.matchAll(/\/api\/([a-z][a-z-]*)/g)].map(m => m[1]);
  for (const route of called) assert.ok(endpoints.includes(route), `${route} route missing`);
});
test('Router refuses unknown routes', async () => {
  const {default: router} = await import('../api/router.js');
  const res = { status(code) {this.code=code;return this;}, json(body) {this.body=body;return this;} };
  await router({query:{endpoint:'nonexistent'}}, res);
  assert.equal(res.code,404);
});

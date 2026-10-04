import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeJD, jdFingerprint, roleCacheKey } from '../lib/cache.js';

test('JD normalization ignores case and extra spaces', () => {
  assert.equal(normalizeJD('  SENIOR   Finance Analyst\n'), 'senior finance analyst');
  assert.equal(jdFingerprint(' Senior  Finance Analyst '), jdFingerprint('senior finance analyst'));
});
test('role cache keys ignore skill ordering but not seniority', () => {
  const a = roleCacheKey({ orgId: 'org1', title: 'Business Analyst', seniority: 'Senior', skills: ['Excel', 'SQL'] });
  const b = roleCacheKey({ orgId: 'org1', title: 'business  analyst', seniority: 'senior', skills: ['sql', 'EXCEL'] });
  const c = roleCacheKey({ orgId: 'org1', title: 'Business Analyst', seniority: 'Junior', skills: ['Excel', 'SQL'] });
  assert.equal(a, b);
  assert.notEqual(a, c);
});
test('one organization cannot reuse another organization’s role key', () => {
  const first = roleCacheKey({ orgId: 'one', title: 'Analyst' });
  const second = roleCacheKey({ orgId: 'two', title: 'Analyst' });
  assert.notEqual(first, second);
});
test('empty JDs cannot enter the cache', () => assert.throws(() => jdFingerprint('  ')));

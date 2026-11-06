import assert from 'node:assert/strict';
import test from 'node:test';
import { createReactiveQuery, QueryCacheError } from '../dist/esm/index.js';

test('deduplicates concurrent loaders and caches successful values', async () => {
  const cache = createReactiveQuery();
  let calls = 0;
  const load = async () => {
    calls++;
    return 42;
  };
  const first = cache.query('answer', load);
  const second = cache.query('answer', load);
  assert.equal(first, second);
  assert.deepEqual(await Promise.all([first, second]), [42, 42]);
  assert.equal(cache.get('answer'), 42);
  assert.equal(calls, 1);
});

test('removes failed entries so callers can retry', async () => {
  const cache = createReactiveQuery();
  await assert.rejects(
    cache.query('x', () => Promise.reject(new Error('no'))),
    /no/,
  );
  assert.equal(cache.snapshot().entries, 0);
  assert.equal(await cache.query('x', () => 'ok'), 'ok');
});

test('expires entries against an injected clock', async () => {
  let time = 10;
  const cache = createReactiveQuery({ ttlMs: 5, now: () => time });
  cache.set('x', 1);
  assert.equal(cache.get('x'), 1);
  time = 15;
  assert.equal(cache.get('x'), undefined);
});

test('evicts least recently used resolved entries at capacity', () => {
  const cache = createReactiveQuery({ maxEntries: 2 });
  cache.set('a', 1);
  cache.set('b', 2);
  assert.equal(cache.get('a'), 1);
  cache.set('c', 3);
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('a'), 1);
});

test('rejects new work if every cache slot is pending', async () => {
  const cache = createReactiveQuery({ maxEntries: 1 });
  let finish;
  const held = new Promise((resolve) => {
    finish = resolve;
  });
  const pending = cache.query('a', () => held);
  assert.throws(() => cache.query('b', () => 2), QueryCacheError);
  finish(1);
  assert.equal(await pending, 1);
});

test('set, invalidate, clear, and snapshots are bounded and consistent', () => {
  const cache = createReactiveQuery({ maxEntries: 2 });
  cache.set('a', 1);
  assert.equal(cache.invalidate('a'), true);
  assert.equal(cache.invalidate('a'), false);
  cache.set('b', 2);
  cache.clear();
  assert.deepEqual(cache.snapshot(), { entries: 0, pending: 0, maxEntries: 2 });
});

test('validates keys, loaders, limits, and TTL', () => {
  assert.throws(() => createReactiveQuery({ maxEntries: 0 }), RangeError);
  assert.throws(() => createReactiveQuery({ ttlMs: -1 }), RangeError);
  const cache = createReactiveQuery();
  assert.throws(() => cache.get(''), TypeError);
  assert.throws(() => cache.query(' padded ', () => 1), TypeError);
  assert.throws(() => cache.query('x', /** @type {any} */ (3)), TypeError);
});

test('zero TTL returns query values without retaining them', async () => {
  const cache = createReactiveQuery({ ttlMs: 0 });
  assert.equal(await cache.query('x', () => 9), 9);
  assert.equal(cache.get('x'), undefined);
  assert.equal(cache.snapshot().entries, 0);
});

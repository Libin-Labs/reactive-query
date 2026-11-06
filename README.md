# @lp-labs/reactive-query

A small async query cache with request deduplication, TTL expiry, LRU eviction and a hard entry
limit. It has no runtime or peer dependencies and does not perform network requests itself.

## Install

```bash
npm install @lp-labs/reactive-query
```

Includes ESM and CommonJS builds and TypeScript declarations. CommonJS consumers can use
`require('@lp-labs/reactive-query')`.

## Quickstart

```js
import { createReactiveQuery } from '@lp-labs/reactive-query';

const queries = createReactiveQuery({
  maxEntries: 250,
  ttlMs: 15_000,
});
const record = await queries.query('record:42', async () => ({ id: '42', title: 'Example' }));
console.log(record.title);
```

## API and customization

- `createReactiveQuery<T>({ maxEntries = 500, ttlMs = 30000, now = Date.now })` creates a
  process-local cache. Limits must be positive safe integers; TTL is finite and non-negative.
- `query(key, load)` deduplicates concurrent work for the same key and stores successful results
  for the configured TTL. Failed work is removed so a later call may retry.
- `get(key)` returns a fresh cached value or `undefined`; `set`, `invalidate`, and `clear` manage
  entries. Keys must be trimmed, nonempty strings no longer than 256 characters.
- `snapshot()` reports entry, pending-work, and configured capacity counts.

At capacity, the least-recently-used completed value is evicted. Pending work is never evicted;
when every slot is pending, a new distinct query fails with `QueryCacheError` (`code: 'capacity'`).
Set `ttlMs:  0` to disable retention while keeping in-flight deduplication. The injected clock
makes expiry deterministic in tests.

## Limitations

This is an in-memory cache, not a reactive UI state framework. It has no persistence, query-key
serialization, automatic invalidation graph, cancellation, stale-while-revalidate, cross-process
coordination, or protection against callers mutating cached object values. Cache keys and value
ownership are application responsibilities.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.

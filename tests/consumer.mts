import { createReactiveQuery, type ReactiveQuery } from '@lp-labs/reactive-query';
const cache: ReactiveQuery<number> = createReactiveQuery<number>({ maxEntries: 4, ttlMs: 1000 });
const value: Promise<number> = cache.query('items', () => 1);
cache.set('other', 2);
const stored: number | undefined = cache.get('other');
void [value, stored];

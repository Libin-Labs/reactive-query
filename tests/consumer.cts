import { createReactiveQuery, type QuerySnapshot } from '@lp-labs/reactive-query';
const cache = createReactiveQuery<string>();
const value: Promise<string> = cache.query('key', () => 'value');
const snapshot: QuerySnapshot = cache.snapshot();
void [value, snapshot];

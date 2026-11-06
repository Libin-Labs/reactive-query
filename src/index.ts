export interface ReactiveQueryOptions {
  maxEntries?: number;
  ttlMs?: number;
  now?: () => number;
}

export interface QuerySnapshot {
  entries: number;
  pending: number;
  maxEntries: number;
}

export interface ReactiveQuery<T> {
  query(key: string, load: () => T | PromiseLike<T>): Promise<T>;
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  invalidate(key: string): boolean;
  clear(): void;
  snapshot(): QuerySnapshot;
}

export class QueryCacheError extends Error {
  constructor(
    readonly code: 'capacity',
    message: string,
  ) {
    super(message);
    this.name = 'QueryCacheError';
  }
}

type Entry<T> =
  | { kind: 'pending'; promise: Promise<T>; touched: number }
  | { kind: 'value'; value: T; expiresAt: number; touched: number };

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive safe integer.`);
  }
  return value;
}

function validKey(key: string): string {
  if (typeof key !== 'string' || key.length === 0 || key.length > 256 || key.trim() !== key) {
    throw new TypeError('Query keys must be nonempty, trimmed strings of at most 256 characters.');
  }
  return key;
}

export function createReactiveQuery<T>(options: ReactiveQueryOptions = {}): ReactiveQuery<T> {
  const maxEntries = positiveInteger(options.maxEntries ?? 500, 'maxEntries');
  const ttlMs = options.ttlMs ?? 30_000;
  if (!Number.isFinite(ttlMs) || ttlMs < 0)
    throw new RangeError('ttlMs must be finite and non-negative.');
  const now = options.now ?? Date.now;
  if (typeof now !== 'function') throw new TypeError('now must be a function.');
  const entries = new Map<string, Entry<T>>();

  const touch = (key: string, entry: Entry<T>) => {
    entry.touched = now();
    entries.delete(key);
    entries.set(key, entry);
  };
  const pruneExpired = () => {
    const time = now();
    for (const [key, entry] of entries) {
      if (entry.kind === 'value' && entry.expiresAt <= time) entries.delete(key);
    }
  };
  const ensureSlot = () => {
    pruneExpired();
    if (entries.size < maxEntries) return;
    for (const [key, entry] of entries) {
      if (entry.kind === 'value') {
        entries.delete(key);
        return;
      }
    }
    throw new QueryCacheError('capacity', 'All cache slots are occupied by pending queries.');
  };

  return {
    query(keyInput, load) {
      const key = validKey(keyInput);
      if (typeof load !== 'function') throw new TypeError('load must be a function.');
      const existing = entries.get(key);
      if (existing?.kind === 'pending') {
        touch(key, existing);
        return existing.promise;
      }
      if (existing?.kind === 'value' && existing.expiresAt > now()) {
        touch(key, existing);
        return Promise.resolve(existing.value);
      }
      if (existing) entries.delete(key);
      ensureSlot();
      const entry: Entry<T> = {
        kind: 'pending',
        promise: Promise.resolve(undefined as T),
        touched: now(),
      };
      const promise = Promise.resolve()
        .then(load)
        .then(
          (value) => {
            if (entries.get(key) === entry) {
              if (ttlMs === 0) entries.delete(key);
              else {
                const resolved: Entry<T> = {
                  kind: 'value',
                  value,
                  expiresAt: now() + ttlMs,
                  touched: now(),
                };
                entries.delete(key);
                entries.set(key, resolved);
              }
            }
            return value;
          },
          (error: unknown) => {
            if (entries.get(key) === entry) entries.delete(key);
            throw error;
          },
        );
      entry.promise = promise;
      entries.set(key, entry);
      return promise;
    },
    get(keyInput) {
      const key = validKey(keyInput);
      const entry = entries.get(key);
      if (!entry || entry.kind === 'pending') return undefined;
      if (entry.expiresAt <= now()) {
        entries.delete(key);
        return undefined;
      }
      touch(key, entry);
      return entry.value;
    },
    set(keyInput, value) {
      const key = validKey(keyInput);
      if (entries.has(key)) entries.delete(key);
      if (ttlMs > 0) {
        ensureSlot();
        entries.set(key, { kind: 'value', value, expiresAt: now() + ttlMs, touched: now() });
      }
    },
    invalidate(keyInput) {
      return entries.delete(validKey(keyInput));
    },
    clear() {
      entries.clear();
    },
    snapshot() {
      let pending = 0;
      for (const entry of entries.values()) if (entry.kind === 'pending') pending++;
      return { entries: entries.size, pending, maxEntries };
    },
  };
}

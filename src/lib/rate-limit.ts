/**
 * Limitador de intentos en memoria (ventana deslizante simple). Suficiente para una
 * sola instancia; con varias réplicas habría que moverlo a Redis o a la base de datos.
 */
type Entry = { fails: number; first: number };
const store = new Map<string, Entry>();

const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 2000;

function live(key: string): Entry | undefined {
  const e = store.get(key);
  if (e && Date.now() - e.first > WINDOW_MS) {
    store.delete(key);
    return undefined;
  }
  return e;
}

/** Evita que el mapa crezca sin límite con intentos de muchas IP distintas. */
function prune() {
  if (store.size < MAX_ENTRIES) return;
  const now = Date.now();
  for (const [k, e] of store) if (now - e.first > WINDOW_MS) store.delete(k);
  if (store.size >= MAX_ENTRIES) store.clear();
}

export function isBlocked(key: string) {
  return (live(key)?.fails ?? 0) >= MAX_FAILS;
}

export function recordFailure(key: string) {
  const e = live(key);
  if (e) e.fails++;
  else {
    prune();
    store.set(key, { fails: 1, first: Date.now() });
  }
}

export function clearFailures(key: string) {
  store.delete(key);
}

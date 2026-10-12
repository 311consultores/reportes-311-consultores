/**
 * Limitadores de intentos en memoria. Suficientes para una sola instancia; con varias réplicas
 * habría que moverlos a Redis o a la base de datos.
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

// --- Límite de acciones por ventana (p. ej. envíos del formulario público de registro) ---
const hits = new Map<string, { n: number; first: number }>();

/** ¿Ya se alcanzó el máximo en la ventana? No cuenta nada (se usa antes de hacer el trabajo). */
export function overLimit(key: string, max: number, windowMs: number): boolean {
  const e = hits.get(key);
  return !!e && Date.now() - e.first <= windowMs && e.n >= max;
}

/** Cuenta una acción y devuelve false si ya se superó el máximo permitido dentro de la ventana. */
export function allowAction(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  if (hits.size >= MAX_ENTRIES) {
    for (const [k, e] of hits) if (now - e.first > windowMs) hits.delete(k);
    if (hits.size >= MAX_ENTRIES) hits.clear();
  }
  const e = hits.get(key);
  if (!e || now - e.first > windowMs) {
    hits.set(key, { n: 1, first: now });
    return true;
  }
  e.n++;
  return e.n <= max;
}

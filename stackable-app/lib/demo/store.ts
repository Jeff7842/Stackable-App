// Demo data lives in sessionStorage, so it is gone when the tab or browser session ends.
export type DemoDb = Record<string, unknown>;

const KEY = "stackable_demo_db";

export function loadDb(seed: () => DemoDb): DemoDb {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DemoDb;
  } catch {
    // Unreadable or blocked storage: fall through to a fresh seed.
  }
  const db = seed();
  saveDb(db);
  return db;
}

export function saveDb(db: DemoDb): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // Storage full or blocked: the demo keeps working for this page load only.
  }
}

export function clearDb(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

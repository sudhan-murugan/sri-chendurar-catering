// Two-way sync between the local store (lib/db.ts) and Supabase.
//  • push: outbox rows are upserted in parent→child table order
//  • pull: rows changed on the server since the last pull (server updated_at)
//  • conflicts: last write wins (single user); unpushed local edits are never
//    overwritten by a pull
// Runs on app start, when the phone comes back online, shortly after every
// edit, when the app returns to the foreground, and every minute.

import { useSyncExternalStore } from "react";
import { supabase, DEMO_MODE } from "./supabase";
import { TABLES } from "./types";
import * as db from "./db";

export interface SyncStatus {
  online: boolean;
  syncing: boolean;
  pending: number;
  lastSyncAt: string | null;
  error: string | null;
  authExpired: boolean;
  /** Changes the server refused (e.g. a value too long); they stay on the phone and are retried. */
  rejected: number;
}

let status: SyncStatus = {
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  syncing: false,
  pending: 0,
  lastSyncAt: null,
  error: null,
  authExpired: false,
  rejected: 0,
};
const listeners = new Set<() => void>();
function set(p: Partial<SyncStatus>) {
  status = { ...status, ...p };
  listeners.forEach((l) => l());
}
db.subscribe(() => {
  const n = db.pendingCount();
  if (n !== status.pending) set({ pending: n });
});

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    () => status,
    () => status,
  );
}

const PAGE = 1000;
const PUSH_CHUNK = 200;
let inflight: Promise<boolean> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Push then pull. Resolves true if both fully succeeded. */
export function syncNow(): Promise<boolean> {
  if (DEMO_MODE || !db.isReady()) return Promise.resolve(false);
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    set({ online: false });
    return Promise.resolve(false);
  }
  if (inflight) return inflight;
  inflight = run().finally(() => (inflight = null));
  return inflight;
}

export function scheduleSync(delayMs = 1500) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delayMs);
}

async function run(): Promise<boolean> {
  const sbp = supabase();
  if (!sbp) return false;
  const sb = await sbp;
  set({ syncing: true, error: null });
  try {
    const { data: sess } = await sb.auth.getSession();
    if (!sess.session) {
      set({ authExpired: true, syncing: false });
      return false;
    }
    const rejected = await push(sb);
    set({ rejected });
    await pull(sb);
    set({ syncing: false, online: true, lastSyncAt: new Date().toISOString(), authExpired: false });
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const authErr = /jwt|auth|401|refresh token/i.test(msg);
    set({ syncing: false, error: msg, authExpired: authErr || status.authExpired });
    return false;
  }
}

type Sb = Awaited<NonNullable<ReturnType<typeof supabase>>>;

/**
 * A Postgres data error (bad value, constraint, permission on one row) as opposed
 * to a network/auth problem. Data errors affect single rows, so the rest of the
 * changes must still be sent instead of being blocked behind one bad row.
 */
function isRowError(error: { code?: string } | null): boolean {
  return !!error?.code && /^(22|23|42)/.test(error.code);
}

/** Send pending changes, parents first. Returns how many rows the server refused. */
async function push(sb: Sb): Promise<number> {
  const entries = db.pendingEntries();
  let rejected = 0;
  for (const t of TABLES) {
    const forTable = entries.filter((e) => e.table === t);
    for (let i = 0; i < forTable.length; i += PUSH_CHUNK) {
      const chunk = forTable.slice(i, i + PUSH_CHUNK);
      const withRows = chunk.map((e) => ({ e, row: db.getRow(t, e.id) }));
      const rows = withRows.filter((x) => !!x.row).map((x) => x.row as object);
      if (!rows.length) {
        await db.ackPushed(chunk);
        continue;
      }
      const { error } = await sb.from(t).upsert(rows, { onConflict: "id" });
      if (!error) {
        await db.ackPushed(chunk);
        continue;
      }
      // network / auth problem: stop and retry the whole sync later
      if (!isRowError(error)) throw new Error(`${t}: ${error.message}`);
      // one or more bad rows: send them one by one so the good ones still go through
      for (const { e, row } of withRows) {
        if (!row) {
          await db.ackPushed([e]);
          continue;
        }
        const r = await sb.from(t).upsert(row as object, { onConflict: "id" });
        if (!r.error) await db.ackPushed([e]);
        else if (isRowError(r.error)) {
          rejected++; // stays in the outbox (kept on the phone), retried next time
          console.warn(`sync: server refused ${t}/${e.id}: ${r.error.message}`);
        } else throw new Error(`${t}: ${r.error.message}`);
      }
    }
  }
  return rejected;
}

async function pull(sb: Sb) {
  for (const t of TABLES) {
    let cursor = (await db.getMeta<string>(`pull:${t}`)) ?? "1970-01-01T00:00:00Z";
    for (;;) {
      // strictly newer than the last row we have: no re-downloading the same row every minute
      // (updated_at is set per row by clock_timestamp(), so timestamps don't collide)
      const { data, error } = await sb.from(t).select("*").gt("updated_at", cursor).order("updated_at").limit(PAGE);
      if (error) throw new Error(`${t}: ${error.message}`);
      if (!data?.length) break;
      await db.applyRemote(t, data);
      cursor = data[data.length - 1].updated_at;
      await db.setMeta(`pull:${t}`, cursor);
      if (data.length < PAGE) break;
    }
  }
}

let started = false;
export function startSyncLoop() {
  if (started || typeof window === "undefined") return;
  started = true;
  db.setLocalWriteHook(() => scheduleSync());
  window.addEventListener("online", () => {
    set({ online: true });
    void syncNow();
  });
  window.addEventListener("offline", () => set({ online: false }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncNow();
  });
  setInterval(() => void syncNow(), 60_000);
  set({ pending: db.pendingCount() });
}

/** Exposed for unit tests only. */
export const __testing = { push, pull, isRowError };

// Local-first data store.
//
// Every table is held in memory (personal-business data is small) and
// persisted to IndexedDB. Screens read only from here, so everything works
// offline and renders instantly. Every write also records an "outbox" entry;
// lib/offline-sync.ts pushes those to Supabase when online and pulls changes.

import { openDB, type IDBPDatabase } from "idb";
import { useSyncExternalStore } from "react";
import { TABLES, type Base, type Draft, type TableName, type Tables } from "./types";

type AnyRow = Base & Record<string, unknown>;
interface OutboxEntry {
  key: string; // `${table}:${id}`
  table: TableName;
  id: string;
  rev: number;
}

const mem = Object.fromEntries(TABLES.map((t) => [t, new Map<string, AnyRow>()])) as Record<TableName, Map<string, AnyRow>>;
const versions = Object.fromEntries(TABLES.map((t) => [t, 0])) as Record<TableName, number>;
const pending = new Map<string, OutboxEntry>();
const listeners = new Set<() => void>();
let idb: IDBPDatabase | null = null;
let currentUser = "";
let ready = false;
let revCounter = Date.now();
let onLocalWrite: (() => void) | null = null;

function emit() {
  for (const l of listeners) l();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isReady() {
  return ready;
}
export function getUserId() {
  return currentUser;
}

/** Called by the sync module so a write schedules a push. */
export function setLocalWriteHook(fn: () => void) {
  onLocalWrite = fn;
}

export async function openStore(userId: string): Promise<void> {
  if (ready && currentUser === userId) return;
  currentUser = userId;
  idb = await openDB(`scc-${userId}`, 1, {
    upgrade(db) {
      for (const t of TABLES) db.createObjectStore(t, { keyPath: "id" });
      db.createObjectStore("outbox", { keyPath: "key" });
      db.createObjectStore("meta");
    },
  });
  const tx = idb.transaction([...TABLES, "outbox"], "readonly");
  await Promise.all(
    TABLES.map(async (t) => {
      const all = (await tx.objectStore(t).getAll()) as AnyRow[];
      mem[t] = new Map(all.map((r) => [r.id, r]));
      versions[t]++;
    }),
  );
  const ob = (await tx.objectStore("outbox").getAll()) as OutboxEntry[];
  pending.clear();
  for (const e of ob) pending.set(e.key, e);
  await tx.done;
  ready = true;
  emit();
}

/** Delete everything stored on this phone for the current user (logout / restore). */
export async function wipeLocal(userId = currentUser): Promise<void> {
  idb?.close();
  idb = null;
  ready = false;
  for (const t of TABLES) {
    mem[t].clear();
    versions[t]++;
  }
  pending.clear();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(`scc-${userId}`);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
  emit();
}

export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // fallback for very old browsers / insecure origins
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ------------------------------------------------------------------ reads

export function getRow<T extends TableName>(t: T, id: string | null | undefined): Tables[T] | undefined {
  if (!id) return undefined;
  return mem[t].get(id) as Tables[T] | undefined;
}

/** Active (non-archived) rows. */
export function getRows<T extends TableName>(t: T): Tables[T][] {
  return snapshot(t);
}

const snapCache = {} as Record<TableName, { v: number; rows: AnyRow[] }>;
const mapCache = {} as Record<TableName, { v: number; map: Map<string, AnyRow> }>;
const EMPTY: never[] = [];
const EMPTY_MAP = new Map();

function snapshot<T extends TableName>(t: T): Tables[T][] {
  const c = snapCache[t];
  if (c && c.v === versions[t]) return c.rows as unknown as Tables[T][];
  const rows = [...mem[t].values()].filter((r) => !r.archived);
  snapCache[t] = { v: versions[t], rows };
  return rows as unknown as Tables[T][];
}

/** React hook: active rows of a table, re-renders on change. */
export function useTable<T extends TableName>(t: T): Tables[T][] {
  return useSyncExternalStore(subscribe, () => snapshot(t), () => EMPTY as Tables[T][]);
}

/** React hook: id → row map INCLUDING archived rows (for looking up names in old orders). */
export function useRowMap<T extends TableName>(t: T): Map<string, Tables[T]> {
  return useSyncExternalStore(
    subscribe,
    () => {
      const c = mapCache[t];
      if (c && c.v === versions[t]) return c.map as unknown as Map<string, Tables[T]>;
      const map = new Map(mem[t]);
      mapCache[t] = { v: versions[t], map };
      return map as unknown as Map<string, Tables[T]>;
    },
    () => EMPTY_MAP,
  );
}

export function useRow<T extends TableName>(t: T, id: string | null | undefined): Tables[T] | undefined {
  return useRowMap(t).get(id ?? "");
}

export function useStoreReady(): boolean {
  return useSyncExternalStore(subscribe, () => ready, () => false);
}

// ------------------------------------------------------------------ writes

export interface SaveOp<T extends TableName = TableName> {
  table: T;
  row: Draft<T> | (Partial<Tables[T]> & { id: string });
}

function build<T extends TableName>(t: T, draft: Record<string, unknown>, now: string): AnyRow {
  const id = (draft.id as string) || newId();
  const existing = mem[t].get(id);
  return {
    ...existing,
    ...draft,
    id,
    user_id: currentUser,
    created_at: existing?.created_at ?? (draft.created_at as string) ?? now,
    updated_at: now,
    archived: (draft.archived as boolean | undefined) ?? existing?.archived ?? false,
  } as AnyRow;
}

/** Save several rows atomically (one IndexedDB transaction). Returns saved rows. */
export function saveMany(ops: SaveOp[]): AnyRow[] {
  if (!ready || !idb) throw new Error("store not ready");
  const now = new Date().toISOString();
  const saved: AnyRow[] = [];
  const entries: OutboxEntry[] = [];
  for (const op of ops) {
    const row = build(op.table, op.row as Record<string, unknown>, now);
    mem[op.table].set(row.id, row);
    versions[op.table]++;
    const e: OutboxEntry = { key: `${op.table}:${row.id}`, table: op.table, id: row.id, rev: ++revCounter };
    pending.set(e.key, e);
    entries.push(e);
    saved.push(row);
  }
  emit();
  const tables = [...new Set(ops.map((o) => o.table))];
  const tx = idb.transaction([...tables, "outbox"], "readwrite");
  ops.forEach((op, i) => void tx.objectStore(op.table).put(saved[i]));
  for (const e of entries) void tx.objectStore("outbox").put(e);
  tx.done.catch((err) => console.error("IndexedDB write failed", err));
  onLocalWrite?.();
  return saved;
}

export function save<T extends TableName>(t: T, row: Draft<T> | (Partial<Tables[T]> & { id: string })): Tables[T] {
  return saveMany([{ table: t, row }])[0] as unknown as Tables[T];
}

export function update<T extends TableName>(t: T, id: string, patch: Partial<Tables[T]>): Tables[T] {
  return save(t, { ...(patch as object), id } as Partial<Tables[T]> & { id: string });
}

/** Soft delete. */
export function archive(t: TableName, id: string) {
  update(t, id, { archived: true } as never);
}

// ------------------------------------------------------------------ sync helpers (used by offline-sync.ts)

export function pendingEntries(): OutboxEntry[] {
  return [...pending.values()];
}
export function pendingCount(): number {
  return pending.size;
}

/** Mark pushed entries done, unless they were edited again while pushing. */
export async function ackPushed(entries: OutboxEntry[]) {
  if (!idb) return;
  const tx = idb.transaction("outbox", "readwrite");
  for (const e of entries) {
    const cur = pending.get(e.key);
    if (cur && cur.rev === e.rev) {
      pending.delete(e.key);
      void tx.store.delete(e.key);
    }
  }
  await tx.done;
  emit();
}

/** Apply rows pulled from the server (skips rows with unpushed local edits). */
export async function applyRemote(t: TableName, rows: AnyRow[]) {
  if (!idb || rows.length === 0) return;
  const tx = idb.transaction(t, "readwrite");
  for (const r of rows) {
    if (pending.has(`${t}:${r.id}`)) continue;
    mem[t].set(r.id, r);
    void tx.store.put(r);
  }
  versions[t]++;
  await tx.done;
  emit();
}

export async function getMeta<V>(key: string): Promise<V | undefined> {
  return idb ? ((await idb.get("meta", key)) as V | undefined) : undefined;
}
export async function setMeta(key: string, value: unknown) {
  if (idb) await idb.put("meta", value, key);
}

/** Full dump for backups. */
export function dumpAll(includeArchived = true): Record<TableName, AnyRow[]> {
  return Object.fromEntries(
    TABLES.map((t) => [t, [...mem[t].values()].filter((r) => includeArchived || !r.archived)]),
  ) as Record<TableName, AnyRow[]>;
}

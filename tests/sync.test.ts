import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- fake local store
const outbox = new Map<string, { key: string; table: string; id: string; rev: number }>();
const rows = new Map<string, Record<string, unknown>>();
vi.mock("@/lib/db", () => ({
  subscribe: () => () => {},
  pendingCount: () => outbox.size,
  pendingEntries: () => [...outbox.values()],
  getRow: (t: string, id: string) => rows.get(`${t}:${id}`),
  ackPushed: async (entries: { key: string }[]) => entries.forEach((e) => outbox.delete(e.key)),
  applyRemote: vi.fn(async () => {}),
  getMeta: async () => "2026-11-01T00:00:00Z",
  setMeta: async () => {},
  isReady: () => true,
  setLocalWriteHook: () => {},
}));
vi.mock("@/lib/supabase", () => ({ DEMO_MODE: false, supabase: () => null }));

import { __testing } from "@/lib/offline-sync";

const add = (table: string, id: string, row: Record<string, unknown>) => {
  outbox.set(`${table}:${id}`, { key: `${table}:${id}`, table, id, rev: 1 });
  rows.set(`${table}:${id}`, { id, ...row });
};

/** Fake Supabase: refuses rows whose name is "BAD" (like a check-constraint violation). */
function fakeServer(opts: { network?: boolean } = {}) {
  const sent: string[] = [];
  const filters: string[] = [];
  const sb = {
    from: (t: string) => ({
      upsert: async (r: object | object[]) => {
        if (opts.network) return { error: { message: "TypeError: Failed to fetch", code: "" } };
        const list = Array.isArray(r) ? r : [r];
        if (list.some((x) => (x as { name_ta?: string }).name_ta === "BAD")) return { error: { message: "violates check constraint", code: "23514" } };
        list.forEach((x) => sent.push(`${t}:${(x as { id: string }).id}`));
        return { error: null };
      },
      select: () => ({
        gt: (col: string, v: string) => (filters.push(`gt ${col} ${v}`), { order: () => ({ limit: async () => ({ data: [], error: null }) }) }),
        gte: (col: string, v: string) => (filters.push(`gte ${col} ${v}`), { order: () => ({ limit: async () => ({ data: [], error: null }) }) }),
      }),
    }),
  };
  return { sb: sb as never, sent, filters };
}

beforeEach(() => {
  outbox.clear();
  rows.clear();
});

describe("sync push", () => {
  it("one refused row no longer blocks the other changes", async () => {
    add("ingredients", "i1", { name_ta: "அரிசி" });
    add("ingredients", "i2", { name_ta: "BAD" });
    add("dishes", "d1", { name_ta: "இட்லி" });
    const { sb, sent } = fakeServer();
    const rejected = await __testing.push(sb);
    expect(rejected).toBe(1);
    expect(sent.sort()).toEqual(["dishes:d1", "ingredients:i1"]);
    expect([...outbox.keys()]).toEqual(["ingredients:i2"]); // kept on the phone, retried next time
  });

  it("a network failure stops the push and keeps everything for the next try", async () => {
    add("ingredients", "i1", { name_ta: "அரிசி" });
    const { sb } = fakeServer({ network: true });
    await expect(__testing.push(sb)).rejects.toThrow(/Failed to fetch/);
    expect(outbox.size).toBe(1);
  });

  it("classifies errors", () => {
    expect(__testing.isRowError({ code: "23514" })).toBe(true); // check violation
    expect(__testing.isRowError({ code: "22001" })).toBe(true); // value too long
    expect(__testing.isRowError({ code: "PGRST301" })).toBe(false); // auth
    expect(__testing.isRowError({ code: "" })).toBe(false); // network
  });
});

describe("sync pull", () => {
  it("asks only for rows strictly newer than the last one (no re-download every minute)", async () => {
    const { sb, filters } = fakeServer();
    await __testing.pull(sb);
    expect(filters.length).toBeGreaterThan(0);
    expect(filters.every((x) => x.startsWith("gt updated_at"))).toBe(true);
  });
});

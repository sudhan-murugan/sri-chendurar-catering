import { describe, expect, it } from "vitest";
import { configProblems } from "@/lib/config-check";

const jwt = (role: string) => `x.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.y`;

describe("production config check", () => {
  it("fails when variables are missing (would silently keep data on the phone)", () => {
    expect(configProblems({})).toHaveLength(2);
  });
  it("accepts a publishable key or a legacy anon key", () => {
    expect(configProblems({ supabaseUrl: "https://abc.supabase.co", supabaseKey: "sb_publishable_123" })).toEqual([]);
    expect(configProblems({ supabaseUrl: "https://abc.supabase.co", supabaseKey: jwt("anon") })).toEqual([]);
  });
  it("refuses secret keys in a public variable", () => {
    expect(configProblems({ supabaseUrl: "https://abc.supabase.co", supabaseKey: "sb_secret_123" })[0]).toMatch(/SECRET/);
    expect(configProblems({ supabaseUrl: "https://abc.supabase.co", supabaseKey: jwt("service_role") })[0]).toMatch(/SECRET/);
  });
  it("requires https and a valid URL", () => {
    expect(configProblems({ supabaseUrl: "http://abc.supabase.co", supabaseKey: "sb_publishable_1" })[0]).toMatch(/https/);
    expect(configProblems({ supabaseUrl: "not a url", supabaseKey: "sb_publishable_1" })[0]).toMatch(/valid URL/);
  });
  it("explicit demo mode is allowed", () => {
    expect(configProblems({ demoMode: "1" })).toEqual([]);
  });
});

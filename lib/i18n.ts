import ta from "@/locales/ta.json";

/** All UI text. Typed: `t.calc.people`. Edit locales/ta.json to change wording. */
export const t = ta;

/** Fill "{n} நபர்கள்" style placeholders. */
export function f(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

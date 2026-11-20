// Unit handling for ingredients and recipes.
// Recipes may use g while the ingredient is bought in kg (and ml ↔ litre);
// count/bundle/packet are only compatible with themselves.

export const UNITS = ["kg", "g", "l", "ml", "count", "bundle", "packet"] as const;
export type Unit = (typeof UNITS)[number];

export const UNIT_LABEL: Record<Unit, string> = {
  kg: "கிலோ",
  g: "கிராம்",
  l: "லிட்டர்",
  ml: "மி.லி",
  count: "எண்ணம்",
  bundle: "கட்டு",
  packet: "பாக்கெட்",
};

/** Short label for tight spaces (price per unit, etc.). */
export const UNIT_SHORT: Record<Unit, string> = {
  kg: "கிலோ",
  g: "கி",
  l: "லி",
  ml: "மி.லி",
  count: "எண்",
  bundle: "கட்டு",
  packet: "பாக்.",
};

type Dimension = "mass" | "volume" | "count" | "bundle" | "packet";

const DIM: Record<Unit, { dim: Dimension; factor: number }> = {
  kg: { dim: "mass", factor: 1000 },
  g: { dim: "mass", factor: 1 },
  l: { dim: "volume", factor: 1000 },
  ml: { dim: "volume", factor: 1 },
  count: { dim: "count", factor: 1 },
  bundle: { dim: "bundle", factor: 1 },
  packet: { dim: "packet", factor: 1 },
};

export function isUnit(u: string): u is Unit {
  return (UNITS as readonly string[]).includes(u);
}

export function areCompatible(a: Unit, b: Unit): boolean {
  return DIM[a].dim === DIM[b].dim;
}

/** Units a recipe line may use for an ingredient bought in `unit`. */
export function compatibleUnits(unit: Unit): Unit[] {
  return UNITS.filter((u) => areCompatible(u, unit));
}

/** Convert a quantity between compatible units. Returns null if incompatible. */
export function convert(qty: number, from: Unit, to: Unit): number | null {
  if (!areCompatible(from, to)) return null;
  return (qty * DIM[from].factor) / DIM[to].factor;
}

/** Practical purchase rounding steps (in the ingredient's own unit). */
export interface RoundingRules {
  kg: number; // e.g. 0.25 → buy in quarter-kilos
  kgSmall: number; // step used when total is below 1 kg, e.g. 0.05 (50 g)
  l: number;
  lSmall: number;
  g: number;
  ml: number;
  count: number;
  bundle: number;
  packet: number;
}

export const DEFAULT_ROUNDING: RoundingRules = {
  kg: 0.25,
  kgSmall: 0.05,
  l: 0.25,
  lSmall: 0.05,
  g: 50,
  ml: 50,
  count: 1,
  bundle: 1,
  packet: 1,
};

/** Round to 3 decimals to remove floating-point noise (0.30000000004). */
export function clean(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function roundUpToStep(qty: number, step: number): number {
  if (!(step > 0)) return clean(qty);
  // the small epsilon keeps 2.0000000001 from rounding up to the next step
  return clean(Math.ceil(qty / step - 1e-9) * step);
}

/** Round a required quantity up to a size you can actually buy. */
export function practicalRound(qty: number, unit: Unit, rules: RoundingRules = DEFAULT_ROUNDING): number {
  if (qty <= 0) return 0;
  switch (unit) {
    case "kg":
      return roundUpToStep(qty, qty < 1 ? rules.kgSmall : rules.kg);
    case "l":
      return roundUpToStep(qty, qty < 1 ? rules.lSmall : rules.l);
    default:
      return roundUpToStep(qty, rules[unit]);
  }
}

/** Human-friendly quantity: 0.25 kg → "250 கிராம்", 12.5 kg → "12.5 கிலோ". */
export function formatQty(qty: number, unit: Unit): string {
  if (unit === "kg" && qty > 0 && qty < 1) return `${trimNum(qty * 1000)} ${UNIT_LABEL.g}`;
  if (unit === "l" && qty > 0 && qty < 1) return `${trimNum(qty * 1000)} ${UNIT_LABEL.ml}`;
  return `${trimNum(qty)} ${UNIT_LABEL[unit]}`;
}

export function trimNum(n: number, maxDecimals = 2): string {
  const f = Math.pow(10, maxDecimals);
  const r = Math.round(n * f) / f;
  return r.toLocaleString("en-IN", { maximumFractionDigits: maxDecimals });
}

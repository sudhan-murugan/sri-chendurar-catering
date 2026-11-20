// Cost calculation engine. Pure functions only — runs on the phone, offline,
// and is covered by tests/calc.test.ts.
//
// Model
//  • A dish recipe is written for a reference batch (e.g. 100 people).
//  • Per-person qty = recipe qty / batch size; scaled by headcount, the dish's
//    portion multiplier in the session, and the dish wastage buffer.
//  • Quantities are converted to the ingredient's purchase unit, combined
//    across all dishes and sessions, then rounded UP to practical sizes.
//  • Ingredient cost = rounded purchase qty × current price (what you pay).
//  • Other expenses: per person (× plates), per session (× sessions), fixed.
//  • "Plates" = sum of headcounts across sessions; per-plate figures use it.
//  • Suggested price per plate = cost per plate × (1 + margin%), rounded up
//    to the nearest `priceRoundRupees`.
//  • Profit = selling price (before GST) − total cost. GST is added on top
//    and is not counted as income.

import { convert, practicalRound, type RoundingRules, type Unit, DEFAULT_ROUNDING, clean } from "./units";

export type ExpenseMode = "per_person" | "per_session" | "fixed";

export interface CalcIngredient {
  id: string;
  name: string;
  category: string;
  unit: Unit;
  pricePaise: number; // price per 1 `unit`
  shop?: string | null;
}

export interface CalcRecipeItem {
  ingredientId: string;
  qty: number;
  unit: Unit;
}

export interface CalcDish {
  id: string;
  name: string;
  batchSize: number; // recipe is written for this many people
  wastagePct: number | null; // null → settings default
  items: CalcRecipeItem[];
}

export interface CalcSessionDish {
  dishId: string;
  multiplier: number; // 1 = full portion, 0.5 = half portion
}

export interface CalcSession {
  id: string;
  label: string;
  headcount: number;
  dishes: CalcSessionDish[];
}

export interface CalcExpense {
  id: string;
  name: string;
  mode: ExpenseMode;
  ratePaise: number;
}

export interface CalcOptions {
  defaultWastagePct: number;
  rounding?: RoundingRules;
  marginPct: number;
  priceRoundRupees: number; // round suggested per-plate price up to this (0 = no rounding)
  gstPct: number; // 0 = no GST
  /** Manual per-plate price; overrides the suggested price. */
  pricePerPlateOverridePaise?: number | null;
  /** Manual total price (before GST); overrides everything else. */
  totalPriceOverridePaise?: number | null;
}

export interface IngredientLine {
  ingredientId: string;
  name: string;
  category: string;
  shop: string | null;
  unit: Unit;
  exactQty: number; // required (with wastage), not rounded
  purchaseQty: number; // rounded up to a practical size
  pricePaise: number;
  costPaise: number;
  dishNames: string[];
}

export interface ExpenseLine {
  id: string;
  name: string;
  mode: ExpenseMode;
  ratePaise: number;
  amountPaise: number;
}

export interface CalcWarning {
  kind: "missing_dish" | "missing_ingredient" | "unit_mismatch" | "no_price" | "bad_batch";
  message: string;
}

export interface CalcResult {
  lines: IngredientLine[];
  plates: number;
  sessionsCount: number;
  ingredientCostPaise: number;
  expenseLines: ExpenseLine[];
  expenseCostPaise: number;
  totalCostPaise: number;
  perPlateCostPaise: number;
  suggestedPerPlatePaise: number;
  pricePerPlatePaise: number;
  sellingPricePaise: number; // before GST
  gstPaise: number;
  customerTotalPaise: number; // selling + GST
  profitPaise: number;
  profitPctOfCost: number;
  warnings: CalcWarning[];
}

/** Combined ingredient requirements across all sessions. */
export function computeRequirements(
  sessions: CalcSession[],
  dishes: Map<string, CalcDish> | CalcDish[],
  ingredients: Map<string, CalcIngredient> | CalcIngredient[],
  opts: Pick<CalcOptions, "defaultWastagePct" | "rounding">,
): { lines: IngredientLine[]; warnings: CalcWarning[] } {
  const dishMap = toMap(dishes);
  const ingMap = toMap(ingredients);
  const rounding = opts.rounding ?? DEFAULT_ROUNDING;
  const warnings: CalcWarning[] = [];
  const acc = new Map<string, { exact: number; dishNames: Set<string> }>();

  for (const s of sessions) {
    const people = Math.max(0, s.headcount || 0);
    if (people === 0) continue;
    for (const sd of s.dishes) {
      const dish = dishMap.get(sd.dishId);
      if (!dish) {
        warnings.push({ kind: "missing_dish", message: `உணவு கிடைக்கவில்லை (${sd.dishId})` });
        continue;
      }
      if (!(dish.batchSize > 0)) {
        warnings.push({ kind: "bad_batch", message: `${dish.name}: அளவு (நபர்கள்) சரியில்லை` });
        continue;
      }
      const wastage = dish.wastagePct ?? opts.defaultWastagePct ?? 0;
      const factor = (people / dish.batchSize) * (sd.multiplier ?? 1) * (1 + wastage / 100);
      for (const item of dish.items) {
        const ing = ingMap.get(item.ingredientId);
        if (!ing) {
          warnings.push({ kind: "missing_ingredient", message: `${dish.name}: பொருள் கிடைக்கவில்லை` });
          continue;
        }
        const qtyInIngUnit = convert(item.qty, item.unit, ing.unit);
        if (qtyInIngUnit === null) {
          warnings.push({ kind: "unit_mismatch", message: `${dish.name}: ${ing.name} அளவு அலகு பொருந்தவில்லை` });
          continue;
        }
        const entry = acc.get(ing.id) ?? { exact: 0, dishNames: new Set<string>() };
        entry.exact += qtyInIngUnit * factor;
        entry.dishNames.add(dish.name);
        acc.set(ing.id, entry);
      }
    }
  }

  const lines: IngredientLine[] = [];
  for (const [id, { exact, dishNames }] of acc) {
    const ing = ingMap.get(id)!;
    const purchaseQty = practicalRound(exact, ing.unit, rounding);
    if (!ing.pricePaise) warnings.push({ kind: "no_price", message: `${ing.name}: விலை இல்லை` });
    lines.push({
      ingredientId: id,
      name: ing.name,
      category: ing.category,
      shop: ing.shop ?? null,
      unit: ing.unit,
      exactQty: clean(exact),
      purchaseQty,
      pricePaise: ing.pricePaise || 0,
      costPaise: Math.round(purchaseQty * (ing.pricePaise || 0)),
      dishNames: [...dishNames],
    });
  }
  lines.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  return { lines, warnings: dedupeWarnings(warnings) };
}

export function computeExpenses(expenses: CalcExpense[], plates: number, sessionsCount: number): ExpenseLine[] {
  return expenses.map((e) => {
    const rate = Math.round(e.ratePaise || 0);
    const amountPaise =
      e.mode === "per_person" ? rate * plates : e.mode === "per_session" ? rate * sessionsCount : rate;
    return { id: e.id, name: e.name, mode: e.mode, ratePaise: rate, amountPaise };
  });
}

export function suggestedPerPlate(perPlateCostPaise: number, marginPct: number, priceRoundRupees: number): number {
  const raw = perPlateCostPaise * (1 + (marginPct || 0) / 100);
  const step = Math.max(0, priceRoundRupees || 0) * 100;
  if (step === 0) return Math.ceil(raw);
  return Math.ceil(raw / step - 1e-9) * step;
}

export function calculate(
  sessions: CalcSession[],
  dishes: Map<string, CalcDish> | CalcDish[],
  ingredients: Map<string, CalcIngredient> | CalcIngredient[],
  expenses: CalcExpense[],
  opts: CalcOptions,
): CalcResult {
  const { lines, warnings } = computeRequirements(sessions, dishes, ingredients, opts);
  const active = sessions.filter((s) => (s.headcount || 0) > 0);
  const plates = active.reduce((n, s) => n + s.headcount, 0);
  const sessionsCount = active.length;

  const ingredientCostPaise = lines.reduce((n, l) => n + l.costPaise, 0);
  const expenseLines = computeExpenses(expenses, plates, sessionsCount);
  const expenseCostPaise = expenseLines.reduce((n, l) => n + l.amountPaise, 0);
  const totalCostPaise = ingredientCostPaise + expenseCostPaise;
  const perPlateCostPaise = plates > 0 ? Math.round(totalCostPaise / plates) : 0;
  const suggested = suggestedPerPlate(perPlateCostPaise, opts.marginPct, opts.priceRoundRupees);

  let pricePerPlatePaise: number;
  let sellingPricePaise: number;
  if (opts.totalPriceOverridePaise != null && opts.totalPriceOverridePaise > 0) {
    sellingPricePaise = Math.round(opts.totalPriceOverridePaise);
    pricePerPlatePaise = plates > 0 ? Math.round(sellingPricePaise / plates) : 0;
  } else {
    pricePerPlatePaise =
      opts.pricePerPlateOverridePaise != null && opts.pricePerPlateOverridePaise > 0
        ? Math.round(opts.pricePerPlateOverridePaise)
        : suggested;
    sellingPricePaise = pricePerPlatePaise * plates;
  }

  const gstPaise = Math.round((sellingPricePaise * (opts.gstPct || 0)) / 100);
  const profitPaise = sellingPricePaise - totalCostPaise;

  return {
    lines,
    plates,
    sessionsCount,
    ingredientCostPaise,
    expenseLines,
    expenseCostPaise,
    totalCostPaise,
    perPlateCostPaise,
    suggestedPerPlatePaise: suggested,
    pricePerPlatePaise,
    sellingPricePaise,
    gstPaise,
    customerTotalPaise: sellingPricePaise + gstPaise,
    profitPaise,
    profitPctOfCost: totalCostPaise > 0 ? Math.round((profitPaise / totalCostPaise) * 1000) / 10 : 0,
    warnings,
  };
}

/** Cost of one dish per person (used for live cost on the recipe editor and combo cards). */
export function dishCostPerPerson(
  dish: CalcDish,
  ingredients: Map<string, CalcIngredient> | CalcIngredient[],
  defaultWastagePct: number,
  multiplier = 1,
): number {
  const ingMap = toMap(ingredients);
  if (!(dish.batchSize > 0)) return 0;
  const wastage = dish.wastagePct ?? defaultWastagePct ?? 0;
  let total = 0;
  for (const item of dish.items) {
    const ing = ingMap.get(item.ingredientId);
    if (!ing) continue;
    const q = convert(item.qty, item.unit, ing.unit);
    if (q === null) continue;
    total += q * (ing.pricePaise || 0);
  }
  // unrounded: rounding to purchase sizes only makes sense for a real order
  return (total / dish.batchSize) * multiplier * (1 + wastage / 100);
}

function toMap<T extends { id: string }>(x: Map<string, T> | T[]): Map<string, T> {
  return x instanceof Map ? x : new Map(x.map((i) => [i.id, i]));
}

function dedupeWarnings(ws: CalcWarning[]): CalcWarning[] {
  const seen = new Set<string>();
  return ws.filter((w) => (seen.has(w.message) ? false : (seen.add(w.message), true)));
}

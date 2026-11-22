import { describe, expect, it } from "vitest";
import {
  calculate,
  computeRequirements,
  computeExpenses,
  dishCostPerPerson,
  suggestedPerPlate,
  type CalcDish,
  type CalcIngredient,
  type CalcSession,
} from "@/lib/calc";
import { convert, practicalRound, roundUpToStep, formatQty, DEFAULT_ROUNDING } from "@/lib/units";
import { money, rupeesToPaise, dmy } from "@/lib/format";

const ING: CalcIngredient[] = [
  { id: "rice", name: "பொன்னி அரிசி", category: "grains", unit: "kg", pricePaise: 6000 }, // ₹60/kg
  { id: "dal", name: "துவரம் பருப்பு", category: "grains", unit: "kg", pricePaise: 15000 },
  { id: "oil", name: "எண்ணெய்", category: "oil", unit: "l", pricePaise: 16000 },
  { id: "coconut", name: "தேங்காய்", category: "veg", unit: "count", pricePaise: 3000 },
  { id: "salt", name: "உப்பு", category: "grocery", unit: "kg", pricePaise: 2000 },
];

const RICE: CalcDish = {
  id: "d-rice",
  name: "சாதம்",
  batchSize: 100,
  wastagePct: 0,
  items: [{ ingredientId: "rice", qty: 15, unit: "kg" }],
};

const SAMBAR: CalcDish = {
  id: "d-sambar",
  name: "சாம்பார்",
  batchSize: 100,
  wastagePct: 0,
  items: [
    { ingredientId: "dal", qty: 3, unit: "kg" },
    { ingredientId: "oil", qty: 500, unit: "ml" },
    { ingredientId: "salt", qty: 400, unit: "g" },
  ],
};

const CHUTNEY: CalcDish = {
  id: "d-chutney",
  name: "சட்னி",
  batchSize: 50,
  wastagePct: 0,
  items: [
    { ingredientId: "coconut", qty: 7, unit: "count" },
    { ingredientId: "oil", qty: 0.1, unit: "l" },
    { ingredientId: "salt", qty: 100, unit: "g" },
  ],
};

const DISHES = [RICE, SAMBAR, CHUTNEY];
const OPTS = { defaultWastagePct: 0, marginPct: 30, priceRoundRupees: 0, gstPct: 0 };
const session = (headcount: number, dishIds: string[], id = "s1", mult = 1): CalcSession => ({
  id,
  label: id,
  headcount,
  dishes: dishIds.map((d) => ({ dishId: d, multiplier: mult })),
});
const line = (r: ReturnType<typeof computeRequirements>, id: string) => r.lines.find((l) => l.ingredientId === id)!;

describe("units", () => {
  it("converts g↔kg and ml↔l", () => {
    expect(convert(500, "g", "kg")).toBe(0.5);
    expect(convert(1.5, "kg", "g")).toBe(1500);
    expect(convert(250, "ml", "l")).toBe(0.25);
    expect(convert(2, "l", "ml")).toBe(2000);
  });
  it("refuses incompatible units", () => {
    expect(convert(1, "kg", "l")).toBeNull();
    expect(convert(1, "count", "bundle")).toBeNull();
  });
  it("rounds up to practical sizes", () => {
    expect(practicalRound(12.1, "kg")).toBe(12.25);
    expect(practicalRound(12.25, "kg")).toBe(12.25); // exact stays
    expect(practicalRound(0.33, "kg")).toBe(0.35); // small amounts in 50 g steps
    expect(practicalRound(0.12, "l")).toBe(0.15);
    expect(practicalRound(13.2, "count")).toBe(14);
    expect(practicalRound(0, "kg")).toBe(0);
    expect(roundUpToStep(0.1 + 0.2, 0.1)).toBe(0.3); // float noise does not bump up
  });
  it("respects custom rounding rules", () => {
    expect(practicalRound(12.1, "kg", { ...DEFAULT_ROUNDING, kg: 1 })).toBe(13);
  });
  it("formats small kg as grams", () => {
    expect(formatQty(0.25, "kg")).toBe("250 கிராம்");
    expect(formatQty(12.5, "kg")).toBe("12.5 கிலோ");
  });
});

describe("scaling", () => {
  it("scales a 100-person recipe to 200 people", () => {
    const r100 = computeRequirements([session(100, ["d-rice", "d-sambar"])], DISHES, ING, OPTS);
    const r200 = computeRequirements([session(200, ["d-rice", "d-sambar"])], DISHES, ING, OPTS);
    expect(line(r100, "rice").exactQty).toBe(15);
    expect(line(r200, "rice").exactQty).toBe(30);
    expect(line(r200, "dal").exactQty).toBe(6);
    expect(line(r200, "oil").exactQty).toBe(1); // 500 ml × 2 → 1 litre
    expect(line(r200, "salt").exactQty).toBe(0.8);
  });

  it("applies wastage buffer (dish value beats default)", () => {
    const withDefault = computeRequirements([session(100, ["d-rice"])], [{ ...RICE, wastagePct: null }], ING, { defaultWastagePct: 10 });
    expect(line(withDefault, "rice").exactQty).toBe(16.5);
    const own = computeRequirements([session(100, ["d-rice"])], [{ ...RICE, wastagePct: 5 }], ING, { defaultWastagePct: 10 });
    expect(line(own, "rice").exactQty).toBe(15.75);
  });

  it("applies portion multiplier", () => {
    const r = computeRequirements([session(100, ["d-rice"], "s1", 0.5)], DISHES, ING, OPTS);
    expect(line(r, "rice").exactQty).toBe(7.5);
  });
});

describe("shared ingredients", () => {
  it("combines the same ingredient across dishes, converting units", () => {
    // sambar: 500 ml oil per 100; chutney: 0.1 l per 50 → 0.2 l per 100
    const r = computeRequirements([session(100, ["d-sambar", "d-chutney"])], DISHES, ING, OPTS);
    const oil = line(r, "oil");
    expect(oil.exactQty).toBe(0.7);
    expect(oil.dishNames.sort()).toEqual(["சட்னி", "சாம்பார்"].sort());
    expect(line(r, "salt").exactQty).toBe(0.6); // 400 g + 200 g
    expect(r.lines.filter((l) => l.ingredientId === "oil")).toHaveLength(1);
  });
});

describe("multi-session orders", () => {
  it("adds quantities across sessions with different headcounts", () => {
    const sessions = [session(200, ["d-rice", "d-sambar"], "lunch"), session(100, ["d-sambar", "d-chutney"], "dinner")];
    const r = computeRequirements(sessions, DISHES, ING, OPTS);
    expect(line(r, "rice").exactQty).toBe(30);
    expect(line(r, "dal").exactQty).toBe(9); // 6 + 3
    expect(line(r, "coconut").exactQty).toBe(14);
  });

  it("totals plates, per-session and fixed expenses", () => {
    const sessions = [session(200, ["d-rice"], "lunch"), session(100, ["d-rice"], "dinner"), session(0, ["d-rice"], "empty")];
    const res = calculate(
      sessions,
      DISHES,
      ING,
      [
        { id: "leaf", name: "இலை", mode: "per_person", ratePaise: 500 },
        { id: "cook", name: "சமையல்", mode: "per_session", ratePaise: 300000 },
        { id: "van", name: "போக்குவரத்து", mode: "fixed", ratePaise: 150000 },
      ],
      OPTS,
    );
    expect(res.plates).toBe(300);
    expect(res.sessionsCount).toBe(2); // empty session ignored
    expect(res.expenseLines.map((e) => e.amountPaise)).toEqual([150000, 600000, 150000]);
    expect(res.expenseCostPaise).toBe(900000);
  });
});

describe("cost, price and profit", () => {
  it("costs from rounded purchase quantities", () => {
    // 210 people rice: 31.5 kg exact → 31.5 (already on 0.25 step); dal 6.3 → 6.5 kg
    const res = calculate([session(210, ["d-rice", "d-sambar"])], DISHES, ING, [], OPTS);
    const rice = res.lines.find((l) => l.ingredientId === "rice")!;
    const dal = res.lines.find((l) => l.ingredientId === "dal")!;
    expect(rice.purchaseQty).toBe(31.5);
    expect(dal.purchaseQty).toBe(6.5);
    expect(dal.costPaise).toBe(97500);
  });

  it("suggests price with margin and computes profit", () => {
    const res = calculate([session(100, ["d-rice"])], DISHES, ING, [], { ...OPTS, marginPct: 30 });
    // 15 kg × ₹60 = ₹900 → ₹9/plate → +30% = ₹11.70
    expect(res.totalCostPaise).toBe(90000);
    expect(res.perPlateCostPaise).toBe(900);
    expect(res.suggestedPerPlatePaise).toBe(1170);
    expect(res.sellingPricePaise).toBe(117000);
    expect(res.profitPaise).toBe(27000);
    expect(res.profitPctOfCost).toBe(30);
  });

  it("rounds suggested price up to nearest ₹5", () => {
    expect(suggestedPerPlate(900, 30, 5)).toBe(1500);
    expect(suggestedPerPlate(10000, 0, 5)).toBe(10000);
  });

  it("uses manual price override and GST", () => {
    const res = calculate([session(100, ["d-rice"])], DISHES, ING, [], { ...OPTS, gstPct: 5, pricePerPlateOverridePaise: 1000 });
    expect(res.sellingPricePaise).toBe(100000);
    expect(res.profitPaise).toBe(10000);
    expect(res.gstPaise).toBe(5000);
    expect(res.customerTotalPaise).toBe(105000);
    const total = calculate([session(100, ["d-rice"])], DISHES, ING, [], { ...OPTS, totalPriceOverridePaise: 80000 });
    expect(total.profitPaise).toBe(-10000); // loss shows as negative
    expect(total.pricePerPlatePaise).toBe(800);
  });

  it("dish cost per person", () => {
    expect(dishCostPerPerson(RICE, ING, 0)).toBe(900); // ₹9
    expect(dishCostPerPerson({ ...RICE, wastagePct: null }, ING, 10)).toBeCloseTo(990);
  });
});

describe("warnings", () => {
  it("reports unit mismatch and missing data without crashing", () => {
    const bad: CalcDish = { id: "bad", name: "தவறு", batchSize: 100, wastagePct: 0, items: [{ ingredientId: "rice", qty: 1, unit: "l" }, { ingredientId: "nope", qty: 1, unit: "kg" }] };
    const r = computeRequirements([session(100, ["bad", "ghost"])], [bad], ING, OPTS);
    expect(r.lines).toHaveLength(0);
    expect(r.warnings.map((w) => w.kind).sort()).toEqual(["missing_dish", "missing_ingredient", "unit_mismatch"]);
  });
  it("zero headcount gives zero everything", () => {
    const res = calculate([session(0, ["d-rice"])], DISHES, ING, [{ id: "x", name: "x", mode: "fixed", ratePaise: 100 }], OPTS);
    expect(res.plates).toBe(0);
    expect(res.perPlateCostPaise).toBe(0);
    expect(computeExpenses([], 0, 0)).toEqual([]);
  });
});

describe("format", () => {
  it("formats Indian money and dates", () => {
    expect(money(10000000)).toBe("₹1,00,000.00");
    expect(rupeesToPaise("1,250.50")).toBe(125050);
    expect(rupeesToPaise("abc")).toBe(0);
    expect(dmy("2026-11-20")).toBe("20-11-2026");
  });
});

import { scaleOrder, batchCost } from "@/lib/simple";

describe("simple dish scaling (100-person reference)", () => {
  const ingMap = new Map(ING.map((i) => [i.id, i]));
  it("400 people = exactly 4× the 100 recipe, no rounding or wastage", () => {
    const sambar = { ...SAMBAR, wastagePct: 10 }; // hidden wastage must be ignored
    const r = scaleOrder([RICE, sambar], 400, ingMap);
    const rice = r.combined.find((l) => l.ingredientId === "rice")!;
    expect(rice.exactQty).toBe(60);
    expect(rice.purchaseQty).toBe(60);
    expect(r.dishes[0].costPaise).toBe(4 * batchCost(RICE, ingMap));
    expect(r.totalPaise).toBe(4 * (batchCost(RICE, ingMap) + batchCost(sambar, ingMap)));
    expect(r.combined.find((l) => l.ingredientId === "dal")!.exactQty).toBe(12);
  });
  it("odd headcounts are not rounded up", () => {
    const r = scaleOrder([SAMBAR], 130, ingMap);
    expect(r.combined.find((l) => l.ingredientId === "dal")!.purchaseQty).toBe(3.9);
    expect(r.perPersonPaise).toBe(Math.round(r.totalPaise / 130));
  });
  it("batch cost of a 100-person recipe", () => {
    expect(batchCost(RICE, ingMap)).toBe(90000); // 15 kg × ₹60
  });
});

import { scaleMeals } from "@/lib/simple";

describe("multi-meal orders (breakfast / lunch / dinner)", () => {
  const ingMap = new Map(ING.map((i) => [i.id, i]));
  const dishMap = new Map([RICE, SAMBAR, CHUTNEY].map((d) => [d.id, d]));
  const meal = (id: string, people: number, dishIds: string[]) => ({ id, label: id, people, dishIds });

  it("one meal gives exactly the same result as the single-order calculator (before = after)", () => {
    const before = scaleOrder([RICE, SAMBAR], 200, ingMap);
    const after = scaleMeals([meal("lunch", 200, ["d-rice", "d-sambar"])], dishMap, ingMap);
    expect(after.totalPaise).toBe(before.totalPaise);
    expect(after.combined).toEqual(before.combined);
    expect(after.meals[0].dishes.map((d) => d.costPaise)).toEqual(before.dishes.map((d) => d.costPaise));
  });

  it("different headcounts per meal, same ingredient added once in the shopping list", () => {
    // breakfast 400: sambar + chutney (both use oil & salt); lunch 500: rice + sambar
    const r = scaleMeals([meal("b", 400, ["d-sambar", "d-chutney"]), meal("l", 500, ["d-rice", "d-sambar"])], dishMap, ingMap);
    const qty = (id: string) => r.combined.find((l) => l.ingredientId === id)!.exactQty;
    expect(qty("dal")).toBe(3 * 4 + 3 * 5); // sambar in both meals = 27 kg
    expect(qty("rice")).toBe(15 * 5); // 75 kg
    expect(qty("oil")).toBe(0.5 * 4 + 0.2 * 4 + 0.5 * 5); // 5.3 l
    expect(r.combined.filter((l) => l.ingredientId === "oil")).toHaveLength(1); // not double-listed
    expect(r.plates).toBe(900);
    // total = sum of the two meals (within rounding of a few paise)
    expect(Math.abs(r.totalPaise - (r.meals[0].costPaise + r.meals[1].costPaise))).toBeLessThanOrEqual(5);
  });

  it("ignores empty meals and deleted dishes; reports missing prices", () => {
    const noPrice = new Map(ingMap);
    noPrice.set("salt", { ...ingMap.get("salt")!, pricePaise: 0 });
    const r = scaleMeals([meal("a", 0, ["d-rice"]), meal("b", 100, []), meal("c", 100, ["d-sambar", "gone"])], dishMap, noPrice);
    expect(r.meals).toHaveLength(1);
    expect(r.plates).toBe(100);
    expect(r.missingPrice.map((l) => l.ingredientId)).toEqual(["salt"]);
  });
});

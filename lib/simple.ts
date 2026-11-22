// Simple dish scaling: a dish recipe is saved for a reference number of people
// (default 100). For an order, every quantity and cost is multiplied exactly:
//   needed = recipe qty × (people ÷ reference people)
// No hidden wastage or rounding, so 400 people = exactly 4 × the 100 recipe.

import { computeRequirements, dishCostPerPerson, type CalcDish, type CalcIngredient, type IngredientLine } from "./calc";
import type { RoundingRules } from "./units";

const EXACT: RoundingRules = { kg: 0.001, kgSmall: 0.001, l: 0.001, lSmall: 0.001, g: 0.001, ml: 0.001, count: 0.001, bundle: 0.001, packet: 0.001 };

function noWastage(d: CalcDish): CalcDish {
  return { ...d, wastagePct: 0 };
}

export interface DishResult {
  dish: CalcDish;
  lines: IngredientLine[];
  costPaise: number;
}

export interface OrderResult {
  people: number;
  dishes: DishResult[];
  combined: IngredientLine[]; // same ingredient across dishes added together
  totalPaise: number;
  perPersonPaise: number;
}

function linesFor(dishes: CalcDish[], people: number, ingredients: Map<string, CalcIngredient>): IngredientLine[] {
  const session = { id: "s", label: "", headcount: people, dishes: dishes.map((d) => ({ dishId: d.id, multiplier: 1 })) };
  return computeRequirements([session], dishes.map(noWastage), ingredients, { defaultWastagePct: 0, rounding: EXACT }).lines.sort((a, b) =>
    a.name.localeCompare(b.name, "ta"),
  );
}

export function scaleOrder(dishes: CalcDish[], people: number, ingredients: Map<string, CalcIngredient>): OrderResult {
  const perDish = dishes.map((dish) => {
    const lines = linesFor([dish], people, ingredients);
    return { dish, lines, costPaise: lines.reduce((n, l) => n + l.costPaise, 0) };
  });
  const combined = linesFor(dishes, people, ingredients);
  const totalPaise = combined.reduce((n, l) => n + l.costPaise, 0);
  return { people, dishes: perDish, combined, totalPaise, perPersonPaise: people > 0 ? Math.round(totalPaise / people) : 0 };
}

/** Cost of the dish for its reference batch (e.g. cost to make for 100 people). */
export function batchCost(dish: CalcDish, ingredients: Map<string, CalcIngredient>): number {
  return Math.round(dishCostPerPerson(noWastage(dish), ingredients, 0) * dish.batchSize);
}

// ------------------------------------------------------------------ multiple meals (breakfast / lunch / dinner)

export interface MealInput {
  id: string;
  label: string;
  people: number;
  dishIds: string[];
}

export interface MealResult {
  meal: MealInput;
  dishes: DishResult[];
  costPaise: number;
  perPersonPaise: number;
}

export interface MenuResult {
  meals: MealResult[];
  /** Shopping list: each ingredient once, added up across every dish and meal. */
  combined: IngredientLine[];
  totalPaise: number;
  plates: number; // sum of people across meals
  perPlatePaise: number;
  /** Ingredients used in this menu that have no price yet (their cost counts as ₹0). */
  missingPrice: IngredientLine[];
}

/**
 * A full order: each meal has its own headcount and dishes. Each meal is scaled
 * exactly like scaleOrder; the shopping list adds the same ingredient across all
 * dishes and meals so nothing is counted twice.
 */
export function scaleMeals(meals: MealInput[], dishes: Map<string, CalcDish>, ingredients: Map<string, CalcIngredient>): MenuResult {
  const active = meals
    .map((m) => ({ ...m, dishIds: m.dishIds.filter((id) => dishes.has(id)) }))
    .filter((m) => m.people > 0 && m.dishIds.length > 0);

  const mealResults = active.map((m) => {
    const r = scaleOrder(
      m.dishIds.map((id) => dishes.get(id)!),
      m.people,
      ingredients,
    );
    return { meal: m, dishes: r.dishes, costPaise: r.totalPaise, perPersonPaise: r.perPersonPaise };
  });

  const sessions = active.map((m) => ({ id: m.id, label: m.label, headcount: m.people, dishes: m.dishIds.map((dishId) => ({ dishId, multiplier: 1 })) }));
  const used = [...new Set(active.flatMap((m) => m.dishIds))].map((id) => noWastage(dishes.get(id)!));
  const combined = computeRequirements(sessions, used, ingredients, { defaultWastagePct: 0, rounding: EXACT }).lines.sort((a, b) => a.name.localeCompare(b.name, "ta"));

  const totalPaise = combined.reduce((n, l) => n + l.costPaise, 0);
  const plates = active.reduce((n, m) => n + m.people, 0);
  return {
    meals: mealResults,
    combined,
    totalPaise,
    plates,
    perPlatePaise: plates > 0 ? Math.round(totalPaise / plates) : 0,
    missingPrice: combined.filter((l) => !l.pricePaise),
  };
}

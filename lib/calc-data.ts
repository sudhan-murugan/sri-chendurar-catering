// Adapts stored rows into the pure calc engine's input shapes.
import { useMemo } from "react";
import { useRowMap, useTable } from "./db";
import type { CalcDish, CalcIngredient, CalcSessionDish } from "./calc";
import type { Dish, Ingredient, RecipeItem } from "./types";

export function toCalcIngredient(i: Ingredient): CalcIngredient {
  return { id: i.id, name: i.name_ta, category: i.category, unit: i.unit, pricePaise: Number(i.price_paise) || 0, shop: i.shop };
}

export function toCalcDish(d: Dish, items: RecipeItem[]): CalcDish {
  return {
    id: d.id,
    name: d.name_ta,
    batchSize: Number(d.batch_size) || 0,
    wastagePct: d.wastage_pct === null || d.wastage_pct === undefined ? null : Number(d.wastage_pct),
    items: items.map((r) => ({ ingredientId: r.ingredient_id, qty: Number(r.qty) || 0, unit: r.unit })),
  };
}

/**
 * All ingredients and dishes ready for calculation. Archived ingredients are
 * included (an old recipe line still has a price), archived dishes too (so an
 * order that used one still calculates).
 */
export function useCalcData() {
  const ingMap = useRowMap("ingredients");
  const dishMap = useRowMap("dishes");
  const recipe = useTable("recipe_items");
  return useMemo(() => {
    const byDish = new Map<string, RecipeItem[]>();
    for (const r of [...recipe].sort((a, b) => a.sort - b.sort)) {
      const arr = byDish.get(r.dish_id) ?? [];
      arr.push(r);
      byDish.set(r.dish_id, arr);
    }
    const ingredients = new Map<string, CalcIngredient>();
    for (const i of ingMap.values()) ingredients.set(i.id, toCalcIngredient(i));
    const dishes = new Map<string, CalcDish>();
    for (const d of dishMap.values()) dishes.set(d.id, toCalcDish(d, byDish.get(d.id) ?? []));
    return { ingredients, dishes, recipeByDish: byDish };
  }, [ingMap, dishMap, recipe]);
}

/** Dishes of a combo as calc session dishes, in combo order. */
export function useComboDishes() {
  const items = useTable("combo_items");
  return useMemo(() => {
    const m = new Map<string, CalcSessionDish[]>();
    for (const ci of [...items].sort((a, b) => a.sort - b.sort)) {
      const arr = m.get(ci.combo_id) ?? [];
      arr.push({ dishId: ci.dish_id, multiplier: Number(ci.multiplier) || 1 });
      m.set(ci.combo_id, arr);
    }
    return m;
  }, [items]);
}

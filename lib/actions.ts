// Domain write operations that touch more than one table.
import { getRows, saveMany, newId, getRow, type SaveOp } from "./db";
import { isoDate } from "./format";
import type { Ingredient } from "./types";

/** Update an ingredient price and record it in price history (one atomic local write). */
export function setIngredientPrice(ing: Ingredient, pricePaise: number) {
  if (ing.price_paise === pricePaise) return;
  const now = new Date().toISOString();
  saveMany([
    { table: "ingredients", row: { id: ing.id, price_paise: pricePaise, price_updated_at: now } },
    { table: "ingredient_price_history", row: { id: newId(), ingredient_id: ing.id, price_paise: pricePaise, recorded_at: now } },
  ]);
}

export function changedToday(ing: Ingredient): boolean {
  return !!ing.price_updated_at && isoDate(new Date(ing.price_updated_at)) === isoDate();
}

/** Price history points for one ingredient, oldest first. */
export function priceHistory(ingredientId: string) {
  return getRows("ingredient_price_history")
    .filter((h) => h.ingredient_id === ingredientId)
    .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
}

/** Replace the child rows of a parent: archive removed ones, upsert the rest. */
export function replaceChildren<T extends "recipe_items" | "combo_items" | "order_session_items" | "order_expenses" | "order_sessions">(
  table: T,
  parentKey: string,
  parentId: string,
  next: Array<Record<string, unknown> & { id?: string }>,
): SaveOp[] {
  const keep = new Set(next.map((n) => n.id).filter(Boolean));
  const ops: SaveOp[] = [];
  for (const r of getRows(table) as unknown as Array<Record<string, unknown> & { id: string }>) {
    if (r[parentKey] === parentId && !keep.has(r.id)) ops.push({ table, row: { id: r.id, archived: true } } as SaveOp);
  }
  for (const n of next) ops.push({ table, row: { ...n, id: n.id ?? newId(), [parentKey]: parentId, archived: false } } as SaveOp);
  return ops;
}

export function ingredientName(id: string): string {
  return getRow("ingredients", id)?.name_ta ?? "?";
}

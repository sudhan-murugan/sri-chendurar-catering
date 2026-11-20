// Orders: building/saving from the wizard, cost snapshots, recalculation, payments.
import { useMemo } from "react";
import { getRow, getRows, newId, saveMany, useTable, type SaveOp } from "./db";
import { calculate, type CalcExpense, type CalcResult } from "./calc";
import { toCalcIngredient, toCalcDish } from "./calc-data";
import { emptyCalc, toCalcSessions, type CalcState, type SessionState } from "./calc-state";
import { getSettings } from "./settings";
import { isoDate, rupeesToPaise } from "./format";
import type { EventType, Order, OrderStatus, PayMethod } from "./types";

export interface OrderForm {
  customer_name: string;
  phone: string;
  event_type: EventType;
  event_date: string;
  event_time: string;
  venue: string;
  venue_map_url: string;
  status: OrderStatus;
  notes: string;
  calc: CalcState;
  advance: string; // rupees
  advance_method: PayMethod;
}

export function emptyOrderForm(calc?: CalcState | null): OrderForm {
  return {
    customer_name: "",
    phone: "",
    event_type: "wedding",
    event_date: "",
    event_time: "",
    venue: "",
    venue_map_url: "",
    status: "confirmed",
    notes: "",
    calc: calc ?? emptyCalc(),
    advance: "",
    advance_method: "cash",
  };
}

/** Rebuild the editable calculator state of a saved order. */
export function orderCalcState(order: Order): CalcState {
  const sessions: SessionState[] = getRows("order_sessions")
    .filter((s) => s.order_id === order.id)
    .sort((a, b) => a.sort - b.sort)
    .map((s) => ({
      id: s.id,
      meal: s.meal,
      headcount: s.headcount,
      comboId: s.combo_id,
      dishes: getRows("order_session_items")
        .filter((i) => i.session_id === s.id)
        .sort((a, b) => a.sort - b.sort)
        .map((i) => ({ dishId: i.dish_id, multiplier: Number(i.multiplier) })),
    }));
  const expenses: CalcExpense[] = getRows("order_expenses")
    .filter((e) => e.order_id === order.id)
    .sort((a, b) => a.sort - b.sort)
    .map((e) => ({ id: e.id, name: e.name, mode: e.mode, ratePaise: Number(e.rate_paise) }));
  return {
    sessions,
    marginPct: Number(order.margin_pct),
    pricePerPlate: order.price_per_plate_paise ? String(Number(order.price_per_plate_paise) / 100) : "",
    gstPct: Number(order.gst_pct),
    expenses,
  };
}

export function orderFormFromOrder(order: Order): OrderForm {
  return {
    customer_name: order.customer_name,
    phone: order.phone ?? "",
    event_type: order.event_type,
    event_date: order.event_date,
    event_time: order.event_time ?? "",
    venue: order.venue ?? "",
    venue_map_url: order.venue_map_url ?? "",
    status: order.status,
    notes: order.notes ?? "",
    calc: orderCalcState(order),
    advance: "",
    advance_method: "cash",
  };
}

/** Make sure child ids are fresh for a new order (a calc draft can be saved as an order more than once). */
function freshIds(calc: CalcState, orderId: string, isNew: boolean, typeOf: Map<string, string>): CalcState {
  const owns = (table: "order_sessions" | "order_expenses", id: string) => getRow(table, id)?.order_id === orderId;
  const remapExpense = (e: CalcExpense): CalcExpense => {
    if (!isNew && owns("order_expenses", e.id)) return e;
    const id = newId();
    const type = getRow("expense_types", e.id)?.id ?? getRow("order_expenses", e.id)?.expense_type_id;
    if (type) typeOf.set(id, type);
    return { ...e, id };
  };
  return {
    ...calc,
    sessions: calc.sessions.map((s) => (isNew || !owns("order_sessions", s.id) ? { ...s, id: newId() } : s)),
    expenses: calc.expenses?.map(remapExpense) ?? null,
  };
}

export function snapshotTotals(r: CalcResult): Record<string, number> {
  return {
    plates: r.plates,
    sessions: r.sessionsCount,
    ingredientCostPaise: r.ingredientCostPaise,
    expenseCostPaise: r.expenseCostPaise,
    totalCostPaise: r.totalCostPaise,
    perPlateCostPaise: r.perPlateCostPaise,
    pricePerPlatePaise: r.pricePerPlatePaise,
    sellingPricePaise: r.sellingPricePaise,
    gstPaise: r.gstPaise,
    profitPaise: r.profitPaise,
  };
}

function snapshotOp(orderId: string, r: CalcResult): SaveOp {
  const existing = getRows("order_cost_snapshot").find((s) => s.order_id === orderId);
  return {
    table: "order_cost_snapshot",
    row: { id: existing?.id ?? newId(), order_id: orderId, lines: r.lines, totals: snapshotTotals(r), computed_at: new Date().toISOString() },
  };
}

function orderCostFields(r: CalcResult) {
  return {
    price_per_plate_paise: r.pricePerPlatePaise,
    order_amount_paise: r.sellingPricePaise,
    gst_paise: r.gstPaise,
    ingredient_cost_paise: r.ingredientCostPaise,
    expense_cost_paise: r.expenseCostPaise,
    expected_profit_paise: r.profitPaise,
  };
}

/** Child rows (sessions, dishes, expenses) for an order, archiving ones that were removed. */
function childOps(orderId: string, calc: CalcState, expenses: CalcExpense[], typeOf: Map<string, string>): SaveOp[] {
  const ops: SaveOp[] = [];
  const keepSessions = new Set(calc.sessions.map((s) => s.id));
  for (const s of getRows("order_sessions")) if (s.order_id === orderId && !keepSessions.has(s.id)) ops.push({ table: "order_sessions", row: { id: s.id, archived: true } });

  const existingItems = getRows("order_session_items").filter((i) => i.order_id === orderId);
  const usedItems = new Set<string>();
  calc.sessions.forEach((s, si) => {
    ops.push({ table: "order_sessions", row: { id: s.id, order_id: orderId, meal: s.meal, label: null, session_time: null, headcount: s.headcount, combo_id: s.comboId, sort: si, archived: false } });
    s.dishes.forEach((d, di) => {
      const prev = existingItems.find((i) => i.session_id === s.id && i.dish_id === d.dishId && !usedItems.has(i.id));
      const id = prev?.id ?? newId();
      usedItems.add(id);
      ops.push({ table: "order_session_items", row: { id, order_id: orderId, session_id: s.id, dish_id: d.dishId, multiplier: d.multiplier, sort: di, archived: false } });
    });
  });
  for (const i of existingItems) if (!usedItems.has(i.id)) ops.push({ table: "order_session_items", row: { id: i.id, archived: true } });

  const keepExp = new Set(expenses.map((e) => e.id));
  for (const e of getRows("order_expenses")) if (e.order_id === orderId && !keepExp.has(e.id)) ops.push({ table: "order_expenses", row: { id: e.id, archived: true } });
  const plates = calc.sessions.reduce((n, s) => n + (s.headcount > 0 ? s.headcount : 0), 0);
  const nSessions = calc.sessions.filter((s) => s.headcount > 0).length;
  expenses.forEach((e, i) => {
    const amount = e.mode === "per_person" ? e.ratePaise * plates : e.mode === "per_session" ? e.ratePaise * nSessions : e.ratePaise;
    const typeId = typeOf.get(e.id) ?? getRow("order_expenses", e.id)?.expense_type_id ?? null;
    ops.push({ table: "order_expenses", row: { id: e.id, order_id: orderId, expense_type_id: typeId, name: e.name, mode: e.mode, rate_paise: e.ratePaise, amount_paise: amount, sort: i, archived: false } });
  });
  return ops;
}

/**
 * Save the wizard. `compute` re-runs the calculator for the (id-remapped) state
 * so the snapshot exactly matches what is stored.
 */
export function saveOrderForm(form: OrderForm, existingId: string | null, compute: (c: CalcState) => { result: CalcResult; expenses: CalcExpense[] }): string {
  const orderId = existingId ?? newId();
  const settings = getSettings();
  const typeOf = new Map<string, string>();
  let calc = freshIds(form.calc, orderId, !existingId, typeOf);
  const { result, expenses: usedExpenses } = compute(calc);
  if (!calc.expenses) {
    // expenses never edited → store the default rates as this order's own rows
    calc = { ...calc, expenses: usedExpenses.map((e) => { const id = newId(); typeOf.set(id, e.id); return { ...e, id }; }) };
  }
  const expenses = calc.expenses!;
  const ops: SaveOp[] = [
    {
      table: "orders",
      row: {
        id: orderId,
        customer_name: form.customer_name.trim(),
        phone: form.phone.trim() || null,
        event_type: form.event_type,
        venue: form.venue.trim() || null,
        venue_map_url: form.venue_map_url.trim() || null,
        order_date: getRow("orders", orderId)?.order_date ?? isoDate(),
        event_date: form.event_date,
        event_time: form.event_time || null,
        status: form.status,
        margin_pct: calc.marginPct ?? settings.marginPct,
        gst_pct: calc.gstPct ?? (settings.gstEnabled ? settings.gstPct : 0),
        notes: form.notes.trim() || null,
        actual_cost_paise: getRow("orders", orderId)?.actual_cost_paise ?? null,
        final_headcount: getRow("orders", orderId)?.final_headcount ?? null,
        ...orderCostFields(result),
      },
    },
    ...childOps(orderId, calc, expenses, typeOf),
    snapshotOp(orderId, result),
  ];
  const adv = rupeesToPaise(form.advance);
  if (adv > 0) ops.push({ table: "payments", row: { id: newId(), order_id: orderId, paid_on: isoDate(), amount_paise: adv, method: form.advance_method, note: "முன்பணம்" } });
  saveMany(ops);
  return orderId;
}

/** Recalculate an order's cost with today's ingredient prices. Selling price stays the same. */
export function recalculateOrder(order: Order) {
  const calc = orderCalcState(order);
  const s = getSettings();
  const ingredients = getRows("ingredients").map(toCalcIngredient);
  // include archived ingredients/dishes via getRow lookups
  const ingMap = new Map(ingredients.map((i) => [i.id, i]));
  const recipe = getRows("recipe_items");
  const dishes = new Map<string, ReturnType<typeof toCalcDish>>();
  for (const sess of calc.sessions)
    for (const d of sess.dishes) {
      const row = getRow("dishes", d.dishId);
      if (row) dishes.set(row.id, toCalcDish(row, recipe.filter((r) => r.dish_id === row.id).sort((a, b) => a.sort - b.sort)));
      for (const r of recipe) if (r.dish_id === d.dishId && !ingMap.has(r.ingredient_id)) {
        const ing = getRow("ingredients", r.ingredient_id);
        if (ing) ingMap.set(ing.id, toCalcIngredient(ing));
      }
    }
  const result = calculate(toCalcSessions(calc), dishes, ingMap, calc.expenses ?? [], {
    defaultWastagePct: s.wastagePct,
    rounding: s.rounding,
    marginPct: Number(order.margin_pct),
    priceRoundRupees: s.priceRoundRupees,
    gstPct: Number(order.gst_pct),
    totalPriceOverridePaise: Number(order.order_amount_paise) || null,
  });
  saveMany([{ table: "orders", row: { id: order.id, ...orderCostFields(result) } }, snapshotOp(order.id, result)]);
}

/** Duplicate an order's details into a new wizard form (new date, no payments). */
export function duplicateForm(order: Order): OrderForm {
  const f = orderFormFromOrder(order);
  return { ...f, event_date: "", status: "confirmed", calc: { ...f.calc, sessions: f.calc.sessions.map((s) => ({ ...s, id: newId() })), expenses: f.calc.expenses?.map((e) => ({ ...e, id: newId() })) ?? null } };
}

export function customerTotal(o: Order): number {
  return Number(o.order_amount_paise) + Number(o.gst_paise);
}

/** orderId → total paid */
export function usePaidByOrder(): Map<string, number> {
  const pays = useTable("payments");
  return useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pays) m.set(p.order_id, (m.get(p.order_id) ?? 0) + Number(p.amount_paise));
    return m;
  }, [pays]);
}

/** orderId → plates (sum of session headcounts) */
export function usePlatesByOrder(): Map<string, number> {
  const sessions = useTable("order_sessions");
  return useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions) m.set(s.order_id, (m.get(s.order_id) ?? 0) + s.headcount);
    return m;
  }, [sessions]);
}

export function balanceOf(o: Order, paid: number): number {
  if (o.status === "cancelled") return 0;
  return customerTotal(o) - paid;
}

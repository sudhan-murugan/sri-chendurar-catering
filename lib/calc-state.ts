// Editable calculator state, shared by the calculator screen, the shopping
// list ("from calculator") and the new-order wizard.
import { useMemo } from "react";
import { calculate, type CalcExpense, type CalcResult, type CalcSession, type CalcSessionDish } from "./calc";
import { useCalcData } from "./calc-data";
import { useDefaultExpenses } from "./expenses";
import { useSettings, type AppSettings } from "./settings";
import { newId } from "./db";
import { rupeesToPaise } from "./format";
import { t } from "./i18n";
import type { Meal } from "./types";

export interface SessionState {
  id: string;
  meal: Meal;
  headcount: number;
  comboId: string | null;
  dishes: CalcSessionDish[];
}

export interface CalcState {
  sessions: SessionState[];
  marginPct: number | null; // null → settings default
  pricePerPlate: string; // rupees typed by user; "" → suggested price
  gstPct: number | null; // null → settings (0 when GST disabled)
  expenses: CalcExpense[] | null; // null → default expense types
}

export const CALC_DRAFT_KEY = "calc";

export function newSession(meal: Meal = "lunch", headcount = 100): SessionState {
  return { id: newId(), meal, headcount, comboId: null, dishes: [] };
}

export function emptyCalc(): CalcState {
  return { sessions: [newSession()], marginPct: null, pricePerPlate: "", gstPct: null, expenses: null };
}

export function sessionLabel(s: SessionState): string {
  return t.meals[s.meal];
}

export function toCalcSessions(state: CalcState): CalcSession[] {
  return state.sessions.map((s) => ({ id: s.id, label: sessionLabel(s), headcount: s.headcount, dishes: s.dishes }));
}

export function effectiveMargin(state: CalcState, s: AppSettings) {
  return state.marginPct ?? s.marginPct;
}
export function effectiveGst(state: CalcState, s: AppSettings) {
  return state.gstPct ?? (s.gstEnabled ? s.gstPct : 0);
}

type CalcData = ReturnType<typeof useCalcData>;

/** Pure: run the engine for a CalcState. */
export function computeCalc(state: CalcState, data: CalcData, defaults: CalcExpense[], s: AppSettings): { result: CalcResult; expenses: CalcExpense[] } {
  const expenses = state.expenses ?? defaults;
  const result = calculate(toCalcSessions(state), data.dishes, data.ingredients, expenses, {
    defaultWastagePct: s.wastagePct,
    rounding: s.rounding,
    marginPct: effectiveMargin(state, s),
    priceRoundRupees: s.priceRoundRupees,
    gstPct: effectiveGst(state, s),
    pricePerPlateOverridePaise: state.pricePerPlate ? rupeesToPaise(state.pricePerPlate) : null,
  });
  return { result, expenses };
}

/** Live calculation for a CalcState. Runs entirely on the phone. */
export function useCalcResult(state: CalcState): { result: CalcResult; expenses: CalcExpense[]; compute: (c: CalcState) => { result: CalcResult; expenses: CalcExpense[] } } {
  const data = useCalcData();
  const defaults = useDefaultExpenses();
  const s = useSettings();
  return useMemo(() => {
    const compute = (c: CalcState) => computeCalc(c, data, defaults, s);
    return { ...compute(state), compute };
  }, [state, data, defaults, s]);
}

/** Read the calculator draft outside React (e.g. when starting an order from it). */
export function readCalcDraft(): CalcState | null {
  try {
    const raw = localStorage.getItem(`draft:${CALC_DRAFT_KEY}`);
    return raw ? (JSON.parse(raw) as CalcState) : null;
  } catch {
    return null;
  }
}

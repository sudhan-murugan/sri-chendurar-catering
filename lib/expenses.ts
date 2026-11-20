import { useMemo } from "react";
import { useTable } from "./db";
import type { CalcExpense } from "./calc";

/** Default expense types from settings, as calc expenses. */
export function useDefaultExpenses(): CalcExpense[] {
  const rows = useTable("expense_types");
  return useMemo(
    () => [...rows].sort((a, b) => a.sort - b.sort).map((e) => ({ id: e.id, name: e.name, mode: e.mode, ratePaise: Number(e.rate_paise) || 0 })),
    [rows],
  );
}

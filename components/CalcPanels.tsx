"use client";
import { useMemo, useState } from "react";
import { Badge, Button, Chips, Icon, IconButton, Money, NumberInput, ProfitText, Select, TextInput } from "@/components/ui";
import { NumberStepper } from "@/components/mobile";
import { DishPicker } from "@/components/Pickers";
import { useRowMap, useTable, newId } from "@/lib/db";
import { useCalcData, useComboDishes } from "@/lib/calc-data";
import { dishCostPerPerson, type CalcExpense, type CalcResult, type ExpenseMode, type IngredientLine } from "@/lib/calc";
import { effectiveGst, effectiveMargin, newSession, type CalcState, type SessionState } from "@/lib/calc-state";
import { useSettings } from "@/lib/settings";
import { CATEGORIES, MEALS, type Meal } from "@/lib/types";
import { formatQty, UNIT_LABEL } from "@/lib/units";
import { money, paiseToInput, rupeesToPaise } from "@/lib/format";
import { f, t } from "@/lib/i18n";

const QUICK_PEOPLE = [50, 100, 200, 300, 500];

// ------------------------------------------------------------------ sessions + menu
export function SessionsEditor({ state, onChange }: { state: CalcState; onChange: (s: CalcState) => void }) {
  const multi = state.sessions.length > 1;
  const setSession = (id: string, patch: Partial<SessionState>) => onChange({ ...state, sessions: state.sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const addSession = () => {
    const used = new Set(state.sessions.map((s) => s.meal));
    const meal: Meal = (MEALS.find((m) => !used.has(m) && m !== "other") ?? "other") as Meal;
    onChange({ ...state, sessions: [...state.sessions, newSession(meal, state.sessions[state.sessions.length - 1]?.headcount ?? 100)] });
  };
  return (
    <div className="space-y-4">
      {state.sessions.map((s, i) => (
        <SessionCard
          key={s.id}
          index={i}
          session={s}
          multi={multi}
          onChange={(p) => setSession(s.id, p)}
          onRemove={() => onChange({ ...state, sessions: state.sessions.filter((x) => x.id !== s.id) })}
        />
      ))}
      <Button variant="secondary" full icon="plus" onClick={addSession}>
        {t.calc.addSession.replace("+ ", "")}
      </Button>
    </div>
  );
}

function SessionCard({ session: s, multi, index, onChange, onRemove }: { session: SessionState; multi: boolean; index: number; onChange: (p: Partial<SessionState>) => void; onRemove: () => void }) {
  const combos = useTable("combos");
  const comboDishes = useComboDishes();
  const dishMap = useRowMap("dishes");
  const data = useCalcData();
  const settings = useSettings();
  const [picking, setPicking] = useState(false);
  const sortedCombos = useMemo(() => [...combos].sort((a, b) => MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal) || a.sort - b.sort), [combos]);

  const comboCost = (id: string) =>
    (comboDishes.get(id) ?? []).reduce((n, d) => {
      const dish = data.dishes.get(d.dishId);
      return n + (dish ? dishCostPerPerson(dish, data.ingredients, settings.wastagePct, d.multiplier) : 0);
    }, 0);

  return (
    <div className={multi ? "card p-3" : ""}>
      {multi && (
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 font-bold text-white">{index + 1}</span>
          <div className="min-w-0 flex-1">
            <Chips options={MEALS.map((m) => ({ value: m, label: t.meals[m] }))} value={s.meal} onChange={(meal) => onChange({ meal })} />
          </div>
          <IconButton icon="trash" label={t.calc.removeSession} onClick={onRemove} className="text-bad" />
        </div>
      )}

      <StepLabel n={1} text={t.calc.people} />
      <NumberStepper big label={t.calc.people} value={s.headcount} step={10} min={0} max={20000} onChange={(headcount) => onChange({ headcount })} />
      <div className="no-scrollbar -mx-1 mt-2 flex gap-2 overflow-x-auto px-1">
        {QUICK_PEOPLE.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange({ headcount: n })}
            className={`h-12 min-w-14 flex-1 rounded-xl border-2 text-lg font-bold tabular-nums ${s.headcount === n ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-card"}`}
          >
            {n}
          </button>
        ))}
      </div>

      <StepLabel n={2} text={t.calc.menu} />
      <div className="grid grid-cols-2 gap-2">
        {sortedCombos.map((c) => {
          const on = s.comboId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange({ comboId: c.id, dishes: comboDishes.get(c.id) ?? [], meal: multi ? s.meal : c.meal })}
              className={`min-h-20 rounded-2xl border-2 p-3 text-left ${on ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-card active:bg-brand-50"}`}
            >
              <div className="leading-snug font-bold">{c.name}</div>
              <div className={`text-sm tabular-nums ${on ? "text-white/90" : "text-muted"}`}>
                {money(Math.round(comboCost(c.id)))} {t.common.perPerson}
              </div>
            </button>
          );
        })}
      </div>

      {s.dishes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {s.dishes.map((d) => (
            <span key={d.dishId} className="inline-flex h-12 items-center gap-1 rounded-full border border-line bg-card pl-3 text-[15px]">
              {dishMap.get(d.dishId)?.name_ta ?? "?"}
              {d.multiplier !== 1 && <span className="text-xs text-muted">×{d.multiplier}</span>}
              <button
                type="button"
                aria-label={t.common.delete}
                onClick={() => onChange({ dishes: s.dishes.filter((x) => x.dishId !== d.dishId), comboId: null })}
                className="flex h-12 w-12 items-center justify-center rounded-full text-muted active:bg-black/10"
              >
                <Icon name="x" size={18} />
              </button>
            </span>
          ))}
        </div>
      )}
      <Button variant="ghost" full icon="edit" className="mt-2" onClick={() => setPicking(true)}>
        {t.calc.editDishes}
      </Button>
      <DishPicker
        open={picking}
        onClose={() => setPicking(false)}
        selected={s.dishes.map((d) => d.dishId)}
        onDone={(ids) => {
          const kept = s.dishes.filter((d) => ids.includes(d.dishId));
          const added = ids.filter((id) => !kept.some((k) => k.dishId === id)).map((dishId) => ({ dishId, multiplier: 1 }));
          onChange({ dishes: [...kept, ...added], comboId: null });
        }}
      />
    </div>
  );
}

export function StepLabel({ n, text }: { n: number; text: string }) {
  return (
    <div className="mt-4 mb-2 flex items-center gap-2 first:mt-0">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-100">{n}</span>
      <h2 className="text-lg font-bold">{text}</h2>
    </div>
  );
}

// ------------------------------------------------------------------ summary
export function SummaryCard({ r }: { r: CalcResult }) {
  const loss = r.profitPaise < 0;
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-2 divide-x divide-y divide-[var(--line)]">
        <Stat label={t.calc.totalCost} value={<Money paise={r.totalCostPaise} short />} />
        <Stat label={t.calc.perPerson} value={<Money paise={r.perPlateCostPaise} />} />
        <Stat label={t.calc.suggested} value={<Money paise={r.pricePerPlatePaise} />} sub={`${t.common.total} ${money(r.sellingPricePaise)}`} />
        <Stat
          label={loss ? t.calc.loss : t.calc.profit}
          value={<ProfitText paise={r.profitPaise} short />}
          sub={`${r.profitPctOfCost}%`}
          tone={loss ? "bad" : "good"}
        />
      </div>
      <div className="flex justify-between bg-app px-3 py-1.5 text-sm text-muted">
        <span>{f(t.calc.plates, { n: r.plates })}</span>
        <span>{f(t.calc.sessions, { n: r.sessionsCount })}</span>
        {r.gstPaise > 0 && (
          <span>
            {t.calc.customerTotal} {money(r.customerTotalPaise)}
          </span>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className={`p-3 ${tone === "good" ? "bg-green-50 dark:bg-green-950/30" : tone === "bad" ? "bg-red-50 dark:bg-red-950/30" : ""}`}>
      <div className="text-sm text-muted">{label}</div>
      <div className="text-[26px] leading-tight font-bold break-all">{value}</div>
      {sub && <div className="text-sm text-muted tabular-nums">{sub}</div>}
    </div>
  );
}

/** Slim strip pinned under the header once the big summary scrolls away. */
export function CompactSummary({ r }: { r: CalcResult }) {
  return (
    <div className="no-print fixed inset-x-0 top-14 z-30 border-b border-line bg-card/95 shadow backdrop-blur" style={{ marginTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto grid max-w-3xl grid-cols-3 px-4 py-1.5 text-center">
        <div>
          <div className="text-xs text-muted">{t.calc.totalCost}</div>
          <div className="text-lg font-bold">
            <Money paise={r.totalCostPaise} short />
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">{t.calc.perPerson}</div>
          <div className="text-lg font-bold">
            <Money paise={r.perPlateCostPaise} />
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">{r.profitPaise < 0 ? t.calc.loss : t.calc.profit}</div>
          <div className="text-lg font-bold">
            <ProfitText paise={r.profitPaise} short />
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ ingredient quantities
export function IngredientLines({ lines, showCost = true }: { lines: IngredientLine[]; showCost?: boolean }) {
  return (
    <div className="space-y-2">
      {CATEGORIES.map((c) => {
        const ls = lines.filter((l) => l.category === c);
        if (!ls.length) return null;
        const total = ls.reduce((n, l) => n + l.costPaise, 0);
        return (
          <details key={c} open className="card group overflow-hidden">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-3">
              <Icon name="down" className="transition-transform group-open:rotate-0 -rotate-90" />
              <span className="flex-1 font-bold">
                {t.categories[c]} <span className="font-normal text-muted">({ls.length})</span>
              </span>
              {showCost && <Money paise={total} className="font-semibold" />}
            </summary>
            <ul className="divide-y divide-[var(--line)] border-t border-line">
              {ls.map((l) => (
                <li key={l.ingredientId} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold break-words">{l.name}</div>
                    <div className="text-xs text-muted">
                      {t.calc.exact}: {formatQty(l.exactQty, l.unit)}
                      {showCost && ` · ${money(l.pricePaise)}/${UNIT_LABEL[l.unit]}`}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xl font-bold tabular-nums">{formatQty(l.purchaseQty, l.unit)}</div>
                    {showCost && <div className="text-sm text-muted tabular-nums">{money(l.costPaise)}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ other expenses (editable)
export function ExpenseEditor({ expenses, result, onChange }: { expenses: CalcExpense[]; result: CalcResult; onChange: (e: CalcExpense[]) => void }) {
  const amount = (id: string) => result.expenseLines.find((l) => l.id === id)?.amountPaise ?? 0;
  const patch = (id: string, p: Partial<CalcExpense>) => onChange(expenses.map((e) => (e.id === id ? { ...e, ...p } : e)));
  return (
    <div className="space-y-2">
      {expenses.map((e) => (
        <div key={e.id} className="card p-3">
          <div className="flex items-center gap-2">
            <TextInput aria-label={t.common.notes} value={e.name} onChange={(ev) => patch(e.id, { name: ev.target.value })} className="min-h-11 flex-1 border-transparent px-1 font-semibold" />
            <IconButton icon="x" label={t.common.delete} onClick={() => onChange(expenses.filter((x) => x.id !== e.id))} className="text-muted" />
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="relative w-28 shrink-0">
              <span className="absolute top-1/2 left-3 -translate-y-1/2 font-bold">₹</span>
              <NumberInput aria-label={t.common.amount} value={paiseToInput(e.ratePaise)} onChange={(ev) => patch(e.id, { ratePaise: rupeesToPaise(ev.target.value) })} className="pl-7 text-lg font-bold" />
            </div>
            <Select aria-label={t.common.unit} value={e.mode} onChange={(ev) => patch(e.id, { mode: ev.target.value as ExpenseMode })} className="min-w-0 flex-1 text-[15px]">
              {(["per_person", "per_session", "fixed"] as const).map((m) => (
                <option key={m} value={m}>
                  {t.expenseModes[m]}
                </option>
              ))}
            </Select>
          </div>
          <div className="mt-1 text-right text-sm text-muted">
            = <Money paise={amount(e.id)} className="font-bold text-[var(--ink)]" />
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between px-1 font-bold">
        <Button variant="ghost" icon="plus" onClick={() => onChange([...expenses, { id: newId(), name: t.categories.other, mode: "fixed", ratePaise: 0 }])}>
          {t.calc.addExpense.replace("+ ", "")}
        </Button>
        <Money paise={result.expenseCostPaise} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ margin / price / GST
export function PricePanel({ state, result, onChange }: { state: CalcState; result: CalcResult; onChange: (s: CalcState) => void }) {
  const s = useSettings();
  const margin = effectiveMargin(state, s);
  const gst = effectiveGst(state, s);
  return (
    <div className="card space-y-4 p-4">
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="margin" className="font-semibold">
            {t.calc.margin}
          </label>
          <span className="text-2xl font-bold tabular-nums">{margin}%</span>
        </div>
        <input
          id="margin"
          type="range"
          min={0}
          max={100}
          step={1}
          value={margin}
          disabled={!!state.pricePerPlate}
          onChange={(e) => onChange({ ...state, marginPct: Number(e.target.value) })}
          className="h-12 w-full accent-[var(--color-brand-600)] disabled:opacity-40"
        />
        <div className="flex justify-between text-sm text-muted">
          <span>{t.calc.suggested}</span>
          <Money paise={result.suggestedPerPlatePaise} className="font-bold text-[var(--ink)]" />
        </div>
      </div>
      <div>
        <label className="mb-1 block font-semibold" htmlFor="ppp">
          {t.calc.priceOverride}
        </label>
        <div className="flex gap-2">
          <NumberInput id="ppp" placeholder={paiseToInput(result.suggestedPerPlatePaise)} value={state.pricePerPlate} onChange={(e) => onChange({ ...state, pricePerPlate: e.target.value.replace(/[^0-9.]/g, "") })} className="text-2xl font-bold" />
          {state.pricePerPlate && <IconButton icon="x" label={t.common.clearDraft} onClick={() => onChange({ ...state, pricePerPlate: "" })} />}
        </div>
        <div className="mt-1 text-sm text-muted">{t.calc.priceOverrideHint}</div>
      </div>
      <div className="flex items-center gap-3">
        <label htmlFor="gst" className="flex-1 font-semibold">
          {t.calc.gst}
        </label>
        <NumberInput id="gst" value={String(gst)} onChange={(e) => onChange({ ...state, gstPct: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })} className="w-24 text-center text-lg font-bold" />
      </div>
      <dl className="space-y-1 border-t border-line pt-3 text-[17px]">
        <Row k={`${t.calc.sellingPrice} (${result.plates} × ${money(result.pricePerPlatePaise)})`} v={<Money paise={result.sellingPricePaise} />} />
        {result.gstPaise > 0 && <Row k={`${t.calc.gstAmount} ${gst}%`} v={<Money paise={result.gstPaise} />} />}
        {result.gstPaise > 0 && <Row k={t.calc.customerTotal} v={<Money paise={result.customerTotalPaise} className="font-bold" />} />}
        <Row k={t.calc.totalCost} v={<Money paise={result.totalCostPaise} />} />
        <Row
          k={<b>{result.profitPaise < 0 ? t.calc.loss : t.calc.profit}</b>}
          v={
            <span className="text-xl font-bold">
              <ProfitText paise={result.profitPaise} /> <Badge tone={result.profitPaise < 0 ? "bad" : "good"}>{result.profitPctOfCost}%</Badge>
            </span>
          }
        />
      </dl>
    </div>
  );
}

function Row({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right tabular-nums">{v}</dd>
    </div>
  );
}

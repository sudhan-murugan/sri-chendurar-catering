"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Field, Icon, IconButton, LinkButton, PageTitle, TextInput, toast } from "@/components/ui";
import { BottomSheet, NumberStepper } from "@/components/mobile";
import { askConfirm } from "@/components/ui/Confirm";
import { newId, useTable } from "@/lib/db";
import { useCalcData } from "@/lib/calc-data";
import { batchCost, scaleMeals, type MealInput, type MenuResult } from "@/lib/simple";
import { useSettings } from "@/lib/settings";
import { formatQty } from "@/lib/units";
import { dmy, money, moneyShort } from "@/lib/format";
import type { IngredientLine } from "@/lib/calc";
import { MEALS, type Meal } from "@/lib/types";
import { f, t } from "@/lib/i18n";

const QUICK = [50, 100, 200, 300, 400, 500];
const KEY = "scc_calc_v2";
const OLD_KEY = "scc_calc";
const SAVED_KEY = "scc_saved_menus";

interface MealState {
  id: string;
  meal: Meal;
  people: number;
  dishIds: string[];
}
interface SavedMenu {
  id: string;
  name: string;
  savedAt: string;
  meals: MealState[];
}

const newMeal = (meal: Meal = "breakfast", people = 100): MealState => ({ id: newId(), meal, people, dishIds: [] });

function loadMeals(): MealState[] {
  try {
    const v2 = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (Array.isArray(v2?.meals) && v2.meals.length) return v2.meals;
    // earlier version stored one people count + selected dishes
    const v1 = JSON.parse(localStorage.getItem(OLD_KEY) ?? "null");
    if (v1) return [{ ...newMeal("breakfast", v1.people ?? 100), dishIds: v1.selected ?? [] }];
  } catch {}
  return [newMeal()];
}

function loadSaved(): SavedMenu[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

const toInput = (meals: MealState[]): MealInput[] => meals.map((m) => ({ id: m.id, label: t.meals[m.meal], people: m.people, dishIds: m.dishIds }));

export default function CalculatorPage() {
  const dishes = useTable("dishes");
  const data = useCalcData();
  const settings = useSettings();
  const [meals, setMeals] = useState<MealState[]>(() => [newMeal()]);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<SavedMenu[]>([]);
  const [saving, setSaving] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  // remember the current calculation (e.g. if a phone call comes in)
  useEffect(() => {
    setMeals(loadMeals());
    setSaved(loadSaved());
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify({ meals }));
  }, [meals, loaded]);

  const sorted = useMemo(() => [...dishes].sort((a, b) => a.name_ta.localeCompare(b.name_ta, "ta")), [dishes]);
  const perPerson = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of dishes) {
      const cd = data.dishes.get(d.id);
      if (cd && cd.batchSize > 0) m.set(d.id, batchCost(cd, data.ingredients) / cd.batchSize);
    }
    return m;
  }, [dishes, data]);

  // only dishes that still exist (a deleted dish drops out of the calculation)
  const liveDishes = useMemo(() => {
    const live = new Set(dishes.map((d) => d.id));
    return new Map([...data.dishes].filter(([id]) => live.has(id)));
  }, [dishes, data]);
  const result = useMemo(() => scaleMeals(toInput(meals), liveDishes, data.ingredients), [meals, liveDishes, data]);
  const hasResult = result.meals.length > 0;

  const patchMeal = (id: string, p: Partial<MealState>) => setMeals((ms) => ms.map((m) => (m.id === id ? { ...m, ...p } : m)));
  // computed from the latest state, so quick successive taps never lose a selection
  const toggleDish = (mealId: string, dishId: string) =>
    setMeals((ms) => ms.map((m) => (m.id !== mealId ? m : { ...m, dishIds: m.dishIds.includes(dishId) ? m.dishIds.filter((x) => x !== dishId) : [...m.dishIds, dishId] })));
  const addMeal = () =>
    setMeals((ms) => {
      const used = new Set(ms.map((m) => m.meal));
      const next = (MEALS.find((x) => !used.has(x)) ?? "other") as Meal;
      return [...ms, newMeal(next, ms[ms.length - 1]?.people ?? 100)];
    });

  const persistSaved = (list: SavedMenu[]) => {
    setSaved(list);
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  };

  const share = () => {
    const L = [`*${settings.businessName}*`, ""];
    for (const m of result.meals) {
      L.push(`*${m.meal.label} – ${m.meal.people} ${t.common.people}*`);
      for (const d of m.dishes) L.push(`• ${d.dish.name} – ${money(d.costPaise)}`);
      L.push("");
    }
    L.push(`*${t.simple.shoppingList}*`);
    for (const l of result.combined) L.push(`▢ ${l.name} – ${formatQty(l.purchaseQty, l.unit)}`);
    L.push("", `*${t.simple.totalCost}: ${money(result.totalPaise)}*`, `${t.simple.perPlate}: ${money(result.perPlatePaise)}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(L.join("\n"))}`, "_blank", "noopener");
  };

  if (dishes.length === 0) {
    return (
      <>
        <PageTitle title={t.simple.calcTitle} />
        <div className="card mx-auto max-w-md p-8 text-center">
          <p className="t-body text-muted">{t.simple.noDishesYet}</p>
          <LinkButton href="/dishes/edit/" icon="plus" className="mt-4">
            {t.simple.addFirstDish}
          </LinkButton>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle
        title={t.simple.calcTitle}
        subtitle={t.simple.calcHint}
        right={
          <Button variant="secondary" icon="refresh" aria-label={t.simple.reset} className="whitespace-nowrap" onClick={async () => (await askConfirm({ title: t.confirm.resetTitle, message: t.confirm.resetMsg, confirmLabel: t.simple.reset })) && setMeals([newMeal()])}>
            <span className="hidden sm:inline">{t.simple.reset}</span>
          </Button>
        }
      />

      <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start lg:gap-8">
        {/* ---------------- inputs */}
        <div className="space-y-4">
          {meals.map((m) => (
            <section key={m.id} className="card p-4 md:p-6">
              {/* meal name */}
              <div className="mb-4">
                <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label={t.simple.meal}>
                  {MEALS.map((x) => (
                    <button
                      key={x}
                      type="button"
                      role="radio"
                      aria-checked={m.meal === x}
                      onClick={() => patchMeal(m.id, { meal: x })}
                      className={`h-11 flex-1 rounded-lg px-1.5 text-[15px] font-medium whitespace-nowrap transition-colors ${m.meal === x ? "border border-line bg-surface text-ink" : "text-muted hover:text-ink"}`}
                    >
                      {t.meals[x]}
                    </button>
                  ))}
                </div>
              </div>

              {/* people */}
              <div className="mb-2 flex min-h-6 items-center justify-between gap-2">
                <h2 className="t-label">{t.simple.people}</h2>
                {meals.length > 1 && (
                  <button type="button" aria-label={t.simple.removeMeal} onClick={() => setMeals((ms) => ms.filter((x) => x.id !== m.id))} className="-my-3 flex min-h-11 shrink-0 items-center gap-1 px-1 text-sm font-medium text-muted hover:text-danger">
                    <Icon name="trash" size={16} /> {t.common.delete}
                  </button>
                )}
              </div>
              <NumberStepper big label={`${t.meals[m.meal]} ${t.simple.people}`} value={m.people} step={10} min={0} max={20000} onChange={(people) => patchMeal(m.id, { people })} />
              <div className="mt-2 grid grid-cols-6 gap-1.5">
                {QUICK.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => patchMeal(m.id, { people: n })}
                    className={`h-11 rounded-lg border text-[15px] font-medium tabular-nums transition-colors ${m.people === n ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-surface hover:bg-surface-2"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              {/* dishes */}
              <div className="mt-5 mb-2 flex items-center justify-between gap-2">
                <h2 className="t-label">{t.simple.pickDishesHint}</h2>
                {m.dishIds.length > 0 && (
                  <button type="button" onClick={() => patchMeal(m.id, { dishIds: [] })} className="min-h-11 px-1 text-sm font-medium text-accent-ink">
                    {t.simple.clear}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
                {sorted.map((d) => {
                  const on = m.dishIds.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggleDish(m.id, d.id)}
                      className={`flex min-h-14 items-center gap-2.5 rounded-xl border px-3 py-1.5 text-left transition-colors ${on ? "border-accent bg-accent-soft" : "border-line-strong bg-surface hover:bg-surface-2"}`}
                    >
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${on ? "border-accent bg-accent text-on-accent" : "border-line-strong"}`}>{on && <Icon name="check" size={14} />}</span>
                      <span className="min-w-0">
                        <span className={`block text-[15px] leading-snug font-medium ${on ? "text-accent-ink" : ""}`}>{d.name_ta}</span>
                        <span className="block text-xs text-muted tabular-nums">
                          {money(Math.round(perPerson.get(d.id) ?? 0))} {t.simple.perPersonShort}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          <Button variant="secondary" full icon="plus" onClick={addMeal}>
            {t.simple.addMeal}
          </Button>

          <SavedMenus
            saved={saved}
            dishes={liveDishes}
            ingredients={data.ingredients}
            onOpen={(s) => {
              setMeals(s.meals.map((m) => ({ ...m, id: newId() })));
              toast(t.simple.loaded);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onDelete={async (id) => {
              const s = saved.find((x) => x.id === id);
              if (await askConfirm({ title: f(t.confirm.deleteMenuTitle, { name: s?.name ?? "" }), confirmLabel: t.confirm.delete, danger: true })) persistSaved(saved.filter((x) => x.id !== id));
            }}
            onSave={hasResult ? () => setSaving(true) : undefined}
          />
        </div>

        {/* ---------------- results */}
        <div ref={resultRef} className="mt-6 scroll-mt-20 space-y-4 lg:mt-0">
          {!hasResult ? (
            <div className="card t-caption p-8 text-center">{t.simple.noDishSelected}</div>
          ) : (
            <>
              <Summary r={result} />
              <CostByDish r={result} />
              <ShoppingList r={result} onShare={share} />
              <DishIngredients r={result} />
            </>
          )}
        </div>
      </div>

      {/* phone: total always visible while choosing */}
      {hasResult && (
        <>
          <div className="h-20 lg:hidden" aria-hidden />
          <div className="no-print fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 backdrop-blur md:bottom-0 lg:hidden">
            <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5 md:px-8">
              <div className="min-w-0 flex-1">
                <div className="t-caption">
                  {t.simple.totalCost} · {f(t.simple.plates, { n: result.plates })}
                </div>
                <div className="text-xl font-semibold tabular-nums">{moneyShort(result.totalPaise)}</div>
              </div>
              <Button onClick={() => resultRef.current?.scrollIntoView({ behavior: "smooth" })}>{t.simple.seeResult} ↓</Button>
            </div>
          </div>
        </>
      )}

      {saving && (
        <SaveMenuSheet
          onClose={() => setSaving(false)}
          onSave={(name) => {
            persistSaved([{ id: newId(), name, savedAt: new Date().toISOString(), meals }, ...saved]);
            setSaving(false);
            toast(t.common.saved);
          }}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------------ result blocks

function Summary({ r }: { r: MenuResult }) {
  return (
    <section className="card p-4 md:p-6">
      <div className="grid grid-cols-[1.4fr_1fr] gap-3">
        <div className="rounded-xl bg-accent-soft p-4">
          <div className="t-label text-accent-ink">{t.simple.totalCost}</div>
          <div className="t-figure mt-1 text-accent-ink">{moneyShort(r.totalPaise)}</div>
          <div className="mt-0.5 text-sm text-accent-ink/80">{f(t.simple.plates, { n: r.plates })}</div>
        </div>
        <div className="rounded-xl bg-surface-2 p-4">
          <div className="t-label">{t.simple.perPlate}</div>
          <div className="t-figure mt-1">{money(r.perPlatePaise)}</div>
        </div>
      </div>
      {r.missingPrice.length > 0 && (
        <div role="alert" className="mt-3 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          <span className="min-w-0 flex-1">
            {f(t.simple.missingWarn, { n: r.missingPrice.length })} <span className="font-medium">{r.missingPrice.map((l) => l.name).join(", ")}</span>
          </span>
          <Link href="/ingredients/?f=missing" className="shrink-0 py-1 font-semibold underline underline-offset-2">
            {t.simple.fixPrices}
          </Link>
        </div>
      )}
    </section>
  );
}

function CostByDish({ r }: { r: MenuResult }) {
  return (
    <section className="card p-4 md:p-6">
      <h2 className="t-heading mb-3">{t.simple.costByDish}</h2>
      <div className="space-y-4">
        {r.meals.map((m) => (
          <div key={m.meal.id}>
            <div className="flex items-baseline justify-between gap-2 border-b border-line pb-1.5">
              <span className="font-semibold">
                {m.meal.label} <span className="font-normal text-muted">· {f(t.simple.orderFor, { n: m.meal.people })}</span>
              </span>
              <span className="t-amount">{money(m.costPaise)}</span>
            </div>
            <ul className="divide-y divide-line">
              {m.dishes.map((d) => (
                <li key={d.dish.id} className="flex items-baseline gap-3 py-2">
                  <span className="min-w-0 flex-1">{d.dish.name}</span>
                  <span className="t-caption hidden tabular-nums sm:inline">
                    {money(m.meal.people ? Math.round(d.costPaise / m.meal.people) : 0)} {t.simple.perPersonShort}
                  </span>
                  <span className="text-right font-medium tabular-nums">{money(d.costPaise)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="flex items-baseline justify-between rounded-xl bg-surface-2 px-3 py-2.5">
          <span className="font-semibold">{t.simple.totalCost}</span>
          <span className="t-amount">{money(r.totalPaise)}</span>
        </div>
      </div>
    </section>
  );
}

function ShoppingList({ r, onShare }: { r: MenuResult; onShare: () => void }) {
  return (
    <section className="card p-4 md:p-6">
      <h2 className="t-heading">{t.simple.shoppingList}</h2>
      <p className="t-caption mb-3">{t.simple.shoppingHint}</p>
      <div className="-mx-3 sm:-mx-4">
        <Lines lines={r.combined} />
      </div>
      <div className="mt-2 flex items-baseline justify-between rounded-xl bg-surface-2 px-3 py-2.5">
        <span className="font-semibold">{t.simple.total}</span>
        <span className="t-amount">{money(r.totalPaise)}</span>
      </div>
      <Button full variant="secondary" icon="whatsapp" className="mt-4" onClick={onShare}>
        {t.simple.shareWa}
      </Button>
    </section>
  );
}

function DishIngredients({ r }: { r: MenuResult }) {
  return (
    <section className="card p-4 md:p-6">
      <h2 className="t-heading mb-3">{t.simple.dishIngredients}</h2>
      <div className="space-y-4">
        {r.meals.flatMap((m) =>
          m.dishes.map((d) => (
            <div key={`${m.meal.id}-${d.dish.id}`} className="overflow-hidden rounded-xl border border-line">
              <div className="flex items-baseline justify-between gap-2 border-b border-line bg-surface-2 px-3 py-2 sm:px-4">
                <span className="font-semibold">
                  {d.dish.name}
                  <span className="ml-1.5 text-sm font-normal text-muted">
                    {m.meal.label} · {m.meal.people}
                  </span>
                </span>
                <span className="t-amount">{money(d.costPaise)}</span>
              </div>
              <Lines lines={d.lines} />
            </div>
          )),
        )}
      </div>
    </section>
  );
}

function Lines({ lines }: { lines: IngredientLine[] }) {
  return (
    <ul className="divide-y divide-line">
      {lines.map((l) => (
        <li key={l.ingredientId} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
          <span className="min-w-0 flex-1">{l.name}</span>
          <span className="shrink-0 text-right sm:flex sm:items-baseline sm:gap-4">
            <span className="block font-semibold tabular-nums">{formatQty(l.purchaseQty, l.unit)}</span>
            <span className={`block text-sm tabular-nums sm:w-20 ${l.pricePaise ? "text-muted" : "font-medium text-danger"}`}>{l.pricePaise ? moneyShort(l.costPaise) : t.simple.noPrice}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ saved menus (compare)

function SavedMenus({
  saved,
  dishes,
  ingredients,
  onOpen,
  onDelete,
  onSave,
}: {
  saved: SavedMenu[];
  dishes: ReturnType<typeof useCalcData>["dishes"];
  ingredients: ReturnType<typeof useCalcData>["ingredients"];
  onOpen: (s: SavedMenu) => void;
  onDelete: (id: string) => void;
  onSave?: () => void;
}) {
  // recalculated with today's prices, so the comparison is always current
  const rows = useMemo(() => saved.map((s) => ({ s, r: scaleMeals(toInput(s.meals), dishes, ingredients) })), [saved, dishes, ingredients]);
  return (
    <section className="card p-4 md:p-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2">
        <h2 className="t-heading">{t.simple.savedMenus}</h2>
        {onSave && (
          <Button variant="ghost" icon="plus" className="-mr-2 px-3" onClick={onSave}>
            {t.simple.saveMenu}
          </Button>
        )}
      </div>
      <p className="t-caption mb-3">{t.simple.savedHint}</p>
      {rows.length === 0 ? (
        <p className="t-caption rounded-xl bg-surface-2 p-4 text-center">{t.simple.noSaved}</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map(({ s, r }) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
              <div className="min-w-0 flex-1 basis-40">
                <div className="font-medium">{s.name}</div>
                <div className="t-caption">
                  {s.meals.map((m) => `${t.meals[m.meal]} ${m.people}`).join(" · ")} · {dmy(s.savedAt)}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <div className="mr-1 text-right">
                  <div className="font-semibold tabular-nums">{moneyShort(r.totalPaise)}</div>
                  <div className="t-caption tabular-nums">
                    {money(r.perPlatePaise)} {t.simple.perPersonShort}
                  </div>
                </div>
                <Button variant="secondary" className="px-3" onClick={() => onOpen(s)}>
                  {t.simple.open}
                </Button>
                <IconButton icon="x" label={t.common.delete} className="-mr-2 hover:text-danger" onClick={() => onDelete(s.id)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SaveMenuSheet({ onClose, onSave }: { onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={t.simple.saveMenu}
      footer={
        <Button full icon="check" onClick={() => (name.trim() ? onSave(name.trim()) : setError(t.common.required))}>
          {t.common.save}
        </Button>
      }
    >
      <Field label={t.simple.menuName} error={error}>
        <TextInput autoFocus value={name} placeholder={t.simple.menuNamePh} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && name.trim() && onSave(name.trim())} />
      </Field>
    </BottomSheet>
  );
}

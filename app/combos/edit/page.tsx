"use client";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Chips, Field, IconButton, PageTitle, Section, TextInput, toast } from "@/components/ui";
import { NumberStepper, SortableList, StickyActionBar } from "@/components/mobile";
import { DishPicker } from "@/components/Pickers";
import { getRow, getRows, newId, saveMany, useRowMap, type SaveOp } from "@/lib/db";
import { useCalcData } from "@/lib/calc-data";
import { useDefaultExpenses } from "@/lib/expenses";
import { calculate, dishCostPerPerson } from "@/lib/calc";
import { replaceChildren } from "@/lib/actions";
import { useDraft } from "@/lib/draft";
import { useSettings } from "@/lib/settings";
import { MEALS, type Meal } from "@/lib/types";
import { money } from "@/lib/format";
import { t } from "@/lib/i18n";

interface Item {
  id?: string;
  key: string;
  dish_id: string;
  multiplier: number;
}
interface Form {
  name: string;
  meal: Meal;
  items: Item[];
}

export default function ComboEditPage() {
  return (
    <Suspense>
      <ComboEdit />
    </Suspense>
  );
}

function loadForm(id: string | null): Form {
  const c = getRow("combos", id);
  if (!c) return { name: "", meal: "lunch", items: [] };
  const items = getRows("combo_items")
    .filter((i) => i.combo_id === c.id)
    .sort((a, b) => a.sort - b.sort)
    .map((i) => ({ id: i.id, key: i.id, dish_id: i.dish_id, multiplier: Number(i.multiplier) }));
  return { name: c.name, meal: c.meal, items };
}

function ComboEdit() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const { value: form, set: setForm, clear } = useDraft<Form>(`combo:${id ?? "new"}`, () => loadForm(id));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [picking, setPicking] = useState(false);
  const dishMap = useRowMap("dishes");
  const data = useCalcData();
  const expenses = useDefaultExpenses();
  const s = useSettings();

  const r = useMemo(
    () =>
      calculate([{ id: "c", label: "", headcount: 100, dishes: form.items.map((i) => ({ dishId: i.dish_id, multiplier: i.multiplier })) }], data.dishes, data.ingredients, expenses, {
        defaultWastagePct: s.wastagePct,
        rounding: s.rounding,
        marginPct: s.marginPct,
        priceRoundRupees: s.priceRoundRupees,
        gstPct: 0,
      }),
    [form.items, data, expenses, s],
  );

  async function save() {
    const { comboSchema, fieldErrors } = await import("@/lib/schemas");
    const parsed = comboSchema.safeParse({ name: form.name, meal: form.meal });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    const comboId = id ?? newId();
    const ops: SaveOp[] = [
      { table: "combos", row: { id: comboId, ...parsed.data, sort: getRow("combos", comboId)?.sort ?? getRows("combos").length } },
      ...replaceChildren("combo_items", "combo_id", comboId, form.items.map((i, n) => ({ id: i.id, dish_id: i.dish_id, multiplier: i.multiplier, sort: n }))),
    ];
    saveMany(ops);
    clear();
    toast(t.common.saved);
    router.push("/combos/");
  }

  function remove() {
    if (!id || !confirm(t.common.confirmDelete)) return;
    saveMany([{ table: "combos", row: { id, archived: true } }]);
    clear();
    router.push("/combos/");
  }

  return (
    <>
      <PageTitle title={id ? form.name || t.combos.title : t.combos.new} back="/combos/" right={id ? <IconButton icon="trash" label={t.common.delete} onClick={remove} className="text-bad" /> : undefined} />
      <div className="card space-y-4 p-4">
        <Field label={t.combos.name} error={errors.name}>
          <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <div>
          <div className="mb-1 font-semibold">{t.combos.meal}</div>
          <Chips options={MEALS.map((m) => ({ value: m, label: t.meals[m] }))} value={form.meal} onChange={(meal) => setForm({ ...form, meal })} />
        </div>
      </div>

      <Section title={t.combos.dishes}>
        {form.items.length > 1 && <p className="mb-2 text-sm text-muted">{t.combos.reorderHint}</p>}
        <SortableList
          items={form.items}
          keyOf={(i) => i.key}
          onReorder={(items) => setForm({ ...form, items })}
          render={(item, handle) => {
            const d = data.dishes.get(item.dish_id);
            const cost = d ? dishCostPerPerson(d, data.ingredients, s.wastagePct, item.multiplier) : 0;
            return (
              <div className="card p-3">
                <div className="flex items-center gap-1">
                  {handle}
                  <span className="min-w-0 flex-1 text-[17px] font-bold break-words">{dishMap.get(item.dish_id)?.name_ta ?? "?"}</span>
                  <span className="text-sm text-muted tabular-nums">{money(Math.round(cost))}</span>
                  <IconButton icon="x" label={t.common.delete} onClick={() => setForm({ ...form, items: form.items.filter((x) => x.key !== item.key) })} className="text-muted" />
                </div>
                <div className="mt-1 flex items-center gap-3">
                  <span className="shrink-0 text-sm font-semibold">{t.combos.portion}</span>
                  <div className="min-w-0 flex-1">
                    <NumberStepper
                      label={t.combos.portion}
                      decimal
                      step={0.25}
                      min={0.05}
                      max={10}
                      value={item.multiplier}
                      onChange={(v) => setForm({ ...form, items: form.items.map((x) => (x.key === item.key ? { ...x, multiplier: v } : x)) })}
                    />
                  </div>
                </div>
              </div>
            );
          }}
        />
        <Button variant="secondary" full className="mt-3" icon="plus" onClick={() => setPicking(true)}>
          {t.combos.pickDishes}
        </Button>
      </Section>

      <StickyActionBar>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-muted">{t.combos.costPerPerson}</div>
          <div className="text-2xl leading-tight font-bold tabular-nums">{money(r.perPlateCostPaise)}</div>
          <div className="text-xs text-good tabular-nums">
            {t.combos.suggested}: {money(r.suggestedPerPlatePaise)}
          </div>
        </div>
        <Button onClick={save} icon="check" className="h-14 px-8 text-lg">
          {t.common.save}
        </Button>
      </StickyActionBar>

      <DishPicker
        open={picking}
        onClose={() => setPicking(false)}
        selected={form.items.map((i) => i.dish_id)}
        onDone={(ids) => {
          const kept = form.items.filter((i) => ids.includes(i.dish_id));
          const added = ids.filter((d) => !kept.some((k) => k.dish_id === d)).map((d) => ({ key: newId(), dish_id: d, multiplier: 1 }));
          setForm({ ...form, items: [...kept, ...added] });
        }}
      />
    </>
  );
}

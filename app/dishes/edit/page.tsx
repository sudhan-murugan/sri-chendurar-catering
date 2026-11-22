"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Field, IconButton, NumberInput, PageTitle, Select, TextInput, toast } from "@/components/ui";
import { NumberStepper, StickyActionBar } from "@/components/mobile";
import { IngredientPicker } from "@/components/Pickers";
import { getRow, getRows, newId, saveMany, useRowMap, type SaveOp } from "@/lib/db";
import { replaceChildren, setIngredientPrice } from "@/lib/actions";
import { compatibleUnits, convert, UNIT_LABEL, type Unit } from "@/lib/units";
import { money, paiseToInput, rupeesToPaise } from "@/lib/format";
import { f, t } from "@/lib/i18n";
import type { Ingredient } from "@/lib/types";

interface Line {
  key: string;
  id?: string;
  ingredient_id: string;
  qty: string;
  unit: Unit;
}

export default function DishEditPage() {
  return (
    <Suspense>
      <DishEdit />
    </Suspense>
  );
}

function load(id: string | null) {
  const d = getRow("dishes", id);
  const lines: Line[] = d
    ? getRows("recipe_items")
        .filter((r) => r.dish_id === d.id)
        .sort((a, b) => a.sort - b.sort)
        .map((r) => ({ key: r.id, id: r.id, ingredient_id: r.ingredient_id, qty: String(Number(r.qty)), unit: r.unit }))
    : [];
  return { name: d?.name_ta ?? "", batch: d?.batch_size ?? 100, lines };
}

function DishEdit() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const initial = useMemo(() => load(id), [id]);
  const [name, setName] = useState(initial.name);
  const [batch, setBatch] = useState(initial.batch);
  const [lines, setLines] = useState<Line[]>(initial.lines);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<number | "new" | null>(null);
  const ingMap = useRowMap("ingredients");

  const cost = (l: Line) => {
    const ing = ingMap.get(l.ingredient_id);
    const q = ing ? convert(Number(l.qty) || 0, l.unit, ing.unit) : null;
    return ing && q !== null ? Math.round(q * ing.price_paise) : 0;
  };
  const total = lines.reduce((n, l) => n + cost(l), 0);
  const patchLine = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));

  function saveDish() {
    if (!name.trim()) return setError(t.simple.saveFirst);
    const dishId = id ?? newId();
    const items = lines
      .filter((l) => l.ingredient_id && Number(l.qty) > 0)
      .map((l, i) => ({ id: l.id, ingredient_id: l.ingredient_id, qty: Number(l.qty), unit: l.unit, sort: i }));
    const existing = getRow("dishes", id);
    saveMany([
      {
        table: "dishes",
        row: {
          id: dishId,
          name_ta: name.trim(),
          name_en: existing?.name_en ?? null,
          batch_size: Math.max(1, Math.round(batch)),
          serving_note: existing?.serving_note ?? null,
          wastage_pct: null,
          is_sample: false,
        },
      },
      ...replaceChildren("recipe_items", "dish_id", dishId, items),
    ] as SaveOp[]);
    toast(t.common.saved);
    router.push("/");
  }

  function remove() {
    if (!id || !confirm(t.common.confirmDelete)) return;
    saveMany([{ table: "dishes", row: { id, archived: true } }]);
    toast(t.common.deleted, "neutral");
    router.push("/");
  }

  return (
    <>
      <PageTitle
        title={id ? name || t.simple.dishes : t.simple.newDish}
        subtitle={f(t.simple.forPeople, { n: batch })}
        back="/"
        right={id ? <IconButton icon="trash" label={t.common.delete} onClick={remove} className="hover:text-danger" /> : undefined}
      />

      <section className="card grid gap-5 p-4 md:grid-cols-2 md:p-6">
        <Field label={t.simple.dishName} error={error}>
          <TextInput value={name} onChange={(e) => (setName(e.target.value), setError(null))} placeholder="இட்லி" />
        </Field>
        <Field label={t.simple.refPeople} hint={t.simple.refHint}>
          <NumberStepper label={t.simple.refPeople} value={batch} step={10} min={1} onChange={setBatch} />
        </Field>
      </section>

      <div className="mt-8 mb-3">
        <h2 className="t-heading">{t.simple.ingredients}</h2>
        <p className="t-caption">{t.simple.priceNote}</p>
      </div>

      {/* column headings (tablet / desktop) */}
      <div className="t-label mb-2 hidden grid-cols-[minmax(0,1fr)_6.5rem_8.5rem_8rem_7.5rem_3rem] gap-3 px-4 md:grid">
        <span>{t.simple.ingredient}</span>
        <span>{t.simple.qty}</span>
        <span>{t.common.unit}</span>
        <span>{t.simple.priceCol}</span>
        <span className="text-right">{t.simple.lineCost}</span>
        <span />
      </div>

      <ul className="space-y-2">
        {lines.map((l, i) => {
          const ing = ingMap.get(l.ingredient_id);
          return (
            <li
              key={l.key}
              className="card grid grid-cols-[1fr_1.25fr_1fr] gap-x-2 gap-y-1.5 p-3 md:grid-cols-[minmax(0,1fr)_6.5rem_8.5rem_8rem_7.5rem_3rem] md:items-center md:gap-3 md:px-4 md:py-2"
            >
              <button type="button" onClick={() => setPicking(i)} className="order-1 col-span-2 min-h-11 min-w-0 text-left text-[17px] font-semibold hover:text-accent-ink md:col-span-1">
                {ing?.name_ta ?? "?"}
              </button>
              <div className="order-2 flex justify-end md:order-6">
                <IconButton icon="x" label={t.common.delete} className="hover:text-danger" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} />
              </div>
              <span className="t-label order-3 md:hidden">{t.simple.qty}</span>
              <span className="t-label order-3 md:hidden">{t.common.unit}</span>
              <span className="t-label order-3 leading-tight md:hidden">{ing ? f(t.simple.price, { unit: UNIT_LABEL[ing.unit] }) : ""}</span>
              <NumberInput
                aria-label={t.simple.qty}
                value={l.qty}
                onChange={(e) => patchLine(i, { qty: e.target.value.replace(",", ".").replace(/[^0-9.]/g, "") })}
                className="order-4 px-2 text-center font-semibold md:order-2"
              />
              <Select aria-label={t.common.unit} value={l.unit} onChange={(e) => patchLine(i, { unit: e.target.value as Unit })} className="order-4 pr-7 pl-2.5 md:order-3">
                {(ing ? compatibleUnits(ing.unit) : [l.unit]).map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABEL[u]}
                  </option>
                ))}
              </Select>
              <div className="order-4 md:order-4">{ing && <PriceBox ing={ing} />}</div>
              <div className="order-5 col-span-3 flex items-baseline justify-end gap-2 pt-0.5 md:col-span-1">
                <span className="t-caption md:hidden">{t.simple.lineCost}</span>
                <span className="t-amount">{money(cost(l))}</span>
              </div>
            </li>
          );
        })}
      </ul>

      <Button variant="secondary" icon="plus" className="mt-3 w-full md:w-auto" onClick={() => setPicking("new")}>
        {t.simple.addIngredient}
      </Button>

      <StickyActionBar>
        <div className="min-w-0 flex-1">
          <div className="t-caption">
            {t.simple.total} · {f(t.simple.forPeople, { n: batch })}
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-2xl font-semibold tabular-nums">{money(total)}</span>
            <span className="t-caption tabular-nums">
              {t.simple.perPerson} {money(Math.round(total / Math.max(1, batch)))}
            </span>
          </div>
        </div>
        <Button onClick={saveDish} icon="check" className="px-6 md:px-10">
          {t.common.save}
        </Button>
      </StickyActionBar>

      <IngredientPicker
        open={picking !== null}
        onClose={() => setPicking(null)}
        exclude={lines.map((l) => l.ingredient_id)}
        onPick={(ing) => {
          if (picking === "new") setLines((ls) => [...ls, { key: newId(), ingredient_id: ing.id, qty: "", unit: ing.unit }]);
          else if (typeof picking === "number") patchLine(picking, { ingredient_id: ing.id, unit: ing.unit });
        }}
      />
    </>
  );
}

/** Price per purchase unit. Saved to the ingredient (shared by all dishes) when you leave the box. */
function PriceBox({ ing }: { ing: Ingredient }) {
  const [text, setText] = useState(paiseToInput(ing.price_paise, true));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(paiseToInput(ing.price_paise, true));
  }, [ing.price_paise]);
  return (
      <NumberInput
        aria-label={f(t.simple.price, { unit: UNIT_LABEL[ing.unit] })}
        value={text}
        placeholder="0"
        onFocus={(e) => {
          focused.current = true;
          e.currentTarget.select();
        }}
        onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ""))}
        onBlur={() => {
          focused.current = false;
          setIngredientPrice(ing, rupeesToPaise(text));
        }}
        className={`px-2 text-center font-semibold ${ing.price_paise ? "" : "border-danger"}`}
      />
  );
}

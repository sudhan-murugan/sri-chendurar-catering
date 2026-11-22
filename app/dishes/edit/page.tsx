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
      <PageTitle title={id ? name || t.simple.dishes : t.simple.newDish} back="/" right={id ? <IconButton icon="trash" label={t.common.delete} onClick={remove} className="text-bad" /> : undefined} />

      <div className="card space-y-4 p-4">
        <Field label={t.simple.dishName} error={error}>
          <TextInput value={name} onChange={(e) => (setName(e.target.value), setError(null))} placeholder="இட்லி" />
        </Field>
        <Field label={t.simple.refPeople} hint={t.simple.refHint}>
          <NumberStepper label={t.simple.refPeople} value={batch} step={10} min={1} onChange={setBatch} />
        </Field>
      </div>

      <h2 className="mt-5 mb-1 text-lg font-bold">
        {t.simple.ingredients} <span className="font-normal text-muted">({f(t.simple.forPeople, { n: batch })})</span>
      </h2>
      <p className="mb-2 text-sm text-muted">{t.simple.priceNote}</p>

      <ul className="space-y-2">
        {lines.map((l, i) => {
          const ing = ingMap.get(l.ingredient_id);
          return (
            <li key={l.key} className="card p-3">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPicking(i)} className="tap min-w-0 flex-1 text-left text-lg font-bold">
                  {ing?.name_ta ?? "?"}
                </button>
                <IconButton icon="x" label={t.common.delete} className="text-muted" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} />
              </div>
              <div className="grid grid-cols-[1fr_1.25fr_1fr] items-end gap-x-2 text-sm leading-tight text-muted">
                <span>{t.simple.qty}</span>
                <span>{t.common.unit}</span>
                <span>{ing ? f(t.simple.price, { unit: UNIT_LABEL[ing.unit] }) : ""}</span>
              </div>
              <div className="mt-1 grid grid-cols-[1fr_1.25fr_1fr] gap-2">
                <NumberInput aria-label={t.simple.qty} value={l.qty} onChange={(e) => patchLine(i, { qty: e.target.value.replace(",", ".").replace(/[^0-9.]/g, "") })} className="px-2 text-center text-lg font-bold" />
                <Select aria-label={t.common.unit} value={l.unit} onChange={(e) => patchLine(i, { unit: e.target.value as Unit })} className="pr-7 pl-2 text-[16px]">
                  {(ing ? compatibleUnits(ing.unit) : [l.unit]).map((u) => (
                    <option key={u} value={u}>
                      {UNIT_LABEL[u]}
                    </option>
                  ))}
                </Select>
                {ing && <PriceBox ing={ing} />}
              </div>
              <div className="mt-1 text-right text-[15px] text-muted">
                {t.simple.lineCost}: <span className="text-lg font-bold text-[var(--ink)] tabular-nums">{money(cost(l))}</span>
              </div>
            </li>
          );
        })}
      </ul>

      <Button variant="secondary" full icon="plus" className="mt-3 h-14 text-lg" onClick={() => setPicking("new")}>
        {t.simple.addIngredient}
      </Button>

      <StickyActionBar>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-muted">
            {t.simple.total} · {f(t.simple.forPeople, { n: batch })}
          </div>
          <div className="text-2xl leading-tight font-bold tabular-nums">{money(total)}</div>
          <div className="text-xs text-muted tabular-nums">
            {t.simple.perPerson} {money(Math.round(total / Math.max(1, batch)))}
          </div>
        </div>
        <Button onClick={saveDish} icon="check" className="h-14 px-8 text-lg">
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
        className={`px-2 text-center text-lg font-bold ${ing.price_paise ? "" : "border-bad"}`}
      />
  );
}

"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Empty, Field, NumberInput, PageTitle, Select, TextInput, toast } from "@/components/ui";
import { BottomSheet, SearchBox } from "@/components/mobile";
import { getRows, newId, saveMany, useTable } from "@/lib/db";
import { changedToday, setIngredientPrice } from "@/lib/actions";
import type { Ingredient } from "@/lib/types";
import { compatibleUnits, UNITS, UNIT_LABEL, type Unit } from "@/lib/units";
import { paiseToInput, rupeesToPaise } from "@/lib/format";
import { f, t } from "@/lib/i18n";

export default function PricesPage() {
  const all = useTable("ingredients");
  const recipe = useTable("recipe_items");
  const dishes = useTable("dishes");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Ingredient | "new" | null>(null);

  // ingredient → number of (active) dishes using it
  const usage = useMemo(() => {
    const live = new Set(dishes.map((d) => d.id));
    const m = new Map<string, Set<string>>();
    for (const r of recipe) if (live.has(r.dish_id)) m.set(r.ingredient_id, (m.get(r.ingredient_id) ?? new Set()).add(r.dish_id));
    return m;
  }, [recipe, dishes]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter((i) => !s || i.name_ta.toLowerCase().includes(s) || (i.name_en ?? "").toLowerCase().includes(s)).sort((a, b) => a.name_ta.localeCompare(b.name_ta, "ta"));
  }, [all, q]);

  return (
    <>
      <PageTitle
        title={t.nav.prices}
        subtitle={t.simple.pricesHint}
        right={
          <Button variant="secondary" icon="plus" className="whitespace-nowrap" aria-label={t.simple.newIngredient} onClick={() => setEditing("new")}>
            <span className="hidden sm:inline">{t.simple.newIngredient}</span>
          </Button>
        }
      />
      <div className="sticky top-16 z-20 -mx-4 bg-bg px-4 pt-1 pb-3 md:static md:mx-0 md:max-w-sm md:px-0">
        <SearchBox value={q} onChange={setQ} />
      </div>

      {list.length === 0 ? (
        <Empty icon="basket">{t.common.noItems}</Empty>
      ) : (
        // 1px gaps over a line-coloured background = hairline dividers that also work in a grid
        <ul className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-2">
          {list.map((i) => (
            <PriceRow key={i.id} ing={i} used={usage.get(i.id)?.size ?? 0} onEdit={() => setEditing(i)} />
          ))}
          {list.length % 2 === 1 && <li className="hidden bg-surface lg:block" aria-hidden />}
        </ul>
      )}

      {editing && <IngredientSheet ing={editing === "new" ? null : editing} used={editing === "new" ? 0 : usage.get(editing.id)?.size ?? 0} onClose={() => setEditing(null)} />}
    </>
  );
}

/** Name on the left (tap to rename / change unit), price box on the right. Saves when you leave the box. */
function PriceRow({ ing, used, onEdit }: { ing: Ingredient; used: number; onEdit: () => void }) {
  const [text, setText] = useState(paiseToInput(ing.price_paise, true));
  const [flash, setFlash] = useState(false);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(paiseToInput(ing.price_paise, true));
  }, [ing.price_paise]);

  const commit = () => {
    focused.current = false;
    const p = rupeesToPaise(text);
    if (p !== ing.price_paise) {
      setIngredientPrice(ing, p);
      setFlash(true);
      setTimeout(() => setFlash(false), 1200);
    }
  };

  return (
    <li className="flex items-center gap-3 bg-surface px-4 py-2.5">
      <button type="button" onClick={onEdit} className="min-h-12 min-w-0 flex-1 text-left">
        <span className="block font-medium break-words hover:text-accent-ink">{ing.name_ta}</span>
        <span className="t-caption flex items-center gap-1.5">
          {changedToday(ing) && <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" aria-label={t.common.today} />}
          {used ? f(t.simple.usedIn, { n: used }) : t.simple.notUsed}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">₹</span>
          <input
            aria-label={`${ing.name_ta} ${t.common.price}`}
            type="text"
            inputMode="decimal"
            enterKeyHint="next"
            value={text}
            placeholder="0"
            onFocus={(e) => {
              focused.current = true;
              e.currentTarget.select();
            }}
            onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ""))}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className={`h-12 w-28 rounded-xl border bg-surface pr-3 pl-7 text-right text-lg font-semibold tabular-nums outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20 ${
              flash ? "border-accent bg-accent-soft" : ing.price_paise ? "border-line-strong" : "border-danger"
            }`}
          />
        </div>
        <span className="t-caption w-[4.5rem] whitespace-nowrap">/ {UNIT_LABEL[ing.unit]}</span>
      </div>
    </li>
  );
}

function IngredientSheet({ ing, used, onClose }: { ing: Ingredient | null; used: number; onClose: () => void }) {
  const [name, setName] = useState(ing?.name_ta ?? "");
  const [unit, setUnit] = useState<Unit>(ing?.unit ?? "kg");
  const [price, setPrice] = useState(paiseToInput(ing?.price_paise, true));
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!name.trim()) return setError(t.common.required);
    const now = new Date().toISOString();
    const p = rupeesToPaise(price);
    if (ing) {
      saveMany([{ table: "ingredients", row: { id: ing.id, name_ta: name.trim(), unit } }]);
      setIngredientPrice({ ...ing, unit }, p);
    } else {
      const id = newId();
      saveMany([
        { table: "ingredients", row: { id, name_ta: name.trim(), name_en: null, category: "other", unit, price_paise: p, shop: null, price_updated_at: now } },
        { table: "ingredient_price_history", row: { id: newId(), ingredient_id: id, price_paise: p, recorded_at: now } },
      ]);
    }
    toast(t.common.saved);
    onClose();
  }

  function remove() {
    if (!ing) return;
    if (!confirm(used ? f(t.simple.deleteUsed, { n: used }) : t.common.confirmDelete)) return;
    const ops: Parameters<typeof saveMany>[0] = [{ table: "ingredients", row: { id: ing.id, archived: true } }];
    for (const r of getRows("recipe_items")) if (r.ingredient_id === ing.id) ops.push({ table: "recipe_items", row: { id: r.id, archived: true } });
    saveMany(ops);
    toast(t.common.deleted, "neutral");
    onClose();
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={ing ? ing.name_ta : t.simple.newIngredient}
      footer={
        <div className="flex gap-2">
          {ing && <Button variant="danger" icon="trash" aria-label={t.common.delete} onClick={remove} />}
          <Button full icon="check" onClick={submit}>
            {t.common.save}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label={t.ingredients.nameTa} error={error}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus={!ing} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.common.unit}>
            <Select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
              {(ing && used ? compatibleUnits(ing.unit) : UNITS).map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABEL[u]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={f(t.simple.price, { unit: UNIT_LABEL[unit] })}>
            <NumberInput value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} className="font-semibold" />
          </Field>
        </div>
      </div>
    </BottomSheet>
  );
}

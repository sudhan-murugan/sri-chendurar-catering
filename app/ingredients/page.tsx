"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Empty, Field, NumberInput, Select, TextInput, toast } from "@/components/ui";
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
      <div className="mb-2 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold whitespace-nowrap">{t.nav.prices}</h1>
        <Button icon="plus" className="whitespace-nowrap" onClick={() => setEditing("new")}>
          {t.simple.newIngredient}
        </Button>
      </div>
      <p className="mb-3 text-[15px] text-muted">{t.simple.pricesHint}</p>
      <div className="sticky top-14 z-20 -mx-4 bg-app px-4 pt-1 pb-2">
        <SearchBox value={q} onChange={setQ} />
      </div>

      {list.length === 0 ? (
        <Empty icon="basket">{t.common.noItems}</Empty>
      ) : (
        <ul className="card divide-y divide-[var(--line)] overflow-hidden">
          {list.map((i) => (
            <PriceRow key={i.id} ing={i} used={usage.get(i.id)?.size ?? 0} onEdit={() => setEditing(i)} />
          ))}
        </ul>
      )}

      {editing && <IngredientSheet ing={editing === "new" ? null : editing} used={editing === "new" ? 0 : usage.get(editing.id)?.size ?? 0} onClose={() => setEditing(null)} />}
    </>
  );
}

/** Name on the left (tap to rename / change unit), big price box on the right. Saves when you leave the box. */
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
    <li className={`flex items-center gap-3 px-3 py-2 ${changedToday(ing) ? "bg-green-50 dark:bg-green-950/40" : ""}`}>
      <button type="button" onClick={onEdit} className="min-h-12 min-w-0 flex-1 text-left">
        <span className="block text-[17px] font-bold">{ing.name_ta}</span>
        <span className="block text-sm text-muted">
          {used ? f(t.simple.usedIn, { n: used }) : t.simple.notUsed}
        </span>
      </button>
      <div className="flex shrink-0 flex-col items-end">
        <div className="flex items-center gap-1">
          <span className="text-lg font-bold">₹</span>
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
            className={`h-14 w-28 rounded-xl border-2 bg-card px-2 text-right text-2xl font-bold tabular-nums outline-none focus:border-brand-500 ${flash ? "border-good" : ing.price_paise ? "border-line" : "border-bad"}`}
          />
        </div>
        <span className="text-sm text-muted">/ {UNIT_LABEL[ing.unit]}</span>
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
          {ing && <Button variant="secondary" icon="trash" aria-label={t.common.delete} className="text-bad" onClick={remove} />}
          <Button full icon="check" className="h-14 text-lg" onClick={submit}>
            {t.common.save}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
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
            <NumberInput value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} className="text-xl font-bold" />
          </Field>
        </div>
      </div>
    </BottomSheet>
  );
}

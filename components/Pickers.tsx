"use client";
import { useMemo, useState } from "react";
import { BottomSheet, SearchBox } from "@/components/mobile";
import { Button, Chips, Icon } from "@/components/ui";
import { useTable } from "@/lib/db";
import { CATEGORIES, type Category, type Ingredient } from "@/lib/types";
import { UNIT_LABEL } from "@/lib/units";
import { money } from "@/lib/format";
import { f, t } from "@/lib/i18n";

/** Searchable ingredient picker (bottom sheet). */
export function IngredientPicker({ open, onClose, onPick, exclude = [] }: { open: boolean; onClose: () => void; onPick: (i: Ingredient) => void; exclude?: string[] }) {
  const all = useTable("ingredients");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"all" | Category>("all");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all
      .filter((i) => (cat === "all" || i.category === cat) && (!s || i.name_ta.toLowerCase().includes(s) || (i.name_en ?? "").toLowerCase().includes(s)))
      .sort((a, b) => a.name_ta.localeCompare(b.name_ta, "ta"));
  }, [all, q, cat]);
  const excluded = new Set(exclude);

  return (
    <BottomSheet open={open} onClose={onClose} title={t.dishes.pickIngredient}>
      <div className="sticky -top-3 z-10 -mx-4 space-y-2 bg-card px-4 pt-1 pb-2">
        <SearchBox value={q} onChange={setQ} autoFocus />
        <Chips options={[{ value: "all" as const, label: t.common.all }, ...CATEGORIES.map((c) => ({ value: c, label: t.categories[c] }))]} value={cat} onChange={setCat} />
      </div>
      <ul className="divide-y divide-[var(--line)]">
        {list.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              disabled={excluded.has(i.id)}
              onClick={() => {
                onPick(i);
                setQ("");
                onClose();
              }}
              className="flex min-h-14 w-full items-center gap-3 py-2 text-left active:bg-black/5 disabled:opacity-40"
            >
              <span className="flex-1">
                <span className="block text-[17px] font-semibold">{i.name_ta}</span>
                <span className="block text-sm text-muted">{t.categories[i.category]}</span>
              </span>
              <span className="text-sm text-muted tabular-nums">
                {money(i.price_paise)}/{UNIT_LABEL[i.unit]}
              </span>
              {excluded.has(i.id) && <Icon name="check" className="text-good" />}
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}

/** Multi-select dish picker with big checkboxes. */
export function DishPicker({ open, onClose, selected, onDone }: { open: boolean; onClose: () => void; selected: string[]; onDone: (ids: string[]) => void }) {
  const dishes = useTable("dishes");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string[]>(selected);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setSel(selected);
  }
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return dishes.filter((d) => !s || d.name_ta.toLowerCase().includes(s) || (d.name_en ?? "").toLowerCase().includes(s)).sort((a, b) => a.name_ta.localeCompare(b.name_ta, "ta"));
  }, [dishes, q]);
  const toggle = (id: string) => setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t.combos.pickDishes}
      footer={
        <Button
          full
          className="h-14 text-lg"
          icon="check"
          onClick={() => {
            onDone(sel);
            onClose();
          }}
        >
          {t.common.done} ({sel.length})
        </Button>
      }
    >
      <div className="sticky -top-3 z-10 -mx-4 bg-card px-4 pt-1 pb-2">
        <SearchBox value={q} onChange={setQ} />
      </div>
      <ul className="space-y-2">
        {list.map((d) => {
          const on = sel.includes(d.id);
          return (
            <li key={d.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(d.id)}
                className={`flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-3 text-left ${on ? "border-brand-600 bg-brand-50 dark:bg-brand-900" : "border-line"}`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 ${on ? "border-brand-600 bg-brand-600 text-white" : "border-gray-400"}`}>{on && <Icon name="check" />}</span>
                <span className="flex-1 text-[17px] font-semibold">{d.name_ta}</span>
                {d.serving_note && <span className="text-sm text-muted">{d.serving_note}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {list.length === 0 && <p className="py-6 text-center text-muted">{f(t.dishes.items, { n: 0 })}</p>}
    </BottomSheet>
  );
}

"use client";
import { useMemo, useState } from "react";
import { BottomSheet, SearchBox } from "@/components/mobile";
import { Icon } from "@/components/ui";
import { newId, save, useTable } from "@/lib/db";
import type { Ingredient } from "@/lib/types";
import { UNITS, UNIT_LABEL, type Unit } from "@/lib/units";
import { money } from "@/lib/format";
import { f, t } from "@/lib/i18n";

/** Search an ingredient, or type a new name and create it right here. */
export function IngredientPicker({ open, onClose, onPick, exclude = [] }: { open: boolean; onClose: () => void; onPick: (i: Ingredient) => void; exclude?: string[] }) {
  const all = useTable("ingredients");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState<string | null>(null);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter((i) => !s || i.name_ta.toLowerCase().includes(s) || (i.name_en ?? "").toLowerCase().includes(s)).sort((a, b) => a.name_ta.localeCompare(b.name_ta, "ta"));
  }, [all, q]);
  const excluded = new Set(exclude);
  const typed = q.trim();
  const exact = all.some((i) => i.name_ta === typed);

  const done = (i: Ingredient) => {
    onPick(i);
    setQ("");
    setCreating(null);
    onClose();
  };

  const create = (unit: Unit) => {
    const ing = save("ingredients", {
      id: newId(),
      name_ta: creating!,
      name_en: null,
      category: "other",
      unit,
      price_paise: 0,
      shop: null,
      price_updated_at: null,
    });
    done(ing);
  };

  return (
    <BottomSheet open={open} onClose={() => (setCreating(null), onClose())} title={creating ? creating : t.dishes.pickIngredient}>
      {creating ? (
        <div className="space-y-3 pb-2">
          <p className="text-lg font-semibold">{t.simple.newUnit}</p>
          <div className="grid grid-cols-2 gap-2">
            {UNITS.map((u) => (
              <button key={u} type="button" onClick={() => create(u)} className="h-14 rounded-xl border-2 border-line bg-card text-lg font-bold active:bg-brand-50">
                {UNIT_LABEL[u]}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="sticky -top-3 z-10 -mx-4 bg-card px-4 pt-1 pb-2">
            <SearchBox value={q} onChange={setQ} autoFocus />
          </div>
          {typed && !exact && (
            <button type="button" onClick={() => setCreating(typed)} className="mb-2 flex min-h-14 w-full items-center gap-3 rounded-xl border-2 border-dashed border-brand-600 px-3 text-left text-[17px] font-bold text-brand-700 dark:text-brand-100">
              <Icon name="plus" />
              {f(t.simple.createNew, { name: typed })}
            </button>
          )}
          <ul className="divide-y divide-[var(--line)]">
            {list.map((i) => (
              <li key={i.id}>
                <button type="button" disabled={excluded.has(i.id)} onClick={() => done(i)} className="flex min-h-14 w-full items-center gap-3 py-2 text-left active:bg-black/5 disabled:opacity-40">
                  <span className="flex-1 text-[17px] font-semibold">{i.name_ta}</span>
                  <span className="text-[15px] text-muted tabular-nums">
                    {i.price_paise ? `${money(i.price_paise)} / ${UNIT_LABEL[i.unit]}` : UNIT_LABEL[i.unit]}
                  </span>
                  {excluded.has(i.id) && <Icon name="check" className="text-good" />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </BottomSheet>
  );
}

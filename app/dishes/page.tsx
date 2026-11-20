"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Empty, PageTitle } from "@/components/ui";
import { FAB, SearchBox } from "@/components/mobile";
import { useTable } from "@/lib/db";
import { useCalcData } from "@/lib/calc-data";
import { dishCostPerPerson } from "@/lib/calc";
import { useSettings } from "@/lib/settings";
import { money } from "@/lib/format";
import { f, t } from "@/lib/i18n";

export default function DishesPage() {
  const dishes = useTable("dishes");
  const data = useCalcData();
  const settings = useSettings();
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return dishes
      .filter((d) => !s || d.name_ta.toLowerCase().includes(s) || (d.name_en ?? "").toLowerCase().includes(s))
      .sort((a, b) => a.name_ta.localeCompare(b.name_ta, "ta"))
      .map((d) => ({ d, cost: dishCostPerPerson(data.dishes.get(d.id)!, data.ingredients, settings.wastagePct), n: data.recipeByDish.get(d.id)?.length ?? 0 }));
  }, [dishes, q, data, settings.wastagePct]);

  return (
    <>
      <PageTitle title={t.dishes.title} back="/more/" />
      <div className="sticky top-14 z-20 -mx-4 bg-app px-4 pt-1 pb-2">
        <SearchBox value={q} onChange={setQ} />
      </div>
      {list.length === 0 ? (
        <Empty icon="dish">{t.common.noItems}</Empty>
      ) : (
        <ul className="space-y-2">
          {list.map(({ d, cost, n }) => (
            <li key={d.id}>
              <Link href={`/dishes/edit/?id=${d.id}`} className="card flex items-center gap-3 p-3 active:opacity-80">
                <div className="min-w-0 flex-1">
                  <div className="text-[17px] font-bold break-words">{d.name_ta}</div>
                  <div className="text-sm text-muted">
                    {f(t.dishes.batchShort, { n: d.batch_size })} · {f(t.dishes.items, { n })}
                  </div>
                  {d.serving_note && <div className="text-sm text-muted">{d.serving_note}</div>}
                  {d.is_sample && (
                    <div className="mt-1">
                      <Badge tone="soon">{t.common.sample}</Badge>
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xl font-bold tabular-nums">{money(Math.round(cost))}</div>
                  <div className="text-sm text-muted">{t.common.perPerson}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <FAB href="/dishes/edit/" label={t.dishes.new} />
    </>
  );
}

"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Empty, Icon, LinkButton } from "@/components/ui";
import { SearchBox } from "@/components/mobile";
import { useTable } from "@/lib/db";
import { useCalcData } from "@/lib/calc-data";
import { batchCost } from "@/lib/simple";
import { money } from "@/lib/format";
import { f, t } from "@/lib/i18n";

export default function Home() {
  const dishes = useTable("dishes");
  const data = useCalcData();
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return dishes
      .filter((d) => !s || d.name_ta.toLowerCase().includes(s) || (d.name_en ?? "").toLowerCase().includes(s))
      .sort((a, b) => a.name_ta.localeCompare(b.name_ta, "ta"))
      .map((d) => {
        const cd = data.dishes.get(d.id)!;
        const cost = batchCost(cd, data.ingredients);
        return { d, cost };
      });
  }, [dishes, q, data]);

  return (
    <>
      <Link href="/calculator/" className="mb-4 flex min-h-20 items-center gap-4 rounded-2xl bg-brand-600 px-5 py-3 text-white shadow-md active:bg-brand-700">
        <Icon name="calc" size={36} />
        <span className="flex-1">
          <span className="block text-xl font-bold">{t.simple.calcButton}</span>
          <span className="block text-[15px] text-white/85">{t.simple.calcHint}</span>
        </span>
        <Icon name="right" />
      </Link>

      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold whitespace-nowrap">{t.nav.home}</h1>
        <LinkButton href="/dishes/edit/" icon="plus" className="whitespace-nowrap">
          {t.simple.newDish}
        </LinkButton>
      </div>

      {dishes.length > 6 && (
        <div className="mb-3">
          <SearchBox value={q} onChange={setQ} />
        </div>
      )}

      {list.length === 0 ? (
        <Empty icon="dish">{t.simple.emptyDishes}</Empty>
      ) : (
        <ul className="space-y-2">
          {list.map(({ d, cost }) => (
            <li key={d.id}>
              <Link href={`/dishes/edit/?id=${d.id}`} className="card flex items-center gap-2 p-4 active:opacity-80">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-lg font-bold">{d.name_ta}</span>
                    <span className="text-xl font-bold tabular-nums">{money(cost)}</span>
                  </div>
                  <div className="text-[15px] text-muted">{f(t.simple.forPeople, { n: d.batch_size })}</div>
                </div>
                <Icon name="right" className="shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

"use client";
import Link from "next/link";
import { useMemo } from "react";
import { Badge, Empty, PageTitle } from "@/components/ui";
import { FAB } from "@/components/mobile";
import { useRowMap, useTable } from "@/lib/db";
import { useCalcData, useComboDishes } from "@/lib/calc-data";
import { useDefaultExpenses } from "@/lib/expenses";
import { calculate } from "@/lib/calc";
import { useSettings } from "@/lib/settings";
import { money } from "@/lib/format";
import { f, t } from "@/lib/i18n";
import { MEALS } from "@/lib/types";

const REF_PEOPLE = 100;

export default function CombosPage() {
  const combos = useTable("combos");
  const comboDishes = useComboDishes();
  const dishMap = useRowMap("dishes");
  const data = useCalcData();
  const expenses = useDefaultExpenses();
  const s = useSettings();

  const list = useMemo(
    () =>
      [...combos]
        .sort((a, b) => MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal) || a.sort - b.sort)
        .map((c) => {
          const dishes = comboDishes.get(c.id) ?? [];
          const r = calculate([{ id: c.id, label: c.name, headcount: REF_PEOPLE, dishes }], data.dishes, data.ingredients, expenses, {
            defaultWastagePct: s.wastagePct,
            rounding: s.rounding,
            marginPct: s.marginPct,
            priceRoundRupees: s.priceRoundRupees,
            gstPct: 0,
          });
          return { c, dishes, r };
        }),
    [combos, comboDishes, data, expenses, s],
  );

  return (
    <>
      <PageTitle title={t.combos.title} back="/more/" />
      <p className="mb-3 text-sm text-muted">{f(t.dishes.batchShort, { n: REF_PEOPLE })} · {t.calc.otherExpenses} சேர்த்து</p>
      {list.length === 0 ? (
        <Empty icon="combo">{t.common.noItems}</Empty>
      ) : (
        <ul className="space-y-3">
          {list.map(({ c, dishes, r }) => (
            <li key={c.id}>
              <Link href={`/combos/edit/?id=${c.id}`} className="card block p-4 active:opacity-80">
                <div className="flex items-start gap-2">
                  <h2 className="flex-1 text-lg font-bold">{c.name}</h2>
                  <Badge tone="brand">{t.meals[c.meal]}</Badge>
                </div>
                <p className="mt-1 text-[15px] text-muted">{dishes.map((d) => dishMap.get(d.dishId)?.name_ta).filter(Boolean).join(" · ")}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-app p-2">
                    <div className="text-sm text-muted">{t.combos.costPerPerson}</div>
                    <div className="text-xl font-bold tabular-nums">{money(r.perPlateCostPaise)}</div>
                  </div>
                  <div className="rounded-xl bg-green-50 p-2 dark:bg-green-950/40">
                    <div className="text-sm text-muted">{t.combos.suggested}</div>
                    <div className="text-xl font-bold text-good tabular-nums">{money(r.suggestedPerPlatePaise)}</div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <FAB href="/combos/edit/" label={t.combos.new} />
    </>
  );
}

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
      {/* primary action */}
      <Link href="/calculator/" className="group flex items-center gap-4 rounded-2xl bg-accent p-5 text-on-accent transition-colors hover:bg-accent-hover md:p-6">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
          <Icon name="calc" size={26} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-semibold">{t.simple.calcButton}</span>
          <span className="block text-[15px] text-white/80">{t.simple.calcHint}</span>
        </span>
        <Icon name="right" className="shrink-0 opacity-80 transition-transform group-hover:translate-x-0.5" />
      </Link>

      {/* dishes */}
      <div className="mt-8 mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="t-title">{t.nav.home}</h1>
          <p className="t-caption">{f(t.simple.dishCount, { n: dishes.length })}</p>
        </div>
        <LinkButton href="/dishes/edit/" variant="secondary" icon="plus" className="whitespace-nowrap">
          {t.simple.newDish}
        </LinkButton>
      </div>

      {dishes.length > 6 && (
        <div className="mb-4 md:max-w-sm">
          <SearchBox value={q} onChange={setQ} />
        </div>
      )}

      {dishes.length === 0 ? (
        <GettingStarted />
      ) : list.length === 0 ? (
        <Empty icon="dish">{t.common.noItems}</Empty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {list.map(({ d, cost }) => (
            <li key={d.id}>
              <Link href={`/dishes/edit/?id=${d.id}`} className="card flex h-full items-center gap-3 p-4 transition-colors hover:border-line-strong md:p-5">
                <div className="min-w-0 flex-1">
                  <div className="t-heading">{d.name_ta}</div>
                  <div className="t-caption">{f(t.simple.forPeople, { n: d.batch_size })}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="t-amount">{money(cost)}</div>
                  <div className="text-sm font-medium text-accent-ink">{t.simple.edit} ›</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function GettingStarted() {
  const steps = [
    { n: 1, title: t.simple.start1, body: t.simple.start1b },
    { n: 2, title: t.simple.start2, body: t.simple.start2b },
    { n: 3, title: t.simple.start3, body: t.simple.start3b },
  ];
  return (
    <section className="card p-5 md:p-6">
      <h2 className="t-heading mb-4">{t.simple.startTitle}</h2>
      <ol className="space-y-4">
        {steps.map((s) => (
          <li key={s.n} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-ink">{s.n}</span>
            <span>
              <span className="block font-medium">{s.title}</span>
              <span className="t-caption block">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>
      <LinkButton href="/dishes/edit/" icon="plus" className="mt-5 w-full md:w-auto">
        {t.simple.addFirstDish}
      </LinkButton>
    </section>
  );
}

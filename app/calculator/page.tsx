"use client";
import { useEffect, useMemo, useState } from "react";
import { Button, Icon } from "@/components/ui";
import { NumberStepper } from "@/components/mobile";
import { useTable } from "@/lib/db";
import { useCalcData } from "@/lib/calc-data";
import { scaleOrder } from "@/lib/simple";
import { useSettings } from "@/lib/settings";
import { formatQty } from "@/lib/units";
import { money, moneyShort } from "@/lib/format";
import type { IngredientLine } from "@/lib/calc";
import { f, t } from "@/lib/i18n";

const QUICK = [50, 100, 200, 300, 400, 500];
const KEY = "scc_calc";

export default function CalculatorPage() {
  const dishes = useTable("dishes");
  const data = useCalcData();
  const settings = useSettings();
  const [people, setPeople] = useState(100);
  const [selected, setSelected] = useState<string[]>([]);
  const [view, setView] = useState<"dish" | "all">("dish");

  // remember the last calculation (e.g. if a call comes in)
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (s) {
        setPeople(s.people ?? 100);
        setSelected(s.selected ?? []);
      }
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify({ people, selected }));
  }, [people, selected]);

  const sorted = useMemo(() => [...dishes].sort((a, b) => a.name_ta.localeCompare(b.name_ta, "ta")), [dishes]);
  const chosen = sorted.filter((d) => selected.includes(d.id));
  const result = useMemo(() => scaleOrder(chosen.map((d) => data.dishes.get(d.id)!).filter(Boolean), people, data.ingredients), [chosen, people, data]);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const share = () => {
    const L = [`*${settings.businessName}*`, `*${f(t.simple.orderFor, { n: people })}*`, chosen.map((d) => d.name_ta).join(", "), ""];
    for (const l of result.combined) L.push(`▢ ${l.name} – ${formatQty(l.purchaseQty, l.unit)}`);
    L.push("", `${t.simple.total}: ${money(result.totalPaise)}`, `${t.simple.perPerson}: ${money(result.perPersonPaise)}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(L.join("\n"))}`, "_blank", "noopener");
  };

  return (
    <>
      <h1 className="mb-3 text-[22px] font-bold">{t.simple.calcButton}</h1>

      {/* 1. people */}
      <Step n={1} text={t.simple.people} />
      <NumberStepper big label={t.simple.people} value={people} step={10} min={0} max={20000} onChange={setPeople} />
      <div className="mt-2 grid grid-cols-6 gap-1.5">
        {QUICK.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setPeople(n)}
            className={`h-12 rounded-xl border-2 text-base font-bold tabular-nums ${people === n ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-card"}`}
          >
            {n}
          </button>
        ))}
      </div>

      {/* 2. dishes */}
      <div className="mt-6">
        <Step n={2} text={t.simple.pickDishes} />
        <div className="-mt-1 mb-2 flex gap-2">
          <Button variant="ghost" className="px-3" onClick={() => setSelected(sorted.map((d) => d.id))}>
            {t.simple.selectAll}
          </Button>
          {selected.length > 0 && (
            <Button variant="ghost" className="px-3" onClick={() => setSelected([])}>
              {t.simple.clear}
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {sorted.map((d) => {
          const on = selected.includes(d.id);
          return (
            <button
              key={d.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(d.id)}
              className={`flex min-h-14 items-center gap-2 rounded-xl border-2 px-3 text-left text-[17px] font-bold ${on ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-card"}`}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${on ? "border-white" : "border-gray-400"}`}>{on && <Icon name="check" size={18} />}</span>
              <span className="min-w-0">{d.name_ta}</span>
            </button>
          );
        })}
      </div>

      {/* 3. result */}
      <div className="mt-6">
        <Step n={3} text={f(t.simple.orderFor, { n: people })} />
      </div>
      {chosen.length === 0 ? (
        <p className="card p-5 text-center text-lg text-muted">{t.simple.noDishSelected}</p>
      ) : (
        <>
          <div className="card p-4">
            <div className="text-[15px] text-muted">{t.simple.total}</div>
            <div className="text-[34px] leading-tight font-bold tabular-nums">{money(result.totalPaise)}</div>
            <div className="mt-1 flex items-baseline gap-2 border-t border-line pt-2">
              <span className="text-[15px] text-muted">{t.simple.perPerson}</span>
              <span className="text-2xl font-bold tabular-nums">{money(result.perPersonPaise)}</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 rounded-xl border-2 border-brand-600 p-0.5" role="tablist">
            {(["dish", "all"] as const).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`h-12 rounded-lg px-1 text-base font-bold whitespace-nowrap ${view === v ? "bg-brand-600 text-white" : ""}`}>
                {v === "dish" ? t.simple.byDish : t.simple.combined}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-3">
            {view === "dish" ? (
              result.dishes.map((r) => (
                <section key={r.dish.id} className="card overflow-hidden">
                  <div className="flex items-center justify-between gap-2 bg-brand-50 px-4 py-2 dark:bg-brand-900">
                    <h2 className="text-lg font-bold">{r.dish.name}</h2>
                    <span className="text-lg font-bold tabular-nums">{money(r.costPaise)}</span>
                  </div>
                  <Lines lines={r.lines} />
                </section>
              ))
            ) : (
              <section className="card overflow-hidden">
                <Lines lines={result.combined} />
                <div className="flex justify-between border-t-2 border-line px-4 py-3 text-lg font-bold">
                  <span>{t.simple.total}</span>
                  <span className="tabular-nums">{money(result.totalPaise)}</span>
                </div>
              </section>
            )}
          </div>

          <Button full variant="good" icon="whatsapp" className="mt-4 h-14 text-lg" onClick={share}>
            {t.simple.shareWa}
          </Button>
        </>
      )}
    </>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 font-bold text-white">{n}</span>
      <h2 className="text-lg font-bold">{text}</h2>
    </div>
  );
}

function Lines({ lines }: { lines: IngredientLine[] }) {
  return (
    <ul className="divide-y divide-[var(--line)]">
      {lines.map((l) => (
        <li key={l.ingredientId} className="flex items-center gap-3 px-4 py-2.5">
          <span className="min-w-0 flex-1 text-[17px] font-semibold">{l.name}</span>
          <span className="shrink-0 text-right">
            <span className="block text-lg leading-tight font-bold tabular-nums">{formatQty(l.purchaseQty, l.unit)}</span>
            <span className={`block text-sm tabular-nums ${l.pricePaise ? "text-muted" : "text-bad"}`}>{l.pricePaise ? moneyShort(l.costPaise) : t.simple.noPrice}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

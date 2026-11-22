"use client";
import { useEffect, useMemo, useState } from "react";
import { Button, Icon, PageTitle } from "@/components/ui";
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
      <PageTitle title={t.simple.calcButton} subtitle={t.simple.calcHint} />

      <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start lg:gap-8">
        {/* inputs */}
        <div className="space-y-4">
          <section className="card p-4 md:p-6">
            <Step n={1} text={t.simple.people} />
            <NumberStepper big label={t.simple.people} value={people} step={10} min={0} max={20000} onChange={setPeople} />
            <div className="mt-3 grid grid-cols-6 gap-1.5">
              {QUICK.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPeople(n)}
                  className={`h-11 rounded-lg border text-[15px] font-medium tabular-nums transition-colors ${people === n ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-surface hover:bg-surface-2"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </section>

          <section className="card p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-x-2">
              <Step n={2} text={t.simple.pickDishes} />
              <div className="-mt-3 mb-2 flex gap-1">
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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
              {sorted.map((d) => {
                const on = selected.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(d.id)}
                    className={`flex min-h-12 items-center gap-2.5 rounded-xl border px-3 text-left text-[15px] font-medium transition-colors ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line-strong bg-surface hover:bg-surface-2"}`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${on ? "border-accent bg-accent text-on-accent" : "border-line-strong"}`}>{on && <Icon name="check" size={14} />}</span>
                    <span className="min-w-0">{d.name_ta}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* result */}
        <div className="mt-4 lg:sticky lg:top-24 lg:mt-0">
          <section className="card p-3 sm:p-4 md:p-6">
            <Step n={3} text={f(t.simple.orderFor, { n: people })} />
            {chosen.length === 0 ? (
              <p className="t-caption rounded-xl bg-surface-2 p-6 text-center">{t.simple.noDishSelected}</p>
            ) : (
              <>
                <div className="grid grid-cols-[1.4fr_1fr] gap-3">
                  <div className="rounded-xl bg-accent-soft p-4">
                    <div className="t-label text-accent-ink">{t.simple.total}</div>
                    <div className="t-figure mt-1 text-accent-ink">{moneyShort(result.totalPaise)}</div>
                  </div>
                  <div className="rounded-xl bg-surface-2 p-4">
                    <div className="t-label">{t.simple.perPerson}</div>
                    <div className="t-figure mt-1">{money(result.perPersonPaise)}</div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 rounded-xl bg-surface-2 p-1" role="tablist">
                  {(["dish", "all"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      role="tab"
                      aria-selected={view === v}
                      onClick={() => setView(v)}
                      className={`h-11 rounded-lg px-1 text-sm font-medium whitespace-nowrap transition-colors sm:text-[15px] ${view === v ? "border border-line bg-surface text-ink" : "text-muted"}`}
                    >
                      {v === "dish" ? t.simple.byDish : t.simple.combined}
                    </button>
                  ))}
                </div>

                <div className="mt-4 space-y-4">
                  {view === "dish" ? (
                    result.dishes.map((r) => (
                      <div key={r.dish.id} className="overflow-hidden rounded-xl border border-line">
                        <div className="flex items-center justify-between gap-2 border-b border-line bg-surface-2 px-3 py-2.5 sm:px-4">
                          <h3 className="t-heading">{r.dish.name}</h3>
                          <span className="t-amount">{money(r.costPaise)}</span>
                        </div>
                        <Lines lines={r.lines} />
                      </div>
                    ))
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-line">
                      <Lines lines={result.combined} />
                      <div className="flex justify-between border-t border-line bg-surface-2 px-3 py-3 sm:px-4">
                        <span className="t-heading">{t.simple.total}</span>
                        <span className="t-amount">{money(result.totalPaise)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <Button full variant="secondary" icon="whatsapp" className="mt-5" onClick={share}>
                  {t.simple.shareWa}
                </Button>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-ink">{n}</span>
      <h2 className="t-heading">{text}</h2>
    </div>
  );
}

function Lines({ lines }: { lines: IngredientLine[] }) {
  return (
    <ul className="divide-y divide-line">
      {lines.map((l) => (
        <li key={l.ingredientId} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
          <span className="min-w-0 flex-1">{l.name}</span>
          <span className="shrink-0 text-right sm:flex sm:items-baseline sm:gap-4">
            <span className="block font-semibold tabular-nums">{formatQty(l.purchaseQty, l.unit)}</span>
            <span className={`block text-sm tabular-nums sm:w-20 ${l.pricePaise ? "text-muted" : "text-danger"}`}>{l.pricePaise ? moneyShort(l.costPaise) : t.simple.noPrice}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge, Button, Chips, Field, Icon, IconButton, Money, NumberInput, PageTitle, Toggle, toast } from "@/components/ui";
import { BottomSheet } from "@/components/mobile";
import { getRow, newId, save, update, useRowMap, useTable } from "@/lib/db";
import { CALC_DRAFT_KEY, emptyCalc, useCalcResult, type CalcState } from "@/lib/calc-state";
import { useDraft } from "@/lib/draft";
import { setIngredientPrice } from "@/lib/actions";
import { useSettings } from "@/lib/settings";
import { openWhatsApp, shoppingListText } from "@/lib/share";
import type { IngredientLine } from "@/lib/calc";
import { CATEGORIES, type ShoppingCheck } from "@/lib/types";
import { clean, formatQty, practicalRound } from "@/lib/units";
import { addDays, dmy, isoDate, money, paiseToInput, rupeesToPaise } from "@/lib/format";
import { f, t } from "@/lib/i18n";

export default function ShoppingListPage() {
  return (
    <Suspense>
      <ShoppingRouter />
    </Suspense>
  );
}

function ShoppingRouter() {
  const p = useSearchParams();
  if (p.get("src") === "calc") return <FromCalc />;
  if (p.get("order")) return <FromOrder orderId={p.get("order")!} />;
  return <FromDate date={p.get("date") ?? isoDate()} />;
}

function FromCalc() {
  const { value } = useDraft<CalcState>(CALC_DRAFT_KEY, emptyCalc);
  const { result } = useCalcResult(value);
  return <ShoppingList listKey="calc" lines={result.lines} subtitle={`${t.shopping.fromCalc} · ${result.plates} ${t.common.people}`} back="/calculator/" />;
}

function FromOrder({ orderId }: { orderId: string }) {
  const order = useRowMap("orders").get(orderId);
  const snaps = useTable("order_cost_snapshot");
  const snap = snaps.find((s) => s.order_id === orderId);
  return (
    <ShoppingList
      listKey={`order:${orderId}`}
      lines={snap?.lines ?? []}
      subtitle={order ? `${order.customer_name} · ${dmy(order.event_date)}` : ""}
      back={`/orders/view/?id=${orderId}`}
      orderId={orderId}
    />
  );
}

function FromDate({ date }: { date: string }) {
  const router = useRouter();
  const orders = useTable("orders");
  const snaps = useTable("order_cost_snapshot");
  const s = useSettings();
  const dayOrders = orders.filter((o) => o.event_date === date && o.status !== "cancelled");
  const lines = useMemo(() => {
    const ids = new Set(dayOrders.map((o) => o.id));
    const acc = new Map<string, IngredientLine>();
    for (const sn of snaps) {
      if (!ids.has(sn.order_id)) continue;
      for (const l of sn.lines) {
        const cur = acc.get(l.ingredientId);
        if (!cur) acc.set(l.ingredientId, { ...l, dishNames: [...l.dishNames] });
        else {
          cur.exactQty = clean(cur.exactQty + l.exactQty);
          cur.dishNames = [...new Set([...cur.dishNames, ...l.dishNames])];
        }
      }
    }
    // re-round the combined quantity once, so two orders don't each round up
    return [...acc.values()].map((l) => {
      const purchaseQty = practicalRound(l.exactQty, l.unit, s.rounding);
      return { ...l, purchaseQty, costPaise: Math.round(purchaseQty * l.pricePaise) };
    });
  }, [dayOrders, snaps, s.rounding]);

  const today = isoDate();
  return (
    <>
      <div className="mb-2 flex items-center gap-2">
        <Chips
          className="flex-1"
          options={[
            { value: today, label: t.common.today },
            { value: addDays(today, 1), label: t.common.tomorrow },
            ...(date !== today && date !== addDays(today, 1) ? [{ value: date, label: dmy(date) }] : []),
          ]}
          value={date}
          onChange={(d) => router.replace(`/shopping-list/?date=${d}`)}
        />
        <input
          type="date"
          aria-label={t.shopping.pickDate}
          value={date}
          onChange={(e) => e.target.value && router.replace(`/shopping-list/?date=${e.target.value}`)}
          className="tap w-14 shrink-0 rounded-xl border-2 border-line bg-card px-1 text-sm"
        />
      </div>
      <ShoppingList
        listKey={`date:${date}`}
        lines={lines}
        subtitle={`${t.shopping.forDate} · ${dmy(date)} · ${dayOrders.length} ${t.nav.orders}`}
        back="/"
        extra={
          dayOrders.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {dayOrders.map((o) => (
                <Link key={o.id} href={`/orders/view/?id=${o.id}`} className="inline-flex h-10 items-center rounded-full border border-line bg-card px-3 text-sm font-semibold">
                  {o.customer_name}
                </Link>
              ))}
            </div>
          )
        }
        emptyHint={
          <Link href="/calculator/" className="font-bold text-brand-600 underline">
            {t.calc.title} →
          </Link>
        }
      />
    </>
  );
}

// ------------------------------------------------------------------ the list itself
function ShoppingList({
  listKey,
  lines,
  subtitle,
  back,
  orderId,
  extra,
  emptyHint,
}: {
  listKey: string;
  lines: IngredientLine[];
  subtitle: string;
  back: string;
  orderId?: string;
  extra?: React.ReactNode;
  emptyHint?: React.ReactNode;
}) {
  const settings = useSettings();
  const allChecks = useTable("shopping_list_checks");
  const ingMap = useRowMap("ingredients");
  const [groupBy, setGroupBy] = useState<"category" | "shop">("category");
  const [paying, setPaying] = useState<IngredientLine | null>(null);
  const awake = useWakeLock();

  const checks = useMemo(() => {
    const m = new Map<string, ShoppingCheck>();
    for (const c of allChecks) if (c.list_key === listKey) m.set(c.ingredient_id, c);
    return m;
  }, [allChecks, listKey]);

  const toggle = (l: IngredientLine) => {
    const c = checks.get(l.ingredientId);
    if (c) update("shopping_list_checks", c.id, { checked: !c.checked });
    else save("shopping_list_checks", { id: newId(), list_key: listKey, ingredient_id: l.ingredientId, checked: true, paid_paise: null });
    if ("vibrate" in navigator) navigator.vibrate?.(15);
  };

  const groups = useMemo(() => {
    const keyOf = (l: IngredientLine) => (groupBy === "category" ? l.category : ingMap.get(l.ingredientId)?.shop || l.shop || "");
    const order = groupBy === "category" ? [...CATEGORIES] : [...new Set(lines.map(keyOf))].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
    return order
      .map((k) => ({
        key: k as string,
        label: groupBy === "category" ? t.categories[k as keyof typeof t.categories] : k || t.shopping.noShop,
        // ticked items sink to the bottom
        items: lines.filter((l) => keyOf(l) === k).sort((a, b) => Number(!!checks.get(a.ingredientId)?.checked) - Number(!!checks.get(b.ingredientId)?.checked) || a.name.localeCompare(b.name, "ta")),
      }))
      .filter((g) => g.items.length);
  }, [lines, groupBy, checks, ingMap]);

  const remaining = lines.filter((l) => !checks.get(l.ingredientId)?.checked).length;
  const estimated = lines.reduce((n, l) => n + l.costPaise, 0);
  const paidTotal = lines.reduce((n, l) => n + (checks.get(l.ingredientId)?.paid_paise ?? 0), 0);
  const order = getRow("orders", orderId);

  return (
    <>
      <PageTitle
        title={t.shopping.title}
        back={back}
        right={<IconButton icon="print" label={t.common.print} onClick={() => window.print()} className="no-print" />}
      />
      <p className="-mt-2 mb-2 text-[15px] text-muted">{subtitle}</p>
      {extra}

      {lines.length === 0 ? (
        <div className="card p-6 text-center text-muted">
          <p>{t.shopping.empty}</p>
          <div className="mt-3">{emptyHint}</div>
        </div>
      ) : (
        <>
          <div className="no-print sticky top-14 z-20 -mx-4 mb-2 flex items-center gap-2 bg-app px-4 py-2">
            <div className="flex-1">
              {remaining === 0 ? <Badge tone="good">✓ {t.shopping.allDone}</Badge> : <Badge tone="soon">{f(t.shopping.remaining, { n: remaining })}</Badge>}
              {awake && <span className="ml-2 text-xs text-muted">☀ {t.shopping.screenAwake}</span>}
            </div>
            <div className="flex rounded-xl border-2 border-line p-0.5 text-sm">
              {(["category", "shop"] as const).map((g) => (
                <button key={g} type="button" onClick={() => setGroupBy(g)} className={`h-10 rounded-lg px-3 font-semibold ${groupBy === g ? "bg-brand-600 text-white" : ""}`}>
                  {g === "category" ? t.shopping.byCategory : t.shopping.byShop}
                </button>
              ))}
            </div>
          </div>
          <p className="no-print mb-2 text-sm text-muted">{t.shopping.swipeHint}</p>

          <div className="space-y-4">
            {groups.map((g) => (
              <section key={g.key}>
                <h2 className="mb-1 px-1 font-bold text-muted">{g.label}</h2>
                <ul className="card divide-y divide-[var(--line)] overflow-hidden">
                  {g.items.map((l) => (
                    <SwipeRow key={l.ingredientId} line={l} check={checks.get(l.ingredientId)} onToggle={() => toggle(l)} onPay={() => setPaying(l)} />
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="card mt-4 space-y-1 p-4 text-[17px]">
            <div className="flex justify-between">
              <span className="text-muted">{t.shopping.estimated}</span>
              <Money paise={estimated} className="font-bold" />
            </div>
            {paidTotal > 0 && (
              <div className="flex justify-between">
                <span className="text-muted">{t.shopping.actualTotal}</span>
                <Money paise={paidTotal} className={`font-bold ${paidTotal > estimated ? "text-bad" : "text-good"}`} />
              </div>
            )}
            {order && paidTotal > 0 && (
              <Button
                full
                variant="secondary"
                className="mt-2"
                onClick={() => {
                  update("orders", order.id, { actual_cost_paise: paidTotal + Number(order.expense_cost_paise) });
                  toast(t.common.saved);
                }}
              >
                {t.shopping.saveActual}
              </Button>
            )}
          </div>

          <div className="no-print mt-4 grid grid-cols-2 gap-2">
            <Button variant="good" icon="whatsapp" className="h-14" onClick={() => openWhatsApp(shoppingListText(settings.businessName, lines, subtitle))}>
              {t.common.whatsapp}
            </Button>
            <Button
              variant="secondary"
              className="h-14"
              onClick={() => {
                if (!confirm(`${t.shopping.untick}?`)) return;
                for (const c of checks.values()) if (c.checked) update("shopping_list_checks", c.id, { checked: false });
              }}
            >
              {t.shopping.untick}
            </Button>
          </div>
        </>
      )}

      {paying && <PaySheet line={paying} check={checks.get(paying.ingredientId)} listKey={listKey} onClose={() => setPaying(null)} />}
    </>
  );
}

/** Tap the row to tick, or swipe it right. The ₹ button records what was actually paid. */
function SwipeRow({ line: l, check, onToggle, onPay }: { line: IngredientLine; check?: ShoppingCheck; onToggle: () => void; onPay: () => void }) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; swiping: boolean } | null>(null);
  const done = !!check?.checked;

  return (
    <li className="relative overflow-hidden" data-no-ptr>
      {dx > 0 && (
        <div className="absolute inset-y-0 left-0 flex items-center bg-good pl-4 text-white" style={{ width: dx }}>
          {dx > 40 && <Icon name="check" />}
        </div>
      )}
      <div
        className={`relative flex min-h-16 items-center gap-3 bg-card px-3 py-2 transition-opacity ${done ? "opacity-45" : ""}`}
        style={{ transform: `translateX(${dx}px)`, transition: start.current ? "none" : "transform .2s" }}
        onPointerDown={(e) => (start.current = { x: e.clientX, y: e.clientY, swiping: false })}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const mx = e.clientX - s.x;
          if (!s.swiping && Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(e.clientY - s.y)) s.swiping = true;
          if (s.swiping) setDx(Math.max(0, Math.min(140, mx)));
        }}
        onPointerUp={() => {
          const s = start.current;
          start.current = null;
          if (s?.swiping) {
            if (dx > 80) onToggle();
            setDx(0);
          }
        }}
        onPointerCancel={() => {
          start.current = null;
          setDx(0);
        }}
      >
        <button type="button" role="checkbox" aria-checked={done} onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 ${done ? "border-good bg-good text-white" : "border-gray-400"}`}>{done && <Icon name="check" />}</span>
          <span className="min-w-0 flex-1">
            <span className={`block text-[17px] font-bold ${done ? "line-through" : ""}`}>{l.name}</span>
            <span className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-xl font-bold text-brand-700 tabular-nums dark:text-brand-100">{formatQty(l.purchaseQty, l.unit)}</span>
              {check?.paid_paise ? <span className="text-sm font-semibold text-good">₹ {paiseToInput(check.paid_paise)}</span> : null}
            </span>
          </span>
        </button>
        <button type="button" onClick={onPay} aria-label={t.shopping.paid} className="no-print tap flex shrink-0 items-center justify-center rounded-xl border border-line text-lg font-bold text-muted">
          ₹
        </button>
      </div>
    </li>
  );
}

function PaySheet({ line, check, listKey, onClose }: { line: IngredientLine; check?: ShoppingCheck; listKey: string; onClose: () => void }) {
  const [text, setText] = useState(paiseToInput(check?.paid_paise ?? null, true));
  const [updateMaster, setUpdateMaster] = useState(false);
  const paid = rupeesToPaise(text);
  const unitPrice = line.purchaseQty > 0 ? Math.round(paid / line.purchaseQty) : 0;

  const submit = () => {
    if (check) update("shopping_list_checks", check.id, { paid_paise: paid || null, checked: true });
    else save("shopping_list_checks", { id: newId(), list_key: listKey, ingredient_id: line.ingredientId, checked: true, paid_paise: paid || null });
    const ing = getRow("ingredients", line.ingredientId);
    if (updateMaster && ing && unitPrice > 0) setIngredientPrice(ing, unitPrice);
    toast(t.common.saved);
    onClose();
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={`${line.name} – ${formatQty(line.purchaseQty, line.unit)}`}
      footer={
        <Button full className="h-14 text-lg" icon="check" onClick={submit}>
          {t.common.save}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label={t.shopping.paid} hint={`${t.shopping.estimated}: ${money(line.costPaise)}`}>
          <NumberInput autoFocus value={text} onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ""))} className="h-16 text-3xl font-bold" />
        </Field>
        {paid > 0 && (
          <div className="rounded-xl bg-app p-3">
            <Toggle checked={updateMaster} onChange={setUpdateMaster} label={t.shopping.updateMaster} />
            <div className="mt-1 text-sm text-muted">= {money(unitPrice)} / {formatQty(1, line.unit).replace(/^1 /, "")}</div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

/** Keep the screen on while the list is open (where supported). */
function useWakeLock(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        if ("wakeLock" in navigator && document.visibilityState === "visible") {
          lock = await navigator.wakeLock.request("screen");
          setOn(true);
          lock.addEventListener("release", () => setOn(false));
        }
      } catch {
        setOn(false);
      }
    };
    void request();
    const onVis = () => document.visibilityState === "visible" && void request();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release();
    };
  }, []);
  return on;
}

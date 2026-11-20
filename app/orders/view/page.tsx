"use client";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge, Button, Chips, Empty, Field, Icon, IconButton, Money, NumberInput, PageTitle, ProfitText, Section, TextInput, toast } from "@/components/ui";
import { BottomSheet } from "@/components/mobile";
import { IngredientLines } from "@/components/CalcPanels";
import { archive, newId, save, update, useRow, useRowMap, useTable } from "@/lib/db";
import { customerTotal, recalculateOrder } from "@/lib/orders";
import { useSettings } from "@/lib/settings";
import { openWhatsApp, quotationText, shareFile } from "@/lib/share";
import { renderBill, type BillData } from "@/lib/bill-image";
import { addDays, dmy, isoDate, money, paiseToInput, rupeesToPaise } from "@/lib/format";
import { ORDER_STATUSES, PAY_METHODS, type Order, type PayMethod } from "@/lib/types";
import { f, t } from "@/lib/i18n";

export default function OrderViewPage() {
  return (
    <Suspense>
      <OrderView />
    </Suspense>
  );
}

function OrderView() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const order = useRow("orders", id);
  const settings = useSettings();
  const dishMap = useRowMap("dishes");
  const allSessions = useTable("order_sessions");
  const allItems = useTable("order_session_items");
  const allPayments = useTable("payments");
  const snaps = useTable("order_cost_snapshot");
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState(false);

  const sessions = useMemo(
    () =>
      allSessions
        .filter((s) => s.order_id === id)
        .sort((a, b) => a.sort - b.sort)
        .map((s) => ({
          ...s,
          dishes: allItems
            .filter((i) => i.session_id === s.id)
            .sort((a, b) => a.sort - b.sort)
            .map((i) => dishMap.get(i.dish_id)?.name_ta ?? "?"),
        })),
    [allSessions, allItems, dishMap, id],
  );
  const payments = useMemo(() => allPayments.filter((p) => p.order_id === id).sort((a, b) => a.paid_on.localeCompare(b.paid_on)), [allPayments, id]);
  const snap = snaps.find((s) => s.order_id === id);

  if (!order || order.archived) return <Empty icon="orders">{t.orders.noOrders}</Empty>;

  const total = customerTotal(order);
  const paid = payments.reduce((n, p) => n + Number(p.amount_paise), 0);
  const balance = order.status === "cancelled" ? 0 : total - paid;
  const plates = sessions.reduce((n, s) => n + s.headcount, 0);
  const expectedCost = Number(order.ingredient_cost_paise) + Number(order.expense_cost_paise);
  const today = isoDate();
  const when = order.event_date === today ? t.common.today : order.event_date === addDays(today, 1) ? t.common.tomorrow : null;
  const mapUrl = order.venue_map_url || (order.venue ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.venue)}` : null);

  const quoteInfo = () => ({
    businessName: settings.businessName,
    businessPhone: settings.phone,
    customerName: order.customer_name,
    eventDate: order.event_date,
    venue: order.venue,
    sessions: sessions.map((s) => ({ label: t.meals[s.meal], headcount: s.headcount, dishes: s.dishes })),
    result: { pricePerPlatePaise: Number(order.price_per_plate_paise), sellingPricePaise: Number(order.order_amount_paise), gstPaise: Number(order.gst_paise), customerTotalPaise: total, plates },
    paidPaise: paid,
  });

  const billData = (kind: BillData["kind"]): BillData => ({
    kind,
    businessName: settings.businessName,
    businessPhone: settings.phone,
    address: settings.address,
    customerName: order.customer_name,
    phone: order.phone,
    eventType: t.events[order.event_type],
    eventDate: order.event_date,
    eventTime: order.event_time,
    venue: order.venue,
    sessions: sessions.map((s) => ({ label: t.meals[s.meal], headcount: s.headcount, dishes: s.dishes })),
    pricePerPlatePaise: Number(order.price_per_plate_paise),
    plates,
    amountPaise: Number(order.order_amount_paise),
    gstPaise: Number(order.gst_paise),
    gstPct: Number(order.gst_pct),
    payments: payments.map((p) => ({ date: p.paid_on, amountPaise: Number(p.amount_paise), method: t.methods[p.method] })),
  });

  async function shareImage(kind: BillData["kind"]) {
    setBusy(true);
    try {
      const blob = await renderBill(billData(kind));
      const name = `${kind === "bill" ? "bill" : "quotation"}-${order!.customer_name.replace(/\s+/g, "_")}-${order!.event_date}.png`;
      await shareFile(new File([blob], name, { type: "image/png" }), `${settings.businessName} – ${order!.customer_name}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="no-print">
        <PageTitle title={order.customer_name} back="/orders/" right={<IconButton icon="edit" label={t.common.edit} onClick={() => router.push(`/orders/new/?id=${order.id}`)} />} />

        <Chips options={ORDER_STATUSES.map((s) => ({ value: s, label: t.status[s] }))} value={order.status} onChange={(status) => update("orders", order.id, { status })} />

        {/* contact */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <a href={order.phone ? `tel:${order.phone}` : undefined} aria-disabled={!order.phone} className={`tap flex flex-col items-center justify-center rounded-xl bg-card py-2 font-semibold border border-line ${order.phone ? "" : "pointer-events-none opacity-40"}`}>
            <Icon name="phone" />
            {t.common.call}
          </a>
          <button type="button" disabled={!order.phone} onClick={() => openWhatsApp(quotationText(quoteInfo()), order.phone)} className="tap flex flex-col items-center justify-center rounded-xl border border-line bg-card py-2 font-semibold text-good disabled:opacity-40">
            <Icon name="whatsapp" />
            {t.common.whatsapp}
          </button>
          <a href={mapUrl ?? undefined} target="_blank" rel="noopener" className={`tap flex flex-col items-center justify-center rounded-xl border border-line bg-card py-2 font-semibold ${mapUrl ? "" : "pointer-events-none opacity-40"}`}>
            <Icon name="map" />
            {t.common.map}
          </a>
        </div>

        {/* event */}
        <div className="card mt-3 space-y-1 p-4 text-[17px]">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold">
              {dmy(order.event_date)} {order.event_time}
            </span>
            {when && <Badge tone="soon">{when}</Badge>}
          </div>
          <div className="text-muted">
            {t.events[order.event_type]} · {plates} {t.common.people}
            {order.phone && ` · ${order.phone}`}
          </div>
          {order.venue && <div className="break-words">📍 {order.venue}</div>}
          {order.notes && <div className="rounded-lg bg-app p-2 text-[15px]">{order.notes}</div>}
        </div>

        {/* money */}
        <div className="card mt-3 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-sm text-muted">{t.orders.orderAmount}</div>
              <Money paise={total} className="text-2xl font-bold" />
              <div className="text-sm text-muted">
                {plates} × {money(Number(order.price_per_plate_paise))}
              </div>
            </div>
            <div className={`rounded-xl p-2 ${balance > 0 ? "bg-red-50 dark:bg-red-950/30" : "bg-green-50 dark:bg-green-950/30"}`}>
              <div className="text-sm text-muted">{t.orders.balance}</div>
              <Money paise={balance} className={`text-2xl font-bold ${balance > 0 ? "text-bad" : "text-good"}`} />
              <div className="text-sm text-muted">
                {t.orders.paidTotal}: {money(paid)}
              </div>
            </div>
          </div>
          <Button full variant="good" icon="plus" className="mt-3 h-14 text-lg" onClick={() => setPaying(true)}>
            {t.orders.addPayment.replace("+ ", "")}
          </Button>
          {payments.length > 0 && (
            <ul className="mt-3 divide-y divide-[var(--line)] border-t border-line">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center gap-2 py-1">
                  <span className="flex-1 text-[15px]">
                    {dmy(p.paid_on)} · {t.methods[p.method]}
                    {p.note ? ` · ${p.note}` : ""}
                  </span>
                  <Money paise={Number(p.amount_paise)} className="font-bold text-good" />
                  <IconButton icon="x" label={t.common.delete} className="text-muted" onClick={() => confirm(t.common.confirmDelete) && archive("payments", p.id)} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* menu */}
        <Section title={t.orders.menu}>
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="card p-3">
                <div className="flex justify-between font-bold">
                  <span>{t.meals[s.meal]}</span>
                  <span>
                    {s.headcount} {t.common.people}
                  </span>
                </div>
                <div className="text-[15px] text-muted">{s.dishes.join(" · ")}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* cost */}
        <Section title={t.orders.costBreakdown}>
          <div className="card space-y-1 p-4 text-[17px]">
            <KV k={t.calc.ingredientCost} v={<Money paise={Number(order.ingredient_cost_paise)} />} />
            <KV k={t.calc.otherExpenses} v={<Money paise={Number(order.expense_cost_paise)} />} />
            <KV k={t.calc.totalCost} v={<Money paise={expectedCost} className="font-bold" />} />
            <KV k={`${t.orders.expected} ${t.calc.profit}`} v={<ProfitText paise={Number(order.expected_profit_paise)} className="font-bold" />} />
            {snap && <p className="pt-1 text-sm text-muted">{f(t.orders.snapshotNote, { date: dmy(snap.computed_at) })}</p>}
            <Button
              variant="ghost"
              full
              icon="refresh"
              onClick={() => {
                if (!confirm(t.orders.recalcConfirm)) return;
                recalculateOrder(order);
                toast(t.common.saved);
              }}
            >
              {t.orders.recalc}
            </Button>
          </div>
          {snap && snap.lines.length > 0 && (
            <details className="mt-2">
              <summary className="tap flex cursor-pointer items-center gap-2 font-bold">
                <Icon name="down" /> {t.calc.ingredientQty} ({snap.lines.length})
              </summary>
              <div className="mt-2">
                <IngredientLines lines={snap.lines} />
              </div>
            </details>
          )}
        </Section>

        {/* after the event */}
        <Section title={t.orders.afterEvent}>
          <AfterEvent order={order} expectedCost={expectedCost} />
        </Section>

        {/* actions */}
        <Section>
          <div className="grid grid-cols-2 gap-2">
            <Link href={`/shopping-list/?order=${order.id}`} className="tap card col-span-2 flex items-center justify-center gap-2 font-bold text-brand-700 dark:text-brand-100">
              <Icon name="list" /> {t.orders.shoppingList}
            </Link>
            <Button variant="good" icon="whatsapp" onClick={() => openWhatsApp(quotationText(quoteInfo()), order.phone)}>
              {t.orders.quotation}
            </Button>
            <Button variant="secondary" icon="share" disabled={busy} onClick={() => shareImage(paid > 0 || order.status === "completed" ? "bill" : "quotation")}>
              {t.orders.shareImage}
            </Button>
            <Button variant="secondary" icon="print" onClick={() => window.print()}>
              {t.common.print}
            </Button>
            <Button variant="secondary" icon="copy" onClick={() => router.push(`/orders/new/?dup=${order.id}`)}>
              {t.orders.duplicate}
            </Button>
            <Button
              variant="ghost"
              icon="trash"
              className="col-span-2 text-bad"
              onClick={() => {
                if (!confirm(t.common.confirmDelete)) return;
                archive("orders", order.id);
                router.replace("/orders/");
              }}
            >
              {t.common.delete}
            </Button>
          </div>
        </Section>
      </div>

      <PrintBill d={billData(paid > 0 ? "bill" : "quotation")} />
      {paying && <PaymentSheet orderId={order.id} suggested={Math.max(0, balance)} onClose={() => setPaying(false)} />}
    </>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted">{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
}

function AfterEvent({ order, expectedCost }: { order: Order; expectedCost: number }) {
  const [cost, setCost] = useState(paiseToInput(order.actual_cost_paise, true));
  const [count, setCount] = useState(order.final_headcount ? String(order.final_headcount) : "");
  const actualCost = order.actual_cost_paise;
  const actualProfit = actualCost != null ? Number(order.order_amount_paise) - Number(actualCost) : null;
  return (
    <div className="card space-y-3 p-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.orders.actualCost}>
          <NumberInput
            value={cost}
            placeholder={paiseToInput(expectedCost)}
            onChange={(e) => setCost(e.target.value.replace(/[^0-9.]/g, ""))}
            onBlur={() => update("orders", order.id, { actual_cost_paise: cost === "" ? null : rupeesToPaise(cost) })}
          />
        </Field>
        <Field label={t.orders.finalHeadcount}>
          <NumberInput
            decimal={false}
            value={count}
            onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))}
            onBlur={() => update("orders", order.id, { final_headcount: count === "" ? null : Number(count) })}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-app p-2">
          <div className="text-sm text-muted">
            {t.orders.expected} {t.calc.profit}
          </div>
          <ProfitText paise={Number(order.expected_profit_paise)} short className="text-xl font-bold" />
        </div>
        <div className="rounded-xl bg-app p-2">
          <div className="text-sm text-muted">{t.orders.actualProfit}</div>
          {actualProfit === null ? <span className="text-xl text-muted">—</span> : <ProfitText paise={actualProfit} short className="text-xl font-bold" />}
        </div>
      </div>
    </div>
  );
}

function PaymentSheet({ orderId, suggested, onClose }: { orderId: string; suggested: number; onClose: () => void }) {
  const [amount, setAmount] = useState(paiseToInput(suggested, true));
  const [date, setDate] = useState(isoDate());
  const [method, setMethod] = useState<PayMethod>("cash");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    const { paymentSchema } = await import("@/lib/schemas");
    const r = paymentSchema.safeParse({ amount_paise: rupeesToPaise(amount), paid_on: date, method });
    if (!r.success) return setError(r.error.issues[0].message);
    save("payments", { id: newId(), order_id: orderId, ...r.data, note: note.trim() || null });
    toast(t.common.saved);
    onClose();
  };
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={t.orders.addPayment.replace("+ ", "")}
      footer={
        <Button full variant="good" className="h-14 text-lg" icon="check" onClick={submit}>
          {t.common.save}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label={`${t.common.amount} ₹`} error={error}>
          <NumberInput autoFocus value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} className="h-16 text-3xl font-bold" />
        </Field>
        <Chips options={PAY_METHODS.map((m) => ({ value: m, label: t.methods[m] }))} value={method} onChange={setMethod} />
        <Field label={t.common.date}>
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={`${t.common.notes} ${t.common.optional}`}>
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </BottomSheet>
  );
}

/** Clean A4 bill used by the browser's "Print / Save as PDF". */
function PrintBill({ d }: { d: BillData }) {
  const total = d.amountPaise + d.gstPaise;
  const paid = d.payments.reduce((n, p) => n + p.amountPaise, 0);
  return (
    <div className="print-only text-[14pt]">
      <div className="border-b-4 border-[#9a3412] pb-2 text-center">
        <h1 className="text-[24pt] font-bold text-[#9a3412]">{d.businessName}</h1>
        <div>{[d.businessPhone, d.address].filter(Boolean).join(" · ")}</div>
      </div>
      <h2 className="my-3 text-center text-[18pt] font-bold">{d.kind === "bill" ? t.orders.bill : t.orders.quotation}</h2>
      <table className="w-full">
        <tbody>
          <tr><td>{t.orders.customer}</td><td className="font-bold">{d.customerName} {d.phone && `(${d.phone})`}</td></tr>
          <tr><td>{t.orders.eventType}</td><td>{d.eventType}</td></tr>
          <tr><td>{t.orders.eventDate}</td><td>{dmy(d.eventDate)} {d.eventTime}</td></tr>
          {d.venue && <tr><td>{t.orders.venue}</td><td>{d.venue}</td></tr>}
        </tbody>
      </table>
      {d.sessions.map((s, i) => (
        <div key={i} className="mt-3">
          <b>{s.label} – {s.headcount} {t.common.people}</b>
          <div>{s.dishes.join(", ")}</div>
        </div>
      ))}
      <table className="mt-4 w-full border-t-2 border-black">
        <tbody>
          <tr><td>{t.common.total} ({d.plates} × {money(d.pricePerPlatePaise)})</td><td className="text-right">{money(d.amountPaise)}</td></tr>
          {d.gstPaise > 0 && <tr><td>GST {d.gstPct}%</td><td className="text-right">{money(d.gstPaise)}</td></tr>}
          <tr className="font-bold"><td>{t.calc.customerTotal}</td><td className="text-right">{money(total)}</td></tr>
          {d.payments.map((p, i) => (
            <tr key={i}><td>{dmy(p.date)} · {p.method}</td><td className="text-right">− {money(p.amountPaise)}</td></tr>
          ))}
          {paid > 0 && <tr className="font-bold"><td>{t.orders.balance}</td><td className="text-right">{money(total - paid)}</td></tr>}
        </tbody>
      </table>
      <p className="mt-6 text-center font-bold">{t.orders.thanks}</p>
    </div>
  );
}

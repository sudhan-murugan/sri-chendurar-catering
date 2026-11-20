"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Badge, Chips, Icon, LinkButton, Money, ProfitText, Section } from "@/components/ui";
import { FAB } from "@/components/mobile";
import { OrderCard } from "@/components/OrderCard";
import { useRowMap, useTable } from "@/lib/db";
import { balanceOf, usePaidByOrder, usePlatesByOrder } from "@/lib/orders";
import { addDays, isoDate, monthLabel, moneyShort } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { Order } from "@/lib/types";

const MonthlyChart = dynamic(() => import("@/components/DashboardCharts").then((m) => m.MonthlyChart), { ssr: false, loading: () => <div className="skeleton h-64" /> });
const TopDishesChart = dynamic(() => import("@/components/DashboardCharts").then((m) => m.TopDishesChart), { ssr: false, loading: () => <div className="skeleton h-48" /> });

type Period = "thisMonth" | "lastMonth" | "thisYear" | "custom";

function periodRange(p: Period, from: string, to: string): [string, string] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (p === "thisMonth") return [isoDate(new Date(y, m, 1)), isoDate(new Date(y, m + 1, 0))];
  if (p === "lastMonth") return [isoDate(new Date(y, m - 1, 1)), isoDate(new Date(y, m, 0))];
  if (p === "thisYear") return [`${y}-01-01`, `${y}-12-31`];
  return [from || "0000-01-01", to || "9999-12-31"];
}

/** Revenue = order amount before GST. Expense = actual cost if entered, else the expected cost. */
const revenueOf = (o: Order) => Number(o.order_amount_paise);
const costOf = (o: Order) => (o.actual_cost_paise != null ? Number(o.actual_cost_paise) : Number(o.ingredient_cost_paise) + Number(o.expense_cost_paise));
const counts = (o: Order) => o.status === "confirmed" || o.status === "completed";

export default function Dashboard() {
  const orders = useTable("orders");
  const items = useTable("order_session_items");
  const dishMap = useRowMap("dishes");
  const paid = usePaidByOrder();
  const plates = usePlatesByOrder();
  const [period, setPeriod] = useState<Period>("thisMonth");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [upcomingDays, setUpcomingDays] = useState<"7" | "30">("7");
  const today = isoDate();
  const tomorrow = addDays(today, 1);

  const d = useMemo(() => {
    const [start, end] = periodRange(period, from, to);
    const inPeriod = orders.filter((o) => counts(o) && o.event_date >= start && o.event_date <= end);
    const revenue = inPeriod.reduce((n, o) => n + revenueOf(o), 0);
    const expense = inPeriod.reduce((n, o) => n + costOf(o), 0);
    const pending = orders.filter((o) => o.status !== "enquiry" && balanceOf(o, paid.get(o.id) ?? 0) > 0).sort((a, b) => a.event_date.localeCompare(b.event_date));
    const pendingTotal = pending.reduce((n, o) => n + balanceOf(o, paid.get(o.id) ?? 0), 0);
    const soon = orders.filter((o) => o.event_date === today || o.event_date === tomorrow).filter((o) => o.status !== "cancelled").sort((a, b) => a.event_date.localeCompare(b.event_date));
    const upEnd = addDays(today, Number(upcomingDays));
    const upcoming = orders.filter((o) => o.event_date > tomorrow && o.event_date <= upEnd && (o.status === "confirmed" || o.status === "enquiry")).sort((a, b) => a.event_date.localeCompare(b.event_date));
    const completed = inPeriod.filter((o) => o.status === "completed").length;

    // top dishes: number of orders (in period) that included the dish
    const ids = new Set(inPeriod.map((o) => o.id));
    const dishOrders = new Map<string, Set<string>>();
    for (const i of items) if (ids.has(i.order_id)) dishOrders.set(i.dish_id, (dishOrders.get(i.dish_id) ?? new Set()).add(i.order_id));
    const top = [...dishOrders.entries()]
      .map(([id, s]) => ({ name: dishMap.get(id)?.name_ta ?? "?", count: s.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // monthly: months in range (max 12, ending at range end or this month)
    const months = new Map<string, { revenue: number; expense: number }>();
    const endDate = period === "custom" && to ? new Date(to) : period === "lastMonth" ? new Date(start) : new Date(end > today ? today : end);
    const firstMonth = period === "thisYear" ? `${start.slice(0, 7)}` : isoDate(new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1)).slice(0, 7);
    for (let i = 0; i < 12; i++) {
      const dt = new Date(endDate.getFullYear(), endDate.getMonth() - 11 + i, 1);
      const ym = isoDate(dt).slice(0, 7);
      if (ym >= firstMonth) months.set(ym, { revenue: 0, expense: 0 });
    }
    for (const o of orders) {
      if (!counts(o)) continue;
      const m = months.get(o.event_date.slice(0, 7));
      if (m) {
        m.revenue += revenueOf(o);
        m.expense += costOf(o);
      }
    }
    const monthly = [...months.entries()].map(([ym, v]) => ({ month: monthLabel(ym), revenue: v.revenue, expense: v.expense, profit: v.revenue - v.expense }));
    return { inPeriod, revenue, expense, pending, pendingTotal, soon, upcoming, completed, top, monthly };
  }, [orders, items, dishMap, paid, period, from, to, upcomingDays, today, tomorrow]);

  return (
    <>
      <h1 className="sr-only">{t.dashboard.title}</h1>

      {/* 1. today / tomorrow */}
      <section className="card overflow-hidden">
        <div className="flex items-center gap-2 bg-orange-50 px-4 py-2 dark:bg-orange-950/40">
          <Icon name="calendar" className="text-soon" />
          <h2 className="flex-1 font-bold">{t.dashboard.todayTomorrow}</h2>
        </div>
        {d.soon.length === 0 ? (
          <p className="px-4 py-4 text-muted">{t.dashboard.noEvents}</p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {d.soon.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/view/?id=${o.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2 active:bg-black/5">
                  <Badge tone="soon">{o.event_date === today ? t.common.today : t.common.tomorrow}</Badge>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold break-words">{o.customer_name}</span>
                    <span className="block text-sm text-muted">
                      {plates.get(o.id) ?? 0} {t.common.people} {o.event_time && `· ${o.event_time}`}
                    </span>
                  </span>
                  <Icon name="right" className="text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-2 gap-2 border-t border-line p-2">
          <LinkButton href={`/shopping-list/?date=${d.soon[0]?.event_date ?? today}`} variant="secondary" icon="list" className="px-2 text-[15px]">
            {t.calc.list}
          </LinkButton>
          <LinkButton href="/calculator/" icon="calc" className="px-2 text-[15px]">
            {t.dashboard.quickCalc}
          </LinkButton>
        </div>
      </section>

      {/* period */}
      <div className="mt-5">
        <Chips
          options={[
            { value: "thisMonth" as Period, label: t.dashboard.thisMonth },
            { value: "lastMonth" as Period, label: t.dashboard.lastMonth },
            { value: "thisYear" as Period, label: t.dashboard.thisYear },
            { value: "custom" as Period, label: t.dashboard.custom },
          ]}
          value={period}
          onChange={setPeriod}
        />
        {period === "custom" && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-sm font-semibold">
              {t.dashboard.from}
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="tap mt-1 w-full rounded-xl border-2 border-line bg-card px-2" />
            </label>
            <label className="text-sm font-semibold">
              {t.dashboard.to}
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="tap mt-1 w-full rounded-xl border-2 border-line bg-card px-2" />
            </label>
          </div>
        )}
      </div>

      {/* 2. stats */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <StatTile label={t.dashboard.totalOrders} value={<span className="tabular-nums">{d.inPeriod.length}</span>} icon="orders" />
        <StatTile label={t.dashboard.revenue} value={<Money paise={d.revenue} short />} icon="rupee" />
        <StatTile label={t.dashboard.expense} value={<Money paise={d.expense} short />} icon="wallet" />
        <StatTile label={t.dashboard.profit} value={<ProfitText paise={d.revenue - d.expense} short />} icon="rupee" tone={d.revenue - d.expense >= 0 ? "good" : "bad"} />
      </div>

      {/* 3. pending payments */}
      <Section title={t.dashboard.pending} right={<Money paise={d.pendingTotal} short className="text-xl font-bold text-bad" />}>
        {d.pending.length === 0 ? (
          <p className="card p-4 text-muted">✓ {t.orders.fullyPaid}</p>
        ) : (
          <ul className="card divide-y divide-[var(--line)] overflow-hidden">
            {d.pending.slice(0, 8).map((o) => (
              <li key={o.id}>
                <Link href={`/orders/view/?id=${o.id}`} className="flex min-h-14 items-center gap-3 px-4 active:bg-black/5">
                  <span className="min-w-0 flex-1 font-semibold break-words">{o.customer_name}</span>
                  <Money paise={balanceOf(o, paid.get(o.id) ?? 0)} short className="font-bold text-bad" />
                </Link>
              </li>
            ))}
            {d.pending.length > 8 && (
              <li>
                <Link href="/orders/?f=due" className="flex min-h-12 items-center justify-center font-semibold text-brand-600">
                  +{d.pending.length - 8} →
                </Link>
              </li>
            )}
          </ul>
        )}
      </Section>

      {/* 4. upcoming */}
      <Section
        title={t.dashboard.upcoming}
        right={
          <div className="flex rounded-xl border-2 border-line p-0.5 text-sm">
            {(["7", "30"] as const).map((n) => (
              <button key={n} type="button" onClick={() => setUpcomingDays(n)} className={`h-10 rounded-lg px-3 font-semibold whitespace-nowrap ${upcomingDays === n ? "bg-brand-600 text-white" : ""}`}>
                {n === "7" ? t.dashboard.next7 : t.dashboard.next30}
              </button>
            ))}
          </div>
        }
      >
        {d.upcoming.length === 0 ? (
          <p className="card p-4 text-muted">{t.orders.noOrders}</p>
        ) : (
          <ul className="space-y-2">
            {d.upcoming.map((o) => (
              <li key={o.id}>
                <OrderCard o={o} paid={paid.get(o.id) ?? 0} plates={plates.get(o.id) ?? 0} today={today} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 5. completed */}
      <Link href="/orders/?f=completed" className="card mt-5 flex min-h-16 items-center gap-3 px-4">
        <Icon name="check" className="text-good" />
        <span className="flex-1 font-bold">{t.dashboard.completedCount}</span>
        <span className="text-2xl font-bold tabular-nums">{d.completed}</span>
      </Link>

      {/* 6. top dishes */}
      <Section title={t.dashboard.topDishes}>
        <div className="card p-3">{d.top.length ? <TopDishesChart rows={d.top} /> : <p className="text-muted">{t.dashboard.noData}</p>}</div>
      </Section>

      {/* 7. monthly */}
      <Section title={t.dashboard.monthly}>
        <div className="card p-3">
          {d.monthly.some((m) => m.revenue || m.expense) ? (
            <>
              <MonthlyChart rows={d.monthly} />
              <details className="mt-2">
                <summary className="tap flex cursor-pointer items-center text-sm font-semibold text-muted">▸ அட்டவணை</summary>
                <table className="w-full text-sm tabular-nums">
                  <thead>
                    <tr className="text-muted">
                      <th className="text-left font-normal" />
                      <th className="text-right font-normal">{t.dashboard.revenue}</th>
                      <th className="text-right font-normal">{t.dashboard.expense}</th>
                      <th className="text-right font-normal">{t.dashboard.profit}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.monthly.map((m) => (
                      <tr key={m.month} className="border-t border-line">
                        <td className="py-1">{m.month}</td>
                        <td className="text-right">{moneyShort(m.revenue)}</td>
                        <td className="text-right">{moneyShort(m.expense)}</td>
                        <td className={`text-right font-semibold ${m.profit < 0 ? "text-bad" : "text-good"}`}>{moneyShort(m.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </>
          ) : (
            <p className="text-muted">{t.dashboard.noData}</p>
          )}
        </div>
      </Section>

      <FAB href="/orders/new/" label={t.orders.new} />
    </>
  );
}

function StatTile({ label, value, icon, tone }: { label: string; value: React.ReactNode; icon: string; tone?: "good" | "bad" }) {
  return (
    <div className={`card p-3 ${tone === "good" ? "bg-green-50 dark:bg-green-950/30" : tone === "bad" ? "bg-red-50 dark:bg-red-950/30" : ""}`}>
      <div className="flex items-center gap-1.5 text-sm text-muted">
        <Icon name={icon} size={18} />
        {label}
      </div>
      <div className="mt-1 text-[26px] leading-tight font-bold break-all">{value}</div>
    </div>
  );
}

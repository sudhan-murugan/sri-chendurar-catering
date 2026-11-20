"use client";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Chips, Empty, PageTitle } from "@/components/ui";
import { OrderCard } from "@/components/OrderCard";
import { FAB, SearchBox } from "@/components/mobile";
import { useTable } from "@/lib/db";
import { balanceOf, usePaidByOrder, usePlatesByOrder } from "@/lib/orders";
import { isoDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { Order } from "@/lib/types";

type Filter = "upcoming" | "completed" | "due" | "cancelled" | "all";

export default function OrdersPage() {
  return (
    <Suspense>
      <Orders />
    </Suspense>
  );
}

function Orders() {
  const router = useRouter();
  const params = useSearchParams();
  const filter = (params.get("f") as Filter) || "upcoming";
  const orders = useTable("orders");
  const paid = usePaidByOrder();
  const plates = usePlatesByOrder();
  const [q, setQ] = useState("");
  const today = isoDate();

  const groups = useMemo(() => {
    const match = (o: Order): Record<Filter, boolean> => ({
      upcoming: o.event_date >= today && (o.status === "confirmed" || o.status === "enquiry"),
      completed: o.status === "completed",
      due: balanceOf(o, paid.get(o.id) ?? 0) > 0 && o.status !== "enquiry",
      cancelled: o.status === "cancelled",
      all: true,
    });
    const counts = { upcoming: 0, completed: 0, due: 0, cancelled: 0, all: 0 };
    for (const o of orders) {
      const m = match(o);
      (Object.keys(counts) as Filter[]).forEach((k) => m[k] && counts[k]++);
    }
    const s = q.trim().toLowerCase();
    const digits = s.replace(/\D/g, "");
    const list = orders
      .filter((o) => match(o)[filter])
      .filter((o) => !s || o.customer_name.toLowerCase().includes(s) || (digits.length > 2 && (o.phone ?? "").replace(/\D/g, "").includes(digits)))
      .sort((a, b) => (filter === "upcoming" ? a.event_date.localeCompare(b.event_date) : b.event_date.localeCompare(a.event_date)));
    return { counts, list };
  }, [orders, paid, filter, q, today]);

  const chips: { value: Filter; label: string; count: number }[] = [
    { value: "upcoming", label: t.orders.upcoming, count: groups.counts.upcoming },
    { value: "due", label: t.orders.due, count: groups.counts.due },
    { value: "completed", label: t.orders.completed, count: groups.counts.completed },
    { value: "cancelled", label: t.orders.cancelled, count: groups.counts.cancelled },
    { value: "all", label: t.orders.all, count: groups.counts.all },
  ];

  return (
    <>
      <PageTitle title={t.orders.title} />
      <div className="sticky top-14 z-20 -mx-4 space-y-2 bg-app px-4 pt-1 pb-2">
        <SearchBox value={q} onChange={setQ} placeholder={t.orders.searchHint} />
        <Chips options={chips} value={filter} onChange={(f) => router.replace(`/orders/?f=${f}`)} />
      </div>
      {groups.list.length === 0 ? (
        <Empty icon="orders">{t.orders.noOrders}</Empty>
      ) : (
        <ul className="space-y-2">
          {groups.list.map((o) => (
            <li key={o.id}>
              <OrderCard o={o} paid={paid.get(o.id) ?? 0} plates={plates.get(o.id) ?? 0} today={today} />
            </li>
          ))}
        </ul>
      )}
      <FAB href="/orders/new/" label={t.orders.new} />
    </>
  );
}

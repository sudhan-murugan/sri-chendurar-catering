"use client";
import Link from "next/link";
import { Badge, Money } from "@/components/ui";
import { balanceOf, customerTotal } from "@/lib/orders";
import { addDays, dmy } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { Order, OrderStatus } from "@/lib/types";

export function statusTone(s: OrderStatus): "good" | "neutral" | "brand" | "soon" {
  return s === "completed" ? "good" : s === "cancelled" ? "neutral" : s === "enquiry" ? "brand" : "soon";
}

export function OrderCard({ o, paid, plates, today }: { o: Order; paid: number; plates: number; today: string }) {
  const bal = balanceOf(o, paid);
  const when = o.event_date === today ? t.common.today : o.event_date === addDays(today, 1) ? t.common.tomorrow : null;
  return (
    <Link href={`/orders/view/?id=${o.id}`} className="card block p-3 active:opacity-80">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-bold break-words">{o.customer_name}</div>
          <div className="text-sm text-muted">
            {t.events[o.event_type]} · {plates} {t.common.people}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-bold tabular-nums">{dmy(o.event_date)}</div>
          {when ? <Badge tone="soon">{when}</Badge> : <Badge tone={statusTone(o.status)}>{t.status[o.status]}</Badge>}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
        <Money paise={customerTotal(o)} className="text-lg font-bold" />
        {o.status === "cancelled" ? null : bal > 0 ? (
          <Badge tone="bad">
            {t.orders.balance} <Money paise={bal} short />
          </Badge>
        ) : (
          <Badge tone="good">✓ {t.orders.fullyPaid}</Badge>
        )}
      </div>
    </Link>
  );
}

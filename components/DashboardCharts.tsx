"use client";
// Loaded lazily (next/dynamic) so Recharts never weighs on first load.
import { useEffect, useRef } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { moneyShort } from "@/lib/format";
import { t } from "@/lib/i18n";

// Validated with the dataviz palette checker (light + dark).
const LIGHT = { revenue: "#c2410c", expense: "#2563eb", profit: "#15803d" };
const DARK = { revenue: "#ea580c", expense: "#3b82f6", profit: "#16a34a" };
const isDark = () => typeof document !== "undefined" && document.documentElement.classList.contains("dark");

const axis = { fontSize: 13, fill: "var(--muted)" };
const tooltipStyle = { background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)" };
const compact = (paise: number) => {
  const r = paise / 100;
  if (Math.abs(r) >= 100000) return `₹${(r / 100000).toFixed(1)}L`;
  if (Math.abs(r) >= 1000) return `₹${Math.round(r / 1000)}K`;
  return `₹${Math.round(r)}`;
};

export interface MonthRow {
  month: string;
  revenue: number;
  expense: number;
  profit: number;
}

export function MonthlyChart({ rows }: { rows: MonthRow[] }) {
  const c = isDark() ? DARK : LIGHT;
  // ~64px per month; scrolls sideways on narrow screens instead of squeezing
  const minWidth = Math.max(320, rows.length * 64);
  const scroller = useRef<HTMLDivElement>(null);
  // show the latest months first
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, [rows.length]);
  return (
    <>
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {([["revenue", t.dashboard.revenue], ["expense", t.dashboard.expense], ["profit", t.dashboard.profit]] as const).map(([k, label]) => (
        <li key={k} className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: c[k] }} />
          {label}
        </li>
      ))}
    </ul>
    <div ref={scroller} className="no-scrollbar -mx-3 overflow-x-auto px-3" data-no-ptr>
      <div style={{ minWidth, height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={2} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="0" />
            <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
            <YAxis tickFormatter={compact} tick={axis} tickLine={false} axisLine={false} width={52} />
            <Tooltip formatter={(v) => moneyShort(Number(v))} contentStyle={tooltipStyle} cursor={{ fill: "var(--line)", opacity: 0.4 }} />
            <Bar dataKey="revenue" name={t.dashboard.revenue} fill={c.revenue} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="expense" name={t.dashboard.expense} fill={c.expense} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="profit" name={t.dashboard.profit} fill={c.profit} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
    </>
  );
}

export function TopDishesChart({ rows }: { rows: { name: string; count: number }[] }) {
  const c = isDark() ? DARK : LIGHT;
  return (
    <div style={{ height: Math.max(120, rows.length * 40 + 20) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 28, left: 0, bottom: 0 }} barCategoryGap={8}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={110} tick={{ ...axis, fill: "var(--ink)", fontSize: 14 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--line)", opacity: 0.4 }} formatter={(v) => [`${v} ${t.nav.orders}`, ""]} />
          <Bar dataKey="count" fill={c.revenue} radius={[0, 4, 4, 0]} isAnimationActive={false} label={{ position: "right", fill: "var(--ink)", fontSize: 13 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

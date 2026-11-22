"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { t } from "@/lib/i18n";
import { trimNum } from "@/lib/units";

// ------------------------------------------------------------- BottomNav
const NAV = [
  { href: "/", label: t.nav.home, icon: "dish" },
  { href: "/calculator/", label: t.nav.calc, icon: "calc" },
  { href: "/ingredients/", label: t.nav.prices, icon: "rupee" },
];

export function BottomNav() {
  const path = usePathname() || "/";
  const active = (href: string) => {
    if (href === "/") return path === "/" || path.startsWith("/dishes");
    return path.startsWith(href.replace(/\/$/, ""));
  };
  return (
    <nav className="no-print pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card" aria-label="main">
      <ul className="mx-auto flex max-w-3xl">
        {NAV.map((n) => {
          const on = active(n.href);
          return (
            <li key={n.href} className="flex-1">
              <Link
                href={n.href}
                aria-current={on ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-0.5 text-[15px] font-semibold ${on ? "text-brand-600 dark:text-brand-100" : "text-muted"}`}
              >
                <span className={`flex h-8 w-14 items-center justify-center rounded-full ${on ? "bg-brand-100 dark:bg-brand-900" : ""}`}>
                  <Icon name={n.icon} size={24} />
                </span>
                <span className="leading-tight">{n.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ------------------------------------------------------------- FAB
export function FAB({ href, onClick, label, icon = "plus" }: { href?: string; onClick?: () => void; label: string; icon?: string }) {
  const cls =
    "no-print fixed right-4 z-30 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-xl active:bg-brand-700 md:right-[max(1rem,calc(50vw-23rem))]";
  const style = { bottom: "calc(5rem + env(safe-area-inset-bottom))" };
  if (href)
    return (
      <Link href={href} aria-label={label} title={label} className={cls} style={style}>
        <Icon name={icon} size={32} />
      </Link>
    );
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={cls} style={style}>
      <Icon name={icon} size={32} />
    </button>
  );
}

// ------------------------------------------------------------- StickyActionBar
/** Primary actions pinned above the bottom nav, in the thumb zone. */
export function StickyActionBar({ children, aboveNav = true }: { children: ReactNode; aboveNav?: boolean }) {
  return (
    <>
      <div className="h-20" aria-hidden />
      <div
        className="no-print fixed inset-x-0 z-30 border-t border-line bg-card/95 px-4 py-2 backdrop-blur"
        style={{ bottom: aboveNav ? "calc(4rem + env(safe-area-inset-bottom))" : "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-3xl gap-2">{children}</div>
      </div>
    </>
  );
}

// ------------------------------------------------------------- BottomSheet
export function BottomSheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Android back button closes the sheet instead of leaving the page
    history.pushState({ sheet: true }, "");
    const onPop = () => onClose();
    window.addEventListener("popstate", onPop);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      if (history.state?.sheet) history.back();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" data-no-ptr role="dialog" aria-modal="true" aria-label={title}>
      <div className="anim-fade absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="anim-sheet relative flex max-h-[88dvh] w-full max-w-3xl flex-col rounded-t-3xl bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b border-line px-4 pt-2 pb-1">
          <div className="absolute top-2 left-1/2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-gray-400" />
          <h2 className="mt-3 min-w-0 flex-1 truncate text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t.common.close} className="tap mt-2 -mr-2 flex items-center justify-center rounded-full active:bg-black/10">
            <Icon name="x" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">{children}</div>
        {footer && <div className="pb-safe border-t border-line px-4 py-2">{footer}</div>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------- NumberStepper
export function NumberStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 100000,
  decimal = false,
  big = false,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  decimal?: boolean;
  big?: boolean;
  label: string;
}) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(trimNum(value, 3).replace(/,/g, ""));
  }, [value]);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const bump = (d: number) => onChange(clamp(Math.round((value + d) * 1000) / 1000));
  const btn = `flex shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 active:bg-brand-500 active:text-white dark:bg-brand-900 dark:text-brand-100 ${big ? "h-16 w-16" : "h-12 w-12"}`;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <button type="button" className={btn} aria-label={`${label} −`} onClick={() => bump(-step)}>
        <Icon name="minus" size={big ? 32 : 24} />
      </button>
      <input
        aria-label={label}
        type="text"
        inputMode={decimal ? "decimal" : "numeric"}
        value={text}
        onFocus={(e) => {
          focused.current = true;
          e.currentTarget.select();
        }}
        onBlur={() => {
          focused.current = false;
          setText(trimNum(value, 3).replace(/,/g, ""));
        }}
        onChange={(e) => {
          const s = e.target.value.replace(",", ".").replace(decimal ? /[^0-9.]/g : /[^0-9]/g, "");
          setText(s);
          const n = Number(s);
          if (s !== "" && Number.isFinite(n)) onChange(clamp(n));
          else if (s === "") onChange(min);
        }}
        size={1}
        className={`w-0 min-w-0 flex-1 rounded-2xl border-2 border-line bg-card text-center font-bold tabular-nums outline-none focus:border-brand-500 ${big ? "h-16 text-[32px]" : "h-12 text-xl"}`}
      />
      <button type="button" className={btn} aria-label={`${label} +`} onClick={() => bump(step)}>
        <Icon name="plus" size={big ? 32 : 24} />
      </button>
    </div>
  );
}

// ------------------------------------------------------------- SearchBox
export function SearchBox({ value, onChange, placeholder = t.common.search, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <div className="relative">
      <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        enterKeyHint="search"
        className="tap w-full rounded-xl border-2 border-line bg-card pr-3 pl-11 text-[17px] outline-none focus:border-brand-500"
      />
    </div>
  );
}

// ------------------------------------------------------------- Sortable (drag handle)
/**
 * Drag-to-reorder list using pointer events on a handle (works with touch).
 * Each item still has its own controls; dragging is only via the ⠿ handle.
 */
export function SortableList<T>({ items, keyOf, onReorder, render }: { items: T[]; keyOf: (i: T) => string; onReorder: (next: T[]) => void; render: (item: T, handle: ReactNode, index: number) => ReactNode }) {
  const listRef = useRef<HTMLUListElement>(null);
  const [drag, setDrag] = useState<{ from: number; over: number; dy: number; startY: number } | null>(null);

  const onDown = (index: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ from: index, over: index, dy: 0, startY: e.clientY });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag || !listRef.current) return;
    const children = [...listRef.current.children] as HTMLElement[];
    let over = drag.from;
    for (let i = 0; i < children.length; i++) {
      const r = children[i].getBoundingClientRect();
      if (e.clientY > r.top + r.height / 2) over = i;
    }
    if (e.clientY < children[0].getBoundingClientRect().top + children[0].offsetHeight / 2) over = 0;
    setDrag({ ...drag, over, dy: e.clientY - drag.startY });
  };
  const onUp = () => {
    if (drag && drag.over !== drag.from) {
      const next = [...items];
      const [m] = next.splice(drag.from, 1);
      next.splice(drag.over, 0, m);
      onReorder(next);
    }
    setDrag(null);
  };

  return (
    <ul ref={listRef} className="space-y-2">
      {items.map((it, i) => {
        const handle = (
          <span
            role="button"
            aria-label="drag"
            onPointerDown={onDown(i)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            className="tap -ml-2 flex cursor-grab touch-none items-center justify-center text-muted"
          >
            <Icon name="drag" />
          </span>
        );
        const dragging = drag?.from === i;
        return (
          <li
            key={keyOf(it)}
            style={dragging ? { transform: `translateY(${drag.dy}px)`, zIndex: 10, position: "relative" } : undefined}
            className={`${dragging ? "opacity-90 shadow-xl" : ""} ${drag && drag.over === i && !dragging ? "ring-2 ring-brand-500 rounded-2xl" : ""}`}
          >
            {render(it, handle, i)}
          </li>
        );
      })}
    </ul>
  );
}

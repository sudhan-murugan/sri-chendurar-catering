"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { t } from "@/lib/i18n";
import { trimNum } from "@/lib/units";

// ------------------------------------------------------------------ navigation
export const NAV = [
  { href: "/", label: t.nav.home, icon: "dish" },
  { href: "/calculator/", label: t.nav.calc, icon: "calc" },
  { href: "/ingredients/", label: t.nav.prices, icon: "rupee" },
];

export function useNavActive() {
  const path = usePathname() || "/";
  return (href: string) => (href === "/" ? path === "/" || path.startsWith("/dishes") : path.startsWith(href.replace(/\/$/, "")));
}

/** Phone: tab bar at the bottom (thumb zone). Hidden on tablet/desktop, where tabs sit in the header. */
export function BottomNav() {
  const active = useNavActive();
  return (
    <nav className="no-print pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface md:hidden" aria-label="main">
      <ul className="flex">
        {NAV.map((n) => {
          const on = active(n.href);
          return (
            <li key={n.href} className="flex-1">
              <Link href={n.href} aria-current={on ? "page" : undefined} className={`flex h-16 flex-col items-center justify-center gap-1 text-[13px] font-medium ${on ? "text-accent-ink" : "text-muted"}`}>
                <span className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${on ? "bg-accent-soft" : ""}`}>
                  <Icon name={n.icon} size={22} />
                </span>
                {n.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Tablet/desktop: the same three tabs inline in the header. */
export function TopNav() {
  const active = useNavActive();
  return (
    <nav className="no-print hidden items-center gap-1 md:flex" aria-label="main">
      {NAV.map((n) => {
        const on = active(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={on ? "page" : undefined}
            className={`flex h-11 items-center gap-2 rounded-lg px-3.5 text-[15px] font-medium transition-colors ${on ? "bg-accent-soft text-accent-ink" : "text-muted hover:bg-surface-2 hover:text-ink"}`}
          >
            <Icon name={n.icon} size={18} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

// ------------------------------------------------------------------ StickyActionBar
/** Summary + primary action pinned at the bottom (above the phone tab bar). */
export function StickyActionBar({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="h-24" aria-hidden />
      <div className="no-print fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 backdrop-blur md:bottom-0">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 md:px-8">{children}</div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ BottomSheet
/** Bottom sheet on phones, centred dialog on larger screens. */
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
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center md:p-6" data-no-ptr role="dialog" aria-modal="true" aria-label={title}>
      <div className="anim-fade absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="anim-sheet relative flex max-h-[88dvh] w-full flex-col rounded-t-2xl border border-line bg-surface md:max-h-[80vh] md:max-w-lg md:rounded-2xl">
        <div className="flex items-center gap-2 border-b border-line px-5 py-2">
          <h2 className="t-heading min-w-0 flex-1 truncate">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t.common.close} className="tap -mr-3 flex items-center justify-center rounded-xl text-muted hover:bg-surface-2">
            <Icon name="x" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && <div className="pb-safe border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ NumberStepper
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
  const h = big ? "h-16" : "h-12";
  const btn = `flex ${h} ${big ? "w-16" : "w-12"} shrink-0 items-center justify-center rounded-xl border border-line-strong bg-surface text-ink transition-colors hover:bg-surface-2 active:bg-accent-soft`;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <button type="button" className={btn} aria-label={`${label} −`} onClick={() => bump(-step)}>
        <Icon name="minus" size={big ? 26 : 22} />
      </button>
      <input
        aria-label={label}
        type="text"
        inputMode={decimal ? "decimal" : "numeric"}
        value={text}
        size={1}
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
        className={`${h} w-0 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface text-center font-semibold tabular-nums outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 ${big ? "text-[28px]" : "text-lg"}`}
      />
      <button type="button" className={btn} aria-label={`${label} +`} onClick={() => bump(step)}>
        <Icon name="plus" size={big ? 26 : 22} />
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ SearchBox
export function SearchBox({ value, onChange, placeholder = t.common.search, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <div className="relative">
      <Icon name="search" size={20} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        enterKeyHint="search"
        className="min-h-12 w-full rounded-xl border border-line-strong bg-surface pr-3 pl-11 text-base outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
    </div>
  );
}

"use client";
// Small, touch-friendly building blocks. Every tappable thing is ≥ 48px.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { forwardRef, useSyncExternalStore, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { Icon } from "./Icon";
import { t } from "@/lib/i18n";
import { money, moneyShort } from "@/lib/format";

export { Icon };

type Variant = "primary" | "secondary" | "ghost" | "danger" | "good";
const VARIANT: Record<Variant, string> = {
  primary: "bg-brand-600 text-white active:bg-brand-700 disabled:opacity-50",
  secondary: "bg-card border-2 border-brand-600 text-brand-700 dark:text-brand-100 active:bg-brand-50 dark:active:bg-brand-900",
  ghost: "text-brand-700 dark:text-brand-100 active:bg-black/5",
  danger: "bg-bad text-white active:opacity-80",
  good: "bg-good text-white active:opacity-80",
};

export function Button({
  variant = "primary",
  icon,
  className = "",
  children,
  full,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: string; full?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={`tap inline-flex items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition-colors select-none ${VARIANT[variant]} ${full ? "w-full" : ""} ${className}`}
    >
      {icon && <Icon name={icon} size={22} />}
      {children}
    </button>
  );
}

export function LinkButton({ href, variant = "primary", icon, className = "", children }: { href: string; variant?: Variant; icon?: string; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={`tap inline-flex items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold ${VARIANT[variant]} ${className}`}>
      {icon && <Icon name={icon} size={22} />}
      {children}
    </Link>
  );
}

export function IconButton({ icon, label, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string }) {
  return (
    <button type="button" aria-label={label} title={label} {...rest} className={`tap inline-flex items-center justify-center rounded-full active:bg-black/10 ${className}`}>
      <Icon name={icon} />
    </button>
  );
}

export function Card({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div className={`card p-4 ${onClick ? "cursor-pointer active:opacity-80" : ""} ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[15px] font-semibold">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-sm text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-sm font-semibold text-bad">{error}</span>}
    </label>
  );
}

const inputCls =
  "tap w-full rounded-xl border-2 border-line bg-card px-3 text-[17px] outline-none focus:border-brand-500 disabled:opacity-60";

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput({ className = "", ...p }, ref) {
  return <input ref={ref} {...p} className={`${inputCls} ${className}`} />;
});

/** Number field that always opens the number keypad. Value is a string so partial input ("12.") works. */
export function NumberInput({ decimal = true, className = "", ...p }: InputHTMLAttributes<HTMLInputElement> & { decimal?: boolean }) {
  return (
    <input
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      pattern={decimal ? "[0-9]*[.,]?[0-9]*" : "[0-9]*"}
      autoComplete="off"
      enterKeyHint="done"
      onFocus={(e) => e.currentTarget.select()}
      {...p}
      className={`${inputCls} ${className}`}
    />
  );
}

export function TextArea(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...p} className={`w-full rounded-xl border-2 border-line bg-card p-3 text-[17px] outline-none focus:border-brand-500 ${p.className ?? ""}`} />;
}

const SELECT_BG = {
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23888' d='M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 8px center",
  backgroundSize: "22px",
};

export function Select({ className = "", children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...p} className={`${inputCls} appearance-none pr-9 ${className}`} style={SELECT_BG}>
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="tap flex w-full items-center justify-between gap-3 text-left">
      <span className="font-semibold">{label}</span>
      <span className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${checked ? "bg-good" : "bg-gray-400"}`}>
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? "left-7" : "left-1"}`} />
      </span>
    </button>
  );
}

/** Horizontally scrolling filter chips. */
export function Chips<V extends string>({ options, value, onChange, className = "" }: { options: { value: V; label: string; count?: number }[]; value: V; onChange: (v: V) => void; className?: string }) {
  return (
    <div className={`no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`h-11 shrink-0 rounded-full border-2 px-4 text-[15px] font-semibold whitespace-nowrap ${
            value === o.value ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-card"
          }`}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-1 opacity-80">({o.count})</span>}
        </button>
      ))}
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "good" | "bad" | "soon" | "neutral" | "brand"; children: ReactNode }) {
  const cls = {
    good: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200",
    bad: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
    soon: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200",
    neutral: "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
    brand: "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-100",
  }[tone];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap ${cls}`}>{children}</span>;
}

export function Money({ paise, short, className = "" }: { paise: number; short?: boolean; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{short ? moneyShort(paise) : money(paise)}</span>;
}

/** Profit in green, loss in red. */
export function ProfitText({ paise, short, className = "" }: { paise: number; short?: boolean; className?: string }) {
  return <Money paise={paise} short={short} className={`${paise >= 0 ? "text-good" : "text-bad"} ${className}`} />;
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label={t.app.loading}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-20" />
      ))}
    </div>
  );
}

export function Empty({ children, icon = "list" }: { children: ReactNode; icon?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center text-muted">
      <Icon name={icon} size={48} className="opacity-40" />
      <div className="max-w-xs">{children}</div>
    </div>
  );
}

export function PageTitle({ title, back, right }: { title: string; back?: boolean | string; right?: ReactNode }) {
  const router = useRouter();
  return (
    <div className="mb-3 flex min-h-12 items-center gap-1">
      {back && (
        <IconButton
          icon="back"
          label={t.common.back}
          className="-ml-3"
          onClick={() => (typeof back === "string" ? router.push(back) : window.history.length > 1 ? router.back() : router.push("/"))}
        />
      )}
      <h1 className="line-clamp-2 min-w-0 flex-1 text-[22px] leading-snug font-bold">{title}</h1>
      {right}
    </div>
  );
}

export function Section({ title, right, children, className = "" }: { title?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mt-5 ${className}`}>
      {(title || right) && (
        <div className="mb-2 flex items-center justify-between gap-2">
          {title && <h2 className="min-w-0 text-lg font-bold">{title}</h2>}
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// ------------------------------------------------------------- toast
let toastState: { id: number; text: string; tone: "good" | "bad" | "neutral" } | null = null;
const toastListeners = new Set<() => void>();
export function toast(text: string, tone: "good" | "bad" | "neutral" = "good") {
  const id = Date.now();
  toastState = { id, text, tone };
  toastListeners.forEach((l) => l());
  setTimeout(() => {
    if (toastState?.id === id) {
      toastState = null;
      toastListeners.forEach((l) => l());
    }
  }, 2200);
}
export function Toaster() {
  const s = useSyncExternalStore((fn) => (toastListeners.add(fn), () => toastListeners.delete(fn)), () => toastState, () => null);
  if (!s) return null;
  const bg = s.tone === "bad" ? "bg-bad" : s.tone === "good" ? "bg-good" : "bg-gray-800";
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 top-16 z-[70] flex justify-center px-4">
      <div className={`anim-fade rounded-xl px-5 py-3 text-base font-semibold text-white shadow-lg ${bg}`}>{s.text}</div>
    </div>
  );
}

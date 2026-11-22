"use client";
// Design system building blocks. Every page uses these, so colours, type,
// radii and spacing stay consistent. Tap targets are ≥ 48px.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { forwardRef, useSyncExternalStore, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { Icon } from "./Icon";
import { t } from "@/lib/i18n";
import { money, moneyShort } from "@/lib/format";

export { Icon };

// ------------------------------------------------------------------ buttons
type Variant = "primary" | "secondary" | "ghost" | "danger" | "good";
const BASE = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold transition-colors select-none disabled:opacity-50 disabled:pointer-events-none";
const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-hover",
  good: "bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-hover",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-2 active:bg-surface-2",
  ghost: "text-accent-ink hover:bg-accent-soft active:bg-accent-soft",
  danger: "border border-line-strong bg-surface text-danger hover:bg-danger-soft",
};

export function Button({ variant = "primary", icon, className = "", children, full, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: string; full?: boolean }) {
  return (
    <button type="button" {...rest} className={`${BASE} ${VARIANT[variant]} ${full ? "w-full" : ""} ${className}`}>
      {icon && <Icon name={icon} size={20} />}
      {children}
    </button>
  );
}

export function LinkButton({ href, variant = "primary", icon, className = "", children }: { href: string; variant?: Variant; icon?: string; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={`${BASE} ${VARIANT[variant]} ${className}`}>
      {icon && <Icon name={icon} size={20} />}
      {children}
    </Link>
  );
}

export function IconButton({ icon, label, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string }) {
  return (
    <button type="button" aria-label={label} title={label} {...rest} className={`tap inline-flex items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-ink active:bg-surface-2 ${className}`}>
      <Icon name={icon} size={22} />
    </button>
  );
}

// ------------------------------------------------------------------ surfaces
export function Card({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div className={`card p-4 md:p-5 ${onClick ? "cursor-pointer hover:border-line-strong" : ""} ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}

export function PageTitle({ title, subtitle, back, onBack, right }: { title: string; subtitle?: string; back?: boolean | string; onBack?: () => void; right?: ReactNode }) {
  const router = useRouter();
  return (
    <div className="mb-5 flex min-h-12 items-center gap-2">
      {(back || onBack) && (
        <IconButton
          icon="back"
          label={t.common.back}
          className="-ml-3"
          onClick={() => (onBack ? onBack() : typeof back === "string" ? router.push(back) : window.history.length > 1 ? router.back() : router.push("/"))}
        />
      )}
      <div className="min-w-0 flex-1">
        <h1 className="t-title line-clamp-2">{title}</h1>
        {subtitle && <p className="t-caption mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

export function Section({ title, right, children, className = "" }: { title?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mt-8 ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="t-heading min-w-0">{title}</h2>}
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// ------------------------------------------------------------------ form controls
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="block">
      <span className="t-label mb-1.5 block">{label}</span>
      {children}
      {hint && !error && <span className="t-caption mt-1.5 block">{hint}</span>}
      {error && <span className="mt-1.5 block text-sm font-medium text-danger">{error}</span>}
    </label>
  );
}

export const inputCls =
  "min-h-12 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-base text-ink placeholder:text-muted/70 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60";

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput({ className = "", ...p }, ref) {
  return <input ref={ref} {...p} className={`${inputCls} ${className}`} />;
});

/** Number field that always opens the number keypad. */
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
      className={`${inputCls} tabular-nums ${className}`}
    />
  );
}

export function TextArea(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...p} className={`${inputCls} py-3 ${p.className ?? ""}`} />;
}

const SELECT_BG = {
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23857d76' d='M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 8px center",
  backgroundSize: "20px",
};

export function Select({ className = "", children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...p} className={`${inputCls} appearance-none pr-8 ${className}`} style={SELECT_BG}>
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="tap flex w-full items-center justify-between gap-3 text-left">
      <span className="font-medium">{label}</span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-accent" : "bg-line-strong"}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

/** Horizontally scrolling choice chips. */
export function Chips<V extends string>({ options, value, onChange, className = "" }: { options: { value: V; label: string; count?: number }[]; value: V; onChange: (v: V) => void; className?: string }) {
  return (
    <div className={`no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1 md:mx-0 md:px-0 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`h-11 shrink-0 rounded-full border px-4 text-[15px] font-medium whitespace-nowrap transition-colors ${
            value === o.value ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-surface text-ink hover:bg-surface-2"
          }`}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-1 opacity-70">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "good" | "bad" | "soon" | "neutral" | "brand"; children: ReactNode }) {
  const cls = {
    good: "bg-accent-soft text-accent-ink",
    brand: "bg-accent-soft text-accent-ink",
    soon: "bg-accent-soft text-accent-ink",
    bad: "bg-danger-soft text-danger",
    neutral: "bg-surface-2 text-muted border border-line",
  }[tone];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[13px] font-medium whitespace-nowrap ${cls}`}>{children}</span>;
}

export function Money({ paise, short, className = "" }: { paise: number; short?: boolean; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{short ? moneyShort(paise) : money(paise)}</span>;
}

export function ProfitText({ paise, short, className = "" }: { paise: number; short?: boolean; className?: string }) {
  return <Money paise={paise} short={short} className={`${paise >= 0 ? "text-accent-ink" : "text-danger"} ${className}`} />;
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
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center text-muted">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2">
        <Icon name={icon} size={24} />
      </span>
      <div className="max-w-xs">{children}</div>
    </div>
  );
}

// ------------------------------------------------------------------ toast
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
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 top-20 z-[70] flex justify-center px-4">
      <div className="anim-fade flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-[15px] font-medium text-bg">
        {s.tone === "bad" ? <Icon name="x" size={18} className="text-danger" /> : <Icon name="check" size={18} className="text-[#5eead4]" />}
        {s.text}
      </div>
    </div>
  );
}

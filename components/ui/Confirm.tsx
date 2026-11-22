"use client";
// In-app confirmation dialog (replaces the browser's "localhost says…" pop-up).
// Usage:  if (await askConfirm({ title, message, confirmLabel, danger: true })) { … }
import { useEffect, useRef, useSyncExternalStore } from "react";
import { Icon } from "./Icon";
import { t } from "@/lib/i18n";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

let current: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function askConfirm(opts: ConfirmOptions): Promise<boolean> {
  current?.resolve(false);
  return new Promise((resolve) => {
    current = { ...opts, resolve };
    emit();
  });
}

function close(ok: boolean) {
  const c = current;
  current = null;
  emit();
  c?.resolve(ok);
}

export function ConfirmHost() {
  const c = useSyncExternalStore((fn) => (listeners.add(fn), () => listeners.delete(fn)), () => current, () => null);
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!c) return;
    // focus the main action without drawing a focus ring on open (ring still shows when tabbing)
    okRef.current?.focus({ focusVisible: false } as FocusOptions);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [c]);

  if (!c) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-5" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby={c.message ? "confirm-msg" : undefined}>
      <div className="anim-fade absolute inset-0 bg-black/45" onClick={() => close(false)} />
      <div className="anim-sheet relative w-full max-w-sm rounded-2xl border border-line bg-surface p-6">
        <span className={`mb-4 flex h-11 w-11 items-center justify-center rounded-full ${c.danger ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent-ink"}`}>
          <Icon name={c.danger ? "trash" : "refresh"} size={22} />
        </span>
        <h2 id="confirm-title" className="t-heading">
          {c.title}
        </h2>
        {c.message && (
          <p id="confirm-msg" className="t-caption mt-1.5">
            {c.message}
          </p>
        )}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => close(false)} className="min-h-12 rounded-xl border border-line-strong bg-surface px-3 text-[15px] font-semibold text-ink transition-colors hover:bg-surface-2">
            {c.cancelLabel ?? t.common.cancel}
          </button>
          <button
            ref={okRef}
            type="button"
            onClick={() => close(true)}
            className={`min-h-12 rounded-xl px-3 text-[15px] font-semibold text-white transition-colors ${c.danger ? "bg-[#b42318] hover:bg-[#912018]" : "bg-accent hover:bg-accent-hover"}`}
          >
            {c.confirmLabel ?? t.common.yes}
          </button>
        </div>
      </div>
    </div>
  );
}

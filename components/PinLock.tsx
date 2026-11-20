"use client";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { checkPin, clearPin } from "@/lib/pin";
import { logout } from "@/lib/auth";
import { t } from "@/lib/i18n";

/** Full-screen 4-digit keypad. Used for unlocking and (with `onEntered`) for setting a PIN. */
export function PinPad({ title, onComplete, error }: { title: string; onComplete: (pin: string) => void; error?: string | null }) {
  const [pin, setPin] = useState("");
  const press = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) setTimeout(() => (onComplete(next), setPin("")), 120);
  };
  return (
    <div className="flex flex-col items-center gap-6">
      <Icon name="lock" size={40} className="text-brand-600" />
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="flex gap-4" aria-live="polite">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-5 w-5 rounded-full border-2 border-brand-600 ${i < pin.length ? "bg-brand-600" : ""}`} />
        ))}
      </div>
      <div className="h-6 font-semibold text-bad">{error}</div>
      <div className="grid grid-cols-3 gap-4">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) =>
          k === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => (k === "⌫" ? setPin(pin.slice(0, -1)) : press(k))}
              className="h-[72px] w-[72px] rounded-full bg-brand-50 text-3xl font-bold text-brand-700 active:bg-brand-500 active:text-white dark:bg-brand-900 dark:text-brand-100"
            >
              {k}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

export function PinLock({ onUnlock }: { onUnlock: () => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-app p-6">
      <PinPad
        title={t.pin.enter}
        error={error}
        onComplete={async (p) => {
          if (await checkPin(p)) onUnlock();
          else setError(t.pin.wrong);
        }}
      />
      <button
        type="button"
        className="tap mt-8 max-w-xs px-4 text-center text-sm text-muted underline"
        onClick={async () => {
          clearPin();
          await logout();
          location.href = "/login/";
        }}
      >
        {t.pin.forgot}
      </button>
    </div>
  );
}

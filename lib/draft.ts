// Auto-saved drafts (localStorage) so a phone call or closing the app never loses a half-filled form.
import { useCallback, useEffect, useRef, useState } from "react";

export function useDraft<T>(key: string, initial: () => T): { value: T; set: (v: T | ((p: T) => T)) => void; clear: () => void; restored: boolean } {
  const storageKey = `draft:${key}`;
  const [state, setState] = useState<{ value: T; restored: boolean }>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) return { value: JSON.parse(raw) as T, restored: true };
      } catch {}
    }
    return { value: initial(), restored: false };
  });
  const dirty = useRef(false);

  useEffect(() => {
    if (!dirty.current) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(state.value));
      } catch {}
    }, 250);
    return () => clearTimeout(id);
  }, [state.value, storageKey]);

  const set = useCallback((v: T | ((p: T) => T)) => {
    dirty.current = true;
    setState((s) => ({ ...s, value: typeof v === "function" ? (v as (p: T) => T)(s.value) : v }));
  }, []);

  const clear = useCallback(() => {
    dirty.current = false;
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  }, [storageKey]);

  return { value: state.value, set, clear, restored: state.restored };
}

export function discardDraft(key: string) {
  try {
    localStorage.removeItem(`draft:${key}`);
  } catch {}
}

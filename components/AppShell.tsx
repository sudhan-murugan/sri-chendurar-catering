"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BottomNav } from "@/components/mobile";
import { Icon, Skeleton, Toaster, Button } from "@/components/ui";
import { PinLock } from "@/components/PinLock";
import { cachedUserId } from "@/lib/auth";
import { openStore, getRows, saveMany, useStoreReady } from "@/lib/db";
import { startSyncLoop, syncNow, scheduleSync, useSyncStatus } from "@/lib/offline-sync";
import { buildSeed } from "@/lib/seed";
import { DEMO_MODE } from "@/lib/supabase";
import { useSettings } from "@/lib/settings";
import { hasPin, PIN_LOCK_AFTER_MS } from "@/lib/pin";
import { f, t } from "@/lib/i18n";
import type { SaveOp } from "@/lib/db";

async function seedIfEmpty(uid: string) {
  if (getRows("settings").length > 0) return;
  const rows = await buildSeed(uid);
  saveMany(rows.map((r) => ({ table: r.table, row: r.row }) as SaveOp));
  scheduleSync(0);
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname() || "/";
  const router = useRouter();
  const isLogin = path.startsWith("/login");
  const ready = useStoreReady();
  const [firstRunOffline, setFirstRunOffline] = useState(false);
  const [locked, setLocked] = useState(false);
  const hiddenAt = useRef<number | null>(null);
  const [swWaiting, setSwWaiting] = useState<ServiceWorker | null>(null);

  // ---- boot: open local data immediately, then sync in the background
  useEffect(() => {
    if (isLogin) return;
    const uid = cachedUserId();
    if (!uid) {
      router.replace("/login/");
      return;
    }
    let cancelled = false;
    (async () => {
      await openStore(uid);
      startSyncLoop();
      if (cancelled) return;
      if (DEMO_MODE) return seedIfEmpty(uid);
      const ok = await syncNow();
      if (ok) await seedIfEmpty(uid);
      else if (getRows("settings").length === 0 && !navigator.onLine) setFirstRunOffline(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [isLogin, router]);

  // ---- PIN lock on open and after 2 min in background
  useEffect(() => {
    if (isLogin) return;
    if (hasPin() && !sessionStorage.getItem("scc_unlocked")) setLocked(true);
    const onVis = () => {
      if (document.visibilityState === "hidden") hiddenAt.current = Date.now();
      else if (hasPin() && hiddenAt.current && Date.now() - hiddenAt.current > PIN_LOCK_AFTER_MS) {
        sessionStorage.removeItem("scc_unlocked");
        setLocked(true);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [isLogin]);

  // ---- service worker (production only) with "new version" prompt
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      const check = () => reg.waiting && navigator.serviceWorker.controller && setSwWaiting(reg.waiting);
      check();
      reg.addEventListener("updatefound", () => reg.installing?.addEventListener("statechange", check));
    });
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!reloaded) {
        reloaded = true;
        location.reload();
      }
    });
  }, []);

  usePullToRefresh(!isLogin && ready);

  if (isLogin) return <>{children}</>;

  return (
    <>
      <Header />
      <StatusBanner />
      <main className="mx-auto w-full max-w-3xl px-4 pt-3 pb-28">
        {firstRunOffline ? (
          <div className="card mt-10 p-6 text-center text-lg">
            <Icon name="offline" size={48} className="mx-auto mb-3 text-bad" />
            {t.app.firstRunOffline}
          </div>
        ) : ready ? (
          children
        ) : (
          <Skeleton rows={5} />
        )}
      </main>
      <BottomNav />
      <Toaster />
      {swWaiting && (
        <div className="fixed inset-x-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-gray-900 p-3 text-white shadow-xl" style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}>
          <span className="flex-1 font-semibold">{t.app.updateReady}</span>
          <Button onClick={() => swWaiting.postMessage("SKIP_WAITING")}>{t.app.update}</Button>
        </div>
      )}
      {locked && (
        <PinLock
          onUnlock={() => {
            sessionStorage.setItem("scc_unlocked", "1");
            setLocked(false);
          }}
        />
      )}
    </>
  );
}

function Header() {
  const s = useSettings();
  const sync = useSyncStatus();
  return (
    <header className="no-print sticky top-0 z-40 bg-brand-600 text-white shadow" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
        {s.logo ? <img src={s.logo} alt="" className="h-9 w-9 rounded-full bg-white object-cover" /> : <span className="text-2xl" aria-hidden>🪔</span>}
        <Link href="/" className="flex h-12 min-w-0 flex-1 items-center truncate text-lg font-bold">
          {s.businessName}
        </Link>
        <button
          type="button"
          onClick={() => void syncNow()}
          className="tap -mr-2 flex items-center justify-center gap-1 rounded-full text-sm"
          aria-label={sync.online ? t.app.synced : t.app.offline}
        >
          {DEMO_MODE ? null : !sync.online ? (
            <Icon name="offline" />
          ) : sync.syncing ? (
            <Icon name="refresh" className="animate-spin" />
          ) : sync.pending > 0 ? (
            <span className="rounded-full bg-white/20 px-2 font-bold">{sync.pending}</span>
          ) : (
            <Icon name="cloud" className="opacity-80" />
          )}
        </button>
      </div>
    </header>
  );
}

function StatusBanner() {
  const sync = useSyncStatus();
  if (DEMO_MODE) return <div className="no-print bg-amber-100 px-4 py-1.5 text-center text-sm font-semibold text-amber-900">{t.app.demo}</div>;
  if (sync.authExpired)
    return (
      <Link href="/login/" className="no-print block bg-red-100 px-4 py-2 text-center font-semibold text-red-900">
        {t.app.sessionExpired} →
      </Link>
    );
  if (!sync.online)
    return (
      <div role="status" className="no-print flex items-center justify-center gap-2 bg-gray-900 px-4 py-2 text-center text-[15px] font-semibold text-white">
        <Icon name="offline" size={20} />
        {t.app.offline}
        {sync.pending > 0 && <span className="opacity-80">({sync.pending})</span>}
      </div>
    );
  if (sync.error && sync.pending > 0)
    return <div className="no-print bg-orange-100 px-4 py-1.5 text-center text-sm font-semibold text-orange-900">{t.app.syncError}</div>;
  return null;
}

/** Pull down at the top of a page to sync. A shortcut only — the header cloud button does the same. */
function usePullToRefresh(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let startY = 0;
    let pulling = false;
    let el: HTMLDivElement | null = null;
    const show = (dy: number) => {
      if (!el) {
        el = document.createElement("div");
        el.className = "fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-full bg-card px-4 py-2 text-sm font-semibold shadow-lg border border-line";
        document.body.appendChild(el);
      }
      el.textContent = dy > 80 ? t.app.refreshing : t.app.pullToRefresh;
      el.style.opacity = String(Math.min(1, dy / 80));
    };
    const hide = () => {
      el?.remove();
      el = null;
    };
    const onStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      pulling = window.scrollY <= 0 && !target.closest("[data-no-ptr],input,textarea,select");
      startY = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 20) show(dy);
      else hide();
    };
    const onEnd = (e: TouchEvent) => {
      if (!pulling) return;
      const dy = (e.changedTouches[0]?.clientY ?? startY) - startY;
      pulling = false;
      if (dy > 80) void syncNow().finally(() => setTimeout(hide, 400));
      else hide();
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      hide();
    };
  }, [enabled]);
}

export { f };

"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BottomNav, TopNav } from "@/components/mobile";
import { Icon, Skeleton, Toaster, Button } from "@/components/ui";
import { PinLock } from "@/components/PinLock";
import { ConfirmHost } from "@/components/ui/Confirm";
import { cachedUserId } from "@/lib/auth";
import { openStore, useStoreReady } from "@/lib/db";
import { startSyncLoop, syncNow, useSyncStatus } from "@/lib/offline-sync";
import { DEMO_MODE } from "@/lib/supabase";
import { useSettings } from "@/lib/settings";
import { hasPin, PIN_LOCK_AFTER_MS } from "@/lib/pin";
import { f, t } from "@/lib/i18n";


export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname() || "/";
  const router = useRouter();
  const isLogin = path.startsWith("/login");
  const ready = useStoreReady();
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
      // no sample data: a new install starts empty; existing data is pulled from the server
      if (!DEMO_MODE) await syncNow();
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
      <main className="mx-auto w-full max-w-5xl px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-16">
        {ready ? (
          children
        ) : (
          <Skeleton rows={5} />
        )}
      </main>
      <BottomNav />
      <Toaster />
      <ConfirmHost />
      {swWaiting && (
        <div className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface p-3 pl-4 md:bottom-6">
          <span className="flex-1 font-medium">{t.app.updateReady}</span>
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
    <header className="no-print sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 md:px-8">
        <Link href="/" className="flex min-h-12 min-w-0 flex-1 items-center gap-3 md:flex-none">
          {s.logo ? (
            <img src={s.logo} alt="" className="h-9 w-9 rounded-lg border border-line object-cover" />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-[15px] font-semibold text-on-accent" aria-hidden>
              ஸ்ரீ
            </span>
          )}
          <span className="truncate text-[17px] font-semibold">{s.businessName}</span>
        </Link>
        <div className="hidden flex-1 justify-center md:flex">
          <TopNav />
        </div>
        {!DEMO_MODE && (
          <button
            type="button"
            onClick={() => void syncNow()}
            className="tap flex items-center justify-center rounded-xl text-muted hover:bg-surface-2"
            aria-label={sync.online ? t.app.synced : t.app.offline}
            title={sync.online ? t.app.synced : t.app.offline}
          >
            {!sync.online ? (
              <Icon name="offline" size={20} className="text-danger" />
            ) : sync.syncing ? (
              <Icon name="refresh" size={20} className="animate-spin" />
            ) : sync.pending > 0 ? (
              <span className="rounded-full bg-accent-soft px-2 text-sm font-semibold text-accent-ink">{sync.pending}</span>
            ) : (
              <Icon name="cloud" size={20} />
            )}
          </button>
        )}
        <Link href="/settings/" aria-label={t.nav.settings} title={t.nav.settings} className="tap -mr-3 flex items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink">
          <Icon name="settings" size={22} />
        </Link>
      </div>
    </header>
  );
}

function StatusBanner() {
  const sync = useSyncStatus();
  const bar = "no-print border-b px-4 py-2 text-center text-sm font-medium";
  if (DEMO_MODE) return null;
  if (sync.authExpired)
    return (
      <Link href="/login/" className={`${bar} block border-line bg-danger-soft text-danger`}>
        {t.app.sessionExpired} →
      </Link>
    );
  if (!sync.online)
    return (
      <div role="status" className={`${bar} flex items-center justify-center gap-2 border-line bg-ink text-bg`}>
        <Icon name="offline" size={18} />
        {t.app.offline}
        {sync.pending > 0 && <span className="opacity-70">({sync.pending})</span>}
      </div>
    );
  if (sync.error && sync.pending > 0) return <div className={`${bar} border-line bg-danger-soft text-danger`}>{t.app.syncError}</div>;
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
        el.className = "fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full bg-surface px-4 py-2 text-sm font-medium border border-line";
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

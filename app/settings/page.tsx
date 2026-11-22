"use client";
import { useRef, useState } from "react";
import { Button, Field, PageTitle, TextInput, Toggle, toast } from "@/components/ui";
import { getUserId, pendingCount, save, wipeLocal } from "@/lib/db";
import { useSettings } from "@/lib/settings";
import { clearPin } from "@/lib/pin";
import { logout } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/supabase";
import { backupJson, downloadOrShare, excelFile, lastBackupAt, restoreJson } from "@/lib/backup";
import { dmy } from "@/lib/format";
import { f, t } from "@/lib/i18n";

export default function SettingsPage() {
  const s = useSettings();
  const [name, setName] = useState(s.businessName);
  const [phone, setPhone] = useState(s.phone);

  return (
    <>
      <PageTitle title={t.settings.title} back="/" />

      <section className="card space-y-4 p-4">
        <Field label={t.settings.businessName}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t.settings.phone}>
          <TextInput type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Button
          full
          icon="check"
          className="h-14 text-lg"
          onClick={() => {
            save("settings", { id: s.id ?? getUserId(), business_name: name.trim() || t.app.name, phone: phone.trim() || null });
            toast(t.common.saved);
          }}
        >
          {t.common.save}
        </Button>
      </section>

      <section className="card mt-4 p-4">
        <DarkModeToggle />
      </section>

      <h2 className="mt-6 mb-2 text-lg font-bold">{t.settings.backup}</h2>
      <BackupPanel />

      {!DEMO_MODE && (
        <Button
          full
          variant="secondary"
          className="mt-6"
          onClick={async () => {
            if (pendingCount() > 0 && !confirm(t.login.logoutWarn)) return;
            const uid = getUserId();
            clearPin();
            await logout();
            await wipeLocal(uid);
            location.href = "/login/";
          }}
        >
          {t.login.logout}
        </Button>
      )}
    </>
  );
}

function DarkModeToggle() {
  const [dark, setDark] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  return (
    <Toggle
      checked={dark}
      label={t.settings.darkMode}
      onChange={(v) => {
        setDark(v);
        document.documentElement.classList.toggle("dark", v);
        localStorage.setItem("scc_theme", v ? "dark" : "light");
      }}
    />
  );
}

function BackupPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [last, setLast] = useState(lastBackupAt());
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      setLast(lastBackupAt());
    } catch (e) {
      toast(String((e as Error).message || e), "bad");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card space-y-2 p-4">
      {last && <p className="text-sm text-muted">{f(t.settings.lastBackup, { date: dmy(last) })}</p>}
      <Button full variant="good" icon="share" disabled={busy} onClick={() => run(() => downloadOrShare(backupJson(), true))}>
        {t.settings.shareBackup}
      </Button>
      <Button full variant="secondary" icon="download" disabled={busy} onClick={() => run(async () => downloadOrShare(await excelFile(), false))}>
        {t.settings.exportExcel}
      </Button>
      <Button full variant="ghost" icon="upload" disabled={busy} onClick={() => fileRef.current?.click()}>
        {t.settings.restore}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file || !confirm(t.settings.restoreConfirm)) return;
          void run(async () => {
            try {
              toast(f(t.settings.restoreDone, { n: await restoreJson(file) }));
            } catch {
              toast(t.settings.restoreBad, "bad");
            }
          });
        }}
      />
    </section>
  );
}

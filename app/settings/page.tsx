"use client";
import { useRef, useState } from "react";
import { Button, Field, Icon, PageTitle, TextInput, Toggle, toast } from "@/components/ui";
import { getUserId, pendingCount, save, wipeLocal } from "@/lib/db";
import { useSettings } from "@/lib/settings";
import { clearPin } from "@/lib/pin";
import { logout } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/supabase";
import { downloadOrShare, excelFile, lastBackupAt } from "@/lib/backup";
import { askConfirm } from "@/components/ui/Confirm";
import { dmy } from "@/lib/format";
import { f, t } from "@/lib/i18n";

export default function SettingsPage() {
  const s = useSettings();
  const [name, setName] = useState(s.businessName);

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle title={t.settings.title} back="/" />

      <h2 className="t-heading mb-3">{t.settings.business}</h2>
      <section className="card space-y-5 p-4 md:p-6">
        <LogoEditor />
        <Field label={t.settings.businessName}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Button
          full
          icon="check"
          onClick={() => {
            save("settings", { id: s.id ?? getUserId(), business_name: name.trim() || t.app.name });
            toast(t.common.saved);
          }}
        >
          {t.common.save}
        </Button>
      </section>

      <h2 className="t-heading mt-8 mb-3">{t.settings.display}</h2>
      <section className="card px-4 py-1 md:px-6">
        <DarkModeToggle />
      </section>

      <h2 className="t-heading mt-8 mb-3">{t.settings.backup}</h2>
      <BackupPanel />

      {!DEMO_MODE && (
        <Button
          full
          variant="secondary"
          className="mt-8"
          onClick={async () => {
            if (!(await askConfirm({ title: t.confirm.logoutTitle, message: pendingCount() > 0 ? t.login.logoutWarn : undefined, confirmLabel: t.login.logout, danger: pendingCount() > 0 }))) return;
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
    </div>
  );
}

/** Pick a logo from the gallery/camera. Resized to fit 256×256 so it stays small, syncs fast and works offline. */
async function resizeLogo(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const size = 256;
  const scale = Math.min(1, size / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.drawImage(img, 0, 0, w, h);
  img.close();
  // keep well under the database limit (300 KB of text)
  for (const q of [0.9, 0.75, 0.6]) {
    const url = c.toDataURL("image/webp", q);
    if (url.length < 250_000) return url;
  }
  return c.toDataURL("image/jpeg", 0.6);
}

function LogoEditor() {
  const s = useSettings();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const id = s.id ?? getUserId();

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      if (!file.type.startsWith("image/")) throw new Error("not an image");
      save("settings", { id, logo_data_url: await resizeLogo(file) });
      toast(t.settings.logoSaved);
    } catch {
      toast(t.settings.logoBad, "bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <span className="t-label mb-1.5 block">{t.settings.logo}</span>
      <div className="flex items-center gap-4">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-white">
          {s.logo ? (
            <img src={s.logo} alt={t.settings.logo} className="h-full w-full object-contain" />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-accent text-2xl font-semibold text-on-accent" aria-hidden>
              ஸ்ரீ
            </span>
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <Button variant="secondary" icon="upload" disabled={busy} onClick={() => input.current?.click()}>
            {s.logo ? t.settings.changeLogo : t.settings.addLogo}
          </Button>
          {s.logo && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (await askConfirm({ title: t.settings.removeLogoTitle, message: t.settings.removeLogoMsg, confirmLabel: t.confirm.delete, danger: true })) {
                  save("settings", { id, logo_data_url: null });
                  toast(t.common.deleted, "neutral");
                }
              }}
              className="flex min-h-11 items-center gap-1.5 px-1 text-sm font-medium text-muted hover:text-danger"
            >
              <Icon name="trash" size={16} /> {t.settings.removeLogo}
            </button>
          )}
        </div>
      </div>
      <p className="t-caption mt-2">{t.settings.logoHint}</p>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void onFile(file);
        }}
      />
    </div>
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
  const [last, setLast] = useState(lastBackupAt());
  const [busy, setBusy] = useState(false);
  const run = async (share: boolean) => {
    setBusy(true);
    try {
      await downloadOrShare(await excelFile(), share);
      setLast(lastBackupAt());
    } catch (e) {
      toast(String((e as Error).message || e), "bad");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card space-y-2 p-4 md:p-6">
      {last && <p className="text-sm text-muted">{f(t.settings.lastBackup, { date: dmy(last) })}</p>}
      <Button full variant="primary" icon="share" disabled={busy} onClick={() => run(true)}>
        {t.settings.shareBackup}
      </Button>
      <Button full variant="secondary" icon="download" disabled={busy} onClick={() => run(false)}>
        {t.settings.exportExcel}
      </Button>
    </section>
  );
}

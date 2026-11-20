"use client";
import { useEffect, useRef, useState } from "react";
import { Button, Field, IconButton, NumberInput, PageTitle, Section, Select, TextArea, TextInput, Toggle, toast } from "@/components/ui";
import { BottomSheet } from "@/components/mobile";
import { PinPad } from "@/components/PinLock";
import { getUserId, newId, pendingCount, save, archive, useTable, wipeLocal, getRows } from "@/lib/db";
import { useSettings } from "@/lib/settings";
import { clearPin, hasPin, setPin } from "@/lib/pin";
import { logout } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/supabase";
import { backupJson, downloadOrShare, excelFile, lastBackupAt, ordersCsv, restoreJson } from "@/lib/backup";
import { dmy, paiseToInput, rupeesToPaise } from "@/lib/format";
import type { ExpenseMode } from "@/lib/calc";
import type { ExpenseType } from "@/lib/types";
import { f, t } from "@/lib/i18n";

export default function SettingsPage() {
  const s = useSettings();
  const [form, setForm] = useState(() => ({
    business_name: s.businessName,
    phone: s.phone,
    address: s.address,
    margin: String(s.marginPct),
    wastage: String(s.wastagePct),
    round: String(s.priceRoundRupees),
    kg: String(s.rounding.kg),
    kgSmall: String(s.rounding.kgSmall),
    l: String(s.rounding.l),
    lSmall: String(s.rounding.lSmall),
    gst_enabled: s.gstEnabled,
    gst: String(s.gstPct),
  }));
  const patch = (p: Partial<typeof form>) => setForm({ ...form, ...p });
  const num = (v: string, d: number) => (v.trim() === "" || !Number.isFinite(Number(v)) ? d : Number(v));

  function saveSettings() {
    save("settings", {
      id: s.id ?? getUserId(),
      business_name: form.business_name.trim() || t.app.name,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      logo_data_url: s.logo,
      default_margin_pct: num(form.margin, 30),
      default_wastage_pct: Math.min(100, num(form.wastage, 5)),
      price_round_rupees: Math.max(0, Math.round(num(form.round, 5))),
      rounding: { kg: num(form.kg, 0.25), kgSmall: num(form.kgSmall, 0.05), l: num(form.l, 0.25), lSmall: num(form.lSmall, 0.05) },
      gst_enabled: form.gst_enabled,
      gst_pct: num(form.gst, 5),
    });
    toast(t.common.saved);
  }

  // jump to #expenses / #backup from the More menu
  useEffect(() => {
    if (location.hash) document.querySelector(location.hash)?.scrollIntoView({ block: "start" });
  }, []);

  const n = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => patch({ [k]: e.target.value.replace(/[^0-9.]/g, "") });

  return (
    <>
      <PageTitle title={t.settings.title} back="/more/" />

      <Section title={t.settings.business} className="mt-0">
        <div className="card space-y-4 p-4">
          <LogoEditor />
          <Field label={t.settings.businessName}>
            <TextInput value={form.business_name} onChange={(e) => patch({ business_name: e.target.value })} />
          </Field>
          <Field label={t.settings.phone}>
            <TextInput type="tel" inputMode="tel" value={form.phone} onChange={(e) => patch({ phone: e.target.value })} />
          </Field>
          <Field label={t.settings.address}>
            <TextArea rows={2} value={form.address} onChange={(e) => patch({ address: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section title={t.settings.defaults}>
        <div className="card space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.settings.margin}>
              <NumberInput value={form.margin} onChange={n("margin")} />
            </Field>
            <Field label={t.settings.wastage}>
              <NumberInput value={form.wastage} onChange={n("wastage")} />
            </Field>
          </div>
          <Field label={t.settings.priceRound}>
            <NumberInput decimal={false} value={form.round} onChange={n("round")} />
          </Field>
          <div>
            <div className="font-semibold">{t.settings.rounding}</div>
            <p className="mb-2 text-sm text-muted">{t.settings.roundingHint}</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t.settings.kgStep}>
                <NumberInput value={form.kg} onChange={n("kg")} />
              </Field>
              <Field label={t.settings.kgSmall}>
                <NumberInput value={form.kgSmall} onChange={n("kgSmall")} />
              </Field>
              <Field label={t.settings.lStep}>
                <NumberInput value={form.l} onChange={n("l")} />
              </Field>
              <Field label={t.settings.lSmall}>
                <NumberInput value={form.lSmall} onChange={n("lSmall")} />
              </Field>
            </div>
          </div>
          <div className="border-t border-line pt-3">
            <Toggle checked={form.gst_enabled} onChange={(v) => patch({ gst_enabled: v })} label={t.settings.gstEnabled} />
            {form.gst_enabled && (
              <Field label={t.settings.gstPct}>
                <NumberInput value={form.gst} onChange={n("gst")} />
              </Field>
            )}
          </div>
          <Button full icon="check" className="h-14 text-lg" onClick={saveSettings}>
            {t.common.save}
          </Button>
        </div>
      </Section>

      <div id="expenses" className="scroll-mt-16" />
      <Section title={t.settings.expenseRates}>
        <ExpenseTypes />
      </Section>

      <Section title={t.settings.security}>
        <div className="card space-y-3 p-4">
          <PinSetting />
          <DarkModeToggle />
        </div>
      </Section>

      <div id="backup" className="scroll-mt-16" />
      <Section title={t.settings.backup}>
        <BackupPanel />
      </Section>

      <Section title={t.settings.account}>
        <div className="card space-y-2 p-4">
          {!DEMO_MODE && (
            <Button
              full
              variant="secondary"
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
          <p className="text-center text-sm text-muted">
            {t.settings.version} 1.0.0 {DEMO_MODE && "· demo"}
          </p>
        </div>
      </Section>
    </>
  );
}

function LogoEditor() {
  const s = useSettings();
  const input = useRef<HTMLInputElement>(null);
  const onFile = async (file: File) => {
    // resize to 256px so the logo stays small enough to sync and store offline
    const img = await createImageBitmap(file);
    const size = 256;
    const scale = Math.min(1, size / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    save("settings", { id: s.id ?? getUserId(), logo_data_url: c.toDataURL("image/webp", 0.85) });
    toast(t.common.saved);
  };
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-line bg-app text-3xl">{s.logo ? <img src={s.logo} alt="" className="h-full w-full object-cover" /> : "🪔"}</div>
      <div className="flex flex-1 flex-wrap gap-2">
        <Button variant="secondary" onClick={() => input.current?.click()}>
          {t.settings.changeLogo}
        </Button>
        {s.logo && (
          <Button variant="ghost" onClick={() => save("settings", { id: s.id ?? getUserId(), logo_data_url: null })}>
            {t.settings.removeLogo}
          </Button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    </div>
  );
}

function ExpenseTypes() {
  const rows = useTable("expense_types");
  const sorted = [...rows].sort((a, b) => a.sort - b.sort);
  return (
    <div className="space-y-2">
      {sorted.map((e) => (
        <ExpenseRow key={e.id} e={e} />
      ))}
      <Button
        variant="secondary"
        full
        icon="plus"
        onClick={() => save("expense_types", { id: newId(), name: t.categories.other, mode: "fixed", rate_paise: 0, sort: (sorted.at(-1)?.sort ?? 0) + 1 })}
      >
        {t.calc.addExpense.replace("+ ", "")}
      </Button>
    </div>
  );
}

function ExpenseRow({ e }: { e: ExpenseType }) {
  const [name, setName] = useState(e.name);
  const [rate, setRate] = useState(paiseToInput(e.rate_paise));
  return (
    <div className="card p-3">
      <div className="flex items-center gap-2">
        <TextInput aria-label={t.common.notes} value={name} onChange={(ev) => setName(ev.target.value)} onBlur={() => name.trim() && name !== e.name && save("expense_types", { id: e.id, name: name.trim() })} className="flex-1 font-semibold" />
        <IconButton icon="trash" label={t.common.delete} className="text-bad" onClick={() => confirm(t.common.confirmDelete) && archive("expense_types", e.id)} />
      </div>
      <div className="mt-2 flex gap-2">
        <div className="relative w-32 shrink-0">
          <span className="absolute top-1/2 left-3 -translate-y-1/2 font-bold">₹</span>
          <NumberInput aria-label={t.common.amount} value={rate} onChange={(ev) => setRate(ev.target.value.replace(/[^0-9.]/g, ""))} onBlur={() => save("expense_types", { id: e.id, rate_paise: rupeesToPaise(rate) })} className="pl-7 text-lg font-bold" />
        </div>
        <Select aria-label={t.common.unit} value={e.mode} onChange={(ev) => save("expense_types", { id: e.id, mode: ev.target.value as ExpenseMode })} className="min-w-0 flex-1">
          {(["per_person", "per_session", "fixed"] as const).map((m) => (
            <option key={m} value={m}>
              {t.expenseModes[m]}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

function PinSetting() {
  const [on, setOn] = useState(hasPin());
  const [step, setStep] = useState<null | "set" | "confirm">(null);
  const [first, setFirst] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <div className="flex items-center gap-3">
        <span className="flex-1 font-semibold">
          {t.settings.pinLock} {on && <span className="text-sm text-good">✓ {t.settings.pinOn}</span>}
        </span>
        {on ? (
          <Button
            variant="secondary"
            onClick={() => {
              clearPin();
              setOn(false);
            }}
          >
            {t.settings.pinRemove}
          </Button>
        ) : (
          <Button variant="secondary" icon="lock" onClick={() => setStep("set")}>
            {t.settings.pinSet}
          </Button>
        )}
      </div>
      <BottomSheet open={!!step} onClose={() => (setStep(null), setError(null))} title={t.settings.pinLock}>
        <div className="py-4">
          {step === "set" && (
            <PinPad
              key="set"
              title={t.pin.set}
              onComplete={(p) => {
                setFirst(p);
                setError(null);
                setStep("confirm");
              }}
            />
          )}
          {step === "confirm" && (
            <PinPad
              key="confirm"
              title={t.pin.confirm}
              error={error}
              onComplete={async (p) => {
                if (p !== first) {
                  setError(t.pin.mismatch);
                  setStep("set");
                  return;
                }
                await setPin(p);
                sessionStorage.setItem("scc_unlocked", "1");
                setOn(true);
                setStep(null);
                toast(t.common.saved);
              }}
            />
          )}
        </div>
      </BottomSheet>
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
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", v ? "#1c1b1a" : "#9a3412");
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
    <div className="card space-y-2 p-4">
      {last && <p className="text-sm text-muted">{f(t.settings.lastBackup, { date: dmy(last) })}</p>}
      <Button full variant="good" icon="share" disabled={busy} onClick={() => run(() => downloadOrShare(backupJson(), true))}>
        {t.settings.shareBackup}
      </Button>
      <Button full variant="secondary" icon="download" disabled={busy} onClick={() => run(() => downloadOrShare(backupJson(), false))}>
        {t.settings.exportJson}
      </Button>
      <Button full variant="secondary" icon="download" disabled={busy} onClick={() => run(async () => downloadOrShare(await excelFile(), false))}>
        {t.settings.exportExcel}
      </Button>
      <Button full variant="secondary" icon="download" disabled={busy} onClick={() => run(() => downloadOrShare(ordersCsv(), false))}>
        {t.settings.exportCsv}
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
              const count = await restoreJson(file);
              toast(f(t.settings.restoreDone, { n: count }));
            } catch {
              toast(t.settings.restoreBad, "bad");
            }
          });
        }}
      />
      {getRows("dishes").length === 0 && <p className="text-sm text-muted">{t.settings.loadSample}: Supabase → seed.sql</p>}
    </div>
  );
}

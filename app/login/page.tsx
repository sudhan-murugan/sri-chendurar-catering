"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, TextInput } from "@/components/ui";
import { login } from "@/lib/auth";
import { t } from "@/lib/i18n";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      router.replace("/");
    } catch {
      setError(navigator.onLine ? t.login.error : t.app.offline);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-xl font-semibold text-on-accent" aria-hidden>
          ஸ்ரீ
        </span>
        <h1 className="t-title mt-4">{t.app.name}</h1>
        <p className="t-caption">{t.login.title}</p>
      </div>
      <form onSubmit={submit} className="card space-y-5 p-6">
        <Field label={t.login.email}>
          <TextInput type="email" autoComplete="username" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t.login.password} error={error}>
          <TextInput type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" full disabled={busy}>
          {busy ? t.app.loading : t.login.submit}
        </Button>
      </form>
    </main>
  );
}

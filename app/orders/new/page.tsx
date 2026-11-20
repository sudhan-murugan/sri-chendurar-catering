"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Chips, Field, Money, NumberInput, PageTitle, TextArea, TextInput, toast } from "@/components/ui";
import { StickyActionBar } from "@/components/mobile";
import { ExpenseEditor, PricePanel, SessionsEditor, SummaryCard } from "@/components/CalcPanels";
import { getRow } from "@/lib/db";
import { readCalcDraft, useCalcResult } from "@/lib/calc-state";
import { useDraft } from "@/lib/draft";
import { duplicateForm, emptyOrderForm, orderFormFromOrder, saveOrderForm, type OrderForm } from "@/lib/orders";
import { EVENT_TYPES, PAY_METHODS } from "@/lib/types";
import { rupeesToPaise } from "@/lib/format";
import { f, t } from "@/lib/i18n";

const STEPS = [t.orders.customer, t.orders.dateVenue, t.orders.menuPeople, t.orders.price, t.orders.advance];

export default function NewOrderPage() {
  return (
    <Suspense>
      <Wizard />
    </Suspense>
  );
}

function Wizard() {
  const params = useSearchParams();
  const router = useRouter();
  const editId = params.get("id");
  const dupId = params.get("dup");
  const fromCalc = params.get("from") === "calc";
  const editing = editId ? getRow("orders", editId) : undefined;
  const draftKey = editId ? `order:${editId}` : "order:new";

  const { value: form, set, clear, restored } = useDraft<OrderForm>(draftKey, () => (editing ? orderFormFromOrder(editing) : emptyOrderForm(fromCalc ? readCalcDraft() : null)));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { result, expenses, compute } = useCalcResult(form.calc);
  const once = useRef(false);

  // starting from the calculator or duplicating overrides any older draft
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    if (fromCalc && restored) {
      const c = readCalcDraft();
      if (c) set((p) => ({ ...p, calc: c }));
    }
    if (dupId) {
      const o = getRow("orders", dupId);
      if (o) set(duplicateForm(o));
    }
  }, [fromCalc, dupId, restored, set]);

  const patch = (p: Partial<OrderForm>) => set((prev) => ({ ...prev, ...p }));

  async function validate(s: number): Promise<boolean> {
    const { fieldErrors, orderCustomerSchema, orderDateSchema } = await import("@/lib/schemas");
    if (s === 0) {
      const r = orderCustomerSchema.safeParse(form);
      if (!r.success) return setErrors(fieldErrors(r.error)), false;
    }
    if (s === 1) {
      const r = orderDateSchema.safeParse({ event_date: form.event_date, event_time: form.event_time || null, venue: form.venue || null });
      if (!r.success) return setErrors(fieldErrors(r.error)), false;
    }
    if (s === 2 && result.plates === 0) return setErrors({ menu: t.calc.noMenu }), false;
    setErrors({});
    return true;
  }

  async function next() {
    if (!(await validate(step))) return;
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      window.scrollTo({ top: 0 });
      return;
    }
    for (let s = 0; s < 3; s++)
      if (!(await validate(s))) {
        setStep(s);
        return;
      }
    const id = saveOrderForm(form, editId, compute);
    clear();
    toast(t.common.saved);
    router.replace(`/orders/view/?id=${id}`);
  }

  const advance = rupeesToPaise(form.advance);

  return (
    <>
      <PageTitle title={editing ? `${t.common.edit}: ${editing.customer_name}` : t.orders.new} back={editId ? `/orders/view/?id=${editId}` : "/orders/"} />

      {/* progress */}
      <div className="mb-4">
        <div className="flex gap-1.5" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={`h-2 flex-1 rounded-full ${i <= step ? "bg-brand-600" : "bg-[var(--line)]"}`} />
          ))}
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <h2 className="text-xl font-bold">{STEPS[step]}</h2>
          <span className="text-sm text-muted">{f(t.orders.step, { n: step + 1, total: STEPS.length })}</span>
        </div>
        {fromCalc && step === 0 && <p className="text-sm text-good">✓ {t.orders.fromCalcNote}</p>}
      </div>

      {step === 0 && (
        <div className="card space-y-4 p-4">
          <Field label={t.orders.customerName} error={errors.customer_name}>
            <TextInput value={form.customer_name} autoComplete="name" onChange={(e) => patch({ customer_name: e.target.value })} />
          </Field>
          <Field label={t.orders.phone} error={errors.phone}>
            <TextInput type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => patch({ phone: e.target.value })} />
          </Field>
          <div>
            <div className="mb-1 font-semibold">{t.orders.eventType}</div>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => patch({ event_type: e })}
                  className={`h-12 rounded-xl border-2 px-4 font-semibold ${form.event_type === e ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-card"}`}
                >
                  {t.events[e]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="card space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.orders.eventDate} error={errors.event_date}>
              <TextInput type="date" value={form.event_date} onChange={(e) => patch({ event_date: e.target.value })} />
            </Field>
            <Field label={t.orders.eventTime}>
              <TextInput type="time" value={form.event_time} onChange={(e) => patch({ event_time: e.target.value })} />
            </Field>
          </div>
          <Field label={t.orders.venue}>
            <TextArea rows={2} value={form.venue} onChange={(e) => patch({ venue: e.target.value })} />
          </Field>
          <Field label={`${t.orders.mapUrl} ${t.common.optional}`}>
            <TextInput type="url" inputMode="url" value={form.venue_map_url} onChange={(e) => patch({ venue_map_url: e.target.value })} />
          </Field>
          <div>
            <div className="mb-1 font-semibold">{t.orders.status}</div>
            <Chips options={(["enquiry", "confirmed"] as const).map((s) => ({ value: s, label: t.status[s] }))} value={form.status === "enquiry" ? "enquiry" : "confirmed"} onChange={(status) => patch({ status })} />
          </div>
        </div>
      )}

      {step === 2 && (
        <>
          <SessionsEditor state={form.calc} onChange={(calc) => patch({ calc })} />
          {errors.menu && <p className="mt-2 font-semibold text-bad">{errors.menu}</p>}
        </>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <SummaryCard r={result} />
          <PricePanel state={form.calc} result={result} onChange={(calc) => patch({ calc })} />
          <details className="card p-3">
            <summary className="flex min-h-12 cursor-pointer items-center justify-between font-bold">
              {t.calc.otherExpenses} <Money paise={result.expenseCostPaise} />
            </summary>
            <div className="mt-2">
              <ExpenseEditor expenses={expenses} result={result} onChange={(e) => patch({ calc: { ...form.calc, expenses: e } })} />
            </div>
          </details>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div className="card space-y-4 p-4">
            <Field label={`${t.orders.advance} ₹`}>
              <NumberInput value={form.advance} onChange={(e) => patch({ advance: e.target.value.replace(/[^0-9.]/g, "") })} className="h-16 text-3xl font-bold" />
            </Field>
            <Chips options={PAY_METHODS.map((m) => ({ value: m, label: t.methods[m] }))} value={form.advance_method} onChange={(advance_method) => patch({ advance_method })} />
            <Field label={t.common.notes}>
              <TextArea value={form.notes} onChange={(e) => patch({ notes: e.target.value })} />
            </Field>
          </div>
          <div className="card space-y-1 p-4 text-[17px]">
            <div className="flex justify-between">
              <span className="text-muted">{t.orders.orderAmount}</span>
              <Money paise={result.customerTotalPaise} className="font-bold" />
            </div>
            <div className="flex justify-between">
              <span className="text-muted">{t.orders.advance}</span>
              <Money paise={advance} className="text-good" />
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-xl font-bold">
              <span>{t.orders.balance}</span>
              <Money paise={result.customerTotalPaise - advance} className={result.customerTotalPaise - advance > 0 ? "text-bad" : "text-good"} />
            </div>
          </div>
        </div>
      )}

      <StickyActionBar>
        {step > 0 && (
          <Button variant="secondary" className="h-14 flex-1" icon="back" onClick={() => setStep(step - 1)}>
            {t.common.back}
          </Button>
        )}
        <Button className="h-14 flex-[2] text-lg" icon={step === STEPS.length - 1 ? "check" : undefined} onClick={next}>
          {step === STEPS.length - 1 ? t.common.save : `${t.common.next} →`}
        </Button>
      </StickyActionBar>
    </>
  );
}

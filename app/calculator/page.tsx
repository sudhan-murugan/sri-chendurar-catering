"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, IconButton, PageTitle, Section } from "@/components/ui";
import { BottomSheet, StickyActionBar } from "@/components/mobile";
import { CompactSummary, ExpenseEditor, IngredientLines, PricePanel, SessionsEditor, StepLabel, SummaryCard } from "@/components/CalcPanels";
import { CALC_DRAFT_KEY, emptyCalc, sessionLabel, useCalcResult, type CalcState } from "@/lib/calc-state";
import { useDraft } from "@/lib/draft";
import { useRowMap } from "@/lib/db";
import { useSettings } from "@/lib/settings";
import { openWhatsApp, quotationText, shareText, shoppingListText } from "@/lib/share";
import { t } from "@/lib/i18n";

export default function CalculatorPage() {
  const router = useRouter();
  const { value: state, set } = useDraft<CalcState>(CALC_DRAFT_KEY, emptyCalc);
  const { result, expenses } = useCalcResult(state);
  const settings = useSettings();
  const dishMap = useRowMap("dishes");
  const [sharing, setSharing] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [summaryVisible, setSummaryVisible] = useState(true);
  const hasMenu = state.sessions.some((s) => s.dishes.length > 0 && s.headcount > 0);

  useEffect(() => {
    const el = summaryRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSummaryVisible(e.isIntersecting || e.boundingClientRect.top > 0), { rootMargin: "-56px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMenu]);

  const quote = () =>
    quotationText({
      businessName: settings.businessName,
      businessPhone: settings.phone,
      sessions: state.sessions.map((s) => ({ label: sessionLabel(s), headcount: s.headcount, dishes: s.dishes.map((d) => dishMap.get(d.dishId)?.name_ta ?? "") })),
      result,
    });
  const listText = () => shoppingListText(settings.businessName, result.lines, `${result.plates} ${t.common.people}`);

  return (
    <>
      <PageTitle
        title={t.calc.title}
        right={
          <IconButton icon="refresh" label={t.calc.reset} onClick={() => confirm(`${t.calc.reset}?`) && set(emptyCalc())} />
        }
      />

      <SessionsEditor state={state} onChange={set} />

      <StepLabel n={3} text={t.calc.result} />
      {!hasMenu ? (
        <p className="card p-4 text-center text-muted">{t.calc.noMenu}</p>
      ) : (
        <>
          <div ref={summaryRef}>
            <SummaryCard r={result} />
          </div>
          {!summaryVisible && <CompactSummary r={result} />}

          {result.warnings.length > 0 && (
            <div className="mt-3 rounded-xl bg-orange-50 p-3 text-[15px] text-orange-900 dark:bg-orange-950 dark:text-orange-100">
              <b>{t.calc.warnings}:</b>
              <ul className="list-disc pl-5">
                {result.warnings.slice(0, 6).map((w) => (
                  <li key={w.message}>{w.message}</li>
                ))}
              </ul>
            </div>
          )}

          <Section title={t.calc.ingredientQty} right={<span className="font-bold tabular-nums">{t.calc.ingredientCost}</span>}>
            <IngredientLines lines={result.lines} />
          </Section>

          <Section title={t.calc.otherExpenses}>
            <ExpenseEditor expenses={expenses} result={result} onChange={(e) => set({ ...state, expenses: e })} />
          </Section>

          <Section title={t.calc.sellingPrice}>
            <PricePanel state={state} result={result} onChange={set} />
          </Section>

          <StickyActionBar>
            <Button className="h-14 flex-[1.4] px-2" icon="check" onClick={() => router.push("/orders/new/?from=calc")}>
              {t.calc.saveOrder}
            </Button>
            <Button variant="secondary" className="h-14 flex-1 px-2" icon="list" onClick={() => router.push("/shopping-list/?src=calc")}>
              {t.calc.list}
            </Button>
            <IconButton icon="share" label={t.calc.share} onClick={() => setSharing(true)} className="h-14 w-14 shrink-0 rounded-xl border-2 border-brand-600 text-brand-700 dark:text-brand-100" />
          </StickyActionBar>
        </>
      )}

      <BottomSheet open={sharing} onClose={() => setSharing(false)} title={t.calc.share}>
        <div className="space-y-3 pb-2">
          <Button full variant="good" icon="whatsapp" className="h-14 text-lg" onClick={() => openWhatsApp(quote())}>
            {t.calc.quotation} – {t.common.whatsapp}
          </Button>
          <Button full variant="good" icon="whatsapp" className="h-14 text-lg" onClick={() => openWhatsApp(listText())}>
            {t.calc.list} – {t.common.whatsapp}
          </Button>
          <Button full variant="secondary" icon="share" className="h-14 text-lg" onClick={() => shareText(quote(), t.calc.quotation)}>
            {t.calc.quotation} – {t.common.share}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}

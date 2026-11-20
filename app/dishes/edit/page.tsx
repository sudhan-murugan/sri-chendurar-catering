"use client";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge, Button, Field, IconButton, NumberInput, PageTitle, Section, Select, TextInput, toast } from "@/components/ui";
import { NumberStepper, StickyActionBar } from "@/components/mobile";
import { IngredientPicker } from "@/components/Pickers";
import { getRow, getRows, newId, saveMany, useRowMap, type SaveOp } from "@/lib/db";
import { useCalcData } from "@/lib/calc-data";
import { dishCostPerPerson, type CalcDish } from "@/lib/calc";
import { replaceChildren } from "@/lib/actions";
import { useDraft } from "@/lib/draft";
import { useSettings } from "@/lib/settings";
import { compatibleUnits, convert, UNIT_LABEL, type Unit } from "@/lib/units";
import { money } from "@/lib/format";
import { f, t } from "@/lib/i18n";

interface Line {
  id?: string;
  ingredient_id: string;
  qty: string;
  unit: Unit;
}
interface Form {
  name_ta: string;
  name_en: string;
  batch_size: number;
  serving_note: string;
  wastage: string; // "" = use default
  lines: Line[];
}

export default function DishEditPage() {
  return (
    <Suspense>
      <DishEdit />
    </Suspense>
  );
}

function loadForm(id: string | null): Form {
  const d = getRow("dishes", id);
  if (!d) return { name_ta: "", name_en: "", batch_size: 100, serving_note: "", wastage: "", lines: [] };
  const lines = getRows("recipe_items")
    .filter((r) => r.dish_id === d.id)
    .sort((a, b) => a.sort - b.sort)
    .map((r) => ({ id: r.id, ingredient_id: r.ingredient_id, qty: String(Number(r.qty)), unit: r.unit }));
  return {
    name_ta: d.name_ta,
    name_en: d.name_en ?? "",
    batch_size: d.batch_size,
    serving_note: d.serving_note ?? "",
    wastage: d.wastage_pct === null ? "" : String(d.wastage_pct),
    lines,
  };
}

function DishEdit() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const dish = getRow("dishes", id);
  const draftKey = `dish:${id ?? "new"}`;
  const { value: form, set: setForm, clear, restored } = useDraft<Form>(draftKey, () => loadForm(id));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<{ index: number | null } | null>(null);
  const ingMap = useRowMap("ingredients");
  const data = useCalcData();
  const settings = useSettings();

  const calcDish: CalcDish = useMemo(
    () => ({
      id: "draft",
      name: form.name_ta,
      batchSize: form.batch_size,
      wastagePct: form.wastage === "" ? null : Number(form.wastage),
      items: form.lines.filter((l) => l.ingredient_id).map((l) => ({ ingredientId: l.ingredient_id, qty: Number(l.qty) || 0, unit: l.unit })),
    }),
    [form],
  );
  const perPerson = dishCostPerPerson(calcDish, data.ingredients, settings.wastagePct);
  const batchCost = perPerson * form.batch_size;

  const patch = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));
  const patchLine = (i: number, p: Partial<Line>) => setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, ...p } : l)) }));

  async function save() {
    const { dishSchema, fieldErrors } = await import("@/lib/schemas");
    const parsed = dishSchema.safeParse({
      name_ta: form.name_ta,
      name_en: form.name_en,
      batch_size: form.batch_size,
      serving_note: form.serving_note,
      wastage_pct: form.wastage === "" ? null : Number(form.wastage),
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    const dishId = id ?? newId();
    const lines = form.lines
      .filter((l) => l.ingredient_id && Number(l.qty) > 0)
      .map((l, i) => ({ id: l.id, ingredient_id: l.ingredient_id, qty: Number(l.qty), unit: l.unit, sort: i }));
    const ops: SaveOp[] = [
      { table: "dishes", row: { id: dishId, ...parsed.data, is_sample: false } },
      ...replaceChildren("recipe_items", "dish_id", dishId, lines),
    ];
    saveMany(ops);
    clear();
    toast(t.common.saved);
    router.push("/dishes/");
  }

  function remove() {
    if (!id || !confirm(t.common.confirmDelete)) return;
    const ops: SaveOp[] = [{ table: "dishes", row: { id, archived: true } }];
    for (const ci of getRows("combo_items")) if (ci.dish_id === id) ops.push({ table: "combo_items", row: { id: ci.id, archived: true } });
    saveMany(ops);
    clear();
    toast(t.common.deleted, "neutral");
    router.push("/dishes/");
  }

  return (
    <>
      <PageTitle
        title={id ? form.name_ta || t.dishes.title : t.dishes.new}
        back="/dishes/"
        right={id ? <IconButton icon="trash" label={t.common.delete} onClick={remove} className="text-bad" /> : undefined}
      />
      {dish?.is_sample && (
        <div className="mb-3">
          <Badge tone="soon">{t.common.sample}</Badge>
        </div>
      )}
      {restored && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-blue-50 p-3 text-[15px] text-blue-900 dark:bg-blue-950 dark:text-blue-100">
          <span className="flex-1">{t.common.draftRestored}</span>
          <Button
            variant="ghost"
            onClick={() => {
              clear();
              setForm(loadForm(id));
            }}
          >
            {t.common.clearDraft}
          </Button>
        </div>
      )}

      <div className="card space-y-4 p-4">
        <Field label={t.dishes.name} error={errors.name_ta}>
          <TextInput value={form.name_ta} onChange={(e) => patch({ name_ta: e.target.value })} />
        </Field>
        <Field label={`${t.dishes.nameEn} ${t.common.optional}`}>
          <TextInput value={form.name_en} onChange={(e) => patch({ name_en: e.target.value })} lang="en" />
        </Field>
        <Field label={t.dishes.batch} error={errors.batch_size}>
          <NumberStepper label={t.dishes.batch} value={form.batch_size} step={10} min={1} onChange={(v) => patch({ batch_size: v })} />
        </Field>
        <Field label={t.dishes.serving} hint={t.dishes.servingHint}>
          <TextInput value={form.serving_note} onChange={(e) => patch({ serving_note: e.target.value })} />
        </Field>
        <Field label={t.dishes.wastage} error={errors.wastage_pct}>
          <NumberInput value={form.wastage} placeholder={f(t.dishes.wastageDefault, { n: settings.wastagePct })} onChange={(e) => patch({ wastage: e.target.value.replace(/[^0-9.]/g, "") })} />
        </Field>
      </div>

      <Section title={`${t.dishes.ingredients} (${f(t.dishes.batchShort, { n: form.batch_size })})`}>
        {form.lines.length === 0 && <p className="py-4 text-center text-muted">{t.dishes.noIngredients}</p>}
        <ul className="space-y-2">
          {form.lines.map((l, i) => {
            const ing = ingMap.get(l.ingredient_id);
            const units = ing ? compatibleUnits(ing.unit) : [l.unit];
            const q = ing ? convert(Number(l.qty) || 0, l.unit, ing.unit) : null;
            const lineCost = ing && q !== null ? q * ing.price_paise : 0;
            return (
              <li key={l.id ?? i} className="card p-3">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setPicker({ index: i })} className="tap min-w-0 flex-1 text-left text-[17px] font-bold break-words">
                    {ing?.name_ta ?? "?"}
                    {ing?.archived && <span className="ml-1 text-sm text-bad">({t.common.deleted})</span>}
                  </button>
                  <IconButton icon="x" label={t.common.delete} onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }))} className="text-muted" />
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <NumberInput aria-label={t.common.qty} value={l.qty} onChange={(e) => patchLine(i, { qty: e.target.value.replace(",", ".").replace(/[^0-9.]/g, "") })} className="w-28 text-center text-xl font-bold" />
                  <Select aria-label={t.common.unit} value={l.unit} onChange={(e) => patchLine(i, { unit: e.target.value as Unit })} className="w-32">
                    {units.map((u) => (
                      <option key={u} value={u}>
                        {UNIT_LABEL[u]}
                      </option>
                    ))}
                  </Select>
                  <span className="flex-1 text-right text-sm text-muted tabular-nums">{money(Math.round(lineCost))}</span>
                </div>
              </li>
            );
          })}
        </ul>
        <Button variant="secondary" full className="mt-3" onClick={() => setPicker({ index: null })}>
          {t.dishes.addIngredient}
        </Button>
      </Section>

      <StickyActionBar>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-muted">{t.dishes.costPerPerson}</div>
          <div className="text-2xl leading-tight font-bold tabular-nums">{money(Math.round(perPerson))}</div>
          <div className="text-xs text-muted tabular-nums">
            {t.dishes.batchCost}: {money(Math.round(batchCost))}
          </div>
        </div>
        <Button onClick={save} icon="check" className="h-14 px-8 text-lg">
          {t.common.save}
        </Button>
      </StickyActionBar>

      <IngredientPicker
        open={!!picker}
        onClose={() => setPicker(null)}
        exclude={form.lines.map((l) => l.ingredient_id)}
        onPick={(ing) => {
          if (picker?.index == null) setForm((f) => ({ ...f, lines: [...f.lines, { ingredient_id: ing.id, qty: "", unit: ing.unit }] }));
          else patchLine(picker.index, { ingredient_id: ing.id, unit: ing.unit });
        }}
      />
    </>
  );
}

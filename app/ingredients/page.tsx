"use client";
import { Suspense, useMemo, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge, Button, Chips, Empty, Field, Icon, NumberInput, PageTitle, Select, TextInput, toast } from "@/components/ui";
import { BottomSheet, FAB, SearchBox } from "@/components/mobile";
import { Sparkline } from "@/components/Sparkline";
import { useTable, save, saveMany, archive, newId } from "@/lib/db";
import { changedToday, priceHistory, setIngredientPrice } from "@/lib/actions";
import { CATEGORIES, type Category, type Ingredient } from "@/lib/types";
import { UNITS, UNIT_LABEL, type Unit } from "@/lib/units";
import { dmy, money, paiseToInput, rupeesToPaise } from "@/lib/format";
import { f, t } from "@/lib/i18n";

type Filter = "all" | "today" | Category;

export default function IngredientsPage() {
  return (
    <Suspense>
      <Ingredients />
    </Suspense>
  );
}

function Ingredients() {
  const params = useSearchParams();
  const router = useRouter();
  const quick = params.get("mode") === "quick";
  const all = useTable("ingredients");
  const recipeItems = useTable("recipe_items");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Ingredient | "new" | null>(null);

  const usage = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of recipeItems) m.set(r.ingredient_id, (m.get(r.ingredient_id) ?? new Set()).add(r.dish_id));
    return m;
  }, [recipeItems]);

  const todayCount = all.filter(changedToday).length;
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all
      .filter((i) => (filter === "all" ? true : filter === "today" ? changedToday(i) : i.category === filter))
      .filter((i) => !s || i.name_ta.toLowerCase().includes(s) || (i.name_en ?? "").toLowerCase().includes(s) || (i.shop ?? "").toLowerCase().includes(s))
      .sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.name_ta.localeCompare(b.name_ta, "ta"));
  }, [all, q, filter]);

  const chips: { value: Filter; label: string; count?: number }[] = [
    { value: "all", label: t.common.all, count: all.length },
    ...(todayCount ? [{ value: "today" as Filter, label: t.ingredients.changedToday, count: todayCount }] : []),
    ...CATEGORIES.map((c) => ({ value: c as Filter, label: t.categories[c], count: all.filter((i) => i.category === c).length })).filter((c) => c.count),
  ];

  const setMode = (m: "quick" | "list") => router.replace(m === "quick" ? "/ingredients/?mode=quick" : "/ingredients/");

  return (
    <>
      <PageTitle title={t.ingredients.title} />
      <div className="sticky top-14 z-20 -mx-4 space-y-2 bg-app px-4 pt-1 pb-2">
        <div className="grid grid-cols-2 rounded-xl border-2 border-brand-600 p-0.5" role="tablist">
          <button type="button" role="tab" aria-selected={!quick} onClick={() => setMode("list")} className={`h-11 rounded-lg font-semibold ${!quick ? "bg-brand-600 text-white" : ""}`}>
            {t.ingredients.list}
          </button>
          <button type="button" role="tab" aria-selected={quick} onClick={() => setMode("quick")} className={`h-11 rounded-lg font-semibold ${quick ? "bg-brand-600 text-white" : ""}`}>
            ₹ {t.ingredients.quickUpdate}
          </button>
        </div>
        <SearchBox value={q} onChange={setQ} />
        <Chips options={chips} value={filter} onChange={setFilter} />
      </div>

      {quick && <p className="mb-2 rounded-xl bg-brand-50 p-3 text-[15px] text-brand-900 dark:bg-brand-900 dark:text-brand-50">{t.ingredients.quickHint}. {t.ingredients.recalcNote}</p>}

      {list.length === 0 ? (
        <Empty icon="basket">{t.common.noItems}</Empty>
      ) : quick ? (
        <ul className="card divide-y divide-[var(--line)] overflow-hidden">
          {list.map((i) => (
            <QuickPriceRow key={i.id} ing={i} />
          ))}
        </ul>
      ) : (
        <ul className="space-y-2">
          {list.map((i, idx) => (
            <li key={i.id}>
              {(idx === 0 || list[idx - 1].category !== i.category) && filter === "all" && (
                <h2 className="mt-3 mb-1 px-1 text-sm font-bold tracking-wide text-muted">{t.categories[i.category]}</h2>
              )}
              <button type="button" onClick={() => setEditing(i)} className="card flex w-full items-center gap-3 p-3 text-left active:opacity-80">
                <div className="min-w-0 flex-1">
                  <div className="text-[17px] font-bold break-words">{i.name_ta}</div>
                  <div className="truncate text-sm text-muted">
                    {i.name_en}
                    {i.shop ? ` · ${i.shop}` : ""}
                  </div>
                  <div className="text-sm text-muted">
                    {t.ingredients.lastUpdated}: {dmy(i.price_updated_at) || "—"}
                    {changedToday(i) && (
                      <span className="ml-2">
                        <Badge tone="good">{t.common.today}</Badge>
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={`text-xl font-bold tabular-nums ${i.price_paise ? "" : "text-bad"}`}>{i.price_paise ? money(i.price_paise) : t.ingredients.noPrice}</div>
                  <div className="text-sm text-muted">/ {UNIT_LABEL[i.unit]}</div>
                  {usage.get(i.id) && <div className="text-xs text-muted">{f(t.ingredients.usedIn, { n: usage.get(i.id)!.size })}</div>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <FAB onClick={() => setEditing("new")} label={t.ingredients.new} />
      {editing && <IngredientSheet ing={editing === "new" ? null : editing} usedIn={editing !== "new" ? usage.get(editing.id)?.size ?? 0 : 0} onClose={() => setEditing(null)} />}
    </>
  );
}

/** One row in the market price-update list: big price box, saves on blur / Enter. */
function QuickPriceRow({ ing }: { ing: Ingredient }) {
  const [text, setText] = useState(paiseToInput(ing.price_paise, true));
  const [flash, setFlash] = useState(false);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(paiseToInput(ing.price_paise, true));
  }, [ing.price_paise]);
  const today = changedToday(ing);

  const commit = () => {
    focused.current = false;
    const p = rupeesToPaise(text);
    if (p !== ing.price_paise) {
      setIngredientPrice(ing, p);
      setFlash(true);
      setTimeout(() => setFlash(false), 1200);
    }
  };

  return (
    <li className={`flex items-center gap-3 px-3 py-2 ${today ? "bg-green-50 dark:bg-green-950/40" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="text-[17px] font-bold break-words">{ing.name_ta}</div>
        <div className="text-sm text-muted">
          {dmy(ing.price_updated_at)}
          {today && <span className="ml-1 font-semibold text-good">✓ {t.common.today}</span>}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <div className="flex items-center gap-1">
        <span className="text-lg font-bold">₹</span>
        <input
          aria-label={`${ing.name_ta} ${t.common.price}`}
          type="text"
          inputMode="decimal"
          enterKeyHint="next"
          value={text}
          placeholder="0"
          onFocus={(e) => {
            focused.current = true;
            e.currentTarget.select();
          }}
          onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ""))}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          className={`h-14 w-28 rounded-xl border-2 bg-card px-2 text-right text-2xl font-bold tabular-nums outline-none focus:border-brand-500 ${flash ? "border-good" : "border-line"}`}
        />
        </div>
        <span className="text-sm text-muted">/ {UNIT_LABEL[ing.unit]}</span>
      </div>
    </li>
  );
}

function IngredientSheet({ ing, usedIn, onClose }: { ing: Ingredient | null; usedIn: number; onClose: () => void }) {
  const [form, setForm] = useState({
    name_ta: ing?.name_ta ?? "",
    name_en: ing?.name_en ?? "",
    category: (ing?.category ?? "grains") as Category,
    unit: (ing?.unit ?? "kg") as Unit,
    price: paiseToInput(ing?.price_paise, true),
    shop: ing?.shop ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const history = useMemo(() => (ing ? priceHistory(ing.id) : []), [ing]);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit() {
    const { ingredientSchema, fieldErrors } = await import("@/lib/schemas");
    const parsed = ingredientSchema.safeParse({ ...form, price_paise: rupeesToPaise(form.price) });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    const { price_paise, ...rest } = parsed.data;
    const now = new Date().toISOString();
    if (ing) {
      save("ingredients", { id: ing.id, ...rest });
      setIngredientPrice({ ...ing, ...rest }, price_paise);
    } else {
      const id = newId();
      saveMany([
        { table: "ingredients", row: { id, ...rest, price_paise, price_updated_at: now } },
        { table: "ingredient_price_history", row: { id: newId(), ingredient_id: id, price_paise, recorded_at: now } },
      ]);
    }
    toast(t.common.saved);
    onClose();
  }

  function remove() {
    if (!ing) return;
    const msg = usedIn ? `${f(t.ingredients.usedIn, { n: usedIn })}.\n${t.common.confirmDelete}` : t.common.confirmDelete;
    if (!confirm(msg)) return;
    archive("ingredients", ing.id);
    toast(t.common.deleted, "neutral");
    onClose();
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={ing ? ing.name_ta : t.ingredients.new}
      footer={
        <div className="flex gap-2">
          {ing && <Button variant="secondary" icon="trash" onClick={remove} aria-label={t.common.delete} className="text-bad" />}
          <Button full onClick={submit} icon="check" className="h-14 text-lg">
            {t.common.save}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label={t.ingredients.nameTa} error={errors.name_ta}>
          <TextInput value={form.name_ta} onChange={set("name_ta")} autoFocus={!ing} />
        </Field>
        <Field label={`${t.ingredients.nameEn} ${t.common.optional}`}>
          <TextInput value={form.name_en} onChange={set("name_en")} lang="en" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.ingredients.category}>
            <Select value={form.category} onChange={set("category")}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t.categories[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.ingredients.unit}>
            <Select value={form.unit} onChange={set("unit")}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABEL[u]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label={f(t.ingredients.pricePer, { unit: UNIT_LABEL[form.unit] })} error={errors.price_paise}>
          <NumberInput value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="text-2xl font-bold" />
        </Field>
        <Field label={`${t.ingredients.shop} ${t.common.optional}`}>
          <TextInput value={form.shop} onChange={set("shop")} />
        </Field>
        {ing && history.length > 0 && (
          <div>
            <div className="mb-1 flex items-center gap-2 font-semibold">
              <Icon name="history" size={20} /> {t.ingredients.history}
            </div>
            <Sparkline points={history.map((h) => h.price_paise)} />
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-[15px]">
              {[...history].reverse().slice(0, 12).map((h) => (
                <li key={h.id} className="flex justify-between border-b border-line py-1">
                  <span className="text-muted">{dmy(h.recorded_at)}</span>
                  <span className="font-semibold tabular-nums">{money(h.price_paise)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

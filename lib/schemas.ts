// Zod validation for forms. Messages are Tamil (shown under the field).
import { z } from "zod";
import { CATEGORIES, EVENT_TYPES, MEALS, ORDER_STATUSES, PAY_METHODS } from "./types";
import { UNITS } from "./units";
import { t } from "./i18n";

const req = z.string().trim().min(1, t.common.required);
const optText = z.string().trim().transform((s) => (s === "" ? null : s)).nullable();
const posNum = z.coerce.number({ message: t.common.invalidNumber }).finite(t.common.invalidNumber);

export const ingredientSchema = z.object({
  name_ta: req.max(120),
  name_en: optText,
  category: z.enum(CATEGORIES),
  unit: z.enum(UNITS),
  price_paise: z.number().int().min(0, t.common.invalidNumber),
  shop: optText,
});

export const dishSchema = z.object({
  name_ta: req.max(120),
  name_en: optText,
  batch_size: posNum.int(t.common.invalidNumber).min(1, t.common.invalidNumber),
  serving_note: optText,
  wastage_pct: z.number().min(0).max(100).nullable(),
});

export const recipeLineSchema = z.object({
  ingredient_id: z.string().uuid(),
  qty: posNum.min(0),
  unit: z.enum(UNITS),
});

export const comboSchema = z.object({
  name: req.max(120),
  meal: z.enum(MEALS),
});

export const orderCustomerSchema = z.object({
  customer_name: req.max(120),
  phone: z
    .string()
    .trim()
    .refine((s) => s === "" || /^[+\d][\d\s-]{6,}$/.test(s), "சரியான போன் எண் தேவை"),
  event_type: z.enum(EVENT_TYPES),
});

export const orderDateSchema = z.object({
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t.common.required),
  event_time: z.string().nullable(),
  venue: z.string().nullable(),
});

export const paymentSchema = z.object({
  amount_paise: z.number().int().min(1, t.common.invalidNumber),
  paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method: z.enum(PAY_METHODS),
});

export const orderStatusSchema = z.enum(ORDER_STATUSES);

/** First error message per field, for showing under inputs. */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = String(i.path[0] ?? "_");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

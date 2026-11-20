// Sharing: WhatsApp (wa.me), the phone's share sheet, tap-to-call.
import type { CalcResult, IngredientLine } from "./calc";
import { CATEGORIES } from "./types";
import { formatQty } from "./units";
import { dmy, money, phoneForWa } from "./format";
import { f, t } from "./i18n";

export function whatsappUrl(text: string, phone?: string | null): string {
  const p = phone ? phoneForWa(phone) : "";
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}

export function openWhatsApp(text: string, phone?: string | null) {
  window.open(whatsappUrl(text, phone), "_blank", "noopener");
}

/** Native share sheet if available, otherwise WhatsApp. */
export async function shareText(text: string, title?: string) {
  if (navigator.share) {
    try {
      await navigator.share({ text, title });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  openWhatsApp(text);
}

export async function shareFile(file: File, text?: string): Promise<boolean> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return true;
    } catch (e) {
      if ((e as Error).name === "AbortError") return true;
    }
  }
  // fallback: download
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return false;
}

export function shoppingListText(businessName: string, lines: IngredientLine[], subtitle?: string): string {
  const out: string[] = [f(t.shopping.header, { name: businessName })];
  if (subtitle) out.push(subtitle);
  for (const c of CATEGORIES) {
    const ls = lines.filter((l) => l.category === c);
    if (!ls.length) continue;
    out.push("", `*${t.categories[c]}*`);
    for (const l of ls) out.push(`▢ ${l.name} – ${formatQty(l.purchaseQty, l.unit)}`);
  }
  return out.join("\n");
}

export interface QuoteInfo {
  businessName: string;
  businessPhone?: string;
  customerName?: string;
  eventDate?: string;
  venue?: string | null;
  sessions: { label: string; headcount: number; dishes: string[] }[];
  result: Pick<CalcResult, "pricePerPlatePaise" | "sellingPricePaise" | "gstPaise" | "customerTotalPaise" | "plates">;
  advancePaise?: number;
  paidPaise?: number;
}

export function quotationText(q: QuoteInfo): string {
  const L: string[] = [`*${q.businessName}*`, `*${t.calc.quotation}*`];
  if (q.customerName) L.push(`${t.orders.customer}: ${q.customerName}`);
  if (q.eventDate) L.push(`${t.orders.eventDate}: ${dmy(q.eventDate)}`);
  if (q.venue) L.push(`${t.orders.venue}: ${q.venue}`);
  for (const s of q.sessions) {
    L.push("", `🍽️ *${s.label}* – ${s.headcount} ${t.common.people}`, s.dishes.join(", "));
  }
  L.push("", `${t.calc.perPlate}: ${money(q.result.pricePerPlatePaise)}`, `${t.common.total} (${q.result.plates}): ${money(q.result.sellingPricePaise)}`);
  if (q.result.gstPaise) L.push(`${t.calc.gstAmount}: ${money(q.result.gstPaise)}`, `*${t.calc.customerTotal}: ${money(q.result.customerTotalPaise)}*`);
  if (q.paidPaise) L.push(`${t.orders.paidTotal}: ${money(q.paidPaise)}`, `*${t.orders.balance}: ${money(q.result.customerTotalPaise - q.paidPaise)}*`);
  L.push("", t.orders.thanks);
  if (q.businessPhone) L.push(`📞 ${q.businessPhone}`);
  return L.join("\n");
}

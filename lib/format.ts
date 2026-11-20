// Money is always handled as integer paise. Only format at the edges.

const inrFull = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inrWhole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** ₹1,00,000.00 */
export function money(paise: number | null | undefined): string {
  return inrFull.format((paise ?? 0) / 100);
}

/** ₹1,00,000 (whole rupees, for big headline numbers) */
export function moneyShort(paise: number | null | undefined): string {
  return inrWhole.format(Math.round((paise ?? 0) / 100));
}

/** Parse a rupee string typed by the user ("1,250.50") into integer paise. */
export function rupeesToPaise(input: string | number): number {
  const s = typeof input === "number" ? String(input) : input.replace(/[,₹\s]/g, "");
  if (s === "" || s === ".") return 0;
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Paise → editable rupee string ("1250.5"), empty for 0 when `blankZero`. */
export function paiseToInput(paise: number | null | undefined, blankZero = false): string {
  const p = paise ?? 0;
  if (blankZero && p === 0) return "";
  const r = p / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0$/, "");
}

/** YYYY-MM-DD (local) */
export function isoDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD or ISO timestamp → DD-MM-YYYY */
export function dmy(value: string | null | undefined): string {
  if (!value) return "";
  const iso = value.length > 10 ? isoDate(new Date(value)) : value;
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return isoDate(dt);
}

const TA_MONTHS = ["ஜன", "பிப்", "மார்", "ஏப்", "மே", "ஜூன்", "ஜூலை", "ஆக", "செப்", "அக்", "நவ", "டிச"];
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${TA_MONTHS[Number(m) - 1]} ${y.slice(2)}`;
}

/** Digits only, with 91 prefix for 10-digit Indian numbers (for wa.me / tel:). */
export function phoneForWa(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

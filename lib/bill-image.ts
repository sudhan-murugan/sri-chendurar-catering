// Draws a Tamil quotation / bill as a PNG on a canvas, to share on WhatsApp.
// Uses the page's own Noto Sans Tamil font so Tamil text shapes correctly.
import { dmy, money } from "./format";
import { t } from "./i18n";

export interface BillData {
  kind: "quotation" | "bill";
  businessName: string;
  businessPhone?: string;
  address?: string;
  logo?: string | null;
  customerName: string;
  phone?: string | null;
  eventType: string;
  eventDate: string;
  eventTime?: string | null;
  venue?: string | null;
  sessions: { label: string; headcount: number; dishes: string[] }[];
  pricePerPlatePaise: number;
  plates: number;
  amountPaise: number;
  gstPaise: number;
  gstPct: number;
  payments: { date: string; amountPaise: number; method: string }[];
}

const W = 1080;
const PAD = 64;
const BRAND = "#9a3412";

export async function renderBill(d: BillData): Promise<Blob> {
  const family = getComputedStyle(document.body).fontFamily;
  await document.fonts.ready;
  const font = (size: number, weight = 400) => `${weight} ${size}px ${family}`;

  // measure pass → draw pass (height depends on wrapped text)
  const draw = (ctx: CanvasRenderingContext2D, measureOnly: boolean): number => {
    let y = 0;
    const text = (s: string, x: number, size: number, weight = 400, color = "#111", align: CanvasTextAlign = "left") => {
      ctx.font = font(size, weight);
      ctx.fillStyle = color;
      ctx.textAlign = align;
      if (!measureOnly) ctx.fillText(s, x, y);
    };
    const wrap = (s: string, size: number, maxW: number, weight = 400, color = "#111", lh = 1.5) => {
      ctx.font = font(size, weight);
      const words = s.split(" ");
      let line = "";
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (ctx.measureText(test).width > maxW && line) {
          y += size * lh;
          text(line, PAD, size, weight, color);
          line = w;
        } else line = test;
      }
      if (line) {
        y += size * lh;
        text(line, PAD, size, weight, color);
      }
    };
    const row = (k: string, v: string, size = 34, weight = 400, color = "#111") => {
      y += size * 1.6;
      text(k, PAD, size, weight, "#444");
      text(v, W - PAD, size, weight, color, "right");
    };
    const rule = () => {
      y += 28;
      if (!measureOnly) {
        ctx.fillStyle = "#ddd";
        ctx.fillRect(PAD, y, W - PAD * 2, 2);
      }
    };

    // header band
    if (!measureOnly) {
      ctx.fillStyle = BRAND;
      ctx.fillRect(0, 0, W, 200);
    }
    y = 92;
    text(d.businessName, W / 2, 56, 700, "#fff", "center");
    y += 64;
    text([d.businessPhone, d.address].filter(Boolean).join(" · "), W / 2, 30, 400, "#ffedd5", "center");
    y = 200;

    y += 80;
    text(d.kind === "bill" ? t.orders.bill : t.orders.quotation, W / 2, 44, 700, BRAND, "center");
    y += 10;

    row(t.orders.customer, d.customerName, 34, 700);
    if (d.phone) row(t.orders.phone, d.phone);
    row(t.orders.eventType, d.eventType);
    row(t.orders.eventDate, `${dmy(d.eventDate)}${d.eventTime ? ` ${d.eventTime}` : ""}`);
    if (d.venue) {
      y += 34 * 1.6;
      text(t.orders.venue, PAD, 34, 400, "#444");
      wrap(d.venue, 32, W - PAD * 2, 400, "#111", 1.4);
    }
    rule();

    for (const s of d.sessions) {
      y += 60;
      text(`🍽 ${s.label} – ${s.headcount} ${t.common.people}`, PAD, 38, 700, BRAND);
      wrap(s.dishes.join(" · "), 32, W - PAD * 2, 400, "#222", 1.5);
      y += 6;
    }
    rule();

    row(`${t.calc.perPlate}`, money(d.pricePerPlatePaise));
    row(`${t.common.total} (${d.plates} × ${money(d.pricePerPlatePaise)})`, money(d.amountPaise));
    if (d.gstPaise) row(`GST ${d.gstPct}%`, money(d.gstPaise));
    const total = d.amountPaise + d.gstPaise;
    row(t.calc.customerTotal, money(total), 40, 700);
    const paid = d.payments.reduce((n, p) => n + p.amountPaise, 0);
    if (d.payments.length) {
      rule();
      for (const p of d.payments) row(`${dmy(p.date)} · ${p.method}`, money(p.amountPaise), 30, 400, "#15803d");
      row(t.orders.balance, money(total - paid), 44, 700, total - paid > 0 ? "#b91c1c" : "#15803d");
    }
    y += 90;
    text(t.orders.thanks, W / 2, 36, 700, BRAND, "center");
    y += 60;
    return y;
  };

  const probe = document.createElement("canvas").getContext("2d")!;
  const H = Math.ceil(draw(probe, true));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  draw(ctx, false);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/png"));
}

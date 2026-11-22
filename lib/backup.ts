// Backup & restore. JSON = full restorable backup. Excel (.xlsx) and CSV = for reading.
import { dumpAll, saveMany, getUserId, type SaveOp } from "./db";
import { TABLES, type TableName } from "./types";
import { isoDate } from "./format";

const BACKUP_VERSION = 1;
const LAST_BACKUP_KEY = "scc_last_backup";

export function lastBackupAt(): string | null {
  try {
    return localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
}
function markBackup() {
  localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
}

export function backupJson(): File {
  const data = { app: "sri-chendurar-catering", version: BACKUP_VERSION, exported_at: new Date().toISOString(), tables: dumpAll(true) };
  return new File([JSON.stringify(data)], `chendurar-backup-${isoDate()}.json`, { type: "application/json" });
}

/** Phone share sheet (WhatsApp, Drive…) when available, otherwise a download. */
async function shareFile(file: File): Promise<boolean> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (e) {
      if ((e as Error).name === "AbortError") return true;
    }
  }
  return false;
}

export async function downloadOrShare(file: File, share: boolean) {
  if (!(share && (await shareFile(file)))) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  markBackup();
}

// ------------------------------------------------------------------ restore
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseBackup(raw: unknown): { tables: Record<string, Array<Record<string, unknown> & { id: string }>> } | null {
  const b = raw as { app?: unknown; tables?: unknown };
  if (!b || b.app !== "sri-chendurar-catering" || typeof b.tables !== "object" || !b.tables) return null;
  for (const rows of Object.values(b.tables)) {
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof r.id !== "string" || !UUID.test(r.id))) return null;
  }
  return b as { tables: Record<string, Array<Record<string, unknown> & { id: string }>> };
}

/** Merge a JSON backup into local data (and from there to the server). Returns rows restored. */
export async function restoreJson(file: File): Promise<number> {
  const parsed = { data: parseBackup(JSON.parse(await file.text())) };
  if (!parsed.data) throw new Error("bad backup");
  const uid = getUserId();
  const ops: SaveOp[] = [];
  for (const t of TABLES) {
    for (const row of parsed.data.tables[t] ?? []) {
      // settings id must equal the current user id
      const r = t === "settings" ? { ...row, id: uid } : row;
      const { user_id: _u, updated_at: _up, ...rest } = r as Record<string, unknown>;
      ops.push({ table: t, row: rest as SaveOp["row"] });
    }
  }
  // chunk so a large backup doesn't block the UI
  for (let i = 0; i < ops.length; i += 500) {
    saveMany(ops.slice(i, i + 500));
    await new Promise((r) => setTimeout(r, 0));
  }
  return ops.length;
}

// ------------------------------------------------------------------ CSV / Excel
function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function rowsFor(t: TableName): { headers: string[]; rows: unknown[][] } {
  const data = dumpAll(true)[t];
  const headers = [...new Set(data.flatMap((r) => Object.keys(r)))].filter((h) => h !== "user_id");
  const money = (h: string) => h.endsWith("_paise");
  return {
    // paise columns are exported as rupees for readability
    headers: headers.map((h) => (money(h) ? h.replace(/_paise$/, "_rupees") : h)),
    rows: data.map((r) => headers.map((h) => (money(h) && typeof r[h] === "number" ? (r[h] as number) / 100 : r[h]))),
  };
}

export function ordersCsv(): File {
  const { headers, rows } = rowsFor("orders");
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const csv = [headers, ...rows].map((r) => r.map((v) => esc(cell(v))).join(",")).join("\r\n");
  // BOM so Excel opens Tamil text as UTF-8
  return new File(["﻿" + csv], `chendurar-orders-${isoDate()}.csv`, { type: "text/csv" });
}

const xmlEsc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

function colName(i: number): string {
  let s = "";
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

/** Minimal valid .xlsx (one sheet per table), built with fflate — loaded only when exporting. */
export async function excelFile(): Promise<File> {
  const { zipSync, strToU8 } = await import("fflate");
  const sheets = TABLES.map((t) => ({ name: t.slice(0, 31), ...rowsFor(t) }));
  const sheetXml = (headers: string[], rows: unknown[][]) => {
    const all = [headers, ...rows];
    const body = all
      .map(
        (r, ri) =>
          `<row r="${ri + 1}">${r
            .map((v, ci) => {
              const ref = `${colName(ci)}${ri + 1}`;
              if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
              const s = cell(v);
              return s === "" ? "" : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(s)}</t></is></c>`;
            })
            .join("")}</row>`,
      )
      .join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
  };
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join("")}</Types>`,
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
        .map((s, i) => `<sheet name="${s.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join("")}</sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join("")}</Relationships>`,
    ),
  };
  sheets.forEach((s, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s.headers, s.rows))));
  const zip = zipSync(files);
  return new File([zip as BlobPart], `chendurar-${isoDate()}.xlsx`, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

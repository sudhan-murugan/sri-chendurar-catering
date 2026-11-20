import { useTable, getRows } from "./db";
import type { Settings } from "./types";
import { DEFAULT_ROUNDING, type RoundingRules } from "./units";

export interface AppSettings {
  id: string | null;
  businessName: string;
  phone: string;
  address: string;
  logo: string | null;
  marginPct: number;
  wastagePct: number;
  priceRoundRupees: number;
  rounding: RoundingRules;
  gstEnabled: boolean;
  gstPct: number;
}

export function toAppSettings(s: Settings | undefined): AppSettings {
  return {
    id: s?.id ?? null,
    businessName: s?.business_name || "ஸ்ரீ செந்தூரர் கேட்டரிங்",
    phone: s?.phone ?? "",
    address: s?.address ?? "",
    logo: s?.logo_data_url ?? null,
    marginPct: Number(s?.default_margin_pct ?? 30),
    wastagePct: Number(s?.default_wastage_pct ?? 5),
    priceRoundRupees: Number(s?.price_round_rupees ?? 5),
    rounding: { ...DEFAULT_ROUNDING, ...(s?.rounding ?? {}) },
    gstEnabled: !!s?.gst_enabled,
    gstPct: Number(s?.gst_pct ?? 5),
  };
}

export function useSettings(): AppSettings {
  const rows = useTable("settings");
  return toAppSettings(rows[0]);
}
export function getSettings(): AppSettings {
  return toAppSettings(getRows("settings")[0]);
}

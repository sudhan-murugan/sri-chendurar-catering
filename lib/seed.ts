// Sample starting data. All recipes are marked is_sample = true and shown as
// "மாதிரி – உங்கள் அளவுக்கு மாற்றவும்" — the owner is expected to adjust them.
// Prices are rough Tamil Nadu market prices; update them in the app.
//
// IDs are deterministic (sha256(user_id:key)) so seeding twice never creates
// duplicates, and supabase/seed.sql (generated from this file) uses the same IDs.

import type { Unit } from "./units";
import type { Category, Meal, TableName } from "./types";
import type { ExpenseMode } from "./calc";

type I = [key: string, ta: string, en: string, cat: Category, unit: Unit, rupees: number];
export const SEED_INGREDIENTS: I[] = [
  ["idli_rice", "இட்லி அரிசி", "Idli rice", "grains", "kg", 48],
  ["ponni_rice", "பொன்னி அரிசி", "Ponni rice", "grains", "kg", 62],
  ["raw_rice", "பச்சரிசி", "Raw rice", "grains", "kg", 55],
  ["urad", "உளுத்தம் பருப்பு", "Urad dal", "grains", "kg", 130],
  ["toor", "துவரம் பருப்பு", "Toor dal", "grains", "kg", 150],
  ["moong", "பாசிப் பருப்பு", "Moong dal", "grains", "kg", 120],
  ["chana", "கடலைப் பருப்பு", "Chana dal", "grains", "kg", 90],
  ["pottukadalai", "பொட்டுக்கடலை", "Roasted gram", "grains", "kg", 110],
  ["atta", "கோதுமை மாவு", "Wheat flour", "grains", "kg", 45],
  ["rava", "ரவை", "Rava", "grains", "kg", 50],
  ["semiya", "சேமியா", "Vermicelli", "grains", "kg", 90],
  ["small_onion", "சின்ன வெங்காயம்", "Shallots", "vegetables", "kg", 60],
  ["onion", "பெரிய வெங்காயம்", "Onion", "vegetables", "kg", 35],
  ["tomato", "தக்காளி", "Tomato", "vegetables", "kg", 30],
  ["drumstick", "முருங்கைக்காய்", "Drumstick", "vegetables", "kg", 60],
  ["brinjal", "கத்தரிக்காய்", "Brinjal", "vegetables", "kg", 40],
  ["cabbage", "முட்டைகோஸ்", "Cabbage", "vegetables", "kg", 30],
  ["carrot", "கேரட்", "Carrot", "vegetables", "kg", 50],
  ["beans", "பீன்ஸ்", "Beans", "vegetables", "kg", 60],
  ["potato", "உருளைக்கிழங்கு", "Potato", "vegetables", "kg", 35],
  ["green_chilli", "பச்சை மிளகாய்", "Green chilli", "vegetables", "kg", 60],
  ["ginger", "இஞ்சி", "Ginger", "vegetables", "kg", 120],
  ["garlic", "பூண்டு", "Garlic", "vegetables", "kg", 200],
  ["coconut", "தேங்காய்", "Coconut", "vegetables", "count", 30],
  ["curry_leaves", "கறிவேப்பிலை", "Curry leaves", "vegetables", "bundle", 10],
  ["coriander", "கொத்தமல்லி", "Coriander leaves", "vegetables", "bundle", 10],
  ["sambar_powder", "சாம்பார் பொடி", "Sambar powder", "spices", "kg", 300],
  ["rasam_powder", "ரசம் பொடி", "Rasam powder", "spices", "kg", 320],
  ["pepper", "மிளகு", "Pepper", "spices", "kg", 700],
  ["cumin", "சீரகம்", "Cumin", "spices", "kg", 400],
  ["mustard", "கடுகு", "Mustard", "spices", "kg", 120],
  ["turmeric", "மஞ்சள் தூள்", "Turmeric", "spices", "kg", 250],
  ["asafoetida", "பெருங்காயம்", "Asafoetida", "spices", "kg", 1500],
  ["fennel", "சோம்பு", "Fennel", "spices", "kg", 250],
  ["garam_masala", "கரம் மசாலா", "Garam masala", "spices", "kg", 800],
  ["cardamom", "ஏலக்காய்", "Cardamom", "spices", "kg", 2500],
  ["fenugreek", "வெந்தயம்", "Fenugreek", "spices", "kg", 120],
  ["kesari_colour", "கேசரி பவுடர்", "Kesari colour", "spices", "kg", 400],
  ["oil", "சமையல் எண்ணெய்", "Cooking oil", "oil", "l", 160],
  ["milk", "பால்", "Milk", "dairy", "l", 50],
  ["curd", "தயிர்", "Curd", "dairy", "l", 60],
  ["ghee", "நெய்", "Ghee", "dairy", "kg", 650],
  ["salt", "உப்பு", "Salt", "grocery", "kg", 20],
  ["sugar", "சர்க்கரை", "Sugar", "grocery", "kg", 45],
  ["tamarind", "புளி", "Tamarind", "grocery", "kg", 160],
  ["cashew", "முந்திரி", "Cashew", "grocery", "kg", 900],
  ["raisin", "திராட்சை", "Raisins", "grocery", "kg", 400],
  ["appalam", "அப்பளம்", "Appalam", "grocery", "count", 1.5],
  ["gg_paste", "இஞ்சி பூண்டு விழுது", "Ginger garlic paste", "grocery", "kg", 160],
];

type R = [ingKey: string, qty: number, unit: Unit];
interface D {
  key: string;
  ta: string;
  en: string;
  note: string;
  items: R[];
}
// All recipes are for 100 people.
export const SEED_DISHES: D[] = [
  { key: "idly", ta: "இட்லி", en: "Idly", note: "3 இட்லி / நபர்", items: [["idli_rice", 10, "kg"], ["urad", 2.5, "kg"], ["fenugreek", 50, "g"], ["salt", 300, "g"], ["oil", 250, "ml"]] },
  { key: "dosa", ta: "தோசை", en: "Dosa", note: "2 தோசை / நபர்", items: [["idli_rice", 8, "kg"], ["urad", 2, "kg"], ["chana", 200, "g"], ["fenugreek", 50, "g"], ["salt", 300, "g"], ["oil", 2, "l"]] },
  { key: "pongal", ta: "பொங்கல்", en: "Pongal", note: "150 g / நபர்", items: [["raw_rice", 6, "kg"], ["moong", 3, "kg"], ["ghee", 1, "kg"], ["pepper", 100, "g"], ["cumin", 100, "g"], ["cashew", 250, "g"], ["ginger", 200, "g"], ["curry_leaves", 2, "bundle"], ["salt", 250, "g"]] },
  { key: "sambar", ta: "சாம்பார்", en: "Sambar", note: "150 ml / நபர்", items: [["toor", 3, "kg"], ["tamarind", 500, "g"], ["sambar_powder", 500, "g"], ["small_onion", 2, "kg"], ["tomato", 2, "kg"], ["drumstick", 2, "kg"], ["brinjal", 2, "kg"], ["oil", 500, "ml"], ["mustard", 50, "g"], ["turmeric", 50, "g"], ["asafoetida", 25, "g"], ["curry_leaves", 2, "bundle"], ["coriander", 2, "bundle"], ["salt", 400, "g"]] },
  { key: "coconut_chutney", ta: "தேங்காய் சட்னி", en: "Coconut chutney", note: "50 g / நபர்", items: [["coconut", 15, "count"], ["pottukadalai", 1, "kg"], ["green_chilli", 300, "g"], ["ginger", 100, "g"], ["salt", 200, "g"], ["oil", 200, "ml"], ["mustard", 30, "g"], ["curry_leaves", 1, "bundle"]] },
  { key: "rice", ta: "சாதம்", en: "Rice", note: "150 g அரிசி / நபர்", items: [["ponni_rice", 15, "kg"]] },
  { key: "rasam", ta: "ரசம்", en: "Rasam", note: "100 ml / நபர்", items: [["tamarind", 400, "g"], ["tomato", 2, "kg"], ["toor", 500, "g"], ["rasam_powder", 300, "g"], ["pepper", 50, "g"], ["cumin", 50, "g"], ["garlic", 200, "g"], ["oil", 200, "ml"], ["mustard", 30, "g"], ["asafoetida", 20, "g"], ["coriander", 2, "bundle"], ["curry_leaves", 1, "bundle"], ["salt", 300, "g"]] },
  { key: "poriyal", ta: "பொரியல்", en: "Poriyal", note: "80 g / நபர்", items: [["cabbage", 6, "kg"], ["beans", 2, "kg"], ["coconut", 5, "count"], ["oil", 500, "ml"], ["mustard", 50, "g"], ["urad", 100, "g"], ["green_chilli", 200, "g"], ["curry_leaves", 1, "bundle"], ["salt", 200, "g"]] },
  { key: "appalam", ta: "அப்பளம்", en: "Appalam", note: "1 / நபர்", items: [["appalam", 100, "count"], ["oil", 2, "l"]] },
  { key: "curd", ta: "தயிர்", en: "Curd", note: "80 ml / நபர்", items: [["curd", 8, "l"], ["salt", 50, "g"]] },
  { key: "chapati", ta: "சப்பாத்தி", en: "Chapati", note: "2 / நபர்", items: [["atta", 8, "kg"], ["oil", 1, "l"], ["salt", 150, "g"]] },
  { key: "kurma", ta: "குருமா", en: "Kurma", note: "120 ml / நபர்", items: [["potato", 3, "kg"], ["carrot", 2, "kg"], ["beans", 2, "kg"], ["onion", 3, "kg"], ["tomato", 2, "kg"], ["coconut", 6, "count"], ["cashew", 200, "g"], ["fennel", 50, "g"], ["gg_paste", 300, "g"], ["green_chilli", 200, "g"], ["garam_masala", 100, "g"], ["oil", 1, "l"], ["coriander", 2, "bundle"], ["salt", 300, "g"]] },
  { key: "kesari", ta: "கேசரி", en: "Kesari", note: "60 g / நபர்", items: [["rava", 3, "kg"], ["sugar", 4, "kg"], ["ghee", 1.5, "kg"], ["cashew", 250, "g"], ["raisin", 150, "g"], ["cardamom", 20, "g"], ["kesari_colour", 10, "g"]] },
  { key: "vadai", ta: "வடை", en: "Vadai", note: "1 / நபர்", items: [["urad", 3, "kg"], ["oil", 3, "l"], ["onion", 500, "g"], ["green_chilli", 100, "g"], ["ginger", 100, "g"], ["pepper", 30, "g"], ["curry_leaves", 1, "bundle"], ["salt", 150, "g"]] },
  { key: "payasam", ta: "பாயசம்", en: "Payasam", note: "100 ml / நபர்", items: [["milk", 10, "l"], ["semiya", 1.5, "kg"], ["sugar", 3, "kg"], ["ghee", 300, "g"], ["cashew", 200, "g"], ["raisin", 100, "g"], ["cardamom", 20, "g"]] },
];

// Portion multipliers keep combined combos realistic (e.g. 2 idli + 1 dosa, not 3 + 2).
export const SEED_COMBOS: { key: string; name: string; meal: Meal; items: [dishKey: string, mult: number][] }[] = [
  { key: "breakfast", name: "காலை காம்போ", meal: "breakfast", items: [["idly", 0.67], ["dosa", 0.5], ["pongal", 0.5], ["sambar", 1], ["coconut_chutney", 1]] },
  { key: "lunch", name: "மதிய காம்போ", meal: "lunch", items: [["rice", 1], ["sambar", 1], ["rasam", 1], ["poriyal", 1], ["appalam", 1], ["curd", 1]] },
  { key: "dinner", name: "இரவு காம்போ", meal: "dinner", items: [["idly", 0.67], ["dosa", 0.5], ["chapati", 0.5], ["kurma", 1], ["coconut_chutney", 1]] },
];

export const SEED_EXPENSES: [key: string, name: string, mode: ExpenseMode, rupees: number][] = [
  ["cooks", "சமையல்காரர் & உதவியாளர்", "per_session", 4000],
  ["servers", "பரிமாறுபவர்கள்", "per_person", 8],
  ["fuel", "கேஸ் / விறகு", "per_person", 6],
  ["transport", "போக்குவரத்து", "fixed", 1500],
  ["vessels", "பாத்திர வாடகை", "per_session", 1000],
  ["leaf", "இலை / தட்டு / கப் / தண்ணீர்", "per_person", 8],
  ["utilities", "மின்சாரம் / தண்ணீர் / சுத்தம்", "per_session", 500],
  ["misc", "இதர", "fixed", 500],
];

export async function seedId(userId: string, key: string): Promise<string> {
  const data = new TextEncoder().encode(`${userId}:${key}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  const h = [...hash.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export interface SeedRow {
  table: TableName;
  row: Record<string, unknown> & { id: string };
}

/** Rows in dependency order. Base fields (user_id, timestamps) are added by the store. */
export async function buildSeed(
  userId: string,
  now = new Date().toISOString(),
  idFn: (key: string) => Promise<string> | string = (k) => seedId(userId, k),
): Promise<SeedRow[]> {
  const id = async (k: string) => idFn(k);
  const out: SeedRow[] = [];

  out.push({
    table: "settings",
    row: {
      id: userId,
      business_name: "ஸ்ரீ செந்தூரர் கேட்டரிங்",
      phone: null,
      address: null,
      logo_data_url: null,
      default_margin_pct: 30,
      default_wastage_pct: 5,
      price_round_rupees: 5,
      rounding: {},
      gst_enabled: false,
      gst_pct: 5,
    },
  });

  for (const [key, ta, en, cat, unit, rupees] of SEED_INGREDIENTS) {
    const ingId = await id(`ing:${key}`);
    const price = Math.round(rupees * 100);
    out.push({ table: "ingredients", row: { id: ingId, name_ta: ta, name_en: en, category: cat, unit, price_paise: price, shop: null, price_updated_at: now } });
    out.push({ table: "ingredient_price_history", row: { id: await id(`ph:${key}`), ingredient_id: ingId, price_paise: price, recorded_at: now } });
  }

  for (const d of SEED_DISHES) {
    const dishId = await id(`dish:${d.key}`);
    out.push({ table: "dishes", row: { id: dishId, name_ta: d.ta, name_en: d.en, batch_size: 100, serving_note: d.note, wastage_pct: null, is_sample: true } });
    let sort = 0;
    for (const [ingKey, qty, unit] of d.items) {
      out.push({ table: "recipe_items", row: { id: await id(`ri:${d.key}:${ingKey}`), dish_id: dishId, ingredient_id: await id(`ing:${ingKey}`), qty, unit, sort: sort++ } });
    }
  }

  let csort = 0;
  for (const c of SEED_COMBOS) {
    const comboId = await id(`combo:${c.key}`);
    out.push({ table: "combos", row: { id: comboId, name: c.name, meal: c.meal, sort: csort++ } });
    let sort = 0;
    for (const [dishKey, mult] of c.items) {
      out.push({ table: "combo_items", row: { id: await id(`ci:${c.key}:${dishKey}`), combo_id: comboId, dish_id: await id(`dish:${dishKey}`), multiplier: mult, sort: sort++ } });
    }
  }

  let esort = 0;
  for (const [key, name, mode, rupees] of SEED_EXPENSES) {
    out.push({ table: "expense_types", row: { id: await id(`exp:${key}`), name, mode, rate_paise: rupees * 100, sort: esort++ } });
  }
  return out;
}

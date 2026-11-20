// Row types mirror the Supabase tables exactly (snake_case), so rows can be
// stored locally and pushed to the server without mapping.
import type { Unit } from "./units";
import type { ExpenseMode } from "./calc";
import type { RoundingRules } from "./units";

export interface Base {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  archived: boolean;
}

export const CATEGORIES = ["grains", "vegetables", "spices", "oil", "dairy", "grocery", "other"] as const;
export type Category = (typeof CATEGORIES)[number];
export const MEALS = ["breakfast", "lunch", "dinner", "other"] as const;
export type Meal = (typeof MEALS)[number];
export const EVENT_TYPES = ["wedding", "birthday", "home", "office", "other"] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const ORDER_STATUSES = ["enquiry", "confirmed", "completed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const PAY_METHODS = ["cash", "upi", "bank"] as const;
export type PayMethod = (typeof PAY_METHODS)[number];

export interface Ingredient extends Base {
  name_ta: string;
  name_en: string | null;
  category: Category;
  unit: Unit;
  price_paise: number;
  shop: string | null;
  price_updated_at: string | null;
}
export interface PriceHistory extends Base {
  ingredient_id: string;
  price_paise: number;
  recorded_at: string;
}
export interface Dish extends Base {
  name_ta: string;
  name_en: string | null;
  batch_size: number;
  serving_note: string | null;
  wastage_pct: number | null;
  is_sample: boolean;
}
export interface RecipeItem extends Base {
  dish_id: string;
  ingredient_id: string;
  qty: number;
  unit: Unit;
  sort: number;
}
export interface Combo extends Base {
  name: string;
  meal: Meal;
  sort: number;
}
export interface ComboItem extends Base {
  combo_id: string;
  dish_id: string;
  multiplier: number;
  sort: number;
}
export interface ExpenseType extends Base {
  name: string;
  mode: ExpenseMode;
  rate_paise: number;
  sort: number;
}
export interface Order extends Base {
  customer_name: string;
  phone: string | null;
  event_type: EventType;
  venue: string | null;
  venue_map_url: string | null;
  order_date: string;
  event_date: string;
  event_time: string | null;
  status: OrderStatus;
  margin_pct: number;
  gst_pct: number;
  price_per_plate_paise: number;
  order_amount_paise: number;
  gst_paise: number;
  ingredient_cost_paise: number;
  expense_cost_paise: number;
  expected_profit_paise: number;
  actual_cost_paise: number | null;
  final_headcount: number | null;
  notes: string | null;
}
export interface OrderSession extends Base {
  order_id: string;
  meal: Meal;
  label: string | null;
  session_time: string | null;
  headcount: number;
  combo_id: string | null;
  sort: number;
}
export interface OrderSessionItem extends Base {
  order_id: string;
  session_id: string;
  dish_id: string;
  multiplier: number;
  sort: number;
}
export interface OrderExpense extends Base {
  order_id: string;
  expense_type_id: string | null;
  name: string;
  mode: ExpenseMode;
  rate_paise: number;
  amount_paise: number;
  sort: number;
}
export interface OrderCostSnapshot extends Base {
  order_id: string;
  lines: import("./calc").IngredientLine[];
  totals: Record<string, number>;
  computed_at: string;
}
export interface Payment extends Base {
  order_id: string;
  paid_on: string;
  amount_paise: number;
  method: PayMethod;
  note: string | null;
}
export interface ShoppingCheck extends Base {
  list_key: string;
  ingredient_id: string;
  checked: boolean;
  paid_paise: number | null;
}
export interface Settings extends Base {
  business_name: string;
  phone: string | null;
  address: string | null;
  logo_data_url: string | null;
  default_margin_pct: number;
  default_wastage_pct: number;
  price_round_rupees: number;
  rounding: Partial<RoundingRules>;
  gst_enabled: boolean;
  gst_pct: number;
}

export interface Tables {
  ingredients: Ingredient;
  ingredient_price_history: PriceHistory;
  dishes: Dish;
  recipe_items: RecipeItem;
  combos: Combo;
  combo_items: ComboItem;
  expense_types: ExpenseType;
  orders: Order;
  order_sessions: OrderSession;
  order_session_items: OrderSessionItem;
  order_expenses: OrderExpense;
  order_cost_snapshot: OrderCostSnapshot;
  payments: Payment;
  shopping_list_checks: ShoppingCheck;
  settings: Settings;
}
export type TableName = keyof Tables;

/** Parent tables first, so pushes never violate foreign keys. */
export const TABLES: TableName[] = [
  "settings",
  "ingredients",
  "ingredient_price_history",
  "dishes",
  "recipe_items",
  "combos",
  "combo_items",
  "expense_types",
  "orders",
  "order_sessions",
  "order_session_items",
  "order_expenses",
  "order_cost_snapshot",
  "payments",
  "shopping_list_checks",
];

/** Fields the caller supplies when saving; base fields are filled in by the store. */
export type Draft<T extends TableName> = Omit<Tables[T], keyof Base> & Partial<Base>;

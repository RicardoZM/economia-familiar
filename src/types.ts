export type Kind = "income" | "expense";
export type Scope = "shared" | "personal";
export interface Category {
  id: string;
  household_id: string;
  name: string;
  kind: Kind;
  color: string;
  archived_at: string | null;
}
export interface Transaction {
  id: string;
  household_id: string;
  user_id: string;
  kind: Kind;
  scope: Scope;
  category_id: string | null;
  amount_cents: number;
  occurred_on: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
export interface Budget {
  id: string;
  household_id: string;
  category_id: string;
  month: string;
  limit_cents: number;
}
export interface Goal {
  id: string;
  household_id: string;
  name: string;
  target_cents: number;
  saved_cents: number;
  target_date: string | null;
  archived_at: string | null;
}
export interface GoalContribution {
  id: string;
  goal_id: string;
  household_id: string;
  user_id: string;
  amount_cents: number;
  occurred_on: string;
  note: string | null;
  created_at: string;
}
export interface Debt {
  id: string;
  household_id: string;
  name: string;
  amount_cents: number;
  due_on: string;
  paid_cents: number;
  scope: Scope;
  archived_at: string | null;
}
export interface DebtPayment {
  id: string;
  debt_id: string;
  household_id: string;
  user_id: string;
  amount_cents: number;
  occurred_on: string;
  note: string | null;
  created_at: string;
}
export interface Recurring {
  id: string;
  household_id: string;
  kind: Kind;
  scope: Scope;
  category_id: string | null;
  amount_cents: number;
  day_of_month: number;
  starts_on: string;
  ends_on: string | null;
  note: string | null;
  active: boolean;
}
export interface Household {
  id: string;
  name: string;
  split_method: "equal" | "income_proportional";
  invite_code: string;
}
export type Page =
  | "inicio"
  | "movimientos"
  | "presupuestos"
  | "objetivos"
  | "deudas"
  | "ajustes";

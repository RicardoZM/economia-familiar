import type { Session } from "@supabase/supabase-js";
import { offlineDb, queueTransaction } from "./offline";
import { supabase } from "./supabase";
import type {
  Budget,
  Category,
  Debt,
  DebtPayment,
  Goal,
  GoalContribution,
  Household,
  Transaction,
} from "../types";

export async function loadMyHousehold(): Promise<Household | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("household_members")
    .select("household_id, households(*)")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.households as unknown as Household | null) ?? null;
}

export async function fetchTransactions(
  householdId: string,
): Promise<Transaction[]> {
  if (!navigator.onLine || !supabase)
    return offlineDb.transactions
      .where("household_id")
      .equals(householdId)
      .toArray();
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("household_id", householdId)
    .order("occurred_on", { ascending: false });
  if (error) throw error;
  await offlineDb.transactions.bulkPut(data);
  return data;
}

export async function fetchCategories(householdId: string): Promise<Category[]> {
  if (!navigator.onLine || !supabase)
    return offlineDb.categories
      .where("household_id")
      .equals(householdId)
      .filter((category) => !category.archived_at)
      .toArray();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("household_id", householdId)
    .is("archived_at", null)
    .order("name");
  if (error) throw error;
  await offlineDb.categories.bulkPut(data);
  return data;
}

export async function createCategory(
  input: Pick<Category, "household_id" | "name" | "kind" | "color">,
): Promise<Category> {
  if (!navigator.onLine || !supabase)
    throw new Error("Conéctate a internet para crear categorías.");
  const { data, error } = await supabase
    .from("categories")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  await offlineDb.categories.put(data);
  return data;
}

export async function archiveCategory(id: string): Promise<void> {
  if (!navigator.onLine || !supabase)
    throw new Error("Conéctate a internet para archivar categorías.");
  const archived_at = new Date().toISOString();
  const { error } = await supabase
    .from("categories")
    .update({ archived_at })
    .eq("id", id);
  if (error) throw error;
  await offlineDb.categories.update(id, { archived_at });
}

export async function fetchBudgets(
  householdId: string,
  month: string,
): Promise<Budget[]> {
  if (!navigator.onLine || !supabase)
    throw new Error("Conéctate a internet para consultar los presupuestos.");
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .eq("household_id", householdId)
    .eq("month", `${month}-01`);
  if (error) throw error;
  return data;
}

export async function saveBudget(
  input: Pick<Budget, "household_id" | "category_id" | "month" | "limit_cents">,
): Promise<Budget> {
  if (!navigator.onLine || !supabase)
    throw new Error("Conéctate a internet para guardar un presupuesto.");
  const { data, error } = await supabase
    .from("budgets")
    .upsert(input, { onConflict: "household_id,category_id,month" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBudget(id: string): Promise<void> {
  if (!navigator.onLine || !supabase)
    throw new Error("Conéctate a internet para eliminar un presupuesto.");
  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchGoals(householdId: string): Promise<Goal[]> {
  if (!navigator.onLine || !supabase)
    throw new Error("Conéctate a internet para consultar los objetivos.");
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("household_id", householdId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createGoal(
  input: Pick<Goal, "household_id" | "name" | "target_cents" | "target_date">,
): Promise<Goal> {
  if (!navigator.onLine || !supabase)
    throw new Error("Conéctate a internet para crear un objetivo.");
  const { data, error } = await supabase.from("goals").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function archiveGoal(id: string): Promise<void> {
  if (!navigator.onLine || !supabase)
    throw new Error("Conéctate a internet para archivar un objetivo.");
  const { error } = await supabase
    .from("goals")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function fetchGoalContributions(
  householdId: string,
): Promise<GoalContribution[]> {
  if (!navigator.onLine || !supabase)
    throw new Error("Conéctate a internet para consultar las aportaciones.");
  const { data, error } = await supabase
    .from("goal_contributions")
    .select("*")
    .eq("household_id", householdId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function addGoalContribution(
  input: Pick<
    GoalContribution,
    "goal_id" | "household_id" | "user_id" | "amount_cents" | "occurred_on" | "note"
  >,
): Promise<GoalContribution> {
  if (!navigator.onLine || !supabase)
    throw new Error("Conéctate a internet para registrar una aportación.");
  const { data, error } = await supabase
    .from("goal_contributions")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchDebts(householdId: string): Promise<Debt[]> {
  if (!navigator.onLine || !supabase)
    throw new Error("Conéctate a internet para consultar las deudas.");
  const { data, error } = await supabase
    .from("debts")
    .select("*")
    .eq("household_id", householdId)
    .is("archived_at", null)
    .order("due_on");
  if (error) throw error;
  return data;
}

export async function createDebt(
  input: Pick<Debt, "household_id" | "name" | "amount_cents" | "due_on" | "scope">,
): Promise<Debt> {
  if (!navigator.onLine || !supabase)
    throw new Error("Conéctate a internet para crear una deuda.");
  const { data, error } = await supabase.from("debts").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function archiveDebt(id: string): Promise<void> {
  if (!navigator.onLine || !supabase)
    throw new Error("Conéctate a internet para archivar una deuda.");
  const { error } = await supabase
    .from("debts")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function fetchDebtPayments(householdId: string): Promise<DebtPayment[]> {
  if (!navigator.onLine || !supabase)
    throw new Error("Conéctate a internet para consultar los pagos.");
  const { data, error } = await supabase
    .from("debt_payments")
    .select("*")
    .eq("household_id", householdId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function addDebtPayment(
  input: Pick<
    DebtPayment,
    "debt_id" | "household_id" | "user_id" | "amount_cents" | "occurred_on" | "note"
  >,
): Promise<DebtPayment> {
  if (!navigator.onLine || !supabase)
    throw new Error("Conéctate a internet para registrar un pago.");
  const { data, error } = await supabase
    .from("debt_payments")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function saveTransaction(
  input: Omit<Transaction, "created_at" | "updated_at" | "deleted_at">,
) {
  const record: Transaction = {
    ...input,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };
  if (!navigator.onLine || !supabase) {
    await queueTransaction(record, "upsert");
    return record;
  }
  const { data, error } = await supabase
    .from("transactions")
    .upsert(record)
    .select()
    .single();
  if (error) {
    await queueTransaction(record, "upsert");
    return record;
  }
  await offlineDb.transactions.put(data);
  return data;
}

export async function updateTransaction(
  existing: Transaction,
  input: Pick<
    Transaction,
    "kind" | "scope" | "category_id" | "amount_cents" | "occurred_on" | "note"
  >,
): Promise<Transaction> {
  const record: Transaction = {
    ...existing,
    ...input,
    updated_at: new Date().toISOString(),
  };
  if (!navigator.onLine || !supabase) {
    await queueTransaction(record, "upsert");
    return record;
  }
  const { data, error } = await supabase
    .from("transactions")
    .update(input)
    .eq("id", existing.id)
    .select()
    .single();
  if (error) throw error;
  await offlineDb.transactions.put(data);
  return data;
}

export async function deleteTransaction(existing: Transaction): Promise<void> {
  const deleted_at = new Date().toISOString();
  const record = { ...existing, deleted_at, updated_at: deleted_at };
  if (!navigator.onLine || !supabase) {
    await queueTransaction(record, "delete");
    return;
  }
  const { error } = await supabase
    .from("transactions")
    .update({ deleted_at })
    .eq("id", existing.id);
  if (error) throw error;
  await offlineDb.transactions.put(record);
}
export async function syncPending(session: Session | null) {
  if (!session || !supabase || !navigator.onLine) return;
  const changes = await offlineDb.pending.orderBy("createdAt").toArray();
  for (const change of changes) {
    const query =
      change.operation === "delete"
        ? supabase
            .from(change.table)
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", change.record.id)
        : supabase.from(change.table).upsert(change.record);
    const { error } = await query;
    if (!error && change.id) await offlineDb.pending.delete(change.id);
  }
}

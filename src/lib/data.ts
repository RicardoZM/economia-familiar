import type { Session } from "@supabase/supabase-js";
import { offlineDb, queueTransaction } from "./offline";
import { supabase } from "./supabase";
import type { Category, Household, Transaction } from "../types";

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

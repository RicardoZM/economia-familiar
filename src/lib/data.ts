import type { Session } from "@supabase/supabase-js";
import { offlineDb, queueTransaction } from "./offline";
import { supabase } from "./supabase";
import type { Household, Transaction } from "../types";

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

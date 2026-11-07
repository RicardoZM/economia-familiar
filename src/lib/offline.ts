import Dexie, { type EntityTable } from "dexie";
import type { Transaction } from "../types";

interface PendingChange {
  id?: number;
  table: "transactions";
  operation: "upsert" | "delete";
  record: Transaction;
  createdAt: string;
}
class FamilyDb extends Dexie {
  transactions!: EntityTable<Transaction, "id">;
  pending!: EntityTable<PendingChange, "id">;
  constructor() {
    super("economia-familiar");
    this.version(1).stores({
      transactions: "id, household_id, occurred_on, updated_at",
      pending: "++id, createdAt",
    });
  }
}
export const offlineDb = new FamilyDb();
export async function queueTransaction(
  record: Transaction,
  operation: PendingChange["operation"],
) {
  await offlineDb.transactions.put(record);
  await offlineDb.pending.add({
    table: "transactions",
    operation,
    record,
    createdAt: new Date().toISOString(),
  });
}

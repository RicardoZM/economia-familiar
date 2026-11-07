import type { Debt, Transaction } from "../types";
export const euros = (cents: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
export const monthKey = (date = new Date()) => date.toISOString().slice(0, 7);
export function monthTotals(items: Transaction[], month: string) {
  const active = items.filter(
    (x) => !x.deleted_at && x.occurred_on.startsWith(month),
  );
  return {
    income: active
      .filter((x) => x.kind === "income")
      .reduce((n, x) => n + x.amount_cents, 0),
    expense: active
      .filter((x) => x.kind === "expense")
      .reduce((n, x) => n + x.amount_cents, 0),
  };
}
export function plannedBalance(transactions: Transaction[], debts: Debt[]) {
  const balance = transactions
    .filter((x) => !x.deleted_at)
    .reduce(
      (n, x) => n + (x.kind === "income" ? x.amount_cents : -x.amount_cents),
      0,
    );
  const pending = debts
    .filter((x) => !x.archived_at)
    .reduce((n, x) => n + x.amount_cents - x.paid_cents, 0);
  return balance - pending;
}
export function shareDue(
  sharedExpenses: number,
  method: "equal" | "income_proportional",
  mineIncome: number,
  partnerIncome: number,
) {
  if (method === "equal" || mineIncome + partnerIncome === 0)
    return Math.round(sharedExpenses / 2);
  return Math.round(
    (sharedExpenses * mineIncome) / (mineIncome + partnerIncome),
  );
}

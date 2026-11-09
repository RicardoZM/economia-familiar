import { euros, plannedBalance } from "../lib/finance";
import type { Debt, Transaction } from "../types";
import { Panel } from "./ui";

export function Dashboard({
  items,
  debts,
  income,
  expense,
}: {
  items: Transaction[];
  debts: Debt[];
  income: number;
  expense: number;
}) {
  const balance = plannedBalance(items, debts);
  const metrics = [
    ["Ingresos este mes", euros(income), "text-emerald-700"],
    ["Gastos este mes", euros(expense), "text-rose-700"],
    ["Disponible previsto", euros(balance), "text-slate-900"],
  ];
  return (
    <>
      <section className="mb-5 grid gap-4 sm:grid-cols-3">
        {metrics.map(([label, value, tone]) => (
          <Panel className="p-5" key={label}>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <strong className={`mt-2 block text-2xl tracking-tight ${tone}`}>{value}</strong>
          </Panel>
        ))}
      </section>
      <Panel>
        <h2 className="text-lg font-bold text-slate-900">Actividad reciente</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {items
            .filter((item) => !item.deleted_at)
            .slice(0, 6)
            .map((item) => (
              <div className="flex items-center justify-between gap-4 py-3.5" key={item.id}>
                <span>
                  <b className="block text-sm text-slate-800">{item.note || "Sin descripción"}</b>
                  <small className="text-sm text-slate-500">
                    {item.occurred_on} · {item.scope === "shared" ? "Común" : "Personal"}
                  </small>
                </span>
                <strong className={item.kind === "income" ? "text-emerald-700" : "text-rose-700"}>
                  {item.kind === "income" ? "+" : "-"}
                  {euros(item.amount_cents)}
                </strong>
              </div>
            ))}
        </div>
        {items.filter((item) => !item.deleted_at).length === 0 && (
          <p className="mt-4 text-sm text-slate-500">Aún no hay movimientos. Añade el primero para ver el resumen.</p>
        )}
      </Panel>
    </>
  );
}

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { deleteBudget, fetchBudgets, saveBudget } from "../lib/data";
import { euros, monthKey } from "../lib/finance";
import type { Budget, Category, Household, Transaction } from "../types";
import { fieldClassName, Panel, PrimaryButton, TextButton } from "./ui";
import {Save, Trash} from 'lucide-react';

type BudgetsProps = {
  household: Household;
  categories: Category[];
  items: Transaction[];
};

function centsFromInput(value: string) {
  return Math.round(Number(value.replace(",", ".")) * 100);
}

function progressTone(ratio: number) {
  if (ratio >= 1) return "bg-rose-500";
  if (ratio >= 0.8) return "bg-amber-500";
  return "bg-brand-600";
}

function BudgetRow({
  category,
  budget,
  spent,
  householdId,
  month,
  onSaved,
  onDeleted,
}: {
  category: Category;
  budget?: Budget;
  spent: number;
  householdId: string;
  month: string;
  onSaved: (budget: Budget) => void;
  onDeleted: (id: string) => void;
}) {
  const [amount, setAmount] = useState(budget ? (budget.limit_cents / 100).toFixed(2).replace(".", ",") : "");
  const [message, setMessage] = useState("");
  const limit = budget?.limit_cents ?? 0;
  const ratio = limit > 0 ? spent / limit : 0;
  const remaining = limit - spent;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const limitCents = centsFromInput(amount);
    if (!Number.isSafeInteger(limitCents) || limitCents < 0)
      return setMessage("Indica un límite válido.");
    try {
      const saved = await saveBudget({
        household_id: householdId,
        category_id: category.id,
        month: `${month}-01`,
        limit_cents: limitCents,
      });
      onSaved(saved);
      setMessage("Límite guardado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el límite.");
    }
  };
  const remove = async () => {
    if (!budget || !window.confirm(`¿Eliminar el límite de ${category.name}?`)) return;
    try {
      await deleteBudget(budget.id);
      onDeleted(budget.id);
      setAmount("");
      setMessage("Límite eliminado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar el límite.");
    }
  };

  return (
    <article className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <i className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
            <h3 className="truncate font-semibold text-slate-900">{category.name}</h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">{limit ? `${euros(spent)} de ${euros(limit)}` : `${euros(spent)} gastados · Sin límite`}</p>
        </div>
        {limit > 0 && (
          <span className={`shrink-0 text-sm font-semibold ${ratio >= 1 ? "text-rose-700" : ratio >= 0.8 ? "text-amber-700" : "text-emerald-700"}`}>
            {ratio >= 1 ? `${euros(Math.abs(remaining))} excedido` : `${euros(remaining)} disponible`}
          </span>
        )}
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all ${progressTone(ratio)}`} style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
      </div>
      <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={submit}>
        <label className="sr-only" htmlFor={`budget-${category.id}`}>Límite mensual para {category.name}</label>
        <input
          className={fieldClassName}
          id={`budget-${category.id}`}
          inputMode="decimal"
          min="0"
          placeholder="Límite mensual (€)"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
        />
        <PrimaryButton className="shrink-0" type="submit"><Save /></PrimaryButton>
        {budget && <TextButton className="shrink-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700" type="button" onClick={remove}><Trash/></TextButton>}
      </form>
      {message && <p className="mt-2 text-sm text-slate-500">{message}</p>}
    </article>
  );
}

export function Budgets({ household, categories, items }: BudgetsProps) {
  const [month, setMonth] = useState(monthKey());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [message, setMessage] = useState("");
  const expenseCategories = categories.filter((category) => category.kind === "expense");
  const spending = useMemo(() => {
    const result = new Map<string, number>();
    for (const item of items) {
      if (item.deleted_at || item.kind !== "expense" || !item.category_id || !item.occurred_on.startsWith(month)) continue;
      result.set(item.category_id, (result.get(item.category_id) ?? 0) + item.amount_cents);
    }
    return result;
  }, [items, month]);
  const unassignedSpending = useMemo(
    () => items.filter((item) => !item.deleted_at && item.kind === "expense" && !item.category_id && item.occurred_on.startsWith(month)).reduce((total, item) => total + item.amount_cents, 0),
    [items, month],
  );
  const totalLimit = budgets.reduce((total, budget) => total + budget.limit_cents, 0);
  const totalSpent = [...spending.values()].reduce((total, value) => total + value, 0);

  useEffect(() => {
    let active = true;
    setMessage("");
    setBudgets([]);
    fetchBudgets(household.id, month)
      .then((data) => active && setBudgets(data))
      .catch((error: Error) => active && setMessage(error.message));
    return () => { active = false; };
  }, [household.id, month]);

  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Presupuestos mensuales</h2>
            <p className="mt-1 text-sm text-slate-500">Los gastos comunes y personales cuentan en el presupuesto del hogar.</p>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Mes
            <input className={fieldClassName} type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-brand-50 p-4"><p className="text-sm text-brand-700">Límite total</p><strong className="mt-1 block text-xl text-brand-700">{euros(totalLimit)}</strong></div>
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-600">Gastos categorizados</p><strong className="mt-1 block text-xl text-slate-900">{euros(totalSpent)}</strong></div>
          <div className={`rounded-xl p-4 ${unassignedSpending ? "bg-amber-50" : "bg-emerald-50"}`}><p className={`text-sm ${unassignedSpending ? "text-amber-700" : "text-emerald-700"}`}>Sin categoría</p><strong className={`mt-1 block text-xl ${unassignedSpending ? "text-amber-800" : "text-emerald-800"}`}>{euros(unassignedSpending)}</strong></div>
        </div>
        {unassignedSpending > 0 && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Asigna una categoría a estos gastos para que aparezcan dentro de sus presupuestos.</p>}
        {message && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{message}</p>}
      </Panel>
      {expenseCategories.length === 0 ? (
        <Panel><h2 className="text-lg font-bold text-slate-900">Crea una categoría de gasto</h2><p className="mt-2 text-slate-600">Antes de definir un presupuesto, añade categorías como Alimentación, Vivienda o Transporte en Movimientos.</p></Panel>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {expenseCategories.map((category) => (
            <BudgetRow
              key={`${month}-${category.id}`}
              category={category}
              budget={budgets.find((budget) => budget.category_id === category.id)}
              spent={spending.get(category.id) ?? 0}
              householdId={household.id}
              month={month}
              onSaved={(saved) => setBudgets((current) => [saved, ...current.filter((budget) => budget.id !== saved.id && budget.category_id !== saved.category_id)])}
              onDeleted={(id) => setBudgets((current) => current.filter((budget) => budget.id !== id))}
            />
          ))}
        </section>
      )}
    </div>
  );
}

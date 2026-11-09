import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  addDebtPayment,
  archiveDebt,
  createDebt,
  fetchDebtPayments,
  fetchDebts,
} from "../lib/data";
import { euros } from "../lib/finance";
import type { Debt, DebtPayment, Household, Scope } from "../types";
import { fieldClassName, Panel, PrimaryButton, TextButton } from "./ui";
import { Archive } from 'lucide-react'

function centsFromInput(value: string) {
  return Math.round(Number(value.replace(",", ".")) * 100);
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function DebtCard({
  debt,
  payments,
  household,
  userId,
  onPayment,
  onArchived,
}: {
  debt: Debt;
  payments: DebtPayment[];
  household: Household;
  userId: string;
  onPayment: (payment: DebtPayment) => void;
  onArchived: (id: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState("");
  const pending = Math.max(debt.amount_cents - debt.paid_cents, 0);
  const progress = Math.min((debt.paid_cents / debt.amount_cents) * 100, 100);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = pending > 0 && debt.due_on < today;
  const submitPayment = async (event: FormEvent) => {
    event.preventDefault();
    const amountCents = centsFromInput(amount);
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0)
      return setMessage("Indica un pago válido.");
    if (amountCents > pending)
      return setMessage(`El pago no puede superar los ${euros(pending)} pendientes.`);
    try {
      const payment = await addDebtPayment({
        debt_id: debt.id,
        household_id: household.id,
        user_id: userId,
        amount_cents: amountCents,
        occurred_on: date,
        note: note.trim() || null,
      });
      onPayment(payment);
      setAmount("");
      setNote("");
      setMessage("Pago registrado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar el pago.");
    }
  };
  const archive = async () => {
    if (!window.confirm(`¿Archivar la deuda “${debt.name}”?`)) return;
    try {
      await archiveDebt(debt.id);
      onArchived(debt.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo archivar la deuda.");
    }
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0"><h3 className="truncate text-lg font-bold text-slate-900">{debt.name}</h3><p className="mt-1 text-sm text-slate-500">{debt.scope === "shared" ? "Deuda común" : "Deuda personal"} · Vence el {displayDate(debt.due_on)}</p></div>
        <TextButton className="shrink-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700" type="button" onClick={archive}><Archive /></TextButton>
      </div>
      <div className="mt-5 flex items-end justify-between gap-3">
        <div><strong className="text-2xl tracking-tight text-brand-700">{euros(pending)}</strong><span className="text-slate-500"> pendiente</span></div>
        <span className={`text-sm font-semibold ${pending === 0 ? "text-emerald-700" : overdue ? "text-rose-700" : "text-slate-600"}`}>{pending === 0 ? "Pagada" : overdue ? "Vencida" : `${euros(debt.paid_cents)} pagados`}</span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all ${pending === 0 ? "bg-emerald-500" : "bg-brand-600"}`} style={{ width: `${progress}%` }} /></div>
      <p className="mt-2 text-sm text-slate-500">Total: {euros(debt.amount_cents)} · {Math.round(progress)}% pagado</p>
      {overdue && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">Esta deuda tiene un pago pendiente y ya ha vencido.</p>}

      {pending > 0 && (
        <form className="mt-5 border-t border-slate-100 pt-5" onSubmit={submitPayment}>
          <p className="text-sm font-semibold text-slate-700">Registrar pago</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Importe (€)<input className={fieldClassName} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
            <label className="text-sm font-medium text-slate-700">Fecha<input className={fieldClassName} type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
          </div>
          <label className="mt-3 block text-sm font-medium text-slate-700">Nota <span className="font-normal text-slate-400">(opcional)</span><input className={fieldClassName} value={note} onChange={(event) => setNote(event.target.value)} maxLength={160} /></label>
          <PrimaryButton className="mt-4" type="submit">Añadir pago</PrimaryButton>
        </form>
      )}
      {message && <p className="mt-3 text-sm text-slate-500">{message}</p>}
      {payments.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4"><h4 className="text-sm font-semibold text-slate-700">Últimos pagos</h4><div className="mt-2 divide-y divide-slate-100">{payments.slice(0, 3).map((payment) => <div className="flex justify-between gap-3 py-2 text-sm" key={payment.id}><span className="min-w-0 truncate text-slate-500">{payment.occurred_on}{payment.note && ` · ${payment.note}`}</span><strong className="shrink-0 text-emerald-700">-{euros(payment.amount_cents)}</strong></div>)}</div></div>
      )}
    </article>
  );
}

export function Debts({
  household,
  userId,
  onChanged,
}: {
  household: Household;
  userId: string;
  onChanged: () => void;
}) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [scope, setScope] = useState<Scope>("shared");
  const [message, setMessage] = useState("");
  const totalPending = debts.reduce((total, debt) => total + debt.amount_cents - debt.paid_cents, 0);
  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = debts.filter((debt) => debt.amount_cents > debt.paid_cents && debt.due_on < today).length;

  const load = async () => {
    try {
      const [nextDebts, nextPayments] = await Promise.all([fetchDebts(household.id), fetchDebtPayments(household.id)]);
      setDebts(nextDebts);
      setPayments(nextPayments);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar las deudas.");
    }
  };
  useEffect(() => { void load(); }, [household.id]);
  const paymentsByDebt = useMemo(() => {
    const result = new Map<string, DebtPayment[]>();
    for (const payment of payments) {
      const entries = result.get(payment.debt_id) ?? [];
      entries.push(payment);
      result.set(payment.debt_id, entries);
    }
    return result;
  }, [payments]);
  const create = async (event: FormEvent) => {
    event.preventDefault();
    const amountCents = centsFromInput(amount);
    if (!name.trim()) return setMessage("Indica el nombre de la deuda.");
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) return setMessage("Indica un importe válido.");
    if (!dueOn) return setMessage("Indica una fecha de vencimiento.");
    try {
      const debt = await createDebt({ household_id: household.id, name: name.trim(), amount_cents: amountCents, due_on: dueOn, scope });
      setDebts((current) => [...current, debt].sort((first, second) => first.due_on.localeCompare(second.due_on)));
      onChanged();
      setName("");
      setAmount("");
      setDueOn("");
      setScope("shared");
      setMessage("Deuda creada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear la deuda.");
    }
  };

  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h2 className="text-lg font-bold text-slate-900">Deudas y pagos futuros</h2><p className="mt-1 text-sm text-slate-500">Registra pagos parciales y mantén al día el saldo pendiente.</p></div><div className="text-left sm:text-right"><p className="text-sm text-slate-500">Pendiente total</p><strong className="text-xl text-brand-700">{euros(totalPending)}</strong></div></div>
        {overdueCount > 0 && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">Tienes {overdueCount} {overdueCount === 1 ? "deuda vencida" : "deudas vencidas"} con saldo pendiente.</p>}
        <form className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem_12rem_10rem_auto]" onSubmit={create}>
          <label className="text-sm font-medium text-slate-700">Deuda<input className={fieldClassName} placeholder="Ej. Préstamo coche" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required /></label>
          <label className="text-sm font-medium text-slate-700">Total (€)<input className={fieldClassName} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
          <label className="text-sm font-medium text-slate-700">Vencimiento<input className={fieldClassName} type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} required /></label>
          <label className="text-sm font-medium text-slate-700">Ámbito<select className={fieldClassName} value={scope} onChange={(event) => setScope(event.target.value as Scope)}><option value="shared">Común</option><option value="personal">Personal</option></select></label>
          <PrimaryButton className="self-end">Crear deuda</PrimaryButton>
        </form>
        {message && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p>}
      </Panel>
      {debts.length === 0 ? <Panel><h2 className="text-lg font-bold text-slate-900">No hay deudas activas</h2><p className="mt-2 text-slate-600">Añade solo compromisos pendientes para tener una previsión realista del saldo disponible.</p></Panel> : <section className="grid gap-4 xl:grid-cols-2">{debts.map((debt) => <DebtCard key={debt.id} debt={debt} payments={paymentsByDebt.get(debt.id) ?? []} household={household} userId={userId} onPayment={(payment) => { setPayments((current) => [payment, ...current]); void load(); onChanged(); }} onArchived={(id) => { setDebts((current) => current.filter((debt) => debt.id !== id)); onChanged(); }} />)}</section>}
    </div>
  );
}

import { useMemo, useState, type FormEvent } from "react";
import { archiveCategory, createCategory, deleteTransaction, saveTransaction, updateTransaction } from "../lib/data";
import { euros, monthKey } from "../lib/finance";
import type { Category, Household, Kind, Scope, Transaction } from "../types";
import { fieldClassName, Panel, PrimaryButton, TextButton } from "./ui";

type TransactionsProps = {
  household: Household;
  userId: string;
  items: Transaction[];
  categories: Category[];
  onSaved: (item: Transaction) => void;
  onDeleted: (id: string) => void;
  onCategoryCreated: (category: Category) => void;
  onCategoryArchived: (id: string) => void;
};

const labelClassName = "block text-sm font-medium text-slate-700";

export function Transactions({ household, userId, items, categories, onSaved, onDeleted, onCategoryCreated, onCategoryArchived }: TransactionsProps) {
  const [kind, setKind] = useState<Kind>("expense");
  const [scope, setScope] = useState<Scope>("shared");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [message, setMessage] = useState("");
  const [month, setMonth] = useState(monthKey());
  const [kindFilter, setKindFilter] = useState<Kind | "all">("all");
  const [scopeFilter, setScopeFilter] = useState<Scope | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categoryName, setCategoryName] = useState("");
  const [categoryKind, setCategoryKind] = useState<Kind>("expense");
  const [categoryMessage, setCategoryMessage] = useState("");
  const availableCategories = categories.filter((category) => category.kind === kind);
  const visibleItems = useMemo(
    () => items.filter((item) => !item.deleted_at && item.occurred_on.startsWith(month) && (kindFilter === "all" || item.kind === kindFilter) && (scopeFilter === "all" || item.scope === scopeFilter) && (categoryFilter === "all" || item.category_id === categoryFilter)),
    [items, month, kindFilter, scopeFilter, categoryFilter],
  );

  const resetForm = () => {
    setKind("expense");
    setScope("shared");
    setAmount("");
    setNote("");
    setDate(new Date().toISOString().slice(0, 10));
    setCategoryId("");
    setEditing(null);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const amountCents = Math.round(Number(amount.replace(",", ".")) * 100);
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) return setMessage("Indica un importe válido.");
    const input = { kind, scope, category_id: categoryId || null, amount_cents: amountCents, occurred_on: date, note };
    try {
      const saved = editing
        ? await updateTransaction(editing, input)
        : await saveTransaction({ id: crypto.randomUUID(), household_id: household.id, user_id: userId, ...input });
      const wasEditing = Boolean(editing);
      onSaved(saved);
      resetForm();
      setMessage(navigator.onLine ? wasEditing ? "Movimiento actualizado." : "Movimiento guardado." : "Guardado en este dispositivo; se enviará al reconectar.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar.");
    }
  };
  const edit = (item: Transaction) => {
    setEditing(item);
    setKind(item.kind);
    setScope(item.scope);
    setAmount((item.amount_cents / 100).toFixed(2).replace(".", ","));
    setNote(item.note ?? "");
    setDate(item.occurred_on);
    setCategoryId(item.category_id ?? "");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const remove = async (item: Transaction) => {
    if (!window.confirm(`¿Eliminar “${item.note || "este movimiento"}”?`)) return;
    try {
      await deleteTransaction(item);
      onDeleted(item.id);
      if (editing?.id === item.id) resetForm();
      setMessage(navigator.onLine ? "Movimiento eliminado." : "Eliminado en este dispositivo; se sincronizará al reconectar.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar.");
    }
  };
  const addCategory = async (event: FormEvent) => {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) return;
    try {
      const category = await createCategory({ household_id: household.id, name, kind: categoryKind, color: categoryKind === "income" ? "#08754d" : "#b24c3c" });
      onCategoryCreated(category);
      setCategoryName("");
      setCategoryMessage("Categoría creada.");
    } catch (error) {
      setCategoryMessage(error instanceof Error ? error.message : "No se pudo crear la categoría.");
    }
  };
  const archive = async (category: Category) => {
    if (!window.confirm(`¿Archivar la categoría “${category.name}”?`)) return;
    try {
      await archiveCategory(category.id);
      onCategoryArchived(category.id);
      if (categoryId === category.id) setCategoryId("");
      if (categoryFilter === category.id) setCategoryFilter("all");
      setCategoryMessage("Categoría archivada. Los movimientos existentes no cambian.");
    } catch (error) {
      setCategoryMessage(error instanceof Error ? error.message : "No se pudo archivar la categoría.");
    }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={submit}>
        <Panel>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{editing ? "Editar movimiento" : "Nuevo movimiento"}</h2>
              <p className="mt-1 text-sm text-slate-500">Registra ingresos y gastos de tu hogar.</p>
            </div>
            {editing && <TextButton type="button" onClick={resetForm}>Cancelar edición</TextButton>}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className={labelClassName}>Tipo<select className={fieldClassName} value={kind} onChange={(event) => { setKind(event.target.value as Kind); setCategoryId(""); }}><option value="expense">Gasto</option><option value="income">Ingreso</option></select></label>
            <label className={labelClassName}>Ámbito<select className={fieldClassName} value={scope} onChange={(event) => setScope(event.target.value as Scope)}><option value="shared">Común</option><option value="personal">Personal</option></select></label>
            <label className={labelClassName}>Categoría<select className={fieldClassName} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Sin categoría</option>{availableCategories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
            <label className={labelClassName}>Importe (€)<input className={fieldClassName} inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
            <label className={labelClassName}>Fecha<input className={fieldClassName} type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <label className={`${labelClassName} sm:col-span-2 lg:col-span-1`}>Concepto<input className={fieldClassName} required value={note} onChange={(event) => setNote(event.target.value)} /></label>
          </div>
          <PrimaryButton className="mt-5" type="submit">{editing ? "Guardar cambios" : "Guardar movimiento"}</PrimaryButton>
          {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
        </Panel>
      </form>

      <Panel>
        <h2 className="text-lg font-bold text-slate-900">Movimientos</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className={labelClassName}>Mes<input className={fieldClassName} type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
          <label className={labelClassName}>Tipo<select className={fieldClassName} value={kindFilter} onChange={(event) => setKindFilter(event.target.value as Kind | "all")}><option value="all">Todos</option><option value="expense">Gastos</option><option value="income">Ingresos</option></select></label>
          <label className={labelClassName}>Ámbito<select className={fieldClassName} value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value as Scope | "all")}><option value="all">Todos</option><option value="shared">Común</option><option value="personal">Personal</option></select></label>
          <label className={labelClassName}>Categoría<select className={fieldClassName} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">Todas</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
        </div>
        <div className="mt-5 divide-y divide-slate-100">
          {visibleItems.map((item) => {
            const category = categories.find((entry) => entry.id === item.category_id);
            return (
              <div className="flex items-start justify-between gap-4 py-4" key={item.id}>
                <span className="min-w-0">
                  <b className="block truncate text-sm text-slate-800">{item.note || "Sin descripción"}</b>
                  <small className="block text-sm text-slate-500">{item.occurred_on} · {item.scope === "shared" ? "Común" : "Personal"}{item.category_id && ` · ${category?.name ?? "Categoría archivada"}`}</small>
                </span>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <strong className={item.kind === "income" ? "text-emerald-700" : "text-rose-700"}>{item.kind === "income" ? "+" : "-"}{euros(item.amount_cents)}</strong>
                  {item.user_id === userId && <span className="flex gap-1"><TextButton type="button" onClick={() => edit(item)}>Editar</TextButton><TextButton className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" type="button" onClick={() => remove(item)}>Eliminar</TextButton></span>}
                </div>
              </div>
            );
          })}
        </div>
        {visibleItems.length === 0 && <p className="mt-5 text-sm text-slate-500">No hay movimientos que coincidan con los filtros.</p>}
      </Panel>

      <Panel>
        <h2 className="text-lg font-bold text-slate-900">Categorías</h2>
        <form className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]" onSubmit={addCategory}>
          <input className={fieldClassName} aria-label="Nombre de categoría" placeholder="Ej. Alimentación" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} maxLength={80} required />
          <select className={fieldClassName} value={categoryKind} onChange={(event) => setCategoryKind(event.target.value as Kind)}><option value="expense">Gasto</option><option value="income">Ingreso</option></select>
          <PrimaryButton>Añadir categoría</PrimaryButton>
        </form>
        {categories.length === 0 ? <p className="mt-5 text-sm text-slate-500">Aún no hay categorías. Puedes añadirlas cuando las necesites.</p> : <div className="mt-5 divide-y divide-slate-100 border-y border-slate-100">{categories.map((category) => <div className="flex items-center justify-between gap-4 py-3" key={category.id}><span className="flex items-center gap-2 text-sm text-slate-700"><i className="size-2.5 rounded-full" style={{ backgroundColor: category.color }} />{category.name} · {category.kind === "income" ? "Ingreso" : "Gasto"}</span><TextButton className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" type="button" onClick={() => archive(category)}>Archivar</TextButton></div>)}</div>}
        {categoryMessage && <p className="mt-3 text-sm text-slate-600">{categoryMessage}</p>}
      </Panel>
    </div>
  );
}

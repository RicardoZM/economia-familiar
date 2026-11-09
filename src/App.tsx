import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AppShell } from "./components/app-shell";
import { Auth, HouseholdSetup, Setup } from "./components/auth-views";
import { EmptyState, Settings } from "./components/content-states";
import { Dashboard } from "./components/dashboard";
import { Transactions } from "./components/transactions";
import { configured, supabase } from "./lib/supabase";
import { fetchCategories, fetchTransactions, loadMyHousehold, syncPending } from "./lib/data";
import { euros, monthKey, monthTotals } from "./lib/finance";
import type { Category, Debt, Household, Page, Transaction } from "./types";

const demoDebts: Debt[] = [];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [page, setPage] = useState<Page>("inicio");
  const [items, setItems] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setHousehold(null);
      setCategories([]);
      return;
    }
    loadMyHousehold().then(setHousehold).catch((reason: Error) => setError(reason.message));
  }, [session]);

  useEffect(() => {
    if (!household) return;
    fetchTransactions(household.id).then(setItems).catch((reason: Error) => setError(reason.message));
    fetchCategories(household.id).then(setCategories).catch((reason: Error) => setError(reason.message));
    const sync = () => syncPending(session);
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [household, session]);

  const totals = useMemo(() => monthTotals(items, monthKey()), [items]);
  if (!configured) return <Setup />;
  if (!session) return <Auth />;
  if (!household) return <HouseholdSetup onReady={setHousehold} />;

  const exportCsv = () => {
    const header = "fecha,tipo,ámbito,importe,nota";
    const rows = items.filter((item) => !item.deleted_at).map((item) => [item.occurred_on, item.kind, item.scope, (item.amount_cents / 100).toFixed(2), JSON.stringify(item.note ?? "")].join(","));
    const url = URL.createObjectURL(new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `movimientos-${monthKey()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell
      householdName={household.name}
      page={page}
      online={navigator.onLine}
      onPageChange={setPage}
      onExport={exportCsv}
      onSignOut={() => supabase?.auth.signOut()}
    >
      {error && <p className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {page === "inicio" && <Dashboard items={items} debts={demoDebts} income={totals.income} expense={totals.expense} />}
      {page === "movimientos" && (
        <Transactions
          household={household}
          userId={session.user.id}
          items={items}
          categories={categories}
          onSaved={(item) => setItems((current) => [item, ...current.filter((entry) => entry.id !== item.id)])}
          onDeleted={(id) => setItems((current) => current.map((item) => item.id === id ? { ...item, deleted_at: new Date().toISOString() } : item))}
          onCategoryCreated={(category) => setCategories((current) => [...current, category].sort((first, second) => first.name.localeCompare(second.name, "es")))}
          onCategoryArchived={(id) => setCategories((current) => current.filter((category) => category.id !== id))}
        />
      )}
      {page === "presupuestos" && <EmptyState title="Presupuestos por categoría" text="La estructura segura está creada en la base de datos. La gestión visual de límites mensuales es la siguiente pantalla a completar." />}
      {page === "objetivos" && <EmptyState title="Objetivos de ahorro" text="Puedes crear objetivos y progreso desde la tabla goals. La interfaz de alta y aportaciones queda pendiente de una segunda iteración." />}
      {page === "deudas" && <EmptyState title="Deudas y pagos futuros" text={`La previsión actual descuenta ${euros(demoDebts.reduce((total, debt) => total + debt.amount_cents - debt.paid_cents, 0))} de deudas pendientes.`} />}
      {page === "ajustes" && <Settings household={household} />}
    </AppShell>
  );
}

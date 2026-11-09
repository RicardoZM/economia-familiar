import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AppShell } from "./components/app-shell";
import { Auth, HouseholdSetup, Setup } from "./components/auth-views";
import { Budgets } from "./components/budgets";
import { Settings } from "./components/content-states";
import { Dashboard } from "./components/dashboard";
import { Debts } from "./components/debts";
import { Goals } from "./components/goals";
import { Transactions } from "./components/transactions";
import { configured, supabase } from "./lib/supabase";
import { fetchCategories, fetchDebts, fetchTransactions, loadMyHousehold, syncPending } from "./lib/data";
import { monthKey, monthTotals } from "./lib/finance";
import type { Category, Debt, Household, Page, Transaction } from "./types";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [page, setPage] = useState<Page>("inicio");
  const [items, setItems] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
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
      setDebts([]);
      return;
    }
    loadMyHousehold().then(setHousehold).catch((reason: Error) => setError(reason.message));
  }, [session]);

  useEffect(() => {
    if (!household) return;
    fetchTransactions(household.id).then(setItems).catch((reason: Error) => setError(reason.message));
    fetchCategories(household.id).then(setCategories).catch((reason: Error) => setError(reason.message));
    fetchDebts(household.id).then(setDebts).catch((reason: Error) => setError(reason.message));
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
  const refreshDebts = () => {
    fetchDebts(household.id).then(setDebts).catch((reason: Error) => setError(reason.message));
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
      {page === "inicio" && <Dashboard items={items} debts={debts} income={totals.income} expense={totals.expense} />}
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
      {page === "presupuestos" && <Budgets household={household} categories={categories} items={items} />}
      {page === "objetivos" && <Goals household={household} userId={session.user.id} />}
      {page === "deudas" && <Debts household={household} userId={session.user.id} onChanged={refreshDebts} />}
      {page === "ajustes" && <Settings household={household} />}
    </AppShell>
  );
}

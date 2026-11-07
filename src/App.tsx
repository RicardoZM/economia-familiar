import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { configured, missingConfiguration, supabase } from "./lib/supabase";
import {
  archiveCategory,
  createCategory,
  deleteTransaction,
  fetchCategories,
  fetchTransactions,
  loadMyHousehold,
  saveTransaction,
  syncPending,
  updateTransaction,
} from "./lib/data";
import { euros, monthKey, monthTotals, plannedBalance } from "./lib/finance";
import type {
  Category,
  Debt,
  Household,
  Kind,
  Page,
  Scope,
  Transaction,
} from "./types";

const demoDebts: Debt[] = [];
const nav: Array<[Page, string]> = [
  ["inicio", "Inicio"],
  ["movimientos", "Movimientos"],
  ["presupuestos", "Presupuestos"],
  ["objetivos", "Objetivos"],
  ["deudas", "Deudas"],
  ["ajustes", "Ajustes"],
];

export default function App() {
  const [session, setSession] = useState<Session | null>(null),
    [household, setHousehold] = useState<Household | null>(null),
    [page, setPage] = useState<Page>("inicio"),
    [items, setItems] = useState<Transaction[]>([]),
    [categories, setCategories] = useState<Category[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) =>
      setSession(next),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) {
      setHousehold(null);
      setCategories([]);
      return;
    }
    loadMyHousehold()
      .then(setHousehold)
      .catch((e) => setError(e.message));
  }, [session]);
  useEffect(() => {
    if (!household) return;
    fetchTransactions(household.id)
      .then(setItems)
      .catch((e) => setError(e.message));
    fetchCategories(household.id)
      .then(setCategories)
      .catch((e) => setError(e.message));
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
    const rows = items
      .filter((x) => !x.deleted_at)
      .map((x) =>
        [
          x.occurred_on,
          x.kind,
          x.scope,
          (x.amount_cents / 100).toFixed(2),
          JSON.stringify(x.note ?? ""),
        ].join(","),
      );
    const url = URL.createObjectURL(
      new Blob([[header, ...rows].join("\n")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `movimientos-${monthKey()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          saldo<span>.</span>
        </div>
        <p className="house">{household.name}</p>
        {nav.map(([id, label]) => (
          <button
            className={page === id ? "nav active" : "nav"}
            onClick={() => setPage(id)}
            key={id}
          >
            {label}
          </button>
        ))}
        <button className="nav" onClick={exportCsv}>
          Exportar CSV
        </button>
        <button className="signout" onClick={() => supabase?.auth.signOut()}>
          Cerrar sesión
        </button>
      </aside>
      <main>
        <header>
          <div>
            <p className="eyebrow">
              {navigator.onLine
                ? "Sincronizado"
                : "Sin conexión · cambios guardados localmente"}
            </p>
            <h1>{nav.find((x) => x[0] === page)?.[1]}</h1>
          </div>
          <button className="primary" onClick={() => setPage("movimientos")}>
            + Movimiento
          </button>
        </header>
        {error && <p className="error">{error}</p>}
        {page === "inicio" && (
          <Dashboard
            items={items}
            debts={demoDebts}
            income={totals.income}
            expense={totals.expense}
          />
        )}
        {page === "movimientos" && (
          <Transactions
            household={household}
            userId={session.user.id}
            items={items}
            categories={categories}
            onSaved={(x) =>
              setItems((current) => [
                x,
                ...current.filter((i) => i.id !== x.id),
              ])
            }
            onDeleted={(id) =>
              setItems((current) =>
                current.map((item) =>
                  item.id === id
                    ? { ...item, deleted_at: new Date().toISOString() }
                    : item,
                ),
              )
            }
            onCategoryCreated={(category) =>
              setCategories((current) =>
                [...current, category].sort((a, b) =>
                  a.name.localeCompare(b.name, "es"),
                ),
              )
            }
            onCategoryArchived={(id) =>
              setCategories((current) => current.filter((x) => x.id !== id))
            }
          />
        )}
        {page === "presupuestos" && (
          <Empty
            title="Presupuestos por categoría"
            text="La estructura segura está creada en la base de datos. La gestión visual de límites mensuales es la siguiente pantalla a completar."
          />
        )}
        {page === "objetivos" && (
          <Empty
            title="Objetivos de ahorro"
            text="Puedes crear objetivos y progreso desde la tabla goals. La interfaz de alta y aportaciones queda pendiente de una segunda iteración."
          />
        )}
        {page === "deudas" && (
          <Empty
            title="Deudas y pagos futuros"
            text={`La previsión actual descuenta ${euros(demoDebts.reduce((n, d) => n + d.amount_cents - d.paid_cents, 0))} de deudas pendientes.`}
          />
        )}
        {page === "ajustes" && <Settings household={household} />}
      </main>
    </div>
  );
}
function Setup() {
  return (
    <div className="auth">
      <div className="card">
        <div className="brand">
          saldo<span>.</span>
        </div>
        <h1>Falta conectar Supabase</h1>
        <p>
          Esta versión se ha publicado sin la configuración pública de tu
          proyecto. Faltan: <b>{missingConfiguration.join(" y ")}</b>.
        </p>
        <ol>
          <li>
            En Supabase, abre <b>Project Settings → API Keys</b> y copia la{" "}
            <b>Project URL</b> y la clave pública <b>Publishable</b> (o{" "}
            <b>anon</b>).
          </li>
          <li>
            En Vercel, abre el proyecto →{" "}
            <b>Settings → Environment Variables</b> y añade ambos valores.
          </li>
          <li>
            En <b>Deployments</b>, usa <b>Redeploy</b> para crear una
            compilación nueva: Vite incorpora estas variables durante la
            compilación.
          </li>
        </ol>
        <p className="muted">
          En desarrollo local, crea <code>.env.local</code> desde{" "}
          <code>.env.example</code> y reinicia <code>npm run dev</code>. No uses
          nunca una clave <code>service_role</code>.
        </p>
      </div>
    </div>
  );
}
function Auth() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [register, setRegister] = useState(false),
    [message, setMessage] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const result = register
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setMessage(
      result.error?.message ??
        (register
          ? "Revisa tu correo para confirmar la cuenta."
          : "Acceso correcto."),
    );
  };
  return (
    <div className="auth">
      <form className="card" onSubmit={submit}>
        <div className="brand">
          saldo<span>.</span>
        </div>
        <h1>{register ? "Crea tu cuenta" : "Bienvenido"}</h1>
        <p>Una cuenta por persona; datos protegidos por hogar.</p>
        <label>
          Correo
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {message && <p className="muted">{message}</p>}
        <button className="primary">
          {register ? "Crear cuenta" : "Entrar"}
        </button>
        <button
          type="button"
          className="link"
          onClick={() => setRegister(!register)}
        >
          {register ? "Ya tengo una cuenta" : "Crear una cuenta"}
        </button>
      </form>
    </div>
  );
}
function HouseholdSetup({ onReady }: { onReady: (home: Household) => void }) {
  const [name, setName] = useState("Nuestro hogar"),
    [code, setCode] = useState(""),
    [message, setMessage] = useState("");
  const create = async (e: FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase!.rpc("create_household", {
      household_name: name,
      method: "equal",
    });
    if (error) return setMessage(error.message);
    onReady(data as Household);
  };
  const join = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await supabase!.rpc("join_household", { code });
    if (error) return setMessage(error.message);
    const home = await loadMyHousehold();
    if (home) onReady(home);
  };
  return (
    <div className="auth">
      <div className="card">
        <div className="brand">
          saldo<span>.</span>
        </div>
        <h1>Configura el hogar</h1>
        <p>Una persona crea el hogar; la otra usa su código de invitación.</p>
        <form onSubmit={create}>
          <label>
            Nombre
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <button className="primary">Crear hogar</button>
        </form>
        <hr />
        <form onSubmit={join}>
          <label>
            Código de invitación
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </label>
          <button className="primary">Unirme al hogar</button>
        </form>
        {message && <p className="muted">{message}</p>}
      </div>
    </div>
  );
}
function Dashboard({
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
  return (
    <>
      <section className="grid">
        <Metric label="Ingresos este mes" value={euros(income)} tone="good" />
        <Metric label="Gastos este mes" value={euros(expense)} tone="bad" />
        <Metric
          label="Disponible previsto"
          value={euros(balance)}
          tone="plain"
        />
      </section>
      <section className="panel">
        <h2>Actividad reciente</h2>
        {items
          .filter((x) => !x.deleted_at)
          .slice(0, 6)
          .map((x) => (
            <div className="row" key={x.id}>
              <span>
                <b>{x.note || "Sin descripción"}</b>
                <small>
                  {x.occurred_on} ·{" "}
                  {x.scope === "shared" ? "Común" : "Personal"}
                </small>
              </span>
              <strong className={x.kind}>
                {x.kind === "income" ? "+" : "-"}
                {euros(x.amount_cents)}
              </strong>
            </div>
          ))}
        {items.length === 0 && (
          <p className="muted">
            Aún no hay movimientos. Añade el primero para ver el resumen.
          </p>
        )}
      </section>
    </>
  );
}
function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <article className={`metric ${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}
function Transactions({
  household,
  userId,
  items,
  categories,
  onSaved,
  onDeleted,
  onCategoryCreated,
  onCategoryArchived,
}: {
  household: Household;
  userId: string;
  items: Transaction[];
  categories: Category[];
  onSaved: (x: Transaction) => void;
  onDeleted: (id: string) => void;
  onCategoryCreated: (category: Category) => void;
  onCategoryArchived: (id: string) => void;
}) {
  const [kind, setKind] = useState<Kind>("expense"),
    [scope, setScope] = useState<Scope>("shared"),
    [amount, setAmount] = useState(""),
    [note, setNote] = useState(""),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [categoryId, setCategoryId] = useState(""),
    [editing, setEditing] = useState<Transaction | null>(null),
    [message, setMessage] = useState(""),
    [month, setMonth] = useState(monthKey()),
    [kindFilter, setKindFilter] = useState<Kind | "all">("all"),
    [scopeFilter, setScopeFilter] = useState<Scope | "all">("all"),
    [categoryFilter, setCategoryFilter] = useState("all"),
    [categoryName, setCategoryName] = useState(""),
    [categoryKind, setCategoryKind] = useState<Kind>("expense"),
    [categoryMessage, setCategoryMessage] = useState("");
  const availableCategories = categories.filter((category) => category.kind === kind);
  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) =>
          !item.deleted_at &&
          item.occurred_on.startsWith(month) &&
          (kindFilter === "all" || item.kind === kindFilter) &&
          (scopeFilter === "all" || item.scope === scopeFilter) &&
          (categoryFilter === "all" || item.category_id === categoryFilter),
      ),
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
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cents = Math.round(Number(amount.replace(",", ".")) * 100);
    if (!Number.isSafeInteger(cents) || cents <= 0)
      return setMessage("Indica un importe válido.");
    const input = {
      kind,
      scope,
      category_id: categoryId || null,
      amount_cents: cents,
      occurred_on: date,
      note,
    };
    try {
      const saved = editing
        ? await updateTransaction(editing, input)
        : await saveTransaction({
            id: crypto.randomUUID(),
            household_id: household.id,
            user_id: userId,
            ...input,
          });
      onSaved(saved);
      resetForm();
      setMessage(
        navigator.onLine
          ? editing
            ? "Movimiento actualizado."
            : "Movimiento guardado."
          : "Guardado en este dispositivo; se enviará al reconectar.",
      );
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
      setMessage(
        navigator.onLine
          ? "Movimiento eliminado."
          : "Eliminado en este dispositivo; se sincronizará al reconectar.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar.");
    }
  };
  const addCategory = async (e: FormEvent) => {
    e.preventDefault();
    const name = categoryName.trim();
    if (!name) return;
    try {
      const category = await createCategory({
        household_id: household.id,
        name,
        kind: categoryKind,
        color: categoryKind === "income" ? "#08754d" : "#b24c3c",
      });
      onCategoryCreated(category);
      setCategoryName("");
      setCategoryMessage("Categoría creada.");
    } catch (error) {
      setCategoryMessage(
        error instanceof Error ? error.message : "No se pudo crear la categoría.",
      );
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
      setCategoryMessage(
        error instanceof Error ? error.message : "No se pudo archivar la categoría.",
      );
    }
  };
  return (
    <>
      <form className="panel form" onSubmit={submit}>
        <div className="panel-heading">
          <h2>{editing ? "Editar movimiento" : "Nuevo movimiento"}</h2>
          {editing && (
            <button type="button" className="secondary" onClick={resetForm}>
              Cancelar edición
            </button>
          )}
        </div>
        <div className="fields">
          <label>
            Tipo
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as Kind);
                setCategoryId("");
              }}
            >
              <option value="expense">Gasto</option>
              <option value="income">Ingreso</option>
            </select>
          </label>
          <label>
            Ámbito
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as Scope)}
            >
              <option value="shared">Común</option>
              <option value="personal">Personal</option>
            </select>
          </label>
          <label>
            Categoría
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Sin categoría</option>
              {availableCategories.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Importe (€)
            <input
              inputMode="decimal"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label>
            Fecha
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        <label>
          Concepto
          <input
            required
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <button className="primary">{editing ? "Guardar cambios" : "Guardar"}</button>
        {message && <p className="muted">{message}</p>}
      </form>
      <section className="panel">
        <h2>Movimientos</h2>
        <div className="filters">
          <label>
            Mes
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
          <label>
            Tipo
            <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as Kind | "all")}>
              <option value="all">Todos</option>
              <option value="expense">Gastos</option>
              <option value="income">Ingresos</option>
            </select>
          </label>
          <label>
            Ámbito
            <select value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value as Scope | "all")}>
              <option value="all">Todos</option>
              <option value="shared">Común</option>
              <option value="personal">Personal</option>
            </select>
          </label>
          <label>
            Categoría
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">Todas</option>
              {categories.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {visibleItems.map((x) => (
            <div className="row" key={x.id}>
              <span>
                <b>{x.note || "Sin descripción"}</b>
                <small>
                  {x.occurred_on} · {x.scope === "shared" ? "Común" : "Personal"}
                  {x.category_id &&
                    ` · ${categories.find((category) => category.id === x.category_id)?.name ?? "Categoría archivada"}`}
                </small>
              </span>
              <div className="row-actions">
                <strong className={x.kind}>
                  {x.kind === "income" ? "+" : "-"}
                  {euros(x.amount_cents)}
                </strong>
                {x.user_id === userId && (
                  <span>
                    <button type="button" className="text-button" onClick={() => edit(x)}>
                      Editar
                    </button>
                    <button type="button" className="text-button danger" onClick={() => remove(x)}>
                      Eliminar
                    </button>
                  </span>
                )}
              </div>
            </div>
          ))}
        {visibleItems.length === 0 && (
          <p className="muted">No hay movimientos que coincidan con los filtros.</p>
        )}
      </section>
      <section className="panel">
        <h2>Categorías</h2>
        <form className="category-form" onSubmit={addCategory}>
          <input
            aria-label="Nombre de categoría"
            placeholder="Ej. Alimentación"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            maxLength={80}
            required
          />
          <select value={categoryKind} onChange={(e) => setCategoryKind(e.target.value as Kind)}>
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
          </select>
          <button className="primary">Añadir categoría</button>
        </form>
        {categories.length === 0 ? (
          <p className="muted">Aún no hay categorías. Puedes añadirlas cuando las necesites.</p>
        ) : (
          <div className="category-list">
            {categories.map((category) => (
              <div className="category" key={category.id}>
                <span>
                  <i style={{ backgroundColor: category.color }} />
                  {category.name} · {category.kind === "income" ? "Ingreso" : "Gasto"}
                </span>
                <button type="button" className="text-button danger" onClick={() => archive(category)}>
                  Archivar
                </button>
              </div>
            ))}
          </div>
        )}
        {categoryMessage && <p className="muted">{categoryMessage}</p>}
      </section>
    </>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
}
function Settings({ household }: { household: Household }) {
  return (
    <section className="panel">
      <h2>Hogar y privacidad</h2>
      <p>
        Reparto configurado:{" "}
        <b>
          {household.split_method === "equal"
            ? "50/50"
            : "proporcional a ingresos"}
        </b>
        .
      </p>
      <p>
        Comparte este código solo con la persona a la que quieres invitar:{" "}
        <b>{household.invite_code}</b>.
      </p>
      <p>
        Cada usuario solo puede leer o modificar datos de los hogares de los que
        es miembro.
      </p>
    </section>
  );
}

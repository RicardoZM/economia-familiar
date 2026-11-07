import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { configured, missingConfiguration, supabase } from "./lib/supabase";
import {
  fetchTransactions,
  loadMyHousehold,
  saveTransaction,
  syncPending,
} from "./lib/data";
import { euros, monthKey, monthTotals, plannedBalance } from "./lib/finance";
import type { Debt, Household, Page, Transaction } from "./types";

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
            onSaved={(x) =>
              setItems((current) => [
                x,
                ...current.filter((i) => i.id !== x.id),
              ])
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
  onSaved,
}: {
  household: Household;
  userId: string;
  items: Transaction[];
  onSaved: (x: Transaction) => void;
}) {
  const [kind, setKind] = useState<"income" | "expense">("expense"),
    [scope, setScope] = useState<"shared" | "personal">("shared"),
    [amount, setAmount] = useState(""),
    [note, setNote] = useState(""),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [message, setMessage] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cents = Math.round(Number(amount.replace(",", ".")) * 100);
    if (!Number.isSafeInteger(cents) || cents <= 0)
      return setMessage("Indica un importe válido.");
    const saved = await saveTransaction({
      id: crypto.randomUUID(),
      household_id: household.id,
      user_id: userId,
      kind,
      scope,
      category_id: null,
      amount_cents: cents,
      occurred_on: date,
      note,
    });
    onSaved(saved);
    setAmount("");
    setNote("");
    setMessage(
      navigator.onLine
        ? "Movimiento guardado."
        : "Guardado en este dispositivo; se enviará al reconectar.",
    );
  };
  return (
    <>
      <form className="panel form" onSubmit={submit}>
        <h2>Nuevo movimiento</h2>
        <div className="fields">
          <label>
            Tipo
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              <option value="expense">Gasto</option>
              <option value="income">Ingreso</option>
            </select>
          </label>
          <label>
            Ámbito
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as typeof scope)}
            >
              <option value="shared">Común</option>
              <option value="personal">Personal</option>
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
        <button className="primary">Guardar</button>
        {message && <p className="muted">{message}</p>}
      </form>
      <section className="panel">
        <h2>Todos los movimientos</h2>
        {items
          .filter((x) => !x.deleted_at)
          .map((x) => (
            <div className="row" key={x.id}>
              <span>
                <b>{x.note || "Sin descripción"}</b>
                <small>
                  {x.occurred_on} · {x.scope}
                </small>
              </span>
              <strong className={x.kind}>
                {x.kind === "income" ? "+" : "-"}
                {euros(x.amount_cents)}
              </strong>
            </div>
          ))}
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

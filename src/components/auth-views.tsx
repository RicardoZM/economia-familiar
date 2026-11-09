import { useState, type FormEvent, type ReactNode } from "react";
import { missingConfiguration, supabase } from "../lib/supabase";
import { loadMyHousehold } from "../lib/data";
import type { Household } from "../types";
import { fieldClassName, Logo, Panel, PrimaryButton, TextButton } from "./ui";

function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="grid min-h-screen place-items-center bg-brand-50 p-5">{children}</div>;
}

export function Setup() {
  return (
    <AuthLayout>
      <Panel className="w-full max-w-lg">
        <Logo />
        <h1 className="mt-8 text-2xl font-bold text-slate-900">Falta conectar Supabase</h1>
        <p className="mt-3 leading-6 text-slate-600">
          Esta versión se ha publicado sin la configuración pública del proyecto. Faltan: <b>{missingConfiguration.join(" y ")}</b>.
        </p>
        <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600">
          <li>En Supabase, copia la Project URL y la clave pública Publishable (o anon).</li>
          <li>En Vercel, añade ambos valores en Settings → Environment Variables.</li>
          <li>Haz Redeploy: Vite incorpora estas variables al compilar.</li>
        </ol>
      </Panel>
    </AuthLayout>
  );
}

export function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [register, setRegister] = useState(false);
  const [message, setMessage] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    const result = register
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setMessage(result.error?.message ?? (register ? "Revisa tu correo para confirmar la cuenta." : "Acceso correcto."));
  };
  return (
    <AuthLayout>
      <form className="w-full max-w-md" onSubmit={submit}>
        <Panel>
          <Logo />
          <h1 className="mt-8 text-2xl font-bold text-slate-900">{register ? "Crea tu cuenta" : "Bienvenido"}</h1>
          <p className="mt-2 text-sm text-slate-600">Una cuenta por persona; datos protegidos por hogar.</p>
          <label className="mt-6 block text-sm font-medium text-slate-700">
            Correo
            <input className={fieldClassName} type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Contraseña
            <input className={fieldClassName} type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {message && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p>}
          <PrimaryButton className="mt-6 w-full" type="submit">{register ? "Crear cuenta" : "Entrar"}</PrimaryButton>
          <TextButton className="mt-3 w-full" type="button" onClick={() => setRegister((value) => !value)}>
            {register ? "Ya tengo una cuenta" : "Crear una cuenta"}
          </TextButton>
        </Panel>
      </form>
    </AuthLayout>
  );
}

export function HouseholdSetup({ onReady }: { onReady: (household: Household) => void }) {
  const [name, setName] = useState("Nuestro hogar");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const create = async (event: FormEvent) => {
    event.preventDefault();
    const { data, error } = await supabase!.rpc("create_household", { household_name: name, method: "equal" });
    if (error) return setMessage(error.message);
    onReady(data as Household);
  };
  const join = async (event: FormEvent) => {
    event.preventDefault();
    const { error } = await supabase!.rpc("join_household", { code });
    if (error) return setMessage(error.message);
    const household = await loadMyHousehold();
    if (household) onReady(household);
  };
  return (
    <AuthLayout>
      <Panel className="w-full max-w-md">
        <Logo />
        <h1 className="mt-8 text-2xl font-bold text-slate-900">Configura el hogar</h1>
        <p className="mt-2 text-sm text-slate-600">Una persona crea el hogar; la otra usa su código de invitación.</p>
        <form className="mt-6" onSubmit={create}>
          <label className="block text-sm font-medium text-slate-700">
            Nombre
            <input className={fieldClassName} value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <PrimaryButton className="mt-4 w-full">Crear hogar</PrimaryButton>
        </form>
        <div className="my-6 border-t border-slate-200" />
        <form onSubmit={join}>
          <label className="block text-sm font-medium text-slate-700">
            Código de invitación
            <input className={fieldClassName} value={code} onChange={(event) => setCode(event.target.value)} required />
          </label>
          <PrimaryButton className="mt-4 w-full">Unirme al hogar</PrimaryButton>
        </form>
        {message && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p>}
      </Panel>
    </AuthLayout>
  );
}


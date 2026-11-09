import type { Household } from "../types";
import { Panel } from "./ui";

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <Panel>
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-2 leading-6 text-slate-600">{text}</p>
    </Panel>
  );
}

export function Settings({ household }: { household: Household }) {
  return (
    <Panel className="max-w-2xl">
      <h2 className="text-lg font-bold text-slate-900">Hogar y privacidad</h2>
      <dl className="mt-5 divide-y divide-slate-100">
        <div className="py-4"><dt className="text-sm text-slate-500">Reparto configurado</dt><dd className="mt-1 font-semibold text-slate-800">{household.split_method === "equal" ? "50/50" : "Proporcional a ingresos"}</dd></div>
        <div className="py-4"><dt className="text-sm text-slate-500">Código de invitación</dt><dd className="mt-1 font-mono text-lg font-semibold tracking-wider text-brand-700">{household.invite_code}</dd><p className="mt-1 text-sm text-slate-500">Compártelo solo con la persona a la que quieres invitar.</p></div>
      </dl>
      <p className="mt-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-700">Cada usuario solo puede leer o modificar datos de los hogares de los que es miembro.</p>
    </Panel>
  );
}

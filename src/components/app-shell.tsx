import type { PropsWithChildren } from "react";
import type { Page } from "../types";
import { Logo, PrimaryButton, TextButton } from "./ui";

const navigation: Array<[Page, string]> = [
  ["inicio", "Inicio"],
  ["movimientos", "Movimientos"],
  ["presupuestos", "Presupuestos"],
  ["objetivos", "Objetivos"],
  ["deudas", "Deudas"],
  ["ajustes", "Ajustes"],
];

type AppShellProps = PropsWithChildren<{
  householdName: string;
  page: Page;
  online: boolean;
  onPageChange: (page: Page) => void;
  onExport: () => void;
  onSignOut: () => void;
}>;

export function AppShell({
  householdName,
  page,
  online,
  onPageChange,
  onExport,
  onSignOut,
  children,
}: AppShellProps) {
  const title = navigation.find(([id]) => id === page)?.[1] ?? "Inicio";
  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="flex w-full flex-row gap-1 overflow-x-auto bg-brand-700 px-3 py-3 text-emerald-50 lg:min-h-screen lg:w-64 lg:flex-col lg:px-4 lg:py-7">
        <div className="hidden lg:block">
          <Logo dark />
          <p className="mt-1 text-sm text-emerald-100/75">{householdName}</p>
        </div>
        <nav className="flex flex-row gap-1 lg:mt-7 lg:flex-col" aria-label="Navegación principal">
          {navigation.map(([id, label]) => (
            <button
              className={`shrink-0 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                page === id ? "bg-white/15 text-white" : "text-emerald-50/80 hover:bg-white/10 hover:text-white"
              }`}
              onClick={() => onPageChange(id)}
              key={id}
            >
              {label}
            </button>
          ))}
          <button
            className="shrink-0 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-emerald-50/80 transition hover:bg-white/10 hover:text-white"
            onClick={onExport}
          >
            Exportar CSV
          </button>
        </nav>
        <TextButton
          className="ml-auto shrink-0 text-emerald-100 hover:bg-white/10 hover:text-white lg:mt-auto lg:ml-0 lg:w-full lg:text-left"
          onClick={onSignOut}
        >
          Cerrar sesión
        </TextButton>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
        <header className="mb-7 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">
              {online ? "Sincronizado" : "Sin conexión · cambios guardados localmente"}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
          </div>
          <PrimaryButton className="shrink-0" onClick={() => onPageChange("movimientos")}>
            + Movimiento
          </PrimaryButton>
        </header>
        {children}
      </main>
    </div>
  );
}

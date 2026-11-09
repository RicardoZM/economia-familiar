import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

const primaryBase =
  "inline-flex items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export function PrimaryButton({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`${primaryBase} ${className}`} {...props} />;
}

export function TextButton({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded-lg px-2 py-1 text-sm font-medium text-brand-600 transition hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 ${className}`}
      {...props}
    />
  );
}

export function Panel({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`text-2xl font-extrabold tracking-tight ${dark ? "text-white" : "text-slate-900"}`}>
      saldo<span className="text-emerald-300">.</span>
    </div>
  );
}

export const fieldClassName =
  "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-3 focus:ring-brand-100";

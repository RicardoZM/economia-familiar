import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  addGoalContribution,
  archiveGoal,
  createGoal,
  fetchGoalContributions,
  fetchGoals,
} from "../lib/data";
import { euros } from "../lib/finance";
import type { Goal, GoalContribution, Household } from "../types";
import { fieldClassName, Panel, PrimaryButton, TextButton } from "./ui";

function centsFromInput(value: string) {
  return Math.round(Number(value.replace(",", ".")) * 100);
}

function formattedDate(value: string | null) {
  if (!value) return "Sin fecha objetivo";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function GoalCard({
  goal,
  contributions,
  household,
  userId,
  onContribution,
  onArchived,
}: {
  goal: Goal;
  contributions: GoalContribution[];
  household: Household;
  userId: string;
  onContribution: (contribution: GoalContribution) => void;
  onArchived: (id: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState("");
  const progress = Math.min((goal.saved_cents / goal.target_cents) * 100, 100);
  const remaining = Math.max(goal.target_cents - goal.saved_cents, 0);
  const submitContribution = async (event: FormEvent) => {
    event.preventDefault();
    const amountCents = centsFromInput(amount);
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0)
      return setMessage("Indica una aportación válida.");
    try {
      const contribution = await addGoalContribution({
        goal_id: goal.id,
        household_id: household.id,
        user_id: userId,
        amount_cents: amountCents,
        occurred_on: date,
        note: note.trim() || null,
      });
      onContribution(contribution);
      setAmount("");
      setNote("");
      setMessage("Aportación registrada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar la aportación.");
    }
  };
  const archive = async () => {
    if (!window.confirm(`¿Archivar el objetivo “${goal.name}”?`)) return;
    try {
      await archiveGoal(goal.id);
      onArchived(goal.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo archivar el objetivo.");
    }
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold text-slate-900">{goal.name}</h3>
          <p className="mt-1 text-sm text-slate-500">{formattedDate(goal.target_date)}</p>
        </div>
        <TextButton className="shrink-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700" type="button" onClick={archive}>
          Archivar
        </TextButton>
      </div>
      <div className="mt-5 flex items-end justify-between gap-3">
        <div><strong className="text-2xl tracking-tight text-brand-700">{euros(goal.saved_cents)}</strong><span className="text-slate-500"> / {euros(goal.target_cents)}</span></div>
        <span className={`text-sm font-semibold ${remaining ? "text-slate-600" : "text-emerald-700"}`}>{remaining ? `${euros(remaining)} para llegar` : "Objetivo alcanzado"}</span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all ${remaining ? "bg-brand-600" : "bg-emerald-500"}`} style={{ width: `${progress}%` }} /></div>
      <p className="mt-2 text-sm text-slate-500">{Math.round(progress)}% completado</p>

      <form className="mt-5 border-t border-slate-100 pt-5" onSubmit={submitContribution}>
        <p className="text-sm font-semibold text-slate-700">Registrar aportación</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Importe (€)<input className={fieldClassName} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
          <label className="text-sm font-medium text-slate-700">Fecha<input className={fieldClassName} type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
        </div>
        <label className="mt-3 block text-sm font-medium text-slate-700">Nota <span className="font-normal text-slate-400">(opcional)</span><input className={fieldClassName} value={note} onChange={(event) => setNote(event.target.value)} maxLength={160} /></label>
        <PrimaryButton className="mt-4" type="submit">Añadir aportación</PrimaryButton>
      </form>
      {message && <p className="mt-3 text-sm text-slate-500">{message}</p>}

      {contributions.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h4 className="text-sm font-semibold text-slate-700">Últimas aportaciones</h4>
          <div className="mt-2 divide-y divide-slate-100">
            {contributions.slice(0, 3).map((contribution) => (
              <div className="flex justify-between gap-3 py-2 text-sm" key={contribution.id}>
                <span className="min-w-0 truncate text-slate-500">{contribution.occurred_on}{contribution.note && ` · ${contribution.note}`}</span>
                <strong className="shrink-0 text-emerald-700">+{euros(contribution.amount_cents)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export function Goals({ household, userId }: { household: Household; userId: string }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [contributions, setContributions] = useState<GoalContribution[]>([]);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [message, setMessage] = useState("");
  const totalSaved = goals.reduce((total, goal) => total + goal.saved_cents, 0);
  const totalTarget = goals.reduce((total, goal) => total + goal.target_cents, 0);

  const load = async () => {
    try {
      const [nextGoals, nextContributions] = await Promise.all([
        fetchGoals(household.id),
        fetchGoalContributions(household.id),
      ]);
      setGoals(nextGoals);
      setContributions(nextContributions);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar los objetivos.");
    }
  };
  useEffect(() => { void load(); }, [household.id]);
  const contributionsByGoal = useMemo(() => {
    const result = new Map<string, GoalContribution[]>();
    for (const contribution of contributions) {
      const entries = result.get(contribution.goal_id) ?? [];
      entries.push(contribution);
      result.set(contribution.goal_id, entries);
    }
    return result;
  }, [contributions]);
  const create = async (event: FormEvent) => {
    event.preventDefault();
    const targetCents = centsFromInput(target);
    if (!name.trim()) return setMessage("Indica el nombre del objetivo.");
    if (!Number.isSafeInteger(targetCents) || targetCents <= 0)
      return setMessage("Indica un objetivo válido.");
    try {
      const goal = await createGoal({ household_id: household.id, name: name.trim(), target_cents: targetCents, target_date: targetDate || null });
      setGoals((current) => [goal, ...current]);
      setName("");
      setTarget("");
      setTargetDate("");
      setMessage("Objetivo creado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear el objetivo.");
    }
  };

  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><h2 className="text-lg font-bold text-slate-900">Objetivos de ahorro</h2><p className="mt-1 text-sm text-slate-500">Cada aportación queda registrada y actualiza el progreso automáticamente.</p></div>
          <div className="text-left sm:text-right"><p className="text-sm text-slate-500">Ahorro en objetivos</p><strong className="text-xl text-brand-700">{euros(totalSaved)} <span className="font-normal text-slate-400">de {euros(totalTarget)}</span></strong></div>
        </div>
        <form className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem_12rem_auto]" onSubmit={create}>
          <label className="text-sm font-medium text-slate-700">Objetivo<input className={fieldClassName} placeholder="Ej. Vacaciones" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required /></label>
          <label className="text-sm font-medium text-slate-700">Meta (€)<input className={fieldClassName} inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} required /></label>
          <label className="text-sm font-medium text-slate-700">Fecha objetivo<input className={fieldClassName} type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></label>
          <PrimaryButton className="self-end">Crear objetivo</PrimaryButton>
        </form>
        {message && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p>}
      </Panel>
      {goals.length === 0 ? (
        <Panel><h2 className="text-lg font-bold text-slate-900">Empieza con una meta</h2><p className="mt-2 text-slate-600">Crea un objetivo, como un viaje o un fondo de emergencia, y registra las aportaciones a medida que ahorres.</p></Panel>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              contributions={contributionsByGoal.get(goal.id) ?? []}
              household={household}
              userId={userId}
              onContribution={(contribution) => {
                setContributions((current) => [contribution, ...current]);
                void load();
              }}
              onArchived={(id) => setGoals((current) => current.filter((goal) => goal.id !== id))}
            />
          ))}
        </section>
      )}
    </div>
  );
}

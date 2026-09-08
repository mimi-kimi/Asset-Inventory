import type { ReactNode } from "react";
import { cn, initials } from "@/lib/format";

/* ---------- form class strings ---------- */
export const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500";
export const textareaCls = `${inputCls} min-h-24 resize-y`;
export const selectCls = inputCls;
export const labelCls = "mb-1 block text-sm font-medium text-zinc-700";
export const hintCls = "mt-1 text-xs text-zinc-500";

/* ---------- buttons ---------- */
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 disabled:cursor-not-allowed disabled:opacity-60";

export const btnPrimary = cn(
  btnBase,
  "bg-amber-500 px-4 py-2 text-sm text-zinc-950 hover:bg-amber-400",
);
export const btnSecondary = cn(
  btnBase,
  "border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm hover:bg-zinc-50",
);
export const btnDanger = cn(
  btnBase,
  "bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-500",
);
export const btnGhost = cn(
  btnBase,
  "px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100",
);

export const btnIcon = cn(
  btnBase,
  "h-9 w-9 shrink-0 rounded-lg border border-zinc-300 bg-white text-zinc-600 shadow-sm hover:bg-zinc-50",
);

/* ---------- layout primitives ---------- */
export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-200 bg-white shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  accent = "text-zinc-900",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  accent?: string;
}) {
  return (
    <Card className="flex items-center gap-4 px-5 py-4">
      {icon && (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {label}
        </p>
        <p className={cn("mt-0.5 text-2xl font-bold leading-none", accent)}>
          {value}
        </p>
        {sub && <p className="mt-1 truncate text-xs text-zinc-500">{sub}</p>}
      </div>
    </Card>
  );
}

export function Avatar({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-zinc-950",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function EmptyState({
  title,
  hint,
  action,
  icon,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white/60 px-6 py-14 text-center">
      {icon && <div className="text-zinc-400">{icon}</div>}
      <p className="font-semibold text-zinc-700">{title}</p>
      {hint && <p className="max-w-sm text-sm text-zinc-500">{hint}</p>}
      {action}
    </div>
  );
}

export function FieldLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className={labelCls}>
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
}

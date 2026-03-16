import type { PropsWithChildren, ReactNode } from "react";

function cx(...items: Array<string | false | null | undefined>): string {
  return items.filter(Boolean).join(" ");
}

type CardProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  className?: string;
  headerRight?: ReactNode;
}>;

export function Card({ title, subtitle, className, headerRight, children }: CardProps) {
  return (
    <section className={cx("glass-panel rounded-2xl p-5 md:p-6", className)}>
      {title ? (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
          </div>
          {headerRight}
        </header>
      ) : null}
      {children}
    </section>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-brand-700 text-white shadow-soft hover:bg-brand-800",
        variant === "secondary" && "bg-slate-900 text-white hover:bg-slate-800",
        variant === "ghost" && "border border-slate-300 bg-white/70 text-slate-800 hover:bg-white",
        variant === "danger" && "bg-rose-600 text-white hover:bg-rose-700",
        className,
      )}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "h-11 w-full rounded-xl border border-slate-300/80 bg-white/85 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-200",
        className,
      )}
    />
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx(
        "h-11 w-full rounded-xl border border-slate-300/80 bg-white/85 px-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200",
        className,
      )}
    />
  );
}

export function FieldLabel({ children }: PropsWithChildren) {
  return <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">{children}</label>;
}

export function Pill({ children, tone = "brand" }: PropsWithChildren<{ tone?: "brand" | "warm" | "slate" }>) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        tone === "brand" && "bg-brand-100 text-brand-800",
        tone === "warm" && "bg-orange-100 text-orange-700",
        tone === "slate" && "bg-slate-100 text-slate-700",
      )}
    >
      {children}
    </span>
  );
}

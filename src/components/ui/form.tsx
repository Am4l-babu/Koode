import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

const control =
  "w-full rounded-xl border border-line-strong bg-surface px-3.5 text-[0.95rem] text-fg placeholder:text-subtle transition-colors focus:border-primary focus:outline-none focus-visible:shadow-[var(--ring)] aria-[invalid=true]:border-critical";

export function Field({
  label,
  htmlFor,
  error,
  help,
  required,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor: string;
  error?: string;
  help?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-fg">
        {label}
        {required && <span className="ml-0.5 text-critical" aria-hidden="true">*</span>}
      </label>
      {children}
      {help && !error && <p id={`${htmlFor}-help`} className="text-xs text-muted">{help}</p>}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-critical">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, invalid, ...props }: ComponentProps<"input"> & { invalid?: boolean }) {
  return <input className={cn(control, "h-11", className)} aria-invalid={invalid || undefined} {...props} />;
}

export function Textarea({ className, invalid, ...props }: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return <textarea className={cn(control, "min-h-28 py-2.5 leading-relaxed", className)} aria-invalid={invalid || undefined} {...props} />;
}

export function Select({ className, invalid, children, ...props }: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <select className={cn(control, "h-11 appearance-none bg-[length:1rem] bg-[right_0.85rem_center] bg-no-repeat pr-9", className)} aria-invalid={invalid || undefined} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7a82' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 text-sm text-fg", className)}>
      <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 rounded-md border-line-strong accent-[var(--primary)]" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function RadioCard({
  name,
  value,
  checked,
  onChange,
  title,
  description,
  icon,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex min-h-14 cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors",
        checked ? "border-primary bg-primary-soft" : "border-line bg-surface hover:border-line-strong",
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} className="mt-1 h-4 w-4 accent-[var(--primary)]" />
      {icon && <span className="mt-0.5 text-primary-ink">{icon}</span>}
      <span>
        <span className="block font-semibold text-fg">{title}</span>
        {description && <span className="mt-0.5 block text-sm text-muted">{description}</span>}
      </span>
    </label>
  );
}

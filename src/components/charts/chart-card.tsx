import type { ReactNode } from "react";

/** Chart container with a title, optional summary, and an accessible table view. */
export function ChartCard({
  title,
  description,
  children,
  table,
  className = "",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  table?: { columns: string[]; rows: (string | number)[][] };
  className?: string;
}) {
  return (
    <section className={`card flex flex-col p-5 sm:p-6 ${className}`} aria-label={title}>
      <h2 className="text-base font-semibold text-fg">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <div className="mt-4 flex-1">{children}</div>
      {table && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-medium text-primary-ink">View as table</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-muted">
                  {table.columns.map((c) => <th key={c} className="py-1.5 pr-4 font-semibold">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-b border-line/60">
                    {r.map((cell, j) => <td key={j} className="py-1.5 pr-4 tabular-nums">{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

import type { ReactNode } from "react";

export function SectionShell({
  id,
  eyebrow,
  title,
  description,
  children,
  className = ""
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`px-5 py-16 md:px-8 md:py-20 ${className}`}>
      <div className="mx-auto max-w-6xl">
        {title ? (
          <div className="mb-10 max-w-3xl">
            {eyebrow ? (
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">
                {eyebrow}
              </p>
            ) : null}
            <h2 className="mt-2 text-3xl font-bold text-slate-950 md:text-4xl">
              {title}
            </h2>
            {description ? (
              <p className="mt-4 text-lg leading-8 text-slate-700">
                {description}
              </p>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    </section>
  );
}

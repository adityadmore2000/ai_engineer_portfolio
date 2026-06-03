"use client";

import { useEffect, useId, useState } from "react";

export function MermaidDiagram({
  chart,
  caption,
  statusLabel
}: {
  chart?: string;
  caption?: string;
  statusLabel?: string;
}) {
  const reactId = useId();
  const renderId = `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [svg, setSvg] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      if (!chart?.trim()) {
        setError(true);
        return;
      }

      try {
        const mermaid = (await import("mermaid")).default;

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          themeVariables: {
            background: "#ffffff",
            primaryColor: "#f8fafc",
            primaryTextColor: "#111827",
            primaryBorderColor: "#94a3b8",
            lineColor: "#64748b",
            secondaryColor: "#ecfeff",
            tertiaryColor: "#f1f5f9"
          }
        });

        const result = await mermaid.render(renderId, chart);

        if (!cancelled) {
          setSvg(result.svg);
          setError(false);
        }
      } catch {
        if (!cancelled) {
          setSvg("");
          setError(true);
        }
      }
    }

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [chart, renderId]);

  return (
    <figure className="my-8 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {statusLabel ? (
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-teal-800">
          {statusLabel}
        </div>
      ) : null}
      <div className="overflow-x-auto p-4">
        {error ? (
          <pre className="min-w-full whitespace-pre overflow-x-auto rounded-md bg-slate-950 p-4 text-sm leading-6 text-slate-100">
            <code>{chart}</code>
          </pre>
        ) : svg ? (
          <div
            className="min-w-fit [&_svg]:h-auto [&_svg]:max-w-none md:[&_svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="min-h-32 animate-pulse rounded-md bg-slate-100" />
        )}
      </div>
      {caption ? (
        <figcaption className="border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

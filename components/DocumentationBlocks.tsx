import Image from "next/image";
import type { PortableTextComponents } from "@portabletext/react";
import { ExternalLink } from "lucide-react";
import { urlFor } from "@/sanity/image";
import { MermaidDiagram } from "./MermaidDiagram";
import { generateHeadingId } from "@/lib/content/headings";
import { portableTextBlockToText } from "@/lib/content/portable-text";

type CodeBlockValue = {
  code?: string;
  language?: string;
  filename?: string;
  caption?: string;
};

type CalloutValue = {
  title?: string;
  body?: string;
  variant?: "info" | "warning" | "success" | "limitation" | "lesson" | "future";
};

type DocumentationTableValue = {
  caption?: string;
  headers?: string[];
  rows?: {
    cells?: string[];
  }[];
};

type DocumentationTimelineValue = {
  title?: string;
  steps?: {
    title?: string;
    description?: string;
    statusLabel?: string;
  }[];
};

type BadgeGroupValue = {
  title?: string;
  items?: string[];
};

type CTAGroupValue = {
  title?: string;
  items?: {
    label?: string;
    url?: string;
    style?: "primary" | "secondary" | "link";
  }[];
};

type DocumentationImageValue = {
  image?: Parameters<typeof urlFor>[0];
  alt?: string;
  caption?: string;
};

type FaqItemValue = {
  question?: string;
  answer?: string;
};

type ChallengeCardValue = {
  problem?: string;
  solution?: string;
  outcome?: string;
};

// Heading styles rendered with the shared `generateHeadingId()` anchor so the
// renderer's ids agree with the chunker's anchors and the migration's headings
// (single slug scheme — Risk R2). Heading text is  flattened to plain text.
const headingClasses: Record<string, string> = {
  h2: "mt-12 text-2xl font-bold text-slate-950",
  h3: "mt-8 text-xl font-bold text-slate-900",
  h4: "mt-6 text-lg font-semibold text-slate-900",
};

export const documentationPortableTextComponents: PortableTextComponents = {
  block: {
    h2: ({ children, value }) => (
      <h2 id={headingId(value)} className={headingClasses.h2}>
        {children}
      </h2>
    ),
    h3: ({ children, value }) => (
      <h3 id={headingId(value)} className={headingClasses.h3}>
        {children}
      </h3>
    ),
    h4: ({ children, value }) => (
      <h4 id={headingId(value)} className={headingClasses.h4}>
        {children}
      </h4>
    ),
  },
  types: {
    documentationCodeBlock: ({ value }) => (
      <CodeBlock {...(value as CodeBlockValue)} />
    ),
    documentationMermaidDiagram: ({ value }) => {
      const diagram = value as {
        chart?: string;
        caption?: string;
        statusLabel?: string;
      };

      return (
        <MermaidDiagram
          chart={diagram.chart}
          caption={diagram.caption}
          statusLabel={diagram.statusLabel}
        />
      );
    },
    documentationCallout: ({ value }) => (
      <Callout {...(value as CalloutValue)} />
    ),
    documentationTable: ({ value }) => (
      <DocumentationTable {...(value as DocumentationTableValue)} />
    ),
    documentationTimeline: ({ value }) => (
      <DocumentationTimeline {...(value as DocumentationTimelineValue)} />
    ),
    documentationBadgeGroup: ({ value }) => (
      <BadgeGroup {...(value as BadgeGroupValue)} />
    ),
    documentationCTAGroup: ({ value }) => (
      <DocumentationCTAGroup {...(value as CTAGroupValue)} />
    ),
    documentationImage: ({ value }) => (
      <DocumentationImage {...(value as DocumentationImageValue)} />
    ),
    faqItem: ({ value }) => <FaqItem {...(value as FaqItemValue)} />,
    challengeCard: ({ value }) => (
      <ChallengeCard {...(value as ChallengeCardValue)} />
    ),
  },
  marks: {
    code: ({ children }) => (
      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-950">
        {children}
      </code>
    ),
    link: ({ children, value }) => {
      const href = getSafeHref((value as { href?: string })?.href);

      if (!href) {
        return <>{children}</>;
      }

      const external = isExternalHref(href);

      return (
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noreferrer" : undefined}
        >
          {children}
        </a>
      );
    }
  }
};

function headingId(value: unknown): string {
  const text = portableTextBlockToText(value as never);
  return generateHeadingId(text);
}

function CodeBlock({ code, language, filename, caption }: CodeBlockValue) {
  if (!code) {
    return null;
  }

  return (
    <figure className="my-8 overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      {filename || language ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-4 py-2 text-xs text-slate-300">
          {filename ? <span className="font-medium">{filename}</span> : <span />}
          {language ? (
            <span className="rounded bg-slate-800 px-2 py-1 font-mono uppercase tracking-wide">
              {language}
            </span>
          ) : null}
        </div>
      ) : null}
      <pre className="overflow-x-auto p-4 text-sm leading-6 text-slate-100">
        <code className="font-mono">{code}</code>
      </pre>
      {caption ? (
        <figcaption className="border-t border-slate-800 px-4 py-3 text-sm text-slate-300">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function Callout({ title, body, variant = "info" }: CalloutValue) {
  if (!body) {
    return null;
  }

  const classes = getCalloutClasses(variant);

  return (
    <aside className={`my-8 rounded-lg border p-4 ${classes}`}>
      {title ? (
        <p className="mb-2 text-sm font-bold uppercase tracking-wide">{title}</p>
      ) : null}
      <p className="whitespace-pre-wrap leading-7">{body}</p>
    </aside>
  );
}

export function DocumentationTable({
  caption,
  headers = [],
  rows = []
}: DocumentationTableValue) {
  const columnCount = Math.max(
    headers.length,
    ...rows.map((row) => row.cells?.length || 0),
    0
  );

  if (!columnCount) {
    return null;
  }

  return (
    <figure className="my-8">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full border-collapse text-left text-sm">
          {caption ? (
            <caption className="caption-bottom px-4 py-3 text-left text-sm text-slate-600">
              {caption}
            </caption>
          ) : null}
          {headers.length ? (
            <thead className="bg-slate-50 text-slate-950">
              <tr>
                {Array.from({ length: columnCount }).map((_, index) => (
                  <th
                    key={`header-${index}`}
                    scope="col"
                    className="border-b border-slate-200 px-4 py-3 font-semibold"
                  >
                    {headers[index] || `Column ${index + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`} className="odd:bg-white even:bg-slate-50">
                {Array.from({ length: columnCount }).map((_, cellIndex) => (
                  <td
                    key={`cell-${rowIndex}-${cellIndex}`}
                    className="border-t border-slate-200 px-4 py-3 align-top text-slate-700"
                  >
                    {row.cells?.[cellIndex] || ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

export function DocumentationTimeline({
  title,
  steps = []
}: DocumentationTimelineValue) {
  if (!steps.length) {
    return null;
  }

  return (
    <section className="my-8">
      {title ? (
        <h2 className="mb-4 text-xl font-bold text-slate-950">{title}</h2>
      ) : null}
      <ol className="space-y-4">
        {steps.map((step, index) => (
          <li
            key={`${step.title || "step"}-${index}`}
            className="grid grid-cols-[2rem_1fr] gap-3"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-teal-200 bg-teal-50 text-sm font-bold text-teal-900">
              {index + 1}
            </span>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-base font-bold text-slate-950">
                  {step.title || `Step ${index + 1}`}
                </h3>
                {step.statusLabel ? (
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {step.statusLabel}
                  </span>
                ) : null}
              </div>
              {step.description ? (
                <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-700">
                  {step.description}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function BadgeGroup({ title, items = [] }: BadgeGroupValue) {
  const visibleItems = items.filter(Boolean);

  if (!visibleItems.length) {
    return null;
  }

  return (
    <section className="my-8">
      {title ? (
        <h2 className="mb-3 text-lg font-bold text-slate-950">{title}</h2>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {visibleItems.map((item) => (
          <span
            key={item}
            className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm text-slate-700"
          >
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

export function DocumentationCTAGroup({ title, items = [] }: CTAGroupValue) {
  const links = items
    .map((item) => ({ ...item, href: getSafeHref(item.url) }))
    .filter((item): item is typeof item & { href: string } => Boolean(item.href));

  if (!links.length) {
    return null;
  }

  return (
    <section className="my-8 rounded-lg border border-slate-200 bg-white p-4">
      {title ? (
        <h2 className="mb-4 text-lg font-bold text-slate-950">{title}</h2>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {links.map((item) => {
          const external = isExternalHref(item.href);

          return (
            <a
              key={`${item.label}-${item.href}`}
              href={item.href}
              target={external ? "_blank" : undefined}
              rel={external ? "noreferrer" : undefined}
              className={getCTAClasses(item.style)}
            >
              {item.label}
              {external ? <ExternalLink aria-hidden="true" size={16} /> : null}
            </a>
          );
        })}
      </div>
    </section>
  );
}

export function DocumentationImage({
  image,
  alt,
  caption
}: DocumentationImageValue) {
  if (!alt) {
    return null;
  }

  // Some images may carry an empty source object (e.g. the upload asset was
  // never resolved), which has no `asset._ref` to build a URL from. Guard here
  // so an unresolvable image degrades to nothing instead of crashing the page.
  const ref = (image as { asset?: { _ref?: string } } | undefined)?.asset?._ref;
  if (!image || !ref) {
    return null;
  }

  const src = urlFor(image).width(1400).height(788).fit("max").url();

  return (
    <figure className="my-8 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="relative aspect-[16/9] bg-slate-100">
        <Image src={src} alt={alt} fill className="object-contain" />
      </div>
      {caption ? (
        <figcaption className="border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function FaqItem({ question, answer }: FaqItemValue) {
  if (!question && !answer) {
    return null;
  }

  return (
    <div className="my-4 rounded-lg border border-slate-200 bg-white p-5">
      {question ? <h4 className="font-bold text-slate-950">{question}</h4> : null}
      {answer ? (
        <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-700">{answer}</p>
      ) : null}
    </div>
  );
}

export function ChallengeCard({ problem, solution, outcome }: ChallengeCardValue) {
  if (!problem && !solution && !outcome) {
    return null;
  }

  return (
    <div className="my-4 rounded-lg border border-slate-200 bg-white p-5">
      {problem ? (
        <div className="mb-4">
          <h4 className="text-sm font-bold uppercase tracking-wide text-red-600">
            Problem
          </h4>
          <p className="mt-1 whitespace-pre-wrap leading-7 text-slate-700">{problem}</p>
        </div>
      ) : null}
      {solution ? (
        <div className="mb-4">
          <h4 className="text-sm font-bold uppercase tracking-wide text-teal-700">
            Solution
          </h4>
          <p className="mt-1 whitespace-pre-wrap leading-7 text-slate-700">{solution}</p>
        </div>
      ) : null}
      {outcome ? (
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Outcome
          </h4>
          <p className="mt-1 whitespace-pre-wrap leading-7 text-slate-700">{outcome}</p>
        </div>
      ) : null}
    </div>
  );
}

function getCalloutClasses(variant: NonNullable<CalloutValue["variant"]>) {
  switch (variant) {
    case "warning":
      return "border-amber-300 bg-amber-50 text-amber-950";
    case "success":
      return "border-emerald-300 bg-emerald-50 text-emerald-950";
    case "limitation":
      return "border-slate-300 bg-slate-50 text-slate-800";
    case "lesson":
      return "border-sky-300 bg-sky-50 text-sky-950";
    case "future":
      return "border-violet-300 bg-violet-50 text-violet-950";
    case "info":
    default:
      return "border-teal-300 bg-teal-50 text-teal-950";
  }
}

function getCTAClasses(style?: "primary" | "secondary" | "link") {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-teal-700 focus:ring-offset-2";

  switch (style) {
    case "primary":
      return `${base} bg-teal-800 text-white hover:bg-teal-900`;
    case "link":
      return `${base} px-0 text-teal-900 underline hover:text-teal-700`;
    case "secondary":
    default:
      return `${base} border border-slate-300 text-slate-900 hover:bg-slate-50`;
  }
}

function getSafeHref(url?: string) {
  if (!url) {
    return null;
  }

  const trimmed = url.trim();

  if (trimmed.startsWith("/")) {
    return trimmed.startsWith("//") ? null : trimmed;
  }

  try {
    const parsed = new URL(trimmed);

    if (["http:", "https:", "mailto:"].includes(parsed.protocol)) {
      return trimmed;
    }
  } catch {
    return null;
  }

  return null;
}

function isExternalHref(href: string) {
  return /^https?:\/\//.test(href);
}

import Link from "next/link";
import type { TechnicalNoteSummary } from "@/sanity/types";
import { SectionShell } from "./SectionShell";

export function TechnicalNotes({ notes }: { notes: TechnicalNoteSummary[] }) {
  if (!notes.length) {
    return null;
  }

  return (
    <SectionShell
      id="notes"
      eyebrow="Notes"
      title="Technical notes"
      description="Optional writing on applied AI patterns, evaluations, and implementation details."
      className="bg-white"
    >
      <div className="grid gap-5 md:grid-cols-2">
        {notes.map((note) => (
          <article
            key={note._id}
            className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
          >
            {note.publishedDate ? (
              <p className="text-sm font-medium text-slate-500">
                {new Intl.DateTimeFormat("en", {
                  dateStyle: "medium"
                }).format(new Date(note.publishedDate))}
              </p>
            ) : null}
            <h3 className="mt-2 text-xl font-bold text-slate-950">{note.title}</h3>
            {note.shortSummary ? (
              <p className="mt-3 leading-7 text-slate-700">{note.shortSummary}</p>
            ) : null}
            {note.tags?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {note.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            {note.slug ? (
              <Link
                href={`/notes/${note.slug}`}
                className="mt-5 inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Read Note
              </Link>
            ) : null}
          </article>
        ))}
      </div>
    </SectionShell>
  );
}

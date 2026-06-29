import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Markdown } from "@/components/Markdown";
import { PortableContent } from "@/components/PortableContent";
import { SectionShell } from "@/components/SectionShell";
import { getAllTechnicalNotes, getSiteSettings, getTechnicalNoteBySlug } from "@/sanity/queries";

export const revalidate = 60;

type NotePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const notes = await getAllTechnicalNotes();

  return notes.filter((note) => note.slug).map((note) => ({ slug: note.slug }));
}

export async function generateMetadata({
  params
}: NotePageProps): Promise<Metadata> {
  const { slug } = await params;
  const note = await getTechnicalNoteBySlug(slug);

  if (!note) {
    return {
      title: "Technical Note"
    };
  }

  return {
    title: note.title,
    description: note.shortSummary,
    openGraph: {
      title: note.title,
      description: note.shortSummary,
      images: note.coverImage?.url ? [note.coverImage.url] : undefined
    }
  };
}

export default async function NotePage({ params }: NotePageProps) {
  const { slug } = await params;
  const [settings, note] = await Promise.all([
    getSiteSettings(),
    getTechnicalNoteBySlug(slug)
  ]);

  if (!note) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Header settings={settings} />
      <main>
        <SectionShell className="pt-12">
          <Link
            href="/#notes"
            className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800 hover:text-teal-950"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            Back to notes
          </Link>

          <article className="mx-auto mt-8 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">
              Technical Note
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-tight text-slate-950 md:text-5xl">
              {note.title}
            </h1>
            {note.shortSummary ? (
              <Markdown className="mt-5 text-lg text-slate-700">
                {note.shortSummary}
              </Markdown>
            ) : null}
            {note.publishedDate ? (
              <p className="mt-4 text-sm text-slate-500">
                {new Intl.DateTimeFormat("en", {
                  dateStyle: "medium"
                }).format(new Date(note.publishedDate))}
              </p>
            ) : null}
            {note.tags?.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {note.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            {note.coverImage?.url ? (
              <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                <Image
                  src={note.coverImage.url}
                  alt={note.coverImage.alt || `${note.title} cover image`}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            ) : null}
            {note.content ? <PortableContent value={note.content} /> : null}
          </article>
        </SectionShell>
      </main>
      <Footer settings={settings} />
    </div>
  );
}

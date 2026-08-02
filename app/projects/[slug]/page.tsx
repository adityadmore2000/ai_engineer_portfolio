import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, ExternalLink, Github } from "lucide-react";
import { PortableText } from "@portabletext/react";
import type { PortableTextBlock } from "next-sanity";
import { documentationPortableTextComponents } from "@/components/DocumentationBlocks";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { LightboxImage } from "@/components/LightboxImage";
import { Markdown } from "@/components/Markdown";
import { SectionShell } from "@/components/SectionShell";
import {
  createProjectDocsSource,
  getFirstDocumentationPage
} from "@/lib/project-docs-source";
import { isSanityConfigured } from "@/sanity/env";
import {
  fallbackProjects,
  fallbackSiteSettings,
  getFallbackProjectBySlug
} from "@/sanity/fallbackContent";
import {
  getAllProjects,
  getProjectBySlug,
  getProjectDocumentationPagesByProjectSlug,
  getSiteSettings
} from "@/sanity/queries";

export const revalidate = 60;

type ProjectPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const projects = await getAllProjects();

  const sanityParams = projects
    .filter((project) => project.slug)
    .map((project) => ({ slug: project.slug }));
  const fallbackParams = isSanityConfigured
    ? []
    : fallbackProjects.map((project) => ({
        slug: project.slug || ""
      }));

  return [...sanityParams, ...fallbackParams].filter((param) => param.slug);
}

export async function generateMetadata({
  params
}: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const sanityProject = await getProjectBySlug(slug);
  const project = sanityProject || (!isSanityConfigured ? getFallbackProjectBySlug(slug) : null);

  if (!project) {
    return {
      title: "Project"
    };
  }

  return {
    title: project.title,
    description: project.shortSummary,
    openGraph: {
      title: project.title,
      description: project.shortSummary,
      images: project.coverImage?.url ? [project.coverImage.url] : undefined
    }
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const [settings, sanityProject] = await Promise.all([
    getSiteSettings(),
    getProjectBySlug(slug)
  ]);
  const pageSettings = settings || fallbackSiteSettings;
  const pageProject = sanityProject || (!isSanityConfigured ? getFallbackProjectBySlug(slug) : null);

  if (!pageProject) {
    notFound();
  }

  const documentationPages = await getProjectDocumentationPagesByProjectSlug(
    slug,
    pageProject._id
  );
  const documentationSource = createProjectDocsSource({
    project: pageProject,
    pages: documentationPages,
    docSlug: []
  });
  const firstDocumentationPage = getFirstDocumentationPage(documentationSource);

  const content = Array.isArray(pageProject.content)
    ? (pageProject.content as PortableTextBlock[])
    : null;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Header settings={pageSettings} />
      <main>
        <SectionShell className="pt-12">
          <Link
            href="/#projects"
            className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800 hover:text-teal-950"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            Back to projects
          </Link>

          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
            <article>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">
                Project
              </p>
              <h1 className="mt-3 max-w-4xl text-4xl font-bold leading-tight text-slate-950 md:text-5xl">
                {pageProject.title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {pageProject.status ? (
                  <StatusBadge status={pageProject.status} />
                ) : null}
              </div>

              {pageProject.shortSummary ? (
                <Markdown className="mt-5 max-w-3xl text-lg text-slate-700">
                  {pageProject.shortSummary}
                </Markdown>
              ) : null}

              {pageProject.coverImage?.url ? (
                <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  <LightboxImage
                    src={pageProject.coverImage.url}
                    alt={pageProject.coverImage.alt || `${pageProject.title} cover image`}
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
              ) : null}

              {content ? (
                <PortableText
                  value={content}
                  components={documentationPortableTextComponents}
                />
              ) : null}
            </article>

            <aside className="h-fit rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              {pageProject.keyMetrics?.length ? (
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                    Outcomes
                  </h2>
                  <ul className="mt-3 space-y-2">
                    {pageProject.keyMetrics.map((metric) => (
                      <li
                        key={metric}
                        className="rounded-md bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-950"
                      >
                        {metric}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {pageProject.technologies?.length ? (
                <div className="mt-6">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                    Technologies
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {pageProject.technologies.map((technology) => (
                      <span
                        key={technology}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm text-slate-700"
                      >
                        {technology}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-6 flex flex-col gap-3">
                {pageProject.githubUrl ? (
                  <a
                    href={pageProject.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    <Github aria-hidden="true" size={17} />
                    GitHub
                  </a>
                ) : null}
                {pageProject.demoUrl ? (
                  <a
                    href={pageProject.demoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-900"
                  >
                    <ExternalLink aria-hidden="true" size={17} />
                    Live Demo
                  </a>
                ) : null}
                {firstDocumentationPage ? (
                  <Link
                    href={firstDocumentationPage.url}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    <BookOpen aria-hidden="true" size={17} />
                    View Documentation
                  </Link>
                ) : null}
              </div>
            </aside>
          </div>
        </SectionShell>
      </main>
      <Footer settings={pageSettings} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-100 text-green-800 border-green-200",
    completed: "bg-blue-100 text-blue-800 border-blue-200",
    archived: "bg-slate-100 text-slate-600 border-slate-200",
    poc: "bg-amber-100 text-amber-800 border-amber-200",
    "in-development": "bg-purple-100 text-purple-800 border-purple-200",
  };

  const labels: Record<string, string> = {
    active: "Active",
    completed: "Completed",
    archived: "Archived",
    poc: "Proof of Concept",
    "in-development": "In Development",
  };

  const colorClass = colors[status] || "bg-slate-100 text-slate-700 border-slate-200";
  const label = labels[status] || status;

  return (
    <span className={`inline-block rounded-md border px-2.5 py-0.5 text-xs font-semibold ${colorClass}`}>
      {label}
    </span>
  );
}
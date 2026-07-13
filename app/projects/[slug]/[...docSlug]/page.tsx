import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import type { PortableTextComponents } from "@portabletext/react";
import type { PortableTextBlock } from "next-sanity";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { PortableContent } from "@/components/PortableContent";
import {
  ProjectDocsLayout,
  ProjectDocsPage
} from "@/components/ProjectDocs";
import {
  createProjectDocsSource
} from "@/lib/project-docs-source";
import { isSanityConfigured } from "@/sanity/env";
import {
  fallbackSiteSettings,
  getFallbackProjectBySlug
} from "@/sanity/fallbackContent";
import { previewSanityFetch } from "@/sanity/previewClient";
import {
  getProjectBySlug,
  getProjectDocumentationPagesByProjectSlug,
  getSiteSettings
} from "@/sanity/queries";

export const revalidate = 60;

type ProjectDocumentationRouteProps = {
  params: Promise<{
    slug: string;
    docSlug: string[];
  }>;
};

export async function generateMetadata({
  params
}: ProjectDocumentationRouteProps): Promise<Metadata> {
  const { slug, docSlug } = await params;
  const isPreview = (await draftMode()).isEnabled;
  const source = await resolveDocumentationSource(slug, docSlug, isPreview);

  if (!source?.page || source.isAmbiguousPath) {
    notFound();
  }

  const title = source.page.seoTitle || source.page.title;
  const description =
    source.page.seoDescription ||
    source.page.description ||
    source.project.shortSummary;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: source.page.url,
      images: source.page.socialImage?.url
        ? [source.page.socialImage.url]
        : undefined
    }
  };
}

export default async function ProjectDocumentationPage({
  params
}: ProjectDocumentationRouteProps) {
  const { slug, docSlug } = await params;
  const isPreview = (await draftMode()).isEnabled;
  const [settings, source] = await Promise.all([
    getRouteSiteSettings(isPreview),
    resolveDocumentationSource(slug, docSlug, isPreview)
  ]);

  if (!source?.page || source.isAmbiguousPath) {
    notFound();
  }

  const pageSettings = settings || fallbackSiteSettings;
  const currentPath = `/projects/${slug}/${docSlug.join("/")}`;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Header settings={pageSettings} />
      <main>
        {isPreview ? (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-950">
            Preview mode is enabled.{" "}
            <a
              href={`/api/draft-mode/disable?redirect=${encodeURIComponent(
                currentPath
              )}`}
              className="font-semibold underline"
            >
              Disable preview
            </a>
          </div>
        ) : null}
        <ProjectDocsLayout tree={source.tree}>
          <ProjectDocsPage
            title={source.page.title}
            description={source.page.description}
            statusLabel={source.page.statusLabel}
            toc={source.toc}
            previous={source.previous}
            next={source.next}
          >
            {source.page.body?.length ? (
              <PortableContent
                value={source.page.body}
                components={createPortableTextComponents(
                  source.headingIdByBlockKey
                )}
              />
            ) : null}
          </ProjectDocsPage>
        </ProjectDocsLayout>
      </main>
      <Footer settings={pageSettings} />
    </div>
  );
}

async function resolveDocumentationSource(
  slug: string,
  docSlug: string[],
  isPreview: boolean
) {
  const project = await getRouteProject(slug, isPreview);

  if (!project?.slug) {
    return null;
  }

  const documentationPages = isPreview
    ? await getProjectDocumentationPagesByProjectSlug(
        slug,
        project._id,
        previewSanityFetch
      )
    : await getProjectDocumentationPagesByProjectSlug(slug, project._id);

  return {
    project,
    ...createProjectDocsSource({
      project,
      pages: documentationPages,
      docSlug
    })
  };
}

async function getRouteSiteSettings(isPreview: boolean) {
  return isPreview ? getSiteSettings(previewSanityFetch) : getSiteSettings();
}

async function getRouteProject(slug: string, isPreview: boolean) {
  const project = isPreview
    ? await getProjectBySlug(slug, previewSanityFetch)
    : await getProjectBySlug(slug);

  return project || (!isSanityConfigured ? getFallbackProjectBySlug(slug) : null);
}

function createPortableTextComponents(
  headingIdByBlockKey: Record<string, string>
): PortableTextComponents {
  return {
    block: {
      h2: ({ children, value }) => (
        <h2 id={getHeadingId(value, headingIdByBlockKey)}>{children}</h2>
      ),
      h3: ({ children, value }) => (
        <h3 id={getHeadingId(value, headingIdByBlockKey)}>{children}</h3>
      ),
      h4: ({ children, value }) => (
        <h4 id={getHeadingId(value, headingIdByBlockKey)}>{children}</h4>
      )
    }
  };
}

function getHeadingId(
  block: PortableTextBlock,
  headingIdByBlockKey: Record<string, string>
) {
  return block._key ? headingIdByBlockKey[block._key] : undefined;
}

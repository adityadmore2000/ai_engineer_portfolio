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
import {
  fallbackSiteSettings,
  getFallbackProjectBySlug
} from "@/sanity/fallbackContent";
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

export default async function ProjectDocumentationPage({
  params
}: ProjectDocumentationRouteProps) {
  const { slug, docSlug } = await params;
  const [settings, sanityProject] = await Promise.all([
    getSiteSettings(),
    getProjectBySlug(slug)
  ]);
  const project = sanityProject || getFallbackProjectBySlug(slug);

  if (!project?.slug) {
    notFound();
  }

  const documentationPages = await getProjectDocumentationPagesByProjectSlug(
    slug,
    project._id
  );

  const source = createProjectDocsSource({
    project,
    pages: documentationPages,
    docSlug
  });

  if (!source.page || source.isAmbiguousPath) {
    notFound();
  }

  const pageSettings = settings || fallbackSiteSettings;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Header settings={pageSettings} />
      <main>
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

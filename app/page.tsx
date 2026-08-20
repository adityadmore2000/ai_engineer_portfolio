import { Blog } from "@/components/Blog";
import { Contact } from "@/components/Contact";
import { Experience } from "@/components/Experience";
import { FAQ } from "@/components/FAQ";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Projects } from "@/components/Projects";
import { Showcase } from "@/components/Showcase";
import { WorkingProcess } from "@/components/WorkingProcess";
import type { Metadata } from "next";
import { isSanityConfigured } from "@/sanity/env";
import {
  fallbackExperiences,
  fallbackProjects,
  fallbackSiteSettings,
  toProjectSummaries
} from "@/sanity/fallbackContent";
import {
  getAllProjects,
  getBlogPosts,
  getContactSettings,
  getExperiences,
  getFaqItems,
  getSiteSettings,
  getWorkingProcess
} from "@/sanity/queries";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();

  return {
    title: settings?.seoTitle || "Aditya More | Applied AI Engineer",
    description:
      settings?.seoDescription ||
      "Applied AI Engineer building reliable GenAI, RAG, Computer Vision, OCR, and Python backend systems for real-world applications.",
    openGraph: {
      title: settings?.seoTitle || "Aditya More | Applied AI Engineer",
      description:
        settings?.seoDescription ||
        "Applied AI Engineer building reliable GenAI, RAG, Computer Vision, OCR, and Python backend systems for real-world applications."
    }
  };
}

export default async function Home() {
  const [settings, experiences, projects, workingProcess, blogPosts, faqItems, contactSettings] =
    await Promise.all([
      getSiteSettings(),
      getExperiences(),
      getAllProjects(),
      getWorkingProcess(),
      getBlogPosts(),
      getFaqItems(),
      getContactSettings(),
    ]);
  const pageSettings = settings || fallbackSiteSettings;
  const pageExperiences = experiences.length ? experiences : fallbackExperiences;
  const pageProjects = isSanityConfigured ? projects : toProjectSummaries(fallbackProjects);
  const pageWorkingProcess = workingProcess;
  const pageBlogPosts = blogPosts;
  const pageFaqItems = faqItems;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Header settings={pageSettings} />
      <main>
        <Hero settings={pageSettings} />
        <Projects projects={pageProjects} />
        <Showcase settings={pageSettings} experiences={pageExperiences} />
        <Experience experiences={pageExperiences} />
        <WorkingProcess steps={pageWorkingProcess} />
        <Blog posts={pageBlogPosts} />
        <FAQ items={pageFaqItems} />
        <Contact settings={pageSettings} contactSettings={contactSettings} />
      </main>
      <Footer settings={pageSettings} />
    </div>
  );
}

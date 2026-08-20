import { About } from "@/components/About";
import { Blog } from "@/components/Blog";
import { Contact } from "@/components/Contact";
import { Experience } from "@/components/Experience";
import { FAQ } from "@/components/FAQ";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Projects } from "@/components/Projects";
import { Showcase } from "@/components/Showcase";
import { Skills } from "@/components/Skills";
import { WorkingProcess } from "@/components/WorkingProcess";
import type { Metadata } from "next";
import { isSanityConfigured } from "@/sanity/env";
import {
  fallbackBlogPosts,
  fallbackExperiences,
  fallbackFaqItems,
  fallbackProjects,
  fallbackSiteSettings,
  fallbackSkillCategories,
  fallbackWorkingProcess,
  toProjectSummaries
} from "@/sanity/fallbackContent";
import {
  getAllProjects,
  getBlogPosts,
  getExperiences,
  getFaqItems,
  getSiteSettings,
  getSkillCategories,
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
  const [settings, experiences, projects, skillCategories, workingProcess, blogPosts, faqItems] =
    await Promise.all([
      getSiteSettings(),
      getExperiences(),
      getAllProjects(),
      getSkillCategories(),
      getWorkingProcess(),
      getBlogPosts(),
      getFaqItems()
    ]);
  const pageSettings = settings || fallbackSiteSettings;
  const pageExperiences = experiences.length ? experiences : fallbackExperiences;
  const pageProjects = isSanityConfigured ? projects : toProjectSummaries(fallbackProjects);
  const pageSkillCategories = skillCategories.length
    ? skillCategories
    : fallbackSkillCategories;
  const pageWorkingProcess = workingProcess.length ? workingProcess : fallbackWorkingProcess;
  const pageBlogPosts = blogPosts.length ? blogPosts : fallbackBlogPosts;
  const pageFaqItems = faqItems.length ? faqItems : fallbackFaqItems;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Header settings={pageSettings} />
      <main>
        <Hero settings={pageSettings} />
        <Projects projects={pageProjects} />
        <Showcase settings={pageSettings} experiences={pageExperiences} />
        <About settings={pageSettings} />
        <Experience experiences={pageExperiences} />
        <Skills categories={pageSkillCategories} />
        <WorkingProcess steps={pageWorkingProcess} />
        <Blog posts={pageBlogPosts} />
        <FAQ items={pageFaqItems} />
        <Contact settings={pageSettings} />
      </main>
      <Footer settings={pageSettings} />
    </div>
  );
}

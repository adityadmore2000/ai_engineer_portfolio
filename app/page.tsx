import { About } from "@/components/About";
import { Contact } from "@/components/Contact";
import { Experience } from "@/components/Experience";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Projects } from "@/components/Projects";
import { Showcase } from "@/components/Showcase";
import { Skills } from "@/components/Skills";
import type { Metadata } from "next";
import { isSanityConfigured } from "@/sanity/env";
import {
  fallbackExperiences,
  fallbackProjects,
  fallbackSiteSettings,
  fallbackSkillCategories,
  toProjectSummaries
} from "@/sanity/fallbackContent";
import {
  getAllProjects,
  getExperiences,
  getSiteSettings,
  getSkillCategories
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
  const [settings, experiences, projects, skillCategories] =
    await Promise.all([
      getSiteSettings(),
      getExperiences(),
      getAllProjects(),
      getSkillCategories()
    ]);
  const pageSettings = settings || fallbackSiteSettings;
  const pageExperiences = experiences.length ? experiences : fallbackExperiences;
  const pageProjects = isSanityConfigured ? projects : toProjectSummaries(fallbackProjects);
  const pageSkillCategories = skillCategories.length
    ? skillCategories
    : fallbackSkillCategories;

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
        <Contact settings={pageSettings} />
      </main>
      <Footer settings={pageSettings} />
    </div>
  );
}

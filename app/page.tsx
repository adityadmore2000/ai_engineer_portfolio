import { About } from "@/components/About";
import { Contact } from "@/components/Contact";
import { Experience } from "@/components/Experience";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Projects } from "@/components/Projects";
import { ResumeSection } from "@/components/ResumeSection";
import { Skills } from "@/components/Skills";
import { TechnicalNotes } from "@/components/TechnicalNotes";
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
  getExperiences,
  getFeaturedProjects,
  getFeaturedTechnicalNotes,
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
  const [settings, experiences, projects, skillCategories, notes] =
    await Promise.all([
      getSiteSettings(),
      getExperiences(),
      getFeaturedProjects(),
      getSkillCategories(),
      getFeaturedTechnicalNotes()
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
        <About settings={pageSettings} />
        <Experience experiences={pageExperiences} />
        <Projects projects={pageProjects} />
        <Skills categories={pageSkillCategories} />
        <ResumeSection settings={pageSettings} />
        <TechnicalNotes notes={notes} />
        <Contact settings={pageSettings} />
      </main>
      <Footer settings={pageSettings} />
    </div>
  );
}

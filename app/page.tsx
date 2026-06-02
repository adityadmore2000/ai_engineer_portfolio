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

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Header settings={settings} />
      <main>
        <Hero settings={settings} />
        <About settings={settings} />
        <Experience experiences={experiences} />
        <Projects projects={projects} />
        <Skills categories={skillCategories} />
        <ResumeSection settings={settings} />
        <TechnicalNotes notes={notes} />
        <Contact settings={settings} />
      </main>
      <Footer settings={settings} />
    </div>
  );
}

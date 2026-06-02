import type { ProjectSummary } from "@/sanity/types";
import { ProjectCard } from "./ProjectCard";
import { SectionShell } from "./SectionShell";

export function Projects({ projects }: { projects: ProjectSummary[] }) {
  if (!projects.length) {
    return null;
  }

  return (
    <SectionShell
      id="projects"
      eyebrow="Projects"
      title="Selected AI systems"
      description="A recruiter-friendly view of applied work across RAG, computer vision, OCR, LLM verification, and backend integration."
      className="bg-white"
    >
      <div className="grid gap-5 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project._id} project={project} />
        ))}
      </div>
    </SectionShell>
  );
}

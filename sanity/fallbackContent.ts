import type {
  ExperienceItem,
  ProjectDetail,
  ProjectSummary,
  SiteSettings,
  SkillCategory
} from "./types";

export const fallbackSiteSettings: SiteSettings = {
  _id: "fallback.siteSettings",
  name: "Aditya More",
  role: "Applied AI Engineer",
  shortBio:
    "Applied AI Engineer building reliable GenAI, RAG, Computer Vision, OCR, and Python backend systems for real-world applications.",
  heroDescription:
    "Building reliable GenAI, RAG, Computer Vision, OCR, and Python-based backend systems for practical, real-world applications.",
  email: "aditya@example.com",
  linkedinUrl: "https://www.linkedin.com/in/aditya-more",
  githubUrl: "https://github.com/adityamore",
  resumeUrl: "/resume-placeholder.pdf",
  location: "India",
  availabilityText:
    "Open to Applied AI, Generative AI, Machine Learning, and AI application development roles.",
  heroMetrics: [
    "2+ Years of Applied AI Experience",
    "97.4% mAP50 on Parcel Detection",
    "RAG + Qdrant + FastAPI",
    "Dockerized ML Workflows"
  ],
  headerCtaText: "Contact Me",
  primaryCtaText: "View Projects",
  secondaryCtaText: "Download Resume",
  emailCtaText: "Email Me",
  resumeCtaText: "Download Resume",
  aboutSummary:
    "I build applied AI systems that connect models, retrieval, evaluation, and backend services into workflows that can be inspected, improved, and deployed. My work focuses on practical GenAI systems, computer vision pipelines, OCR automation, and Python services for real-world use cases.",
  focusAreas: [
    "Reliable AI workflows",
    "Evidence-grounded GenAI systems",
    "Real-world model evaluation",
    "Python backend integration",
    "Deployment-oriented ML engineering"
  ],
  contactHeadline: "Let's build reliable AI systems.",
  contactDescription:
    "I'm open to opportunities in Applied AI, Generative AI, Machine Learning, and AI application development.",
  seoTitle: "Aditya More | Applied AI Engineer",
  seoDescription:
    "Applied AI Engineer building reliable GenAI, RAG, Computer Vision, OCR, and Python backend systems for real-world applications."
};

export const fallbackExperiences: ExperienceItem[] = [
  {
    _id: "fallback.experience.ndsofttech",
    role: "Software Engineering Intern",
    company: "NDSoftTech Solutions",
    location: "India",
    startDate: "2023-01-01",
    endDate: "2023-06-01",
    currentRole: false,
    shortDescription:
      "Contributed to software engineering tasks across backend implementation, debugging, and application support.",
    bulletPoints: [
      "Worked with engineering teams to implement maintainable application features.",
      "Improved debugging, code review, and delivery habits in a production-oriented environment."
    ],
    skills: ["Python", "Backend Development", "Debugging"],
    displayOrder: 1
  },
  {
    _id: "fallback.experience.freelancer",
    role: "Applied AI Engineer",
    company: "Freelancer / Independent Projects",
    location: "Remote",
    startDate: "2023-07-01",
    currentRole: true,
    shortDescription:
      "Built applied AI prototypes and MVPs across RAG, OCR, computer vision, and LLM-backed workflows.",
    bulletPoints: [
      "Designed evidence-grounded GenAI workflows using retrieval and validation patterns.",
      "Built Python APIs and ML pipelines with practical deployment constraints in mind."
    ],
    skills: ["RAG", "FastAPI", "Qdrant", "OCR", "Docker"],
    displayOrder: 2
  },
  {
    _id: "fallback.experience.neilsoft",
    role: "AI/ML Engineer",
    company: "Neilsoft",
    location: "India",
    startDate: "2024-01-01",
    currentRole: true,
    shortDescription:
      "Worked on ML and AI engineering tasks involving model evaluation, backend integration, and applied automation.",
    bulletPoints: [
      "Integrated AI capabilities into practical engineering workflows.",
      "Worked with model evaluation, data processing, and deployment-oriented implementation patterns."
    ],
    skills: ["Machine Learning", "Python", "Computer Vision", "Model Evaluation"],
    displayOrder: 3
  }
];

export const fallbackProjects: ProjectDetail[] = [
  {
    _id: "project.resume-tailoring",
    title: "Evidence-Grounded Resume Tailoring Platform",
    slug: "evidence-grounded-resume-tailoring-platform",
    shortSummary:
      "A RAG-based resume-tailoring system that generates role-specific resumes from verified user evidence using structured retrieval, deterministic validation, and human review.",
    status: "completed",
    technologies: ["RAG", "Qdrant", "PostgreSQL", "FastAPI", "Next.js", "LaTeX", "Docker"],
    keyMetrics: ["Evidence-grounded generation with human review"],
    featured: true,
    displayOrder: 1
  },
  {
    _id: "project.parcel-monitoring",
    title: "Warehouse Parcel Monitoring System",
    slug: "warehouse-parcel-monitoring-system",
    shortSummary:
      "A warehouse video-analytics pipeline for parcel-condition monitoring, diagnostics-assisted metadata extraction, movement tracking, and incident review.",
    status: "completed",
    technologies: ["YOLO", "PyTorch", "OpenCV", "OCR", "FastAPI", "MLflow", "DVC"],
    keyMetrics: ["92.7% precision", "95.0% recall", "97.4% mAP50"],
    featured: true,
    displayOrder: 2
  },
  {
    _id: "project.math-mentor",
    title: "Math Mentor AI",
    slug: "math-mentor-ai",
    shortSummary:
      "An LLM and using structured outputs and SymPy checks to catch incorrect math answers before presenting them to users.",
    status: "poc",
    technologies: ["LLMs", "SymPy", "Python", "Structured Outputs", "Verification Workflows"],
    keyMetrics: ["Independent symbolic verification before response"],
    featured: true,
    displayOrder: 3
  }
];

export const fallbackSkillCategories: SkillCategory[] = [
  {
    _id: "fallback.skills.generative-ai",
    title: "Generative AI & LLM Systems",
    skills: [
      "LLMs",
      "RAG",
      "Semantic Search",
      "Vector Embeddings",
      "Qdrant",
      "Prompt Engineering",
      "Structured Outputs",
      "Tool Calling",
      "Hugging Face Transformers",
      "Ollama"
    ],
    displayOrder: 1
  },
  {
    _id: "fallback.skills.cv-ml",
    title: "Computer Vision & Machine Learning",
    skills: [
      "PyTorch",
      "OpenCV",
      "YOLOv5",
      "YOLOX",
      "YOLOv8",
      "OCR",
      "Object Detection",
      "Instance Segmentation",
      "Video Analytics",
      "Model Evaluation"
    ],
    displayOrder: 2
  },
  {
    _id: "fallback.skills.backend-data",
    title: "Backend & Data Systems",
    skills: [
      "Python",
      "FastAPI",
      "REST APIs",
      "PostgreSQL",
      "SQLAlchemy",
      "Alembic",
      "Pydantic",
      "Pandas",
      "NumPy"
    ],
    displayOrder: 3
  },
  {
    _id: "fallback.skills.mlops",
    title: "MLOps & Infrastructure",
    skills: [
      "Docker",
      "MLflow",
      "DVC",
      "CUDA",
      "Git",
      "GitHub",
      "Experiment Tracking",
      "Artifact Versioning",
      "Model Serving"
    ],
    displayOrder: 4
  }
];

export function getFallbackProjectBySlug(slug: string) {
  return fallbackProjects.find((project) => project.slug === slug) || null;
}

export function toProjectSummaries(projects: ProjectDetail[]): ProjectSummary[] {
  return projects;
}

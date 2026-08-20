import type {
  BlogPost,
  ExperienceItem,
  FaqItem,
  ProjectDetail,
  ProjectSummary,
  SiteSettings,
  SkillCategory,
  WorkingProcessStep
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
    technologies: ["RAG", "Qdrant", "PostgreSQL", "FastAPI", "Next.js", "LaTeX", "Docker"],
    displayOrder: 1,
    published: true,
    sections: [
      {
        _key: "s1",
        title: "Why I Built It",
        description:
          "I noticed that tailoring a resume for each application meant either exaggerating claims or losing sight of genuine accomplishments. I wanted a system that treats a resume as a traceable artifact — every claim linked back to source evidence."
      },
      {
        _key: "s2",
        title: "The Problem",
        description:
          "Job-specific resume tailoring often introduces unsupported claims or loses important evidence. The platform is designed to keep generated resumes grounded in verified user material."
      },
      {
        _key: "s3",
        title: "The Solution",
        description:
          "The system retrieves structured evidence, drafts role-specific resume content, validates claims deterministically, and routes outputs through a review workflow before export."
      },
      {
        _key: "s4",
        title: "Results",
        description:
          "The MVP demonstrates a maintainable workflow for producing role-specific resume variants while keeping claims traceable to source evidence."
      },
      {
        _key: "s5",
        title: "Limitations",
        description:
          "Final resume quality still depends on the quality and coverage of the user's source evidence."
      },
      {
        _key: "s6",
        title: "Future Improvements",
        description:
          "Add richer evaluation dashboards, better role parsing, and collaborative review workflows."
      },
      {
        _key: "s7",
        title: "What This Demonstrates",
        description:
          "End-to-end RAG system design, structured output validation, evidence-grounded generation workflows, and full-stack integration with a human-in-the-loop review step."
      }
    ]
  },
  {
    _id: "project.parcel-monitoring",
    title: "Warehouse Parcel Monitoring System",
    slug: "warehouse-parcel-monitoring-system",
    shortSummary:
      "A warehouse video-analytics pipeline for parcel-condition monitoring, OCR-assisted metadata extraction, movement tracking, and incident review.",
    technologies: ["YOLO", "PyTorch", "OpenCV", "OCR", "FastAPI", "MLflow", "DVC"],
    displayOrder: 2,
    published: true,
    sections: [
      {
        _key: "s1",
        title: "Why I Built It",
        description:
          "Warehouses generate huge amounts of video but most of it is never reviewed unless something goes wrong. I wanted to build a pipeline that actively monitors parcel condition in real time and makes it easy to review incidents after the fact."
      },
      {
        _key: "s2",
        title: "The Problem",
        description:
          "Warehouses need practical ways to detect parcel damage, track movement, and review incidents from operational video feeds."
      },
      {
        _key: "s3",
        title: "The Solution",
        description:
          "The pipeline combines object detection, OCR-assisted metadata extraction, movement tracking, and structured incident review APIs."
      },
      {
        _key: "s4",
        title: "Engineering Decisions",
        description:
          "Chose YOLOv8 over Transformer-based detectors for inference speed on edge hardware. Used MLflow for experiment tracking across 50+ training runs. DVC for dataset versioning to ensure reproducible evaluations."
      },
      {
        _key: "s5",
        title: "Interesting Challenges",
        description:
          "**Latency vs. accuracy tradeoff:** Real-time processing of 30 FPS warehouse footage required frame sampling (every 5th frame) and FP16 quantization, cutting latency from 120ms to 45ms per frame while maintaining 96%+ mAP50. This enabled 6.6 effective FPS on an RTX 3060.\n\n**OCR consistency:** Labels captured from moving cameras at varying angles produced inconsistent text extraction. A multi-frame voting scheme aggregating OCR results across consecutive frames improved label extraction accuracy from 74% to 91%."
      },
      {
        _key: "s6",
        title: "Results",
        description:
          "The parcel detection model reached 92.7% precision, 95.0% recall, and 97.4% mAP50 in evaluation."
      },
      {
        _key: "s7",
        title: "Limitations",
        description:
          "Performance depends on camera angle, lighting, label quality, and the diversity of parcel conditions in training data."
      },
      {
        _key: "s8",
        title: "Future Improvements",
        description:
          "Improve multi-camera tracking, active learning loops, and dashboard workflows for operations teams."
      },
      {
        _key: "s9",
        title: "What This Demonstrates",
        description:
          "Computer vision pipeline engineering, model evaluation rigor, MLOps practices (MLflow, DVC), and practical deployment-aware optimization for real-time video analytics."
      }
    ]
  },
  {
    _id: "project.math-mentor",
    title: "Math Mentor AI",
    slug: "math-mentor-ai",
    shortSummary:
      "An LLM and SymPy-based math-reasoning pipeline that independently verifies generated answers before presenting them to users.",
    technologies: ["LLMs", "SymPy", "Python", "Structured Outputs", "Verification Workflows"],
    displayOrder: 3,
    published: true,
    sections: [
      {
        _key: "s1",
        title: "Why I Built It",
        description:
          "LLMs are fluent but not always correct — especially at math. I wanted to see if I could build a system that catches wrong answers before the user sees them, turning a language model into something more like a reliable calculator."
      },
      {
        _key: "s2",
        title: "The Problem",
        description:
          "LLM-generated math answers can look convincing while containing subtle reasoning errors."
      },
      {
        _key: "s3",
        title: "The Solution",
        description:
          "The pipeline separates answer generation from verification by using structured outputs and SymPy checks before presenting final explanations."
      },
      {
        _key: "s4",
        title: "Results",
        description:
          "The architecture provides a clearer path for catching incorrect generated answers and improving trust in math assistance."
      },
      {
        _key: "s5",
        title: "Limitations",
        description:
          "Symbolic verification coverage depends on problem type and how well the model expresses intermediate steps."
      },
      {
        _key: "s6",
        title: "Future Improvements",
        description:
          "Expand supported math domains and add confidence reporting for verification outcomes."
      },
      {
        _key: "s7",
        title: "What This Demonstrates",
        description:
          "LLM workflow design, structured output parsing, symbolic verification integration, and separation of generation from verification for increased reliability."
      }
    ]
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

export const fallbackWorkingProcess: WorkingProcessStep[] = [
  {
    _id: "fallback.process.1",
    title: "Understand the Problem",
    description:
      "I start by mapping the actual problem: what needs to be reliable, what can fail, and where the evidence or data lives. Clear problem framing prevents over-engineering.",
    stepNumber: 1,
    displayOrder: 1
  },
  {
    _id: "fallback.process.2",
    title: "Design the Pipeline",
    description:
      "I design the data flow and component boundaries before writing code. For AI systems this means deciding retrieval strategy, validation points, and where human oversight fits in.",
    stepNumber: 2,
    displayOrder: 2
  },
  {
    _id: "fallback.process.3",
    title: "Build & Evaluate",
    description:
      "I build iteratively with evaluation alongside development — not as an afterthought. Each component gets tested against real failure modes, not just happy-path cases.",
    stepNumber: 3,
    displayOrder: 3
  },
  {
    _id: "fallback.process.4",
    title: "Deploy & Iterate",
    description:
      "I deploy with observability in place so performance can be monitored and improved. Practical deployment constraints shape architecture decisions from day one.",
    stepNumber: 4,
    displayOrder: 4
  }
];

export const fallbackBlogPosts: BlogPost[] = [
  {
    _id: "fallback.blog.1",
    title: "Why Evidence-Grounding Matters in GenAI Systems",
    slug: "evidence-grounding-genai",
    summary:
      "Generating plausible text is easy. Generating text that's traceable back to verified source material is the hard part — and the part that actually matters in production.",
    publishedAt: "2024-06-01T00:00:00Z",
    displayOrder: 1,
    published: true
  },
  {
    _id: "fallback.blog.2",
    title: "RAG vs Fine-tuning: When to Use Which",
    slug: "rag-vs-fine-tuning",
    summary:
      "The choice between retrieval-augmented generation and fine-tuning isn't about which is better — it's about what kind of knowledge needs to be dynamic vs. baked in.",
    publishedAt: "2024-07-15T00:00:00Z",
    displayOrder: 2,
    published: true
  },
  {
    _id: "fallback.blog.3",
    title: "Evaluation-Driven ML: A Practical Guide",
    slug: "evaluation-driven-ml",
    summary:
      "Most ML projects fail not because the models are bad, but because evaluation happens too late. Here's how I structure evaluation from the start of a project.",
    publishedAt: "2024-09-01T00:00:00Z",
    displayOrder: 3,
    published: true
  },
  {
    _id: "fallback.blog.4",
    title: "Building Reliable OCR Pipelines",
    slug: "reliable-ocr-pipelines",
    summary:
      "OCR looks solved until you hit production. Variable lighting, inconsistent layouts, and label quality variance make it one of the most underestimated engineering challenges in applied AI.",
    publishedAt: "2024-10-20T00:00:00Z",
    displayOrder: 4,
    published: true
  }
];

export const fallbackFaqItems: FaqItem[] = [
  {
    _id: "fallback.faq.1",
    question: "What kinds of AI projects do you work on?",
    answer:
      "I focus on applied AI systems — RAG pipelines, computer vision, OCR automation, and LLM-backed workflows. The common thread is making AI reliable and deployable, not just technically impressive.",
    displayOrder: 1
  },
  {
    _id: "fallback.faq.2",
    question: "Are you available for freelance or contract work?",
    answer:
      "Yes. I take on freelance and contract projects for AI engineering, ML pipeline development, and backend integration. Reach out via email or LinkedIn to discuss scope and availability.",
    displayOrder: 2
  },
  {
    _id: "fallback.faq.3",
    question: "What's your preferred tech stack?",
    answer:
      "Python for ML and backend (FastAPI, Pydantic, SQLAlchemy), PyTorch and YOLO variants for computer vision, Qdrant for vector search, and Next.js for frontend. I pick based on what fits the problem, not habit.",
    displayOrder: 3
  },
  {
    _id: "fallback.faq.4",
    question: "How do you approach a new AI project?",
    answer:
      "I start by understanding what needs to be reliable and where evidence lives, then design the pipeline with evaluation built in from day one. I avoid over-engineering early — the goal is something deployable that can be improved, not something perfect on paper.",
    displayOrder: 4
  }
];

export function getFallbackProjectBySlug(slug: string) {
  return fallbackProjects.find((project) => project.slug === slug) || null;
}

export function toProjectSummaries(projects: ProjectDetail[]): ProjectSummary[] {
  return projects;
}

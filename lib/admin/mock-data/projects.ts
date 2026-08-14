import { Project } from '../types';

export interface SectionTemplate {
  title: string;
  placeholder: string;
  hint: string;
}

export const SECTION_TEMPLATES: SectionTemplate[] = [
  {
    title: 'Why I Built It',
    hint: 'Context & Motivation',
    placeholder: 'Explain the origin story, thesis, or developer itch that led to this project...',
  },
  {
    title: 'The Problem & Friction',
    hint: 'Bottlenecks & Scope',
    placeholder: 'Describe the concrete limitations, performance bottlenecks, or user friction being addressed...',
  },
  {
    title: 'System Architecture',
    hint: 'Pipelines & Infrastructure',
    placeholder: 'Detail the component topology, async task queues, memory models, or data pipelines...',
  },
  {
    title: 'Key Engineering Tradeoffs',
    hint: 'Technical Decisions',
    placeholder: 'Explain why specific technologies, libraries, algorithms, or protocols were chosen over alternatives...',
  },
  {
    title: 'Interesting Challenges & Edge Cases',
    hint: 'Obstacles Overcome',
    placeholder: 'Highlight subtle concurrency bugs, race conditions, memory leaks, or mathematical breakthroughs...',
  },
  {
    title: 'Benchmarks & Measurable Results',
    hint: 'Impact & Numbers',
    placeholder: 'Quantify latency improvements, memory reduction, adoption metrics, or throughput numbers...',
  },
  {
    title: 'Future Roadmap & Next Steps',
    hint: 'Vision & Next Steps',
    placeholder: 'Outline planned optimizations, extensions, APIs, or open research questions...',
  },
];

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    title: 'AI Video Captioning Agent',
    slug: 'agentic-video-captioning',
    shortSummary: 'Autonomous multimodal agent that extracts, summarizes, and generates time-aligned contextual subtitles for 4K video streams in minutes.',
    status: 'Active',
    publicationState: 'published',
    displayOrder: 1,
    technologies: ['Python', 'PyTorch', 'Qwen-VL', 'WhisperX', 'FastAPI', 'Docker', 'Redis', 'React'],
    links: {
      github: 'https://github.com/developer/agentic-video-captioning',
      demo: 'https://video-agent-demo.internal.dev',
      videoDemo: 'https://youtube.com/watch?v=demo-captioning-agent',
    },
    metrics: [
      { id: 'm-1', text: 'Runtime under 8 minutes for 1hr 4K video' },
      { id: 'm-2', text: 'Docker image optimized under 6.2 GB' },
      { id: 'm-3', text: '99.4% word error rate accuracy (WER)' },
      { id: 'm-4', text: 'Zero GPU memory leaks across 10k tasks' },
    ],
    coverImage: {
      url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1400&q=80',
      alt: 'Neural network abstract visualization for video processing',
    },
    sections: [
      {
        id: 'sec-101',
        title: 'The Spark & Motivation',
        description: `### Why I Built It\n\nI spend hours reviewing technical talks, screen recordings, and conference keynotes. Most open-source transcription tools provide basic audio text, but they are **blind to on-screen visuals** — code editors, terminal commands, slides, and whiteboards.\n\nI wanted a self-hosted agent that could:\n1. "Watch" the video frames alongside hearing the audio.\n2. Accurately capture technical acronyms and variable names displayed on screen.\n3. Output subtitle tracks formatted with Markdown emphasis and speaker labels.`,
      },
      {
        id: 'sec-102',
        title: 'The Multimodal Sync Problem',
        description: `Traditional Whisper pipelines operate purely on 16kHz audio waveforms. When a speaker says *"take a look at this variable here"*, traditional speech models hallucinate generic words.\n\nFurthermore, naive frame extraction at 30 fps produces **108,000 images per hour** of video — exhausting GPU memory and API budgets instantly.`,
      },
      {
        id: 'sec-103',
        title: 'Hierarchical Keyframe Intelligence',
        description: `We designed a dual-stream architecture:\n- **Audio Stream**: Runs WhisperX with forced phone alignment for sub-millisecond word boundaries.\n- **Visual Stream**: Runs an adaptive perceptual hash & scene detector in Rust to reduce 108,000 raw frames down to ~140 semantically distinct keyframes.\n- **Agent Orchestrator**: Feeds time-bounded keyframe batches to a local \`Qwen-2.5-VL\` model to resolve visual references and enrich subtitle metadata.`,
      },
      {
        id: 'sec-104',
        title: 'System Architecture & Data Pipeline',
        description: `\`\`\`\n┌────────────────┐      ┌─────────────────────────┐\n│ Video Ingest   │ ───► │ FFMPEG Demux & Rust pHash│\n└────────────────┘      └────────────┬────────────┘\n                                     │\n          ┌──────────────────────────┴──────────────────────────┐\n          ▼                                                     ▼\n┌───────────────────┐                                 ┌───────────────────┐\n│ WhisperX Acoustic │                                 │ Keyframe Batcher  │\n│ Alignment Engine  │                                 │ (Top-k Saliency)  │\n└─────────┬─────────┘                                 └─────────┬─────────┘\n          │                                                     │\n          └──────────────────────────┬──────────────────────────┘\n                                     ▼\n                        ┌────────────────────────┐\n                        │ Qwen-VL Fusion Agent   │\n                        └────────────┬───────────┘\n                                     ▼\n                        ┌────────────────────────┐\n                        │ WebVTT / SRT Exporter  │\n                        └────────────────────────┘\n\`\`\``,
      },
      {
        id: 'sec-105',
        title: 'Key Engineering Decisions',
        description: `* **ONNX Runtime with TensorRT**: Migrated Qwen inference to 8-bit quantized ONNX checkpoints, lowering peak VRAM from 24GB to 7.6GB without degradation.\n* **Lock-free Ring Buffer**: Audio decoding and frame extraction run in parallel threads feeding a lock-free queue, preventing thread starvation.\n* **Deterministic Subtitle Formatting**: Built a rule-based post-processor enforcing maximum line length (37 chars) and duration bounds (1.2s - 4.5s) for optimal human readability.`,
      },
      {
        id: 'sec-106',
        title: 'Handling Variable Frame Rate (VFR) Drift',
        description: `Smartphone and screen recorder videos frequently use Variable Frame Rates. When demuxing audio and video streams separately, timestamps would drift by up to **4.2 seconds** by minute 45.\n\nWe fixed this by writing a custom timestamp interpolator using presentation timestamps (\`PTS\`) directly from the container headers rather than trusting frame indices.`,
      },
      {
        id: 'sec-107',
        title: 'Benchmarks & Real-World Results',
        description: `* **Speed**: Processed a 1-hour 1080p presentation in **6m 42s** on a single RTX 4090.\n* **Accuracy**: On technical code walkthrough videos, technical terminology accuracy jumped from **71.2% to 98.6%**.\n* **Community**: 1,200+ GitHub stars in the first 2 weeks.`,
      },
    ],
    createdAt: '2026-06-10T10:00:00Z',
    updatedAt: '2026-08-12T14:30:00Z',
    publishedAt: '2026-08-12T14:30:00Z',
  },
  {
    id: 'proj-2',
    title: 'Local LLM Orchestrator',
    slug: 'local-llm-orchestrator',
    shortSummary: 'High-throughput local model gateway with automatic VRAM tiering, semantic KV caching, and OpenAI-compatible streaming endpoints.',
    status: 'In Development',
    publicationState: 'published_with_draft_changes',
    displayOrder: 2,
    technologies: ['Rust', 'C++', 'CUDA', 'Tokio', 'SQLite', 'WebSockets', 'TailwindCSS'],
    links: {
      github: 'https://github.com/developer/local-orchestrator',
      demo: 'https://orchestrator.local.run',
    },
    metrics: [
      { id: 'm-201', text: '180 tokens/sec across dual 3090 setups' },
      { id: 'm-202', text: 'Sub-4ms semantic cache lookup time' },
      { id: 'm-203', text: 'Zero dependencies single binary release' },
    ],
    coverImage: {
      url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1400&q=80',
      alt: 'Server hardware and high-performance computing interface',
    },
    sections: [
      {
        id: 'sec-201',
        title: 'Motivation & Hardware Bottlenecks',
        description: `Running local LLMs across multiple GPU cards often means dealing with manual vLLM instances, mismatched context limits, and wasted compute from repeated system prompts.\n\nI built this orchestrator to manage heterogeneous hardware like a single distributed cluster.`,
      },
      {
        id: 'sec-202',
        title: 'Prefix Caching & Unified CUDA Memory',
        description: `Most local inference servers do not share KV caches between concurrent sessions. Repeating a 4,000-token system prompt across 10 chat sessions wastes 40,000 tokens of compute every turn.\n\nWe implemented a Radix-tree prefix cache in Rust with unified CUDA memory pooling, enabling instant prefix reuse across divergent conversation threads.`,
      },
      {
        id: 'sec-203',
        title: 'Zero-Copy Streaming Architecture',
        description: `Built as a single binary in Rust utilizing llama.cpp bindings and CUDA driver APIs, featuring a built-in zero-latency reverse proxy and token streaming daemon. Leveraged Tokio async runtimes and ring buffers for zero-copy streaming of token deltas to connected clients.`,
      },
      {
        id: 'sec-204',
        title: 'Benchmarks & Multi-Agent Throughput',
        description: `* Achieved **3.2x throughput increase** for multi-agent workloads with heavy shared system prompt templates.\n* Sub-4ms semantic cache lookup time on local SQLite index.`,
      },
    ],
    createdAt: '2026-07-01T09:00:00Z',
    updatedAt: '2026-08-14T07:15:00Z',
    publishedAt: '2026-07-20T11:00:00Z',
    lastDraftSavedAt: '2026-08-14T07:15:00Z',
    hasUnsavedChanges: true,
  },
  {
    id: 'proj-3',
    title: 'Spatial AR Keyboard',
    slug: 'spatial-ar-keyboard',
    shortSummary: 'Zero-latency virtual keyboard for spatial computing headsets with optical hand tracking, haptic audio feedback, and predictive typing.',
    status: 'Completed',
    publicationState: 'published',
    displayOrder: 3,
    technologies: ['Swift', 'visionOS', 'Metal', 'CoreML', 'WebAssembly'],
    links: {
      github: 'https://github.com/developer/spatial-keyboard',
      demo: 'https://testflight.apple.com/join/demo',
      videoDemo: 'https://youtube.com/watch?v=ar-keyboard-demo',
    },
    metrics: [
      { id: 'm-301', text: 'Typing speed up to 64 WPM on virtual air' },
      { id: 'm-302', text: '12ms glass-to-glass input latency' },
      { id: 'm-303', text: 'Adaptive keyboard curvature matching hand span' },
    ],
    coverImage: {
      url: 'https://images.unsplash.com/photo-1592478411213-6153e4ebc07d?auto=format&fit=crop&w=1400&q=80',
      alt: 'Augmented reality headset and holographic interface',
    },
    sections: [
      {
        id: 'sec-301',
        title: 'Origin & The Mid-Air Typing Problem',
        description: `Typing on spatial computers is currently frustrating due to the lack of tactile feedback and physical key travel. Mid-air pinch typing causes rapid forearm fatigue, while floating flat keyboards have zero tactile reference points.\n\nI wanted to see if spatial audio impulses and predictive gesture modeling could bridge the gap.`,
      },
      {
        id: 'sec-302',
        title: 'Dynamically Conforming 3D Keybed',
        description: `Created a dynamically conforming 3D keybed that follows the natural anatomical resting curve of the user's fingers, using micro-haptic spatial sound clicks rendered via directional binaural audio.`,
      },
      {
        id: 'sec-303',
        title: 'Kalman Filter Gesture Smoothing',
        description: `Custom Kalman filter smoothing 60Hz hand-tracking pinch events to eliminate false jitter triggers while typing at speed. Handled occlusion edge cases when users type with hands positioned closely.`,
      },
      {
        id: 'sec-304',
        title: 'Typing Latency & User Studies',
        description: `Test users reached an average of **58 words per minute** after just 10 minutes of calibration, with **12ms glass-to-glass input latency**.`,
      },
    ],
    createdAt: '2026-05-15T08:00:00Z',
    updatedAt: '2026-08-01T12:00:00Z',
    publishedAt: '2026-08-01T12:00:00Z',
  },
  {
    id: 'proj-4',
    title: 'Distributed Vector Engine',
    slug: 'distributed-vector-engine',
    shortSummary: 'Sub-millisecond approximate nearest neighbor indexer designed for petabyte-scale semantic embeddings on commodity NVMe drives.',
    status: 'Proof of Concept',
    publicationState: 'draft',
    displayOrder: 4,
    technologies: ['Go', 'C++', 'HNSW', 'gRPC', 'RocksDB', 'Kubernetes'],
    links: {
      github: 'https://github.com/developer/vector-engine-poc',
    },
    metrics: [
      { id: 'm-401', text: '1.2ms recall latency on 100M vectors' },
      { id: 'm-402', text: '78% RAM cost reduction using mmap NVMe' },
    ],
    coverImage: {
      url: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1400&q=80',
      alt: 'Server database and vector graphs',
    },
    sections: [
      {
        id: 'sec-401',
        title: 'Problem & Motivation',
        description: `In-memory vector databases like Milvus or Pinecone become exorbitantly expensive at hundreds of millions of embeddings. This engine explores disk-first HNSW indexing with direct IO bypass.`,
      },
      {
        id: 'sec-402',
        title: 'Hybrid Tiered Routing Architecture',
        description: `Top graph layers reside in RAM while dense leaves are page-aligned on NVMe drives with direct IO bypass. Go orchestration layer with C++ SIMD AVX-512 distance computation kernels.`,
      },
      {
        id: 'sec-403',
        title: 'Key Results & Tradeoffs',
        description: `Maintained **96.5% recall@10** with only **12% of the RAM budget** required by pure in-memory solutions. Recall latency averaged 1.2ms on 100M vectors.`,
      },
    ],
    createdAt: '2026-08-05T14:00:00Z',
    updatedAt: '2026-08-10T16:00:00Z',
    lastDraftSavedAt: '2026-08-10T16:00:00Z',
  },
  {
    id: 'proj-5',
    title: 'Neural Shader Studio',
    slug: 'neural-shader-studio',
    shortSummary: 'Real-time WebGPU GLSL shader authoring environment with AI-assisted raymarching debugging and procedural texture synthesizer.',
    status: 'Archived',
    publicationState: 'draft',
    displayOrder: 5,
    technologies: ['TypeScript', 'WebGPU', 'WGSL', 'Three.js', 'Vite'],
    links: {
      github: 'https://github.com/developer/neural-shader-studio',
      demo: 'https://shaders.dev.internal',
    },
    metrics: [
      { id: 'm-501', text: '60 FPS 4K raymarching on M2 Mac' },
      { id: 'm-502', text: 'Instant hot-reloading with AST preservation' },
    ],
    coverImage: {
      url: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=1400&q=80',
      alt: 'Geometric generative shaders and light refraction',
    },
    sections: [
      {
        id: 'sec-501',
        title: 'Experiment Thesis',
        description: `Exploratory prototype to test WebGPU compute shader pipeline for generative visuals and audio-reactive 3D fractals in the browser.`,
      },
      {
        id: 'sec-502',
        title: 'Interactive AST Compiler Architecture',
        description: `Integrated real-time WGSL AST parser with visual variable inspectors and automatic uniform binding generators. Client-side WebGPU pipeline with Web Worker compilation threads.`,
      },
    ],
    createdAt: '2026-03-10T11:00:00Z',
    updatedAt: '2026-04-15T09:30:00Z',
  },
];

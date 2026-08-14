import { Experience } from '../types';

export const INITIAL_EXPERIENCES: Experience[] = [
  {
    id: 'exp-1',
    companyName: 'Anthropic AI Research',
    role: 'Staff Systems & Infrastructure Engineer',
    duration: '2024 — Present',
    location: 'San Francisco, CA (Hybrid)',
    description: `* Architected high-throughput model serving pipelines achieving **sub-15ms time-to-first-token** latency across multi-node GPU clusters.
* Implemented distributed CUDA memory ring buffers and zero-copy token streaming protocols.
* Authored core scheduling algorithms handling over **45M daily inference requests** with 99.99% service uptime.`,
    displayOrder: 1,
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-08-10T12:00:00Z',
  },
  {
    id: 'exp-2',
    companyName: 'Stripe',
    role: 'Senior Software Engineer, Core Platforms',
    duration: '2022 — 2024',
    location: 'Seattle, WA (Remote)',
    description: `* Led the migration of transaction ingestion pipelines to event-driven architectures, reducing p99 processing latency by **42%**.
* Designed resilient idempotency keys and multi-region database fallback mechanisms across distributed databases.
* Mentored 6 junior and mid-level engineers in distributed systems design and type-safe API patterns.`,
    displayOrder: 2,
    createdAt: '2024-06-01T09:00:00Z',
    updatedAt: '2025-12-20T10:00:00Z',
  },
  {
    id: 'exp-3',
    companyName: 'Vercel',
    role: 'Software Engineer, Developer Experience',
    duration: '2020 — 2022',
    location: 'Remote, US',
    description: `* Contributed to the Next.js compilation engine and edge runtime middleware pipelines.
* Built AST-based bundle analysis tooling helping enterprise teams cut client JavaScript payloads by an average of **28%**.
* Maintained core open-source documentation and developer CLI tooling with over **2M weekly downloads**.`,
    displayOrder: 3,
    createdAt: '2022-08-10T10:00:00Z',
    updatedAt: '2024-01-05T14:30:00Z',
  },
];

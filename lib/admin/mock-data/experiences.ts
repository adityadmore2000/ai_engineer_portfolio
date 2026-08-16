import { Experience } from '../types';

export const INITIAL_EXPERIENCES: Experience[] = [
  {
    _id: 'exp-1',
    role: 'Staff Systems & Infrastructure Engineer',
    company: 'Anthropic AI Research',
    location: 'San Francisco, CA (Hybrid)',
    startDate: '2024-01-15',
    currentRole: true,
    shortDescription: `* Architected high-throughput model serving pipelines achieving **sub-15ms time-to-first-token** latency across multi-node GPU clusters.
* Implemented distributed CUDA memory ring buffers and zero-copy token streaming protocols.
* Authored core scheduling algorithms handling over **45M daily inference requests** with 99.99% service uptime.`,
    displayOrder: 1,
  },
  {
    _id: 'exp-2',
    role: 'Senior Software Engineer, Core Platforms',
    company: 'Stripe',
    location: 'Seattle, WA (Remote)',
    startDate: '2022-06-01',
    endDate: '2024-01-01',
    currentRole: false,
    shortDescription: `* Led the migration of transaction ingestion pipelines to event-driven architectures, reducing p99 processing latency by **42%**.
* Designed resilient idempotency keys and multi-region database fallback mechanisms across distributed databases.
* Mentored 6 junior and mid-level engineers in distributed systems design and type-safe API patterns.`,
    displayOrder: 2,
  },
  {
    _id: 'exp-3',
    role: 'Software Engineer, Developer Experience',
    company: 'Vercel',
    location: 'Remote, US',
    startDate: '2020-08-10',
    endDate: '2022-08-01',
    currentRole: false,
    shortDescription: `* Contributed to the Next.js compilation engine and edge runtime middleware pipelines.
* Built AST-based bundle analysis tooling helping enterprise teams cut client JavaScript payloads by an average of **28%**.
* Maintained core open-source documentation and developer CLI tooling with over **2M weekly downloads**.`,
    displayOrder: 3,
  },
];

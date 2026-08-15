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

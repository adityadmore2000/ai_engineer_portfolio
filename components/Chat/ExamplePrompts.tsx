"use client";

const EXAMPLES = [
  "Summarize your work experience",
  "Show your AI projects",
  "Which project best demonstrates backend engineering?",
  "Explain your Video Captioning Agent",
  "What technologies do you specialize in?",
  "Open your resume",
  "How can I contact you?",
  "Which projects use Docker?",
];

export function ExamplePrompts({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-center text-xs font-medium uppercase tracking-wide text-slate-400">
        Try asking about
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => onSelect(example)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800 transition-colors"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}

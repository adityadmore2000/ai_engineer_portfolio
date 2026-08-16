import React from 'react';

export function renderMarkdown(content?: string): React.ReactNode {
  if (!content || !content.trim()) {
    return <p className="text-zinc-500 italic">No content written yet.</p>;
  }

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let index = 0;
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = '';
  let inList: 'ul' | 'ol' | null = null;
  let listItems: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const flushList = () => {
    if (inList && listItems.length > 0) {
      if (inList === 'ul') {
        elements.push(
          <ul key={`ul-${index++}`} className="my-3 space-y-1.5 list-disc list-inside text-zinc-300 leading-relaxed pl-2">
            {listItems}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`ol-${index++}`} className="my-3 space-y-1.5 list-decimal list-inside text-zinc-300 leading-relaxed pl-2">
            {listItems}
          </ol>
        );
      }
      inList = null;
      listItems = [];
    }
  };

  const flushTable = () => {
    if (inTable && tableRows.length > 0) {
      const headerRow = tableRows[0];
      const bodyRows = tableRows.slice(1);

      elements.push(
        <div key={`table-wrapper-${index++}`} className="my-4 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/60 shadow-xs">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="border-b border-zinc-800 bg-zinc-900/80 text-xs uppercase tracking-wider text-zinc-400 font-mono">
              <tr>
                {headerRow.map((cell, cIdx) => (
                  <th key={cIdx} className="px-4 py-3 font-semibold">
                    {parseInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono text-xs">
              {bodyRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-zinc-900/40 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-4 py-2.5">
                      {parseInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      inTable = false;
      tableRows = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <div key={`code-${index++}`} className="my-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs overflow-x-auto shadow-inner text-emerald-400">
            {codeBlockLang && (
              <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold border-b border-zinc-800/80 pb-1">
                {codeBlockLang}
              </div>
            )}
            <pre className="leading-relaxed whitespace-pre font-mono">
              {codeBlockContent.join('\n')}
            </pre>
          </div>
        );
        inCodeBlock = false;
        codeBlockContent = [];
        codeBlockLang = '';
      } else {
        flushList();
        flushTable();
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(rawLine);
      continue;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList();
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
        continue;
      }
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      inTable = true;
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h1 key={`h1-${index++}`} className="mt-6 mb-3 text-2xl font-bold text-zinc-100 tracking-tight">
          {parseInline(trimmed.slice(2))}
        </h1>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={`h2-${index++}`} className="mt-5 mb-2.5 text-xl font-semibold text-zinc-100 tracking-tight border-b border-zinc-800/60 pb-1.5">
          {parseInline(trimmed.slice(3))}
        </h2>
      );
      continue;
    }
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={`h3-${index++}`} className="mt-4 mb-2 text-base font-semibold text-zinc-200 tracking-tight">
          {parseInline(trimmed.slice(4))}
        </h3>
      );
      continue;
    }

    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      flushList();
      elements.push(<hr key={`hr-${index++}`} className="my-6 border-zinc-800" />);
      continue;
    }

    if (trimmed.startsWith('>')) {
      flushList();
      const quoteText = trimmed.replace(/^>\s?/, '');
      elements.push(
        <blockquote key={`bq-${index++}`} className="my-3 pl-4 border-l-2 border-indigo-500/80 bg-indigo-500/5 py-2 pr-3 rounded-r-lg text-zinc-300 italic text-sm">
          {parseInline(quoteText)}
        </blockquote>
      );
      continue;
    }

    if (/^[\*\-\+]\s/.test(trimmed)) {
      if (inList !== 'ul') {
        flushList();
        inList = 'ul';
      }
      const itemText = trimmed.replace(/^[\*\-\+]\s+/, '');
      listItems.push(
        <li key={`li-${index++}`} className="pl-1">
          {parseInline(itemText)}
        </li>
      );
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      if (inList !== 'ol') {
        flushList();
        inList = 'ol';
      }
      const itemText = trimmed.replace(/^\d+\.\s+/, '');
      listItems.push(
        <li key={`oli-${index++}`} className="pl-1">
          {parseInline(itemText)}
        </li>
      );
      continue;
    }

    flushList();
    if (trimmed.length > 0) {
      elements.push(
        <p key={`p-${index++}`} className="my-2.5 text-sm text-zinc-300 leading-relaxed font-normal">
          {parseInline(rawLine)}
        </p>
      );
    }
  }

  flushList();
  flushTable();

  return <div className="markdown-body space-y-1">{elements}</div>;
}

function parseInline(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIdx) {
      result.push(text.slice(lastIdx, match.index));
    }

    const token = match[0];

    if (token.startsWith('`') && token.endsWith('`')) {
      result.push(
        <code
          key={`code-inline-${keyIdx++}`}
          className="rounded-md bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-indigo-300 font-medium border border-zinc-700/50"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      result.push(
        <strong key={`bold-${keyIdx++}`} className="font-semibold text-zinc-100">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      result.push(
        <em key={`italic-${keyIdx++}`} className="italic text-zinc-200">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
      const splitIdx = token.indexOf('](');
      const linkText = token.slice(1, splitIdx);
      const linkUrl = token.slice(splitIdx + 2, -1);
      result.push(
        <a
          key={`link-${keyIdx++}`}
          href={linkUrl}
          target="_blank"
          rel="noreferrer"
          className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 decoration-indigo-500/50 hover:decoration-indigo-400 font-medium inline-flex items-center gap-0.5"
        >
          {linkText}
        </a>
      );
    }

    lastIdx = pattern.lastIndex;
  }

  if (lastIdx < text.length) {
    result.push(text.slice(lastIdx));
  }

  return result.length > 0 ? result : [text];
}

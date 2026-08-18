import React from 'react';
import { isValidTextSizeToken, TEXT_SIZE_CSS_MAP } from '../../utils/text-size';

export function renderMarkdown(content?: string): React.ReactNode {
  if (!content || !content.trim()) {
    return <p className="text-slate-400 italic">No content written yet.</p>;
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
          <ul key={`ul-${index++}`} className="my-3 space-y-1.5 list-disc list-inside text-slate-700 leading-relaxed pl-2">
            {listItems}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`ol-${index++}`} className="my-3 space-y-1.5 list-decimal list-inside text-slate-700 leading-relaxed pl-2">
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
        <div key={`table-wrapper-${index++}`} className="my-4 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 shadow-xs">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-100 text-xs uppercase tracking-wider text-slate-500 font-mono">
              <tr>
                {headerRow.map((cell, cIdx) => (
                  <th key={cIdx} className="px-4 py-3 font-semibold">
                    {parseInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono text-xs">
              {bodyRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-100/60 transition-colors">
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
          <div key={`code-${index++}`} className="my-4 rounded-xl border border-slate-200 bg-slate-900 p-4 font-mono text-xs overflow-x-auto shadow-inner text-emerald-400">
            {codeBlockLang && (
              <div className="mb-2 text-[10px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-700/80 pb-1">
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
        <h1 key={`h1-${index++}`} className="mt-6 mb-3 text-2xl font-bold text-slate-900 tracking-tight">
          {parseInline(trimmed.slice(2))}
        </h1>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={`h2-${index++}`} className="mt-5 mb-2.5 text-xl font-semibold text-slate-900 tracking-tight border-b border-slate-200 pb-1.5">
          {parseInline(trimmed.slice(3))}
        </h2>
      );
      continue;
    }
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={`h3-${index++}`} className="mt-4 mb-2 text-base font-semibold text-slate-800 tracking-tight">
          {parseInline(trimmed.slice(4))}
        </h3>
      );
      continue;
    }

    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      flushList();
      elements.push(<hr key={`hr-${index++}`} className="my-6 border-slate-200" />);
      continue;
    }

    if (trimmed.startsWith('>')) {
      flushList();
      const quoteText = trimmed.replace(/^>\s?/, '');
      elements.push(
        <blockquote key={`bq-${index++}`} className="my-3 pl-4 border-l-2 border-indigo-400 bg-indigo-50 py-2 pr-3 rounded-r-lg text-slate-600 italic text-sm">
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

    const blockImgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (blockImgMatch) {
      const [, altText, imgUrl] = blockImgMatch;
      elements.push(
        <figure key={`img-${index++}`} className="my-4">
          <img
            src={imgUrl}
            alt={altText}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src =
                "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='120'%3E%3Crect fill='%23f1f5f9' width='100%25' height='100%25' rx='8'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='13' fill='%2394a3b8'%3E⚠ Image unavailable%3C/text%3E%3C/svg%3E";
            }}
            className="rounded-lg border border-slate-200 max-w-full h-auto shadow-sm"
          />
          {altText && (
            <figcaption className="mt-1.5 text-center text-xs text-slate-500 italic">
              {altText}
            </figcaption>
          )}
        </figure>
      );
      continue;
    }

    if (trimmed.length > 0) {
      elements.push(
        <p key={`p-${index++}`} className="my-2.5 text-sm text-slate-700 leading-relaxed font-normal">
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
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|\{size:(sm|base|lg|xl|2xl)\}(.*?)\{\/size\})/g;
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
          className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-indigo-700 font-medium border border-slate-200"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      result.push(
        <strong key={`bold-${keyIdx++}`} className="font-semibold text-slate-900">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      result.push(
        <em key={`italic-${keyIdx++}`} className="italic text-slate-700">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('![') && token.includes('](') && token.endsWith(')')) {
      const splitIdx = token.indexOf('](');
      const altText = token.slice(2, splitIdx);
      const imgUrl = token.slice(splitIdx + 2, -1);
      result.push(
        <img
          key={`img-inline-${keyIdx++}`}
          src={imgUrl}
          alt={altText}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src =
              "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='60'%3E%3Crect fill='%23f1f5f9' width='100%25' height='100%25' rx='4'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='10' fill='%2394a3b8'%3E⚠ unavailable%3C/text%3E%3C/svg%3E";
          }}
          className="rounded border border-slate-200 max-h-40 inline-block align-middle"
        />
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
          className="text-indigo-600 hover:text-indigo-500 underline underline-offset-2 decoration-indigo-400/50 hover:decoration-indigo-500 font-medium inline-flex items-center gap-0.5"
        >
          {linkText}
        </a>
      );
    } else if (token.startsWith('{size:') && match[2] != null) {
      const sizeToken = match[2];
      const innerContent = match[3] ?? '';
      if (isValidTextSizeToken(sizeToken)) {
        result.push(
          <span key={`size-${keyIdx++}`} className={TEXT_SIZE_CSS_MAP[sizeToken]}>
            {parseInline(innerContent)}
          </span>
        );
      } else {
        result.push(token);
      }
    }

    lastIdx = pattern.lastIndex;
  }

  if (lastIdx < text.length) {
    result.push(text.slice(lastIdx));
  }

  return result.length > 0 ? result : [text];
}

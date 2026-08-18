import { visit } from 'unist-util-visit';
import type { Root, Text, Element, RootContent } from 'hast';
import { TEXT_SIZE_TOKENS, TEXT_SIZE_CSS_MAP, isValidTextSizeToken } from './text-size';

const SIZE_PATTERN = new RegExp(
  `\\{size:(${TEXT_SIZE_TOKENS.join('|')})\\}(.*?)\\{\\/size\\}`,
  'g'
);

export function rehypeTextSize() {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index: number | undefined, parent) => {
      if (index === undefined || !parent) return;

      const text = node.value;
      if (!text.includes('{size:')) return;

      const parts: RootContent[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      SIZE_PATTERN.lastIndex = 0;
      while ((match = SIZE_PATTERN.exec(text)) !== null) {
        const token = match[1];
        const inner = match[2];

        if (!isValidTextSizeToken(token)) continue;

        if (match.index > lastIndex) {
          parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
        }

        const span: Element = {
          type: 'element',
          tagName: 'span',
          properties: { className: [TEXT_SIZE_CSS_MAP[token]] },
          children: [{ type: 'text', value: inner }],
        };
        parts.push(span);

        lastIndex = match.index + match[0].length;
      }

      if (parts.length === 0) return;

      if (lastIndex < text.length) {
        parts.push({ type: 'text', value: text.slice(lastIndex) });
      }

      (parent.children as RootContent[]).splice(index, 1, ...parts);
    });
  };
}

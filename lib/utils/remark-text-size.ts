import { visit } from 'unist-util-visit';
import type { Root, Text, PhrasingContent, Paragraph, Heading, TableCell } from 'mdast';
import type { Plugin } from 'unified';
import { TEXT_SIZE_CSS_MAP, isValidTextSizeToken } from './text-size';

interface TextSizeNode {
  type: 'textSize';
  data: {
    hName: 'span';
    hProperties: { className: string[] };
  };
  children: PhrasingContent[];
}

declare module 'mdast' {
  interface PhrasingContentMap {
    textSize: TextSizeNode;
  }
}

const OPEN_RE = /\{size:([a-z0-9]+)\}/;
const CLOSE_MARKER = '{/size}';

type PhrasingParent = Paragraph | Heading | TableCell;

function processChildren(children: PhrasingContent[]) {
  let i = 0;
  while (i < children.length) {
    const child = children[i];
    if (child.type !== 'text') {
      i++;
      continue;
    }

    const text = (child as Text).value;
    const m = OPEN_RE.exec(text);
    if (!m) {
      i++;
      continue;
    }

    const token = m[1];
    if (!isValidTextSizeToken(token)) {
      i++;
      continue;
    }

    const openIdx = m.index;
    const openEnd = openIdx + m[0].length;

    const closeInSame = text.indexOf(CLOSE_MARKER, openEnd);
    if (closeInSame !== -1) {
      const before = text.slice(0, openIdx);
      const inner = text.slice(openEnd, closeInSame);
      const after = text.slice(closeInSame + CLOSE_MARKER.length);

      const span: TextSizeNode = {
        type: 'textSize',
        data: { hName: 'span', hProperties: { className: [TEXT_SIZE_CSS_MAP[token]] } },
        children: inner ? [{ type: 'text', value: inner } as Text] : [],
      };

      const parts: PhrasingContent[] = [];
      if (before) parts.push({ type: 'text', value: before } as Text);
      parts.push(span);
      if (after) parts.push({ type: 'text', value: after } as Text);

      children.splice(i, 1, ...parts);
      // Skip past before (if any) + span; the after node (if any) may still need processing
      i += (before ? 1 : 0) + 1;
      continue;
    }

    // Find close marker in a later sibling text node
    let closeJ = -1;
    let closePos = -1;
    for (let j = i + 1; j < children.length; j++) {
      if (children[j].type !== 'text') continue;
      const p = (children[j] as Text).value.indexOf(CLOSE_MARKER);
      if (p !== -1) {
        closeJ = j;
        closePos = p;
        break;
      }
    }

    if (closeJ === -1) {
      // No close marker in this paragraph — leave as literal text
      i++;
      continue;
    }

    const closeNode = children[closeJ] as Text;
    const innerChildren: PhrasingContent[] = [];
    const firstText = text.slice(openEnd);
    if (firstText) innerChildren.push({ type: 'text', value: firstText } as Text);
    for (let j = i + 1; j < closeJ; j++) innerChildren.push(children[j]);
    const lastText = closeNode.value.slice(0, closePos);
    if (lastText) innerChildren.push({ type: 'text', value: lastText } as Text);

    const afterText = closeNode.value.slice(closePos + CLOSE_MARKER.length);
    const before = text.slice(0, openIdx);

    const span: TextSizeNode = {
      type: 'textSize',
      data: { hName: 'span', hProperties: { className: [TEXT_SIZE_CSS_MAP[token]] } },
      children: innerChildren,
    };

    const parts: PhrasingContent[] = [];
    if (before) parts.push({ type: 'text', value: before } as Text);
    parts.push(span);
    if (afterText) parts.push({ type: 'text', value: afterText } as Text);

    children.splice(i, closeJ - i + 1, ...parts);
    i += (before ? 1 : 0) + 1;
  }
}

export const remarkTextSize: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, (node) => {
      if (
        node.type === 'paragraph' ||
        node.type === 'heading' ||
        node.type === 'tableCell'
      ) {
        processChildren((node as PhrasingParent).children as PhrasingContent[]);
      }
    });
  };
};

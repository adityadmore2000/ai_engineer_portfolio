import type { PortableTextBlock } from "next-sanity";
import { generateHeadingId } from "./headings";

/**
 * Shared Portable Text operations — the canonical home for common PT
 * operations reused by the chunker and retrieval layer. No consumer should
 * maintain its own PT flattening or inline section-splitting logic.
 */

/** Flatten a single Portable Text block's children into plain text. */
export function portableTextBlockToText(block: PortableTextBlock): string {
  if (!block.children || !Array.isArray(block.children)) {
    return "";
  }
  return block.children
    .map((child) => ("text" in child && typeof child.text === "string" ? child.text : ""))
    .join("")
    .trim();
}

/** Flatten the full Portable Text array into one plain-text string. */
export function portableTextToText(blocks: PortableTextBlock[]): string {
  if (!Array.isArray(blocks)) {
    return "";
  }
  return blocks
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      return portableTextBlockToText(block);
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * Split a Portable Text array into sections by heading blocks. Non-heading
 * leading blocks are grouped under an empty pseudo-heading ("").
 *
 * Sections are content-derived: every h2/h3/h4 heading starts a new section
 * named after its text, with an anchor id computed via the shared
 * `generateHeadingId()` (bare mode). This mirrors the renderer's on-page ids
 * so chat citations and deep links agree.
 */
export function splitSectionsByHeading(
  blocks: PortableTextBlock[]
): PortableTextSection[] {
  const sections: PortableTextSection[] = [];
  let heading = "";
  let id = "";
  let textParts: string[] = [];
  let sectionBlocks: PortableTextBlock[] = [];

  const used = new Map<string, number>();
  const flush = () => {
    const text = textParts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (text || id) {
      sections.push({ heading, id, text, blocks: sectionBlocks });
    }
  };

  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;

    if (isHeadingBlock(block)) {
      flush();
      heading = portableTextBlockToText(block);
      id =
        "anchor" in block && typeof block.anchor === "string" && block.anchor
          ? block.anchor
          : generateHeadingId(heading, { used });
      textParts = [];
      sectionBlocks = [];
      continue;
    }

    textParts.push(portableTextBlockToText(block));
    sectionBlocks.push(block);
  }

  flush();
  return sections;
}

export type PortableTextSection = {
  heading: string;
  id: string;
  text: string;
  blocks: PortableTextBlock[];
};

function isHeadingBlock(block: PortableTextBlock): boolean {
  return (
    block._type === "block" &&
    typeof block.style === "string" &&
    /^h[2-4]$/.test(block.style)
  );
}
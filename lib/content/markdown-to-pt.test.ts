import { describe, expect, it } from "vitest";
import { serializeMarkdown, validateMarkdownStruct } from "./markdown-to-pt";

const resolveImage = (path: string, alt: string) => ({ _type: "image", asset: { _ref: path }, alt });

describe("validateMarkdownStruct", () => {
  it("flags unbalanced code fences", () => {
    const errors = validateMarkdownStruct("```python\nprint(1)");
    expect(errors.some((e) => /Unbalanced code fence/.test(e))).toBe(true);
  });

  it("allows balanced fences", () => {
    expect(validateMarkdownStruct("```python\nprint(1)\n```")).toEqual([]);
  });

  it("flags relative image paths", () => {
    const errors = validateMarkdownStruct("![x](images/a.png)");
    expect(errors.some((e) => /must be absolute/.test(e))).toBe(true);
  });
});

describe("serializeMarkdown", () => {
  it("emits a heading-shifted h2/h3 for a titled document", () => {
    const { blocks, errors } = serializeMarkdown("# Why I Built It\n\nI wanted to scale.\n\n## Arch\n\nDeep.\n");
    expect(errors).toEqual([]);
    const headings = blocks.filter((b) => b._type === "block" && typeof b.style === "string" && b.style.startsWith("h"));
    expect(headings).toHaveLength(2);
    expect(headings[0].style).toBe("h2");
    expect(headings[1].style).toBe("h3");
  });

  it("emits the heading param as h2 when the body has no heading", () => {
    const { blocks } = serializeMarkdown("Just prose.\n", { heading: "Overview" });
    const headings = blocks.filter((b) => b._type === "block" && typeof b.style === "string" && b.style.startsWith("h"));
    expect(headings).toHaveLength(1);
    expect(headings[0].style).toBe("h2");
  });

  it("maps inline marks (strong, em, code) and links", () => {
    const { blocks } = serializeMarkdown("A **bold**, *em*, `code`, and [link](https://x.dev).\n");
    const paragraphChildren = blocks[0].children as Array<Record<string, unknown>>;
    const marks = paragraphChildren.map((c) => c.marks).flat();
    expect(marks).toContain("strong");
    expect(marks).toContain("code");
  });

  it("maps a mermaid fenced block to documentationMermaidDiagram", () => {
    const { blocks } = serializeMarkdown("```mermaid\ngraph TD\\nA-->B\n```\n");
    expect(blocks.some((b) => b._type === "documentationMermaidDiagram")).toBe(true);
  });

  it("maps a code fenced block to documentationCodeBlock", () => {
    const { blocks } = serializeMarkdown("```python\nx = 1\n```\n");
    const codeBlock = blocks.find((b) => b._type === "documentationCodeBlock");
    expect(codeBlock?.language).toBe("python");
    expect(codeBlock?.code).toContain("x = 1");
  });

  it("maps an image to documentationImage with alt and asset", () => {
    const { blocks, errors } = serializeMarkdown("![Diagram](/repo/arch.png)\n", { resolveImage });
    expect(errors).toEqual([]);
    const img = blocks.find((b) => b._type === "documentationImage");
    expect(img?.alt).toBe("Diagram");
    expect((img?.image as { asset?: { _ref?: string } })?.asset?._ref).toBe("/repo/arch.png");
  });

  it("warns when documentationImage alt is missing", () => {
    const { errors } = serializeMarkdown("![](/repo/x.png)\n", { resolveImage });
    expect(errors.some((e) => /requires alt/.test(e))).toBe(true);
  });

  it("builds a challengeCard from Problem/Solution/Outcome", () => {
    const { blocks, errors } = serializeMarkdown(
      "**Problem:** Slow at scale.\n**Solution:** We sharded.\n**Outcome:** 5x faster.\n"
    );
    expect(errors).toEqual([]);
    const card = blocks.find((b) => b._type === "challengeCard");
    expect(card?.problem).toContain("Slow at scale");
    expect(card?.outcome).toContain("5x faster");
  });

  it("builds faqItem pairs from Q:/A:", () => {
    const { blocks } = serializeMarkdown("**Q:** Cost?\n**A:** ~$0.\n**Q:** Lib?\n**A:** PyTorch.\n");
    const faqs = blocks.filter((b) => b._type === "faqItem");
    expect(faqs).toHaveLength(2);
    expect(faqs[0].question).toBe("Cost?");
    expect(faqs[0].answer).toContain("~$0");
  });

  it("maps a table to documentationTable", () => {
    const { blocks } = serializeMarkdown("| A | B |\n|---|---|\n| 1 | 2 |\n");
    const table = blocks.find((b) => b._type === "documentationTable");
    expect(table?.headers).toEqual(["A", "B"]);
    expect((table?.rows as Array<{ cells: string[] }>)?.[0]?.cells).toEqual(["1", "2"]);
  });

  it("maps a bullet list into listItem blocks", () => {
    const { blocks } = serializeMarkdown("- one\n- two\n");
    const items = blocks.filter((b) => b._type === "block" && b.listItem === "bullet");
    expect(items).toHaveLength(2);
  });

  it("produces stable keys (idempotent)", () => {
    const a = serializeMarkdown("# T\n\nbody.\n");
    const b = serializeMarkdown("# T\n\nbody.\n");
    expect(a.blocks.map((bl) => bl._key)).toEqual(b.blocks.map((bl) => bl._key));
  });
});
import { describe, expect, it } from "vitest";
import { generateHeadingId } from "@/lib/content/headings";
import {
  portableTextToText,
  splitSectionsByHeading,
} from "@/lib/content/portable-text";
import type { ContentBlock } from "@/sanity/types";

const h2 = (text: string, extra: Partial<ContentBlock> = {}): ContentBlock => ({
  _type: "block",
  style: "h2",
  children: [{ _type: "span", text }],
  ...extra,
});

const p = (text: string): ContentBlock => ({
  _type: "block",
  style: "normal",
  children: [{ _type: "span", text }],
});

describe("generateHeadingId", () => {
  it("slugifies the canonical legacy anchor names", () => {
    expect(generateHeadingId("Why I Built It")).toBe("why-i-built-it");
    expect(generateHeadingId("Engineering Decisions")).toBe(
      "engineering-decisions"
    );
    expect(generateHeadingId("Future Improvements")).toBe("future-improvements");
    expect(generateHeadingId("Example Inputs / Outputs")).toBe(
      "example-inputs-outputs"
    );
  });

  it("falls back to 'section' for heading-only-punctuation input", () => {
    expect(generateHeadingId("!!!")).toBe("section");
  });

  it("appends the 8-char key suffix in keyed mode", () => {
    expect(generateHeadingId("FAQ", { key: "abc1234567" })).toBe("faq-abc12345");
  });

  it("deduplicates identical headings via the used map", () => {
    const used = new Map<string, number>();
    expect(generateHeadingId("Overview", { used })).toBe("overview");
    expect(generateHeadingId("Overview", { used })).toBe("overview-2");
  });
});

describe("splitSectionsByHeading", () => {
  it("splits a PT array into heading-derived sections with anchors", () => {
    const sections = splitSectionsByHeading([
      h2("Engineering Decisions"),
      p("We chose X."),
      h2("Results"),
      p("It improved."),
    ]);

    expect(sections.map((s) => s.heading)).toEqual([
      "Engineering Decisions",
      "Results",
    ]);
    expect(sections[0].id).toBe("engineering-decisions");
    expect(sections[1].id).toBe("results");
    expect(sections[0].text).toContain("We chose X.");
  });

  it("renders heading-free content under an empty heading", () => {
    const sections = splitSectionsByHeading([p("Lead prose.")]);
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe("");
    expect(sections[0].text).toBe("Lead prose.");
  });

  it("lets an explicit anchor win over the slugified fallback", () => {
    const sections = splitSectionsByHeading([
      h2("Engineering Decisions", { _key: "k1", anchor: "custom-anchor" }),
      p("We chose X."),
    ]);
    expect(sections).toHaveLength(1);
    expect(sections[0].id).toBe("custom-anchor");
    expect(sections[0].heading).toBe("Engineering Decisions");
  });

  it("keeps fallback ids unchanged and dedupes via used map", () => {
    const sections = splitSectionsByHeading([
      h2("Overview"),
      p("One."),
      h2("Overview"),
      p("Two."),
    ]);
    expect(sections.map((s) => s.id)).toEqual(["overview", "overview-2"]);
  });
});

describe("portableTextToText", () => {
  it("flattens heading and prose into text", () => {
    const text = portableTextToText([h2("Results"), p("Improved.")]);
    expect(text).toContain("Results");
    expect(text).toContain("Improved.");
  });
});
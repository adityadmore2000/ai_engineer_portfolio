import { describe, expect, it } from "vitest";
import { generateHeadingId } from "@/lib/content/headings";
import {
  portableTextToText,
  splitSectionsByHeading,
} from "@/lib/content/portable-text";

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
      { _type: "block", style: "h2", _key: "k1", children: [{ _type: "span", text: "Engineering Decisions" }] },
      { _type: "block", style: "normal", children: [{ _type: "span", text: "We chose X." }] },
      { _type: "block", style: "h2", children: [{ _type: "span", text: "Results" }] },
      { _type: "block", style: "normal", children: [{ _type: "span", text: "It improved." }] },
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
    const sections = splitSectionsByHeading([
      { _type: "block", style: "normal", children: [{ _type: "span", text: "Lead prose." }] },
    ]);
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe("");
    expect(sections[0].text).toBe("Lead prose.");
  });
});

describe("portableTextToText", () => {
  it("flattens heading and prose into text", () => {
    const text = portableTextToText([
      { _type: "block", style: "h2", children: [{ _type: "span", text: "Results" }] },
      { _type: "block", style: "normal", children: [{ _type: "span", text: "Improved." }] },
    ]);
    expect(text).toContain("Results");
    expect(text).toContain("Improved.");
  });
});
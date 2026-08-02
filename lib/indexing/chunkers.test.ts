import { describe, expect, it } from "vitest";
import { chunkProject } from "./chunkers";
import type { SanityProject } from "./types";

describe("chunkProject", () => {
  it("derives content sections by heading with shared anchors", () => {
    const project: SanityProject = {
      ...PROJECT_CONTENT,
      content: [
        { _type: "block", _key: "a", style: "h2", children: [{ _type: "span", text: "Why I Built It" }] },
        { _type: "block", _key: "b", style: "normal", children: [{ _type: "span", text: "I wanted speed." }] },
        { _type: "block", _key: "c", style: "h2", children: [{ _type: "span", text: "Results" }] },
        { _type: "block", _key: "d", style: "normal", children: [{ _type: "span", text: "Cut errors by 40%." }] },
      ],
    };

    const docs = chunkProject(project, "https://example.com");

    const urls = docs.map((d) => d.metadata.url);
    expect(urls).toContain("https://example.com/projects/warehouse-monitor#why-i-built-it");
    expect(urls).toContain("https://example.com/projects/warehouse-monitor#results");

    const sections = docs.map((d) => d.metadata.section);
    expect(sections).toContain("Why I Built It");
    expect(sections).toContain("Results");
  });

  it("keeps metadata-derived short summary, technologies and key metrics chunks", () => {
    const docs = chunkProject(PROJECT_BASE, "https://example.com");

    const sections = docs.map((d) => d.metadata.section);
    expect(sections).toContain("Short Summary");
    expect(sections).toContain("Technologies");
    expect(sections).toContain("Key Metrics");
  });

  it("emits no content sections for a metadata-only project", () => {
    const docs = chunkProject(PROJECT_BASE, "https://example.com");
    const contentSections = docs.filter((d) =>
      ["Short Summary", "Technologies", "Key Metrics"].includes(String(d.metadata.section))
    );
    expect(contentSections.length).toBe(3);
  });
});

const PROJECT_CONTENT: SanityProject = {
  _id: "p1",
  title: "Warehouse Monitor",
  slug: "warehouse-monitor",
  shortSummary: "Watches parcels in real time.",
  status: "completed",
  technologies: ["Python", "OpenCV"],
  keyMetrics: ["2ms latency"],
  content: [],
};

const PROJECT_BASE: SanityProject = { ...PROJECT_CONTENT };
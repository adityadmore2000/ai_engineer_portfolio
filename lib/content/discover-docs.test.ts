import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { discoverDocs, DocDiscoveryError } from "./discover-docs";

function makeTmpDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "discover-"));
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(dir, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return dir;
}

describe("discoverDocs", () => {
  it("orders by front-matter order, falling back to filename", () => {
    const dir = makeTmpDir({
      "b.md": "# B",
      "a.md": "---\ntitle: A\norder: 0\n---\ncontent a",
      "c.md": "---\norder: 1\n---\ncontent c",
    });

    const docs = discoverDocs(dir);
    expect(docs.map((d) => d.heading)).toEqual(["A", "C", "B"]);
    expect(docs[0].order).toBe(0);
    expect(docs[0].raw).toBe("content a");
  });

  it("derives heading from first markdown heading fallback to filename", () => {
    const dir = makeTmpDir({
      "results.md": "## Results\n\ndone.",
    });
    const docs = discoverDocs(dir);
    expect(docs[0].heading).toBe("Results");
  });

  it("reads recursive .md files", () => {
    const dir = makeTmpDir({
      "sub/overview.md": "# Overview",
      "overview.md": "# Root",
    });
    const docs = discoverDocs(dir);
    expect(docs.length).toBe(2);
  });

  it("rejects malformed front matter loudly", () => {
    const dir = makeTmpDir({
      "bad.md": "---\ntitle: [unclosed\n---\nbody",
    });
    expect(() => discoverDocs(dir)).toThrow(DocDiscoveryError);
  });

  it("enforces per-file size caps", () => {
    const dir = makeTmpDir({
      "big.md": `# T\n\n${"x".repeat(100)}`,
    });
    expect(() => discoverDocs(dir, { maxFileChars: 50 })).toThrow(/exceeds maxFileChars/);
  });

  it("skips README.md and dotfiles", () => {
    const dir = makeTmpDir({
      "README.md": "# Readme",
      ".hidden.md": "# hidden",
      "docs.md": "# Real",
    });
    const docs = discoverDocs(dir);
    expect(docs.length).toBe(1);
    expect(docs[0].heading).toBe("Real");
  });
});
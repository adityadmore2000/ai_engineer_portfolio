import { describe, expect, it, vi } from "vitest";
import {
  publishSpec,
  type PublishSpecDeps,
  type PublishSpecInput,
} from "./publish-spec";

function makeDeps(): {
  createProject: ReturnType<typeof vi.fn>;
  updateProject: ReturnType<typeof vi.fn>;
  findProjectId: ReturnType<typeof vi.fn>;
  patchContent: ReturnType<typeof vi.fn>;
  resolveImage: ReturnType<typeof vi.fn>;
} & PublishSpecDeps {
  return {
    createProject: vi.fn().mockResolvedValue(undefined),
    updateProject: vi.fn().mockResolvedValue(undefined),
    findProjectId: vi.fn().mockResolvedValue("proj-123"),
    patchContent: vi.fn().mockResolvedValue(undefined),
    resolveImage: vi.fn((imagePath: string) => ({ _ref: imagePath })),
  };
}

function baseInput(): PublishSpecInput {
  return {
    mode: "create",
    specBody: "## Overview {#overview}\n\nHello",
    payload: { title: "Demo Project", slug: "demo-project" },
    slug: undefined,
    markdownDir: "/tmp/specs",
  };
}

describe("publishSpec (core publish-project-spec logic)", () => {
  it("create mode: writes metadata via createProject, then REPLACEs content", async () => {
    const deps = makeDeps();
    const result = await publishSpec(baseInput(), deps);

    expect(deps.createProject).toHaveBeenCalledTimes(1);
    expect(deps.createProject).toHaveBeenCalledWith(
      { title: "Demo Project", slug: "demo-project" },
      "/tmp/specs"
    );
    expect(deps.updateProject).not.toHaveBeenCalled();

    expect(deps.findProjectId).toHaveBeenCalledWith("demo-project");
    expect(deps.patchContent).toHaveBeenCalledTimes(1);
    const [projectId, blocks] = deps.patchContent.mock.calls[0];
    expect(projectId).toBe("proj-123");
    expect(Array.isArray(blocks)).toBe(true);
    expect(blocks.length).toBeGreaterThan(0);

    // The `{#overview}` marker survives serialization as the published anchor.
    const heading = blocks.find((b: { style?: string }) => b.style === "h2");
    expect(heading).toBeDefined();
    expect(heading.anchor).toBe("overview");

    expect(result.contentPatched).toBe(true);
    expect(result.contentBlocks).toBeGreaterThan(0);
    expect(result.errors).toEqual([]);
  });

  it("update mode: writes metadata via updateProject with the slug", async () => {
    const deps = makeDeps();
    const result = await publishSpec(
      { ...baseInput(), mode: "update", slug: "demo-project", payload: { title: "Demo Project (updated)" } },
      deps
    );

    expect(deps.updateProject).toHaveBeenCalledTimes(1);
    expect(deps.updateProject).toHaveBeenCalledWith(
      "demo-project",
      { title: "Demo Project (updated)" },
      "/tmp/specs"
    );
    expect(deps.createProject).not.toHaveBeenCalled();
    expect(deps.findProjectId).toHaveBeenCalledWith("demo-project");
    expect(deps.patchContent).toHaveBeenCalledTimes(1);
    expect(result.contentPatched).toBe(true);
  });

  it("empty body: metadata written; content patch skipped (empty-body rule)", async () => {
    const deps = makeDeps();
    const result = await publishSpec({ ...baseInput(), specBody: "" }, deps);

    expect(deps.createProject).toHaveBeenCalledTimes(1);
    expect(deps.findProjectId).not.toHaveBeenCalled();
    expect(deps.patchContent).not.toHaveBeenCalled();
    expect(result.contentPatched).toBe(false);
    expect(result.contentBlocks).toBe(0);
  });

  it("serializer errors abort before ANY write (dry-run guarantee)", async () => {
    const deps = makeDeps();
    const result = await publishSpec(
      { ...baseInput(), specBody: "```\nunclosed fence\n" },
      deps
    );

    expect(result.errors.length).toBeGreaterThan(0);
    expect(deps.createProject).not.toHaveBeenCalled();
    expect(deps.updateProject).not.toHaveBeenCalled();
    expect(deps.patchContent).not.toHaveBeenCalled();
  });

  it("dryRun (`--check`): serializes only, writes nothing", async () => {
    const deps = makeDeps();
    const result = await publishSpec({ ...baseInput(), dryRun: true }, deps);

    expect(result.errors).toEqual([]);
    expect(result.contentBlocks).toBeGreaterThan(0);
    expect(result.contentPatched).toBe(false);
    expect(deps.createProject).not.toHaveBeenCalled();
    expect(deps.updateProject).not.toHaveBeenCalled();
    expect(deps.patchContent).not.toHaveBeenCalled();
  });
});
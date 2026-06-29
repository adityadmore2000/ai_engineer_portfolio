import type { PortableTextBlock } from "next-sanity";
import type { Folder, Item, Node, Root } from "fumadocs-core/page-tree";
import type { TOCItemType } from "fumadocs-core/toc";
import type {
  ProjectDocumentationPage,
  ProjectSummary
} from "@/sanity/types";

type ResolvedDocumentationPage = ProjectDocumentationPage & {
  path: string;
  url: string;
};

export type ProjectDocsSource = {
  tree: Root;
  page: ResolvedDocumentationPage | null;
  pages: ResolvedDocumentationPage[];
  toc: TOCItemType[];
  headingIdByBlockKey: Record<string, string>;
  previous?: Item;
  next?: Item;
  isAmbiguousPath: boolean;
};

type PageRecord = ProjectDocumentationPage & {
  id: string;
  parentId?: string;
};

type ResolutionResult =
  | { status: "resolved"; path: string; segments: string[] }
  | { status: "invalid" };

export function createProjectDocsSource({
  project,
  pages,
  docSlug
}: {
  project: ProjectSummary;
  pages: ProjectDocumentationPage[];
  docSlug: string[];
}): ProjectDocsSource {
  const records = pages
    .filter((page) => belongsToProject(page, project))
    .map(toPageRecord);
  const byId = new Map(records.map((page) => [page.id, page]));
  const resolvedById = new Map<string, ResolvedDocumentationPage>();
  const invalidIds = new Set<string>();

  for (const page of records) {
    const resolution = resolvePath(page, byId);

    if (resolution.status === "invalid") {
      invalidIds.add(page.id);
      continue;
    }

    resolvedById.set(page.id, {
      ...page,
      path: resolution.path,
      url: `/projects/${project.slug}/${resolution.path}`
    });
  }

  const pathCounts = new Map<string, number>();
  for (const page of resolvedById.values()) {
    pathCounts.set(page.path, (pathCounts.get(page.path) || 0) + 1);
  }

  const duplicatePaths = new Set(
    [...pathCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([path]) => path)
  );
  const requestedPath = normalizeSegments(docSlug).join("/");
  const isAmbiguousPath = duplicatePaths.has(requestedPath);
  const validPages = [...resolvedById.values()].filter(
    (page) => !invalidIds.has(page._id) && !duplicatePaths.has(page.path)
  );
  const page =
    validPages.find((candidate) => candidate.path === requestedPath) || null;
  const tree = buildPageTree(project, validPages);
  const flatItems = flattenItems(tree.children);
  const currentItem = page
    ? flatItems.find((item) => item.url === page.url)
    : undefined;
  const currentIndex = currentItem ? flatItems.indexOf(currentItem) : -1;
  const { toc, headingIdByBlockKey } = createToc(page?.body || []);

  return {
    tree,
    page,
    pages: validPages,
    toc,
    headingIdByBlockKey,
    previous: currentIndex > 0 ? flatItems[currentIndex - 1] : undefined,
    next:
      currentIndex >= 0 && currentIndex < flatItems.length - 1
        ? flatItems[currentIndex + 1]
        : undefined,
    isAmbiguousPath
  };
}

export function getFirstDocumentationPage(source: ProjectDocsSource) {
  return source.pages
    .filter(
      (page) =>
        page.showInNavigation !== false &&
        page.showInExploreMore !== false &&
        !page.parentPage?._id
    )
    .sort(comparePages)[0] || source.pages
    .filter(
      (page) => page.showInNavigation !== false && page.showInExploreMore !== false
    )
    .sort(comparePages)[0] || null;
}

function toPageRecord(page: ProjectDocumentationPage): PageRecord {
  return {
    ...page,
    id: normalizeId(page._id),
    parentId: page.parentPage?._id
      ? normalizeId(page.parentPage._id)
      : undefined
  };
}

function belongsToProject(
  page: ProjectDocumentationPage,
  project: ProjectSummary
) {
  return (
    page.project?.slug === project.slug ||
    (page.projectRef
      ? normalizeId(page.projectRef) === normalizeId(project._id)
      : false)
  );
}

function resolvePath(
  page: PageRecord,
  byId: Map<string, PageRecord>
): ResolutionResult {
  const chain: PageRecord[] = [];
  const seen = new Set<string>();
  let current: PageRecord | undefined = page;

  while (current) {
    if (!current.slug) {
      return { status: "invalid" };
    }

    if (seen.has(current.id)) {
      return { status: "invalid" };
    }

    seen.add(current.id);
    chain.unshift(current);

    if (!current.parentId) {
      break;
    }

    current = byId.get(current.parentId);

    if (!current) {
      return { status: "invalid" };
    }
  }

  const segments = chain.map((item) => item.slug).filter(Boolean) as string[];

  return {
    status: "resolved",
    path: segments.join("/"),
    segments
  };
}

function buildPageTree(
  project: ProjectSummary,
  pages: ResolvedDocumentationPage[]
): Root {
  const visiblePages = pages
    .filter((page) => page.showInNavigation !== false)
    .sort(comparePages);
  const byId = new Map(visiblePages.map((page) => [normalizeId(page._id), page]));
  const childrenByParentId = new Map<string, ResolvedDocumentationPage[]>();
  const rootPages: ResolvedDocumentationPage[] = [];

  for (const page of visiblePages) {
    const parentId = page.parentPage?._id
      ? normalizeId(page.parentPage._id)
      : undefined;
    const visibleParentId = parentId ? findVisibleParentId(parentId, byId) : null;

    if (visibleParentId) {
      const children = childrenByParentId.get(visibleParentId) || [];
      children.push(page);
      childrenByParentId.set(visibleParentId, children);
    } else {
      rootPages.push(page);
    }
  }

  return {
    name: project.title,
    children: rootPages.sort(comparePages).map((page) =>
      toTreeNode(page, childrenByParentId)
    )
  };
}

function findVisibleParentId(
  parentId: string,
  byId: Map<string, ResolvedDocumentationPage>
) {
  return byId.has(parentId) ? parentId : null;
}

function toTreeNode(
  page: ResolvedDocumentationPage,
  childrenByParentId: Map<string, ResolvedDocumentationPage[]>
): Node {
  const item: Item = {
    type: "page",
    name: page.title,
    url: page.url,
    description: page.description
  };
  const children = (childrenByParentId.get(normalizeId(page._id)) || [])
    .sort(comparePages)
    .map((child) => toTreeNode(child, childrenByParentId));

  if (!children.length) {
    return item;
  }

  return {
    type: "folder",
    name: page.title,
    index: item,
    defaultOpen: true,
    children
  } satisfies Folder;
}

function flattenItems(nodes: Node[]): Item[] {
  return nodes.flatMap((node) => {
    if (node.type === "page") {
      return [node];
    }

    if (node.type === "folder") {
      return [node.index, ...flattenItems(node.children)].filter(Boolean) as Item[];
    }

    return [];
  });
}

export function createToc(blocks: PortableTextBlock[]) {
  const usedIds = new Map<string, number>();
  const headingIdByBlockKey: Record<string, string> = {};
  const toc: TOCItemType[] = [];

  for (const block of blocks) {
    if (!isHeadingBlock(block)) {
      continue;
    }

    const title = block.children
      ?.map((child) => ("text" in child ? child.text : ""))
      .join("")
      .trim();

    if (!title) {
      continue;
    }

    const baseId = slugify(title) || "section";
    const stableSuffix = block._key ? `-${block._key.slice(0, 8)}` : "";
    const preferredId = `${baseId}${stableSuffix}`;
    const count = usedIds.get(preferredId) || 0;
    const id = count ? `${preferredId}-${count + 1}` : preferredId;

    usedIds.set(preferredId, count + 1);

    if (block._key) {
      headingIdByBlockKey[block._key] = id;
    }

    toc.push({
      title,
      url: `#${id}`,
      depth: getHeadingDepth(block)
    });
  }

  return { toc, headingIdByBlockKey };
}

function isHeadingBlock(block: PortableTextBlock) {
  return (
    block._type === "block" &&
    typeof block.style === "string" &&
    /^h[2-4]$/.test(block.style)
  );
}

function getHeadingDepth(block: PortableTextBlock) {
  return typeof block.style === "string" ? Number(block.style.slice(1)) : 2;
}

function normalizeSegments(segments: string[]) {
  return segments.map((segment) => segment.trim()).filter(Boolean);
}

function normalizeId(id: string) {
  return id.replace(/^drafts\./, "");
}

function comparePages(
  first: Pick<ProjectDocumentationPage, "order" | "title">,
  second: Pick<ProjectDocumentationPage, "order" | "title">
) {
  const firstOrder = first.order ?? 0;
  const secondOrder = second.order ?? 0;

  if (firstOrder !== secondOrder) {
    return firstOrder - secondOrder;
  }

  return first.title.localeCompare(second.title);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

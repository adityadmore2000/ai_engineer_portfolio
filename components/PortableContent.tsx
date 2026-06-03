import { PortableText } from "@portabletext/react";
import type { PortableTextComponents } from "@portabletext/react";
import type { PortableTextBlock } from "next-sanity";
import { documentationPortableTextComponents } from "./DocumentationBlocks";

export function PortableContent({
  value,
  components
}: {
  value: PortableTextBlock[];
  components?: PortableTextComponents;
}) {
  const mergedComponents = mergePortableTextComponents(
    documentationPortableTextComponents,
    components
  );

  return (
    <div className="prose-content mt-6">
      <PortableText value={value} components={mergedComponents} />
    </div>
  );
}

function mergePortableTextComponents(
  base: PortableTextComponents,
  override?: PortableTextComponents
): PortableTextComponents {
  if (!override) {
    return base;
  }

  return {
    ...base,
    ...override,
    marks: {
      ...base.marks,
      ...override.marks
    },
    types: {
      ...base.types,
      ...override.types
    }
  };
}

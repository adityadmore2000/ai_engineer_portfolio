import { PortableText } from "@portabletext/react";
import type { PortableTextComponents } from "@portabletext/react";
import type { PortableTextBlock } from "next-sanity";

export function PortableContent({
  value,
  components
}: {
  value: PortableTextBlock[];
  components?: PortableTextComponents;
}) {
  return (
    <div className="prose-content mt-6">
      <PortableText value={value} components={components} />
    </div>
  );
}

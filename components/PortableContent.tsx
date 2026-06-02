import { PortableText } from "@portabletext/react";
import type { PortableTextBlock } from "next-sanity";

export function PortableContent({ value }: { value: PortableTextBlock[] }) {
  return (
    <div className="prose-content mt-6">
      <PortableText value={value} />
    </div>
  );
}

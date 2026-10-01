import { defineField, defineType } from "sanity";
import { Sparkles } from "lucide-react";

export const capability = defineType({
  name: "capability",
  title: "Capability",
  type: "document",
  icon: Sparkles,
  fields: [
    defineField({ name: "title", title: "Title", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "shortDescription", title: "Short Description", type: "text", rows: 3, validation: (Rule) => Rule.required() }),
    defineField({ name: "details", title: "Expanded Details", type: "markdown" }),
    defineField({ name: "useCases", title: "Problems / Use Cases", type: "array", of: [{ type: "string" }] }),
    defineField({ name: "displayOrder", title: "Display Order", type: "number", validation: (Rule) => Rule.integer().min(0) }),
    defineField({ name: "published", title: "Published", type: "boolean", initialValue: true })
  ],
  orderings: [{ title: "Display Order", name: "displayOrderAsc", by: [{ field: "displayOrder", direction: "asc" }] }],
  preview: { select: { title: "title", subtitle: "shortDescription" } }
});

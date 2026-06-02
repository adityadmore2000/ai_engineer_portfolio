import { defineField, defineType } from "sanity";
import { Layers3 } from "lucide-react";

export const skillCategory = defineType({
  name: "skillCategory",
  title: "Skill Categories",
  type: "document",
  icon: Layers3,
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "skills",
      title: "Skills",
      type: "array",
      of: [{ type: "string" }]
    }),
    defineField({
      name: "displayOrder",
      title: "Display Order",
      type: "number",
      validation: (Rule) => Rule.integer().min(0)
    })
  ],
  orderings: [
    {
      title: "Display Order",
      name: "displayOrderAsc",
      by: [{ field: "displayOrder", direction: "asc" }]
    }
  ],
  preview: {
    select: {
      title: "title"
    }
  }
});

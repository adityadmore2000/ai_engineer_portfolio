import { defineField, defineType } from "sanity";
import { HelpCircle } from "lucide-react";

export const faqItem = defineType({
  name: "faqItem",
  title: "FAQ Items",
  type: "document",
  icon: HelpCircle,
  fields: [
    defineField({
      name: "question",
      title: "Question",
      type: "string",
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "answer",
      title: "Answer",
      type: "markdown"
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
      title: "question"
    }
  }
});

import { defineField, defineType } from "sanity";
import { ListOrdered } from "lucide-react";

export const workingProcess = defineType({
  name: "workingProcess",
  title: "Working Process",
  type: "document",
  icon: ListOrdered,
  fields: [
    defineField({
      name: "title",
      title: "Step Title",
      type: "string",
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "markdown"
    }),
    defineField({
      name: "stepNumber",
      title: "Step Number",
      type: "number",
      validation: (Rule) => Rule.required().integer().min(1)
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
      title: "Step Number",
      name: "stepNumberAsc",
      by: [{ field: "stepNumber", direction: "asc" }]
    }
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "stepNumber"
    },
    prepare({ title, subtitle }) {
      return { title, subtitle: `Step ${subtitle}` };
    }
  }
});

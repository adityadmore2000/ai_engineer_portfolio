import { defineField, defineType } from "sanity";
import { FolderKanban } from "lucide-react";
import { urlRule } from "./validation";

export const project = defineType({
  name: "project",
  title: "Projects",
  type: "document",
  icon: FolderKanban,
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: {
        source: "title",
        maxLength: 96
      },
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "shortSummary",
      title: "Short Summary",
      type: "markdown"
    }),
    defineField({
      name: "coverImage",
      title: "Cover Image",
      type: "image",
      options: { hotspot: true },
      fields: [
        defineField({
          name: "alt",
          title: "Alt Text",
          type: "string"
        })
      ]
    }),
    defineField({
      name: "technologies",
      title: "Technology Tags",
      type: "array",
      of: [{ type: "string" }]
    }),
    defineField({
      name: "keyMetrics",
      title: "Key Metrics or Outcomes",
      type: "array",
      of: [{ type: "string" }]
    }),
    defineField({
      name: "githubUrl",
      title: "GitHub URL",
      type: "url",
      validation: urlRule
    }),
    defineField({
      name: "demoUrl",
      title: "Demo URL",
      type: "url",
      validation: urlRule
    }),
    defineField({
      name: "featured",
      title: "Featured",
      type: "boolean",
      initialValue: true
    }),
    defineField({
      name: "displayOrder",
      title: "Display Order",
      type: "number",
      validation: (Rule) => Rule.integer().min(0)
    }),
    defineField({
      name: "problemStatement",
      title: "Problem Statement",
      type: "markdown"
    }),
    defineField({
      name: "approach",
      title: "Approach",
      type: "markdown"
    }),
    defineField({
      name: "results",
      title: "Results",
      type: "markdown"
    }),
    defineField({
      name: "architectureImage",
      title: "Architecture Image",
      type: "image",
      options: { hotspot: true },
      fields: [
        defineField({
          name: "alt",
          title: "Alt Text",
          type: "string"
        })
      ]
    }),
    defineField({
      name: "screenshots",
      title: "Screenshots",
      type: "array",
      of: [
        {
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({
              name: "alt",
              title: "Alt Text",
              type: "string"
            })
          ]
        }
      ]
    }),
    defineField({
      name: "limitations",
      title: "Limitations",
      type: "markdown"
    }),
    defineField({
      name: "futureImprovements",
      title: "Future Improvements",
      type: "markdown"
    }),
    defineField({
      name: "detailedContent",
      title: "Detailed Rich Text Content",
      type: "array",
      of: [{ type: "block" }]
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
      title: "title",
      subtitle: "shortSummary",
      media: "coverImage"
    }
  }
});

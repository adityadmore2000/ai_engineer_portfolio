import { defineField, defineType } from "sanity";
import { FolderKanban } from "lucide-react";
import { urlRule } from "./validation";
import { projectContentBlockOf } from "./documentationBlocks";

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
      title: "One-Line Summary",
      type: "markdown"
    }),
    defineField({
      name: "status",
      title: "Status",
      type: "string",
      options: {
        list: [
          { title: "Active", value: "active" },
          { title: "Completed", value: "completed" },
          { title: "Archived", value: "archived" },
          { title: "Proof of Concept", value: "poc" },
          { title: "In Development", value: "in-development" }
        ]
      }
    }),
    defineField({
      name: "technologies",
      title: "Technology Tags",
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
      name: "keyMetrics",
      title: "Key Metrics or Outcomes",
      type: "array",
      of: [{ type: "string" }]
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
      name: "demoVideo",
      title: "Demo Video URL",
      type: "url",
      validation: urlRule,
      description: "Link to a demo video walkthrough."
    }),
    defineField({
      name: "beforeAfterComparisons",
      title: "Before / After Comparisons",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            defineField({
              name: "beforeImage",
              type: "image",
              title: "Before Image",
              options: { hotspot: true },
              fields: [defineField({ name: "alt", type: "string", title: "Alt Text" })]
            }),
            defineField({
              name: "afterImage",
              type: "image",
              title: "After Image",
              options: { hotspot: true },
              fields: [defineField({ name: "alt", type: "string", title: "Alt Text" })]
            }),
            defineField({ name: "caption", type: "string", title: "Caption" })
          ]
        }
      ]
    }),
    defineField({
      name: "content",
      title: "Content",
      type: "array",
      description:
        "Published representation of the project narrative, derived from the Markdown docs/ source. Do not edit here; edit the Markdown in the repository and re-publish.",
      of: projectContentBlockOf,
      validation: (Rule) => Rule.min(1)
    }),
    defineField({
      name: "published",
      title: "Published",
      type: "boolean",
      initialValue: true,
      description: "When unchecked, the project is hidden from the public site."
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
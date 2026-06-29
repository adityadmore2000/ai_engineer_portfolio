import { defineField, defineType } from "sanity";
import { NotebookText } from "lucide-react";

export const technicalNote = defineType({
  name: "technicalNote",
  title: "Technical Notes",
  type: "document",
  icon: NotebookText,
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
      validation: (Rule) =>
        Rule.custom((slug, context) => {
          const publishedDate = context.document?.publishedDate;
          if (publishedDate && !slug?.current) {
            return "Published technical notes require a slug.";
          }
          return true;
        })
    }),
    defineField({
      name: "shortSummary",
      title: "Short Summary",
      type: "markdown"
    }),
    defineField({
      name: "content",
      title: "Content",
      type: "array",
      of: [{ type: "block" }]
    }),
    defineField({
      name: "tags",
      title: "Tags",
      type: "array",
      of: [{ type: "string" }]
    }),
    defineField({
      name: "publishedDate",
      title: "Published Date",
      type: "date"
    }),
    defineField({
      name: "featured",
      title: "Featured",
      type: "boolean",
      initialValue: false
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
    })
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "publishedDate",
      media: "coverImage"
    }
  }
});

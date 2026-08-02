import { defineField, defineType } from "sanity";
import { FileText } from "lucide-react";
import { documentationPageBlockOf } from "./documentationBlocks";

type ReferenceValue = {
  _ref?: string;
};

function normalizeDocumentId(id?: string) {
  return id?.replace(/^drafts\./, "");
}

export const projectDocumentationPage = defineType({
  name: "projectDocumentationPage",
  title: "Project Documentation Pages",
  type: "document",
  icon: FileText,
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      description: "Human-readable documentation page title.",
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      description:
        "URL segment for this documentation page. Do not include the project slug.",
      options: {
        source: "title",
        maxLength: 96
      },
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "project",
      title: "Project",
      type: "reference",
      to: [{ type: "project" }],
      description: "Project that owns this documentation page.",
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      rows: 3,
      description: "Optional page summary for navigation, previews, and SEO fallback."
    }),
    defineField({
      name: "body",
      title: "Body",
      type: "array",
      description: "Portable Text body content for the documentation page.",
      of: documentationPageBlockOf,
      validation: (Rule) => Rule.required().min(1)
    }),
    defineField({
      name: "order",
      title: "Order",
      type: "number",
      description: "Sidebar and previous/next ordering within a project.",
      initialValue: 0,
      validation: (Rule) => Rule.required().integer().min(0)
    }),
    defineField({
      name: "showInNavigation",
      title: "Show in Navigation",
      type: "boolean",
      initialValue: true
    }),
    defineField({
      name: "showInExploreMore",
      title: "Show in Explore More",
      type: "boolean",
      initialValue: true
    }),
    defineField({
      name: "statusLabel",
      title: "Status Label",
      type: "string",
      description: "Optional editor-controlled status or roadmap label."
    }),
    defineField({
      name: "parentPage",
      title: "Parent Page",
      type: "reference",
      to: [{ type: "projectDocumentationPage" }],
      description:
        "Optional parent for nested documentation. TODO: validate same-project parent and circular references in the source-adapter phase.",
      validation: (Rule) =>
        Rule.custom((parentPage, context) => {
          const parentId = normalizeDocumentId(
            (parentPage as ReferenceValue | undefined)?._ref
          );
          const documentId = normalizeDocumentId(context.document?._id);

          if (parentId && documentId && parentId === documentId) {
            return "A documentation page cannot reference itself as its parent.";
          }

          return true;
        })
    }),
    defineField({
      name: "seoTitle",
      title: "SEO Title",
      type: "string"
    }),
    defineField({
      name: "seoDescription",
      title: "SEO Description",
      type: "text",
      rows: 3
    }),
    defineField({
      name: "socialImage",
      title: "Social Image",
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
  orderings: [
    {
      title: "Project then Order",
      name: "projectOrderAsc",
      by: [
        { field: "project.title", direction: "asc" },
        { field: "order", direction: "asc" },
        { field: "title", direction: "asc" }
      ]
    }
  ],
  preview: {
    select: {
      title: "title",
      projectTitle: "project.title",
      slug: "slug.current",
      statusLabel: "statusLabel",
      media: "socialImage"
    },
    prepare({ title, projectTitle, slug, statusLabel, media }) {
      const details = [
        projectTitle ? `Project: ${projectTitle}` : "No project selected",
        slug ? `/${slug}` : "No slug",
        statusLabel
      ].filter(Boolean);

      return {
        title,
        subtitle: details.join(" | "),
        media
      };
    }
  }
});

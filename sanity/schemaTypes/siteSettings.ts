import { defineField, defineType } from "sanity";
import { UserRound } from "lucide-react";
import { urlRule } from "./validation";

export const siteSettings = defineType({
  name: "siteSettings",
  title: "Site Settings",
  type: "document",
  icon: UserRound,
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "role",
      title: "Role",
      type: "string"
    }),
    defineField({
      name: "shortBio",
      title: "Short Bio",
      type: "markdown"
    }),
    defineField({
      name: "heroDescription",
      title: "Hero Description",
      type: "markdown"
    }),
    defineField({
      name: "profileImage",
      title: "Profile Image",
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
      name: "email",
      title: "Email",
      type: "email",
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "linkedinUrl",
      title: "LinkedIn URL",
      type: "url",
      validation: urlRule
    }),
    defineField({
      name: "githubUrl",
      title: "GitHub URL",
      type: "url",
      validation: urlRule
    }),
    defineField({
      name: "resumeFile",
      title: "Resume File",
      type: "file",
      options: {
        accept: ".pdf"
      }
    }),
    defineField({
      name: "resumeUrl",
      title: "External Resume URL",
      type: "url",
      validation: urlRule
    }),
    defineField({
      name: "location",
      title: "Location",
      type: "string"
    }),
    defineField({
      name: "availabilityText",
      title: "Availability Text",
      type: "string"
    }),
    defineField({
      name: "heroMetrics",
      title: "Hero Metrics",
      type: "array",
      of: [{ type: "string" }]
    }),
    defineField({
      name: "headerCtaText",
      title: "Header CTA Text",
      type: "string"
    }),
    defineField({
      name: "primaryCtaText",
      title: "Primary CTA Text",
      type: "string"
    }),
    defineField({
      name: "secondaryCtaText",
      title: "Secondary CTA Text",
      type: "string"
    }),
    defineField({
      name: "emailCtaText",
      title: "Email CTA Text",
      type: "string"
    }),
    defineField({
      name: "resumeCtaText",
      title: "Resume CTA Text",
      type: "string"
    }),
    defineField({
      name: "aboutSummary",
      title: "About Summary",
      type: "markdown"
    }),
    defineField({
      name: "focusAreas",
      title: "Focus Areas",
      type: "array",
      of: [{ type: "string" }]
    }),
    defineField({
      name: "contactHeadline",
      title: "Contact Headline",
      type: "string"
    }),
    defineField({
      name: "contactDescription",
      title: "Contact Description",
      type: "markdown"
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
    })
  ],
  preview: {
    select: {
      title: "name",
      subtitle: "role"
    }
  }
});

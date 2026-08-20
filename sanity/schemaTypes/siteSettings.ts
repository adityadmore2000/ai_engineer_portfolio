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
    }),
    defineField({
      name: "maintenanceEnabled",
      title: "Maintenance Mode",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "maintenanceMessage",
      title: "Maintenance Message",
      type: "string",
      initialValue: "Website update in progress — some features may be temporarily unavailable.",
    }),
    defineField({
      name: "criticalLock",
      title: "Critical Site Lock",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "showAiChat",
      title: "Show AI Chat",
      type: "boolean",
      initialValue: true,
      description: "Controls whether the floating AI chat button and ChatProvider are visible on the public website.",
    }),
    defineField({
      name: "introductionVideoUrl",
      title: "Introduction Video URL",
      type: "url",
      description: "YouTube URL for the introduction video shown in the About Me section (e.g. https://youtube.com/watch?v=…)",
      validation: urlRule,
    }),
    defineField({
      name: "calendlyUrl",
      title: "Calendly Booking URL",
      type: "url",
      description: "Your Calendly link for the 'Schedule a Meeting' button (e.g. https://calendly.com/yourname/30min)",
      validation: urlRule,
    }),
  ],
  preview: {
    select: {
      title: "name",
      subtitle: "role"
    }
  }
});

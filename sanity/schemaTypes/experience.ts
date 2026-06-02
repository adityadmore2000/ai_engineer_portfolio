import { defineField, defineType } from "sanity";
import { BriefcaseBusiness } from "lucide-react";

export const experience = defineType({
  name: "experience",
  title: "Experience",
  type: "document",
  icon: BriefcaseBusiness,
  fields: [
    defineField({
      name: "role",
      title: "Role",
      type: "string",
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "company",
      title: "Company",
      type: "string",
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "location",
      title: "Location",
      type: "string"
    }),
    defineField({
      name: "startDate",
      title: "Start Date",
      type: "date"
    }),
    defineField({
      name: "endDate",
      title: "End Date",
      type: "date",
      hidden: ({ parent }) => Boolean(parent?.currentRole)
    }),
    defineField({
      name: "currentRole",
      title: "Current Role",
      type: "boolean",
      initialValue: false
    }),
    defineField({
      name: "shortDescription",
      title: "Short Description",
      type: "text",
      rows: 3
    }),
    defineField({
      name: "bulletPoints",
      title: "Bullet Points",
      type: "array",
      of: [{ type: "string" }]
    }),
    defineField({
      name: "skills",
      title: "Skills or Tags",
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
      title: "role",
      subtitle: "company"
    }
  }
});

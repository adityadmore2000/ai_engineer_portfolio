import { defineArrayMember, defineField, defineType } from "sanity";
import {
  Badge,
  Braces,
  FileCode,
  Image as ImageIcon,
  ListTree,
  Megaphone,
  Table,
  Workflow
} from "lucide-react";

export const documentationCodeBlock = defineType({
  name: "documentationCodeBlock",
  title: "Code Block",
  type: "object",
  icon: FileCode,
  fields: [
    defineField({
      name: "code",
      title: "Code",
      type: "text",
      rows: 12,
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "language",
      title: "Language",
      type: "string"
    }),
    defineField({
      name: "filename",
      title: "Filename",
      type: "string"
    }),
    defineField({
      name: "caption",
      title: "Caption",
      type: "string"
    })
  ],
  preview: {
    select: {
      code: "code",
      language: "language",
      filename: "filename"
    },
    prepare({ code, language, filename }) {
      return {
        title: filename || language || "Code Block",
        subtitle: code ? String(code).slice(0, 80) : "No code yet"
      };
    }
  }
});

export const documentationMermaidDiagram = defineType({
  name: "documentationMermaidDiagram",
  title: "Mermaid Diagram",
  type: "object",
  icon: Workflow,
  fields: [
    defineField({
      name: "chart",
      title: "Chart",
      type: "text",
      rows: 12,
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "caption",
      title: "Caption",
      type: "string"
    }),
    defineField({
      name: "statusLabel",
      title: "Status Label",
      type: "string"
    })
  ],
  preview: {
    select: {
      chart: "chart",
      caption: "caption",
      statusLabel: "statusLabel"
    },
    prepare({ chart, caption, statusLabel }) {
      return {
        title: caption || statusLabel || "Mermaid Diagram",
        subtitle: chart ? String(chart).slice(0, 80) : "No chart yet"
      };
    }
  }
});

export const documentationCallout = defineType({
  name: "documentationCallout",
  title: "Callout",
  type: "object",
  icon: Megaphone,
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string"
    }),
    defineField({
      name: "body",
      title: "Body",
      type: "text",
      rows: 4,
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "variant",
      title: "Variant",
      type: "string",
      initialValue: "info",
      options: {
        list: [
          { title: "Info", value: "info" },
          { title: "Warning", value: "warning" },
          { title: "Success", value: "success" },
          { title: "Limitation", value: "limitation" },
          { title: "Lesson", value: "lesson" },
          { title: "Future", value: "future" }
        ],
        layout: "dropdown"
      },
      validation: (Rule) => Rule.required()
    })
  ],
  preview: {
    select: {
      title: "title",
      body: "body",
      variant: "variant"
    },
    prepare({ title, body, variant }) {
      return {
        title: title || "Callout",
        subtitle: [variant, body ? String(body).slice(0, 70) : undefined]
          .filter(Boolean)
          .join(" | ")
      };
    }
  }
});

export const documentationTable = defineType({
  name: "documentationTable",
  title: "Table",
  type: "object",
  icon: Table,
  fields: [
    defineField({
      name: "caption",
      title: "Caption",
      type: "string"
    }),
    defineField({
      name: "headers",
      title: "Headers",
      type: "array",
      of: [defineArrayMember({ type: "string" })]
    }),
    defineField({
      name: "rows",
      title: "Rows",
      type: "array",
      of: [
        defineArrayMember({
          name: "documentationTableRow",
          title: "Table Row",
          type: "object",
          fields: [
            defineField({
              name: "cells",
              title: "Cells",
              type: "array",
              of: [defineArrayMember({ type: "string" })]
            })
          ],
          preview: {
            select: {
              cells: "cells"
            },
            prepare({ cells }) {
              return {
                title: Array.isArray(cells) && cells.length
                  ? cells.join(" | ")
                  : "Table Row"
              };
            }
          }
        })
      ]
    })
  ],
  preview: {
    select: {
      caption: "caption",
      headers: "headers",
      rows: "rows"
    },
    prepare({ caption, headers, rows }) {
      const headerCount = Array.isArray(headers) ? headers.length : 0;
      const rowCount = Array.isArray(rows) ? rows.length : 0;

      return {
        title: caption || "Table",
        subtitle: `${headerCount} columns | ${rowCount} rows`
      };
    }
  }
});

export const documentationTimeline = defineType({
  name: "documentationTimeline",
  title: "Timeline",
  type: "object",
  icon: ListTree,
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string"
    }),
    defineField({
      name: "steps",
      title: "Steps",
      type: "array",
      of: [
        defineArrayMember({
          name: "documentationTimelineStep",
          title: "Timeline Step",
          type: "object",
          fields: [
            defineField({
              name: "title",
              title: "Title",
              type: "string",
              validation: (Rule) => Rule.required()
            }),
            defineField({
              name: "description",
              title: "Description",
              type: "text",
              rows: 3
            }),
            defineField({
              name: "statusLabel",
              title: "Status Label",
              type: "string"
            })
          ],
          preview: {
            select: {
              title: "title",
              statusLabel: "statusLabel"
            },
            prepare({ title, statusLabel }) {
              return {
                title: title || "Timeline Step",
                subtitle: statusLabel
              };
            }
          }
        })
      ],
      validation: (Rule) => Rule.required().min(1)
    })
  ],
  preview: {
    select: {
      title: "title",
      steps: "steps"
    },
    prepare({ title, steps }) {
      const count = Array.isArray(steps) ? steps.length : 0;

      return {
        title: title || "Timeline",
        subtitle: `${count} steps`
      };
    }
  }
});

export const documentationBadgeGroup = defineType({
  name: "documentationBadgeGroup",
  title: "Badge Group",
  type: "object",
  icon: Badge,
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string"
    }),
    defineField({
      name: "items",
      title: "Items",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      validation: (Rule) => Rule.required().min(1)
    })
  ],
  preview: {
    select: {
      title: "title",
      items: "items"
    },
    prepare({ title, items }) {
      const count = Array.isArray(items) ? items.length : 0;

      return {
        title: title || "Badge Group",
        subtitle: `${count} badges`
      };
    }
  }
});

export const documentationCTAGroup = defineType({
  name: "documentationCTAGroup",
  title: "CTA Group",
  type: "object",
  icon: Braces,
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string"
    }),
    defineField({
      name: "items",
      title: "Items",
      type: "array",
      of: [
        defineArrayMember({
          name: "documentationCTAItem",
          title: "CTA",
          type: "object",
          fields: [
            defineField({
              name: "label",
              title: "Label",
              type: "string",
              validation: (Rule) => Rule.required()
            }),
            defineField({
              name: "url",
              title: "URL",
              type: "url",
              validation: (Rule) =>
                Rule.required().uri({
                  allowRelative: true,
                  scheme: ["http", "https", "mailto"]
                })
            }),
            defineField({
              name: "style",
              title: "Style",
              type: "string",
              initialValue: "secondary",
              options: {
                list: [
                  { title: "Primary", value: "primary" },
                  { title: "Secondary", value: "secondary" },
                  { title: "Link", value: "link" }
                ],
                layout: "dropdown"
              }
            })
          ],
          preview: {
            select: {
              label: "label",
              url: "url",
              style: "style"
            },
            prepare({ label, url, style }) {
              return {
                title: label || "CTA",
                subtitle: [style, url].filter(Boolean).join(" | ")
              };
            }
          }
        })
      ],
      validation: (Rule) => Rule.required().min(1)
    })
  ],
  preview: {
    select: {
      title: "title",
      items: "items"
    },
    prepare({ title, items }) {
      const count = Array.isArray(items) ? items.length : 0;

      return {
        title: title || "CTA Group",
        subtitle: `${count} links`
      };
    }
  }
});

export const documentationImage = defineType({
  name: "documentationImage",
  title: "Documentation Image",
  type: "object",
  icon: ImageIcon,
  fields: [
    defineField({
      name: "image",
      title: "Image",
      type: "image",
      options: { hotspot: true },
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "alt",
      title: "Alt Text",
      type: "string",
      description: "Describe the image for readers who cannot see it.",
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "caption",
      title: "Caption",
      type: "string"
    })
  ],
  preview: {
    select: {
      title: "alt",
      caption: "caption",
      media: "image"
    },
    prepare({ title, caption, media }) {
      return {
        title: title || "Documentation Image",
        subtitle: caption,
        media
      };
    }
  }
});

export const documentationBlockTypes = [
  documentationCodeBlock,
  documentationMermaidDiagram,
  documentationCallout,
  documentationTable,
  documentationTimeline,
  documentationBadgeGroup,
  documentationCTAGroup,
  documentationImage
];

// ── Shared Portable Text block configuration ──────────────
// The standard `block` member used by both `project.content` and
// `projectDocumentationPage.body`, so the two channels share one definition.

export const portableTextBlockMember = {
  type: "block",
  styles: [
    { title: "Normal", value: "normal" },
    { title: "Heading 2", value: "h2" },
    { title: "Heading 3", value: "h3" },
    { title: "Heading 4", value: "h4" }
  ],
  lists: [
    { title: "Bullet", value: "bullet" },
    { title: "Number", value: "number" }
  ],
  marks: {
    decorators: [
      { title: "Strong", value: "strong" },
      { title: "Emphasis", value: "em" },
      { title: "Underline", value: "underline" },
      { title: "Code", value: "code" }
    ],
    annotations: [
      {
        name: "link",
        title: "Link",
        type: "object",
        fields: [
          defineField({
            name: "href",
            title: "URL",
            type: "url",
            validation: (Rule) =>
              Rule.uri({ scheme: ["http", "https", "mailto"] })
          })
        ]
      }
    ]
  }
};

/** `of` member list for `project.content` — the shared block plus every
 * reusable documentation block plus the FAQ/challenge cards. */
export const projectContentBlockOf = [
  portableTextBlockMember,
  { type: "documentationCodeBlock" },
  { type: "documentationMermaidDiagram" },
  { type: "documentationCallout" },
  { type: "documentationTable" },
  { type: "documentationTimeline" },
  { type: "documentationBadgeGroup" },
  { type: "documentationCTAGroup" },
  { type: "documentationImage" },
  { type: "faqItem" },
  { type: "challengeCard" }
];

/** `of` member list for `projectDocumentationPage.body` (deep-dive pages). */
export const documentationPageBlockOf = [
  portableTextBlockMember,
  { type: "documentationCodeBlock" },
  { type: "documentationMermaidDiagram" },
  { type: "documentationCallout" },
  { type: "documentationTable" },
  { type: "documentationTimeline" },
  { type: "documentationBadgeGroup" },
  { type: "documentationCTAGroup" },
  { type: "documentationImage" }
];

// ── FAQ / challenge cards (thin wrappers over the legacy shapes) ──

export const documentationFaqItem = defineType({
  name: "faqItem",
  title: "FAQ Item",
  type: "object",
  icon: Megaphone,
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
    })
  ],
  preview: {
    select: { question: "question", answer: "answer" },
    prepare({ question, answer }) {
      return {
        title: question || "FAQ Item",
        subtitle: answer ? String(answer).slice(0, 70) : undefined
      };
    }
  }
});

export const documentationChallengeCard = defineType({
  name: "challengeCard",
  title: "Challenge Card",
  type: "object",
  icon: Workflow,
  fields: [
    defineField({
      name: "problem",
      title: "Problem",
      type: "markdown"
    }),
    defineField({
      name: "solution",
      title: "Solution",
      type: "markdown"
    }),
    defineField({
      name: "outcome",
      title: "Outcome",
      type: "markdown"
    })
  ],
  preview: {
    select: { problem: "problem", outcome: "outcome" },
    prepare({ problem, outcome }) {
      return {
        title: problem ? String(problem).slice(0, 70) : "Challenge Card",
        subtitle: outcome ? String(outcome).slice(0, 70) : undefined
      };
    }
  }
});

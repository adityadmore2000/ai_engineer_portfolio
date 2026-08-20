import { defineField, defineType } from "sanity";
import { MessageCircle } from "lucide-react";
import { urlRule } from "./validation";

export const contactSettings = defineType({
  name: "contactSettings",
  title: "Contact Settings",
  type: "document",
  icon: MessageCircle,
  fields: [
    defineField({
      name: "sectionDescription",
      title: "Section Description",
      type: "text",
      rows: 3,
      description: "Text shown beneath the heading in the Contact section on the public site.",
    }),
    defineField({
      name: "modalDescription",
      title: "Modal Description",
      type: "text",
      rows: 4,
      description: "Text shown in the 'Discuss a Project' popup modal.",
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
    prepare() {
      return { title: "Contact Settings" };
    },
  },
});

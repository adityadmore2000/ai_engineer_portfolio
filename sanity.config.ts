"use client";

import { Fragment, createElement } from "react";
import { visionTool } from "@sanity/vision";
import { markdownSchema } from "sanity-plugin-markdown";
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { apiVersion, dataset, projectId } from "./sanity/env";
import { schemaTypes } from "./sanity/schemaTypes";

/**
 * sanity-plugin-markdown's EasyMDE preview only reverts `ul`/`li` from Studio's
 * global list reset (it omits `ol`), so numbered lists render without their
 * numbers in the editor preview. Re-revert ordered lists here.
 */
const markdownPreviewListFix = `
  .editor-preview ol,
  .editor-preview-side ol {
    list-style: revert;
    padding: revert;
  }
`;

export default defineConfig({
  name: "aditya_more_portfolio",
  title: "Aditya More Portfolio",
  projectId: projectId || "replace-with-project-id",
  dataset,
  basePath: "/studio",
  plugins: [
    structureTool(),
    visionTool({ defaultApiVersion: apiVersion }),
    markdownSchema()
  ],
  schema: {
    types: schemaTypes
  },
  studio: {
    components: {
      layout: (props) =>
        createElement(
          Fragment,
          null,
          createElement("style", null, markdownPreviewListFix),
          props.renderDefault(props)
        )
    }
  }
});

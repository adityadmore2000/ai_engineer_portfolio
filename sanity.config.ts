"use client";

import { visionTool } from "@sanity/vision";
import { markdownSchema } from "sanity-plugin-markdown";
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { apiVersion, dataset, projectId } from "./sanity/env";
import { schemaTypes } from "./sanity/schemaTypes";

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
  }
});

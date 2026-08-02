import {
  documentationBlockTypes,
  documentationChallengeCard,
  documentationFaqItem,
} from "./documentationBlocks";
import { experience } from "./experience";
import { project } from "./project";
import { projectDocumentationPage } from "./projectDocumentationPage";
import { siteSettings } from "./siteSettings";
import { skillCategory } from "./skillCategory";
import { technicalNote } from "./technicalNote";

export const schemaTypes = [
  siteSettings,
  experience,
  project,
  projectDocumentationPage,
  ...documentationBlockTypes,
  documentationFaqItem,
  documentationChallengeCard,
  skillCategory,
  technicalNote
];

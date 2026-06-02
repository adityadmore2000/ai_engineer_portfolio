import imageUrlBuilder from "@sanity/image-url";
import { dataset, projectId } from "./env";

const builder = imageUrlBuilder({
  projectId: projectId || "missing-project-id",
  dataset
});

export function urlFor(source: Parameters<typeof builder.image>[0]) {
  return builder.image(source);
}

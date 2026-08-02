import type { SanityClient } from "@sanity/client";
import fs from "node:fs";
import path from "node:path";

export type ImageRef = {
  _type: "image";
  asset: { _type: "reference"; _ref: string };
  alt?: string;
};

/**
 * Upload a local image file to Sanity and return an image asset reference.
 *
 * `baseDir` is the directory against which relative image paths resolve. The
 * resolved file must exist; a missing file logs a warning and returns
 * `undefined` rather than failing the publish.
 */
export async function uploadImage(
  client: Pick<SanityClient, "assets">,
  imagePath: string,
  baseDir: string
): Promise<ImageRef | undefined> {
  const resolved = path.resolve(baseDir, imagePath);

  if (!fs.existsSync(resolved)) {
    console.warn(`  ⚠  Image not found: ${resolved}`);
    return undefined;
  }

  const filename = path.basename(resolved);
  const mimeType =
    filename.endsWith(".png")
      ? "image/png"
      : filename.endsWith(".webp")
        ? "image/webp"
        : filename.endsWith(".jpg") || filename.endsWith(".jpeg")
          ? "image/jpeg"
          : filename.endsWith(".gif")
            ? "image/gif"
            : filename.endsWith(".svg")
              ? "image/svg+xml"
              : "image/png";

  const stream = fs.createReadStream(resolved);
  const asset = await client.assets.upload("image", stream, {
    filename,
    contentType: mimeType,
  });

  return {
    _type: "image" as const,
    asset: {
      _type: "reference" as const,
      _ref: asset._id,
    },
  } as ImageRef;
}
import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { parseBody } from "next-sanity/webhook";

/**
 * On-demand revalidation endpoint for Sanity publish webhooks.
 *
 * Configure a webhook in Sanity (Manage > API > Webhooks) that POSTs to
 * `https://<your-deployment>/api/revalidate` on document publish/update/delete,
 * signed with the secret stored in `SANITY_REVALIDATE_SECRET`.
 *
 * The webhook GROQ projection should at least return the document `_type` and
 * the `slug.current` so we can target the affected paths:
 *   { "_type": _type, "slug": slug.current }
 */

type WebhookPayload = {
  _type?: string;
  slug?: string;
};

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.SANITY_REVALIDATE_SECRET;

    if (!secret) {
      return NextResponse.json(
        { message: "Missing SANITY_REVALIDATE_SECRET." },
        { status: 500 }
      );
    }

    const { isValidSignature, body } = await parseBody<WebhookPayload>(
      request,
      secret
    );

    if (!isValidSignature) {
      return NextResponse.json(
        { message: "Invalid webhook signature." },
        { status: 401 }
      );
    }

    if (!body?._type) {
      return NextResponse.json(
        { message: "Webhook payload is missing `_type`." },
        { status: 400 }
      );
    }

    const revalidated = revalidatePaths(body);

    return NextResponse.json({
      revalidated: true,
      type: body._type,
      paths: revalidated,
      now: Date.now()
    });
  } catch (error) {
    console.error("Revalidate webhook failed", error);
    return NextResponse.json(
      { message: "Revalidation failed." },
      { status: 500 }
    );
  }
}

function revalidatePaths(body: WebhookPayload): string[] {
  const paths = new Set<string>(["/"]);

  switch (body._type) {
    case "project":
      if (body.slug) {
        paths.add(`/projects/${body.slug}`);
      }
      break;
    case "projectDocumentationPage":
      // Documentation pages live under their project; refresh project routes.
      paths.add("/sitemap.xml");
      break;
    case "technicalNote":
      if (body.slug) {
        paths.add(`/notes/${body.slug}`);
      }
      break;
    default:
      break;
  }

  paths.add("/sitemap.xml");

  for (const path of paths) {
    revalidatePath(path);
  }

  return Array.from(paths);
}

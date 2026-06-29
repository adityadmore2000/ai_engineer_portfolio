import { draftMode } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const configuredSecret = process.env.SANITY_PREVIEW_SECRET;
  const providedSecret = searchParams.get("secret");
  const redirectPath = searchParams.get("redirect");

  if (!providedSecret) {
    return NextResponse.json(
      { error: "Missing draft preview secret." },
      { status: 401 }
    );
  }

  if (!configuredSecret) {
    return NextResponse.json(
      { error: "Draft preview is not configured." },
      { status: 500 }
    );
  }

  if (providedSecret !== configuredSecret) {
    return NextResponse.json(
      { error: "Invalid draft preview secret." },
      { status: 401 }
    );
  }

  const safeRedirect = getSafeDocumentationRedirect(redirectPath, origin);

  if (!safeRedirect) {
    return NextResponse.json(
      { error: "Draft preview redirect must be an internal documentation path." },
      { status: 400 }
    );
  }

  const draft = await draftMode();
  draft.enable();

  return NextResponse.redirect(new URL(safeRedirect, origin));
}

function getSafeDocumentationRedirect(value: string | null, origin: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  try {
    const parsed = new URL(value, origin);

    if (parsed.origin !== origin) {
      return null;
    }

    const segments = parsed.pathname.split("/").filter(Boolean);

    if (
      segments.length < 3 ||
      segments[0] !== "projects" ||
      !segments[1] ||
      !segments[2]
    ) {
      return null;
    }

    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

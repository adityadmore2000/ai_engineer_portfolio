import { draftMode } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const redirectPath = getSafeInternalRedirect(
    searchParams.get("redirect"),
    origin
  );
  const draft = await draftMode();

  draft.disable();

  return NextResponse.redirect(new URL(redirectPath, origin));
}

function getSafeInternalRedirect(value: string | null, origin: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  try {
    const parsed = new URL(value, origin);

    if (parsed.origin !== origin) {
      return "/";
    }

    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/";
  }
}

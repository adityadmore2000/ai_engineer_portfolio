export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const SESSION_COOKIE_NAME = '__session';

// Public paths under /admin that don't require an existing session
const PUBLIC_PATHS = ['/admin/login', '/admin/api/auth/session'];

function getAdminAuth() {
  const app =
    getApps().length === 0
      ? initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID!,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
            privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
          }),
        })
      : getApps()[0];
  return getAuth(app);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLoginPage = pathname === '/admin/login';
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    if (isPublic) return NextResponse.next();
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }

  try {
    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    if (!decoded.admin) {
      throw new Error('missing admin claim');
    }
    // Valid admin session: redirect away from login, allow everything else
    if (isLoginPage) {
      return NextResponse.redirect(new URL('/admin', req.url));
    }
    return NextResponse.next();
  } catch {
    // Stale or invalid cookie: clear it
    const destination = isPublic
      ? NextResponse.next()
      : NextResponse.redirect(new URL('/admin/login', req.url));
    // Must specify path:/admin to match the cookie's original path
    destination.cookies.set(SESSION_COOKIE_NAME, '', {
      path: '/admin',
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    return destination;
  }
}

export const config = {
  matcher: ['/admin/:path*'],
};

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

const SESSION_COOKIE_NAME = '__session';
const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const idToken = body?.idToken;

  if (!idToken) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (!decodedToken.admin) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  let sessionCookie;
  try {
    sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }

  const response = NextResponse.json({ status: 'ok' });
  response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/admin',
    maxAge: SESSION_DURATION_MS / 1000,
  });

  return response;
}

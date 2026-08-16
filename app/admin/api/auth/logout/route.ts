import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

const SESSION_COOKIE_NAME = '__session';

export async function POST(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (cookie) {
    try {
      const decoded = await adminAuth.verifySessionCookie(cookie, true);
      await adminAuth.revokeRefreshTokens(decoded.uid);
    } catch {
      // Cookie invalid or expired — clear it regardless
    }
  }

  const response = NextResponse.json({ status: 'ok' });
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/admin',
    maxAge: 0,
  });

  return response;
}

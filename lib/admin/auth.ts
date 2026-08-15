import 'server-only';
import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase/admin';

export async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;

  if (!sessionCookie) {
    throw new Error('Unauthorized');
  }

  let decodedClaims;
  try {
    decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    throw new Error('Unauthorized');
  }

  if (!decodedClaims.admin) {
    throw new Error('Forbidden');
  }
}

import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminAuth } from '@/lib/firebase/admin';

export async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;

  if (!sessionCookie) {
    redirect('/admin/login');
  }

  let decodedClaims;
  try {
    decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    redirect('/admin/login');
  }

  if (!decodedClaims.admin) {
    redirect('/admin/login');
  }
}

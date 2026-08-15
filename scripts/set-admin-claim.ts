/**
 * Run once to grant admin access to a Firebase user:
 *   npx tsx scripts/set-admin-claim.ts <email-or-uid>
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const [, , target] = process.argv;

if (!target) {
  console.error('Usage: npx tsx scripts/set-admin-claim.ts <email-or-uid>');
  process.exit(1);
}

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  }),
});

const auth = getAuth(app);

async function run() {
  const isEmail = target.includes('@');
  const uid = isEmail ? (await auth.getUserByEmail(target)).uid : target;
  await auth.setCustomUserClaims(uid, { admin: true });
  console.log(`✓ Set { admin: true } on user ${uid} (${target})`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

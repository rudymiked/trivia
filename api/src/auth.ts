import { OAuth2Client } from 'google-auth-library';

const GOOGLE_CLIENT_IDS = [
  process.env.GOOGLE_CLIENT_ID_WEB,
  process.env.GOOGLE_CLIENT_ID_ANDROID,
  process.env.GOOGLE_CLIENT_ID_IOS,
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
].filter((value): value is string => Boolean(value && value.trim()));

const client = new OAuth2Client();

export interface VerifiedUser {
  userId: string;
  email: string;
  name: string;
  picture?: string;
}

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function verifyGoogleToken(token: string): Promise<VerifiedUser | null> {
  // Dev-only bypass: SMOKE_TEST_SECRET lets smoke tests run without a real Google token.
  // Never set this variable in production.
  const smokeSecret = process.env.SMOKE_TEST_SECRET;
  if (smokeSecret && token === smokeSecret) {
    return {
      userId: 'smoke-test-user',
      email: 'smoke@test.local',
      name: 'Smoke Test User',
    };
  }

  if (GOOGLE_CLIENT_IDS.length === 0) {
    console.warn('Google OAuth client IDs not configured, skipping token validation');
    return null;
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_IDS,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return null;
    }

    return {
      userId: payload.sub,
      email: payload.email || '',
      name: payload.name || 'Anonymous',
      picture: payload.picture,
    };
  } catch (error) {
    const authError = error instanceof Error ? error.message : 'unknown error';
    console.error('Token verification failed:', authError);
    return null;
  }
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}

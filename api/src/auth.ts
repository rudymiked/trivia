import { OAuth2Client } from 'google-auth-library';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID_WEB || '';

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export interface VerifiedUser {
  userId: string;
  email: string;
  name: string;
  picture?: string;
}

export async function verifyGoogleToken(token: string): Promise<VerifiedUser | null> {
  if (!GOOGLE_CLIENT_ID) {
    console.warn('GOOGLE_CLIENT_ID_WEB not configured, skipping token validation');
    return null;
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
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
    console.error('Token verification failed:', error);
    return null;
  }
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

import { trackTelemetryEvent } from '@/services/telemetry';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useContext, useEffect, useState } from 'react';

WebBrowser.maybeCompleteAuthSession();

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

interface AuthContextType {
  user: User | null;
  idToken: string | null;
  isLoading: boolean;
  isTokenValid: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getValidIdToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'pinpoint_user';
const TOKEN_STORAGE_KEY = 'pinpoint_id_token';

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Check if a JWT token is expired (with 5 minute buffer)
function isTokenExpired(token: string): boolean {
  try {
    const parsed = parseJwtPayload(token);
    if (!parsed || typeof parsed.exp !== 'number') return true;

    // Check if expired (with 5 minute buffer for clock skew)
    const expirationTime = parsed.exp * 1000; // Convert to milliseconds
    const bufferMs = 5 * 60 * 1000; // 5 minutes
    return Date.now() > expirationTime - bufferMs;
  } catch {
    // If we can't parse the token, treat it as expired
    return true;
  }
}

// You'll need to create these in Google Cloud Console
const GOOGLE_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || '';
const GOOGLE_CLIENT_ID_IOS = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || '';
const GOOGLE_CLIENT_ID_ANDROID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || '';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: GOOGLE_CLIENT_ID_WEB,
    iosClientId: GOOGLE_CLIENT_ID_IOS,
    androidClientId: GOOGLE_CLIENT_ID_ANDROID,
  });

  // Load saved user on mount
  useEffect(() => {
    loadUser();
  }, []);

  // Handle auth response that arrives via state (e.g. redirect-based flows)
  useEffect(() => {
    if (response?.type === 'success') {
      void processAuthResult(response.authentication, response.params);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  const loadUser = async () => {
    try {
      const savedUser = await AsyncStorage.getItem(STORAGE_KEY);
      const savedToken = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
      if (savedToken) {
        // Check if token is expired
        if (isTokenExpired(savedToken)) {
          // Clear expired token but keep user profile
          await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
          console.log('ID token expired, cleared from storage');
        } else {
          setIdToken(savedToken);
        }
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserInfo = async (accessToken: string) => {
    try {
      const response = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userInfo = await response.json();

      const newUser: User = {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
      };

      setUser(newUser);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
  };

  const processAuthResult = async (
    authentication: { accessToken: string; idToken?: string | null } | null,
    params?: Record<string, string>
  ) => {
    const tokenFromAuth = authentication?.idToken ?? null;
    const tokenFromParams = params?.id_token ?? null;
    const resolvedIdToken = tokenFromAuth || tokenFromParams;

    if (!resolvedIdToken) {
      console.warn('Google auth succeeded but no idToken was returned.');
      return;
    }

    setIdToken(resolvedIdToken);
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, resolvedIdToken);

    const accessToken = authentication?.accessToken ?? params?.access_token ?? null;
    if (accessToken) {
      await fetchUserInfo(accessToken);
      return;
    }

    // In id_token flow, an access token may be absent on web. Build user from JWT claims.
    const claims = parseJwtPayload(resolvedIdToken);
    if (!claims) return;

    const sub = typeof claims.sub === 'string' ? claims.sub : null;
    const email = typeof claims.email === 'string' ? claims.email : null;
    if (!sub || !email) return;

    const newUser: User = {
      id: sub,
      email,
      name: typeof claims.name === 'string' ? claims.name : email,
      picture: typeof claims.picture === 'string' ? claims.picture : undefined,
    };

    setUser(newUser);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
  };

  const signIn = async () => {
    try {
      void trackTelemetryEvent('sign_in_started');
      const result = await promptAsync();
      if (result.type === 'success') {
        await processAuthResult(result.authentication, result.params);
        void trackTelemetryEvent('sign_in_succeeded');
      } else if (result.type !== 'dismiss') {
        void trackTelemetryEvent('sign_in_failed', { reason: result.type });
      }
    } catch (error) {
      console.error('Error signing in:', error);
      void trackTelemetryEvent('sign_in_failed', { reason: 'exception' });
    }
  };

  const signOut = async () => {
    try {
      setUser(null);
      setIdToken(null);
      await AsyncStorage.removeItem(STORAGE_KEY);
      await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Check if current token is valid (not expired)
  const isTokenValid = idToken !== null && !isTokenExpired(idToken);

  // Get token only if it's valid, otherwise return null
  // Memoised so consumers can safely use it as a useCallback dep.
  const getValidIdToken = React.useCallback((): string | null => {
    if (idToken && !isTokenExpired(idToken)) {
      return idToken;
    }
    if (idToken) {
      setIdToken(null);
      void AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    return null;
  }, [idToken]);

  return (
    <AuthContext.Provider value={{ user, idToken, isLoading, isTokenValid, signIn, signOut, getValidIdToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

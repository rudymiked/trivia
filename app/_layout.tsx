import { AuthProvider } from '@/hooks/useAuth';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Link, Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

export {
    // Catch any errors thrown by the Layout component.
    ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const isGameRoute = segments[0] === 'game';
  const showWebFooter = Platform.OS === 'web' && !isGameRoute;

  // On initial app load, ensure we start at the home screen
  // This handles cases where the app resumes from a game screen
  useEffect(() => {
    // Only redirect if we're on a game route on initial mount
    const isOnGameRoute = segments[0] === 'game';

    // Check if this is a fresh app start (no intentional navigation yet)
    // We use a small delay to let the navigation state settle
    if (isOnGameRoute) {
      // Use replace to avoid adding to history stack
      router.replace('/');
    }
  }, []); // Empty deps - only run once on mount

  return (
    <AuthProvider>
      <ThemeProvider value={DarkTheme}>
        <View style={styles.appShell}>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: '#1A202C' },
              headerTintColor: '#FFFFFF',
              contentStyle: { backgroundColor: '#1A202C' },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="game" options={{ headerShown: false }} />
            <Stack.Screen name="play-modes" options={{ headerShown: false }} />
            <Stack.Screen name="privacy-policy" options={{ title: 'Privacy Policy' }} />
            <Stack.Screen name="terms" options={{ title: 'Terms of Use' }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          </Stack>

          {showWebFooter && (
            <View style={styles.footer}>
              <View style={styles.footerLinksRow}>
                <Link href="/privacy-policy" asChild>
                  <Text style={styles.footerLink}>Privacy Policy</Text>
                </Link>
                <Text style={styles.footerDivider}>•</Text>
                <Link href="/terms" asChild>
                  <Text style={styles.footerLink}>Terms of Use</Text>
                </Link>
              </View>
              <Text style={styles.footerMeta}>© {new Date().getFullYear()} PinPoint</Text>
            </View>
          )}
        </View>
      </ThemeProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: '#1A202C',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#2D3748',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 6,
    backgroundColor: '#1A202C',
  },
  footerLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  footerLink: {
    color: '#A0AEC0',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  footerDivider: {
    color: '#718096',
    fontSize: 13,
  },
  footerMeta: {
    color: '#718096',
    fontSize: 12,
    textAlign: 'center',
  },
});

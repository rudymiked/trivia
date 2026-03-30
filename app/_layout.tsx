import { Brand } from '@/constants/Colors';
import { AuthProvider } from '@/hooks/useAuth';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Link, Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
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
  const [isNarrowWebViewport, setIsNarrowWebViewport] = useState(false);
  const [showFooterOnNarrowWeb, setShowFooterOnNarrowWeb] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    const updateFooterVisibility = () => {
      const viewportWidth = window.innerWidth;
      const narrowViewport = viewportWidth <= 768;
      setIsNarrowWebViewport(narrowViewport);

      if (!narrowViewport) {
        setShowFooterOnNarrowWeb(true);
        return;
      }

      const scrollTop = window.scrollY || 0;
      const viewportHeight = window.innerHeight || 0;
      const documentHeight = document.documentElement.scrollHeight || 0;

      // Reveal footer only when the user is close to the bottom on narrow screens.
      const nearBottom = scrollTop + viewportHeight >= documentHeight - 80;
      setShowFooterOnNarrowWeb(nearBottom);
    };

    updateFooterVisibility();
    window.addEventListener('scroll', updateFooterVisibility, { passive: true });
    window.addEventListener('resize', updateFooterVisibility);

    return () => {
      window.removeEventListener('scroll', updateFooterVisibility);
      window.removeEventListener('resize', updateFooterVisibility);
    };
  }, []);

  const showWebFooter = Platform.OS === 'web' && !isGameRoute && showFooterOnNarrowWeb;

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

  const brandedDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: Brand.midnight,
      card: Brand.ocean,
      primary: Brand.aqua,
      text: Brand.white,
      border: 'rgba(180, 199, 206, 0.16)',
      notification: Brand.gold,
    },
  };

  return (
    <AuthProvider>
      <ThemeProvider value={brandedDarkTheme}>
        <View style={styles.appShell}>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: Brand.midnight },
              headerTintColor: Brand.white,
              headerTitleStyle: {
                fontFamily: 'SpaceMono',
                fontSize: 15,
              },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: Brand.midnight },
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
            <View style={[styles.footer, isNarrowWebViewport && styles.footerNarrow]}>
              <View style={styles.footerBrandRow}>
                <View style={styles.footerBrandMark}>
                  <Image source={require('../assets/images/logo.png')} style={styles.footerBrandImage} resizeMode="contain" />
                </View>
                <View>
                  <Text style={styles.footerBrandName}>PinPoint</Text>
                  <Text style={styles.footerBrandTagline}>One clue. One map. One shot.</Text>
                </View>
              </View>
              <View style={styles.footerLinksRow}>
                <Link href="/privacy-policy" asChild>
                  <Text style={styles.footerLink}>Privacy Policy</Text>
                </Link>
                <Text style={styles.footerDivider}>•</Text>
                <Link href="/terms" asChild>
                  <Text style={styles.footerLink}>Terms of Use</Text>
                </Link>
              </View>
              <Text style={styles.footerMeta}>© {new Date().getFullYear()} PinPoint. Built for daily globe instincts.</Text>
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
    backgroundColor: Brand.midnight,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(180, 199, 206, 0.16)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    gap: 20,
    backgroundColor: '#081C29',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  footerNarrow: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 10,
  },
  footerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerBrandMark: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBrandImage: {
    width: 34,
    height: 34,
  },
  footerBrandName: {
    color: Brand.white,
    fontFamily: 'SpaceMono',
    fontSize: 12,
    letterSpacing: 0.7,
    textAlign: 'left',
  },
  footerBrandTagline: {
    color: Brand.slate,
    fontSize: 10,
    textAlign: 'left',
  },
  footerLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerLink: {
    color: Brand.mist,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  footerDivider: {
    color: Brand.slate,
    fontSize: 13,
  },
  footerMeta: {
    color: Brand.slate,
    fontSize: 12,
    textAlign: 'center',
  },
});

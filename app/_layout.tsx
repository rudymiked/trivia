import { Brand } from '@/constants/Colors';
import { AuthProvider } from '@/hooks/useAuth';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
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
});

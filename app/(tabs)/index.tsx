import { Brand } from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { useGameStore } from '@/hooks/useGame';
import { checkUserGame } from '@/services/api';
import { getTimeUntilNextPuzzle, getTodayDate, hasPlayedToday } from '@/services/puzzle';
import { getDailyResult, getUserProgress, type UserProgress } from '@/services/storage';
import { trackTelemetryEvent } from '@/services/telemetry';
import { Ionicons } from '@expo/vector-icons';
import { Href, Link, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const featurePoints = [
  'Five rounds, one daily route around the globe.',
  'Distance-based scoring that rewards instinct and precision.',
  'Fresh challenge every day, plus extra modes when you sign in.',
];

const howToPlaySteps = [
  'Read the clue and scan the globe for the strongest signal.',
  'Drop a pin where your instinct says the answer lives.',
  'Lock in the guess and watch the score react to your distance.',
  'Push through all five rounds and compare against the field.',
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, getValidIdToken, isLoading: authLoading } = useAuth();
  const lastCompletedDate = useGameStore((s) => s.lastCompletedDate);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [serverPlayedToday, setServerPlayedToday] = useState<boolean | null>(null);
  const [localPlayedToday, setLocalPlayedToday] = useState(false);
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [isLoading, setIsLoading] = useState(true);
  // Tracks which userId we last completed a full loadProgress() for.
  // undefined = never run, null = ran with no user (guest), 'abc' = ran for user 'abc'.
  // Keeps the spinner up when user loads but the server-check hasn't finished yet.
  const [checkedForUserId, setCheckedForUserId] = useState<string | null | undefined>(undefined);
  const trackedDauRef = useRef(false);
  const isWeb = Platform.OS === 'web';

  const loadProgress = useCallback(async () => {
    setIsLoading(true);
    const today = getTodayDate();
    const [userProgress, todayResult] = await Promise.all([
      getUserProgress(),
      getDailyResult(today),
    ]);
    const resolvedLocalPlayed = hasPlayedToday(userProgress.lastPlayedDate) || todayResult !== null;
    setLocalPlayedToday(resolvedLocalPlayed);
    let resolvedServerPlayedToday: boolean | null = null;

    if (user) {
      const validToken = getValidIdToken();
      if (validToken) {
        try {
          const response = await checkUserGame(user.id, today, validToken);
          if (response.data && typeof response.data.completed === 'boolean') {
            resolvedServerPlayedToday = response.data.completed;
          }
        } catch (error) {
          console.error('Failed to check server game status on home screen:', error);
        }
      }
    }

    setProgress(userProgress);
    setServerPlayedToday(resolvedServerPlayedToday);
    setCheckedForUserId(user?.id ?? null);
    setIsLoading(false);

    if (!trackedDauRef.current) {
      trackedDauRef.current = true;
      void trackTelemetryEvent('daily_active_user', {
        date: today,
        isAuthenticated: !!user,
        hasPlayedToday: resolvedServerPlayedToday ?? hasPlayedToday(userProgress.lastPlayedDate),
      });
    }
  }, [getValidIdToken, user]);

  useFocusEffect(
    useCallback(() => {
      void loadProgress();
    }, [loadProgress])
  );

  // useFocusEffect only fires on navigation focus, not when auth state resolves while the
  // screen is already mounted. This effect catches the cold-load race where loadProgress()
  // ran before the user was loaded from storage.
  // Dep array intentionally excludes loadProgress to avoid re-firing when the expired-token
  // path inside loadProgress calls setIdToken(null) and changes the callback's identity.
  useEffect(() => {
    if (!authLoading) {
      void loadProgress();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getTimeUntilNextPuzzle());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handlePlay = () => {
    const today = getTodayDate();
    router.push(`/game/${today}`);
  };

  const handlePlayModes = () => {
    router.push('/play-modes' as Href);
  };

  const handleGoToProfile = () => {
    router.push('/profile' as Href);
  };

  const renderGuestLoginCta = () => (
    <Pressable style={({ pressed }) => [styles.loginCard, pressed && styles.cardPressed]} onPress={handleGoToProfile}>
      <Text style={styles.loginCardEyebrow}>Account</Text>
      <Text style={styles.loginCardTitle}>Unlock the full board</Text>
      <Text style={styles.loginCardBody}>
        Sign in to unlock Play Modes, keep your scores synced, and claim your leaderboard spot.
      </Text>
      <View style={styles.loginCardLinkRow}>
        <Text style={styles.loginCardLink}>Go to Profile</Text>
        <Ionicons name="arrow-forward" size={16} color={Brand.aqua} />
      </View>
    </Pressable>
  );

  // Three independent signals — any one being true means the user has played today:
  // 1. lastCompletedDate: set synchronously in Zustand when the final guess is submitted
  //    (survives navigation, no async lag, persisted across refreshes)
  // 2. localPlayedToday: from localStorage last-played-date + daily results store
  // 3. serverPlayedToday: from the API (requires a valid token)
  const alreadyPlayed =
    lastCompletedDate === getTodayDate() ||
    localPlayedToday ||
    serverPlayedToday === true;

  // Spinner while:
  // - data is loading, OR
  // - auth is still resolving from storage, OR
  // - user is logged in but we haven't yet run a loadProgress() with their ID
  //   (prevents a paint window between authLoading:false and the useEffect firing)
  const needsUserCheck = !!user && checkedForUserId !== user.id;
  if (isLoading || authLoading || needsUserCheck) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Brand.aqua} />
      </View>
    );
  }

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  if (!isWeb) {
    return (
      <ScrollView
        style={styles.mobileContainer}
        contentContainerStyle={styles.mobileContentContainer}
        showsVerticalScrollIndicator={false}
        scrollEnabled
        nestedScrollEnabled
        bounces
      >
        <View style={styles.mobileTopBar}>
          <View>
            <Text style={styles.mobileDateLabel}>{todayLabel}</Text>
            <Text style={styles.mobileGreeting}>Ready to pin?</Text>
          </View>
          <Pressable style={({ pressed }) => [styles.mobileIconButton, pressed && styles.cardPressed]} onPress={handleGoToProfile}>
            <Ionicons name="person-circle-outline" size={26} color={Brand.white} />
          </Pressable>
        </View>

        <View style={styles.mobileHeroCard}>
          <View style={styles.mobileHeroGlow} />
          <View style={styles.mobileBrandRow}>
            <Image source={require('../../assets/images/logo.png')} style={styles.mobileBrandLogo} resizeMode="contain" />
            <View>
              <Text style={styles.mobileBrandTitle}>PinPoint</Text>
              <Text style={styles.mobileBrandTagline}>Daily world challenge</Text>
            </View>
          </View>

          <Text style={styles.mobileHeroTitle}>Five rounds. One route. Zero fluff.</Text>
          <Text style={styles.mobileHeroBody}>Read the clue, drop your pin, and beat your own instincts.</Text>

          {!alreadyPlayed ? (
            <Pressable style={({ pressed }) => [styles.mobilePrimaryButton, pressed && styles.buttonPressed]} onPress={handlePlay}>
              <Text style={styles.mobilePrimaryButtonText}>Start today&apos;s run</Text>
              <Ionicons name="play" size={18} color={Brand.midnight} />
            </Pressable>
          ) : (
            <View style={styles.mobileTimerCard}>
              <Text style={styles.mobileTimerLabel}>Next daily drop</Text>
              <Text style={styles.mobileTimerValue}>
                {String(countdown.hours).padStart(2, '0')}:
                {String(countdown.minutes).padStart(2, '0')}:
                {String(countdown.seconds).padStart(2, '0')}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.mobileStatsRow}>
          <View style={styles.mobileMiniCard}>
            <Text style={styles.mobileMiniLabel}>Streak</Text>
            <Text style={styles.mobileMiniValue}>{progress?.streak ?? 0}</Text>
          </View>
          <View style={styles.mobileMiniCard}>
            <Text style={styles.mobileMiniLabel}>Played</Text>
            <Text style={styles.mobileMiniValue}>{progress?.gamesPlayed ?? 0}</Text>
          </View>
          <View style={styles.mobileMiniCard}>
            <Text style={styles.mobileMiniLabel}>Best</Text>
            <Text style={styles.mobileMiniValue}>{progress?.highScore ?? 0}</Text>
          </View>
        </View>

        <View style={styles.mobileSectionCard}>
          <Text style={styles.mobileSectionTitle}>How to win this round</Text>
          {howToPlaySteps.slice(0, 3).map((step, index) => (
            <View key={step} style={styles.mobileStepRow}>
              <View style={styles.mobileStepBadge}>
                <Text style={styles.mobileStepNumber}>{index + 1}</Text>
              </View>
              <Text style={styles.mobileStepText}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={styles.mobileSectionCard}>
          <Text style={styles.mobileSectionTitle}>Your mode</Text>
          <Text style={styles.mobileModeBody}>
            Jump into quick daily play or explore extra modes when signed in.
          </Text>
          {user ? (
            <Pressable style={({ pressed }) => [styles.mobileSecondaryButton, pressed && styles.buttonPressed]} onPress={handlePlayModes}>
              <Text style={styles.mobileSecondaryButtonText}>Explore play modes</Text>
              <Ionicons name="grid-outline" size={18} color={Brand.aqua} />
            </Pressable>
          ) : (
            renderGuestLoginCta()
          )}
        </View>

        <View style={styles.homeLegalContainer}>
          <View style={styles.homeLegalLinksRow}>
            <Link href="/privacy-policy" asChild>
              <Text style={styles.homeLegalLink}>Privacy Policy</Text>
            </Link>
            <Text style={styles.homeLegalDivider}>•</Text>
            <Link href="/terms" asChild>
              <Text style={styles.homeLegalLink}>Terms of Use</Text>
            </Link>
          </View>
          <Text style={styles.homeLegalMeta}>© {new Date().getFullYear()} PinPoint</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroPanel}>
        <View style={styles.heroOrbLarge} />
        <View style={styles.heroOrbSmall} />
        <View style={styles.heroGrid} />

        <View style={styles.heroTopRow}>
          <View style={styles.badge}>
            <Ionicons name="compass-outline" size={14} color={Brand.gold} />
            <Text style={styles.badgeText}>Daily map challenge</Text>
          </View>
          <Text style={styles.heroDate}>{todayLabel}</Text>
        </View>

        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Image source={require('../../assets/images/logo.png')} style={styles.brandLogoImage} resizeMode="contain" />
          </View>
          <View>
            <Text style={styles.logoText}>PinPoint</Text>
            <Text style={styles.tagline}>Find the place. Test your instincts.</Text>
          </View>
        </View>

        <Text style={styles.heroTitle}>A geography game that finally looks like it belongs on your home screen.</Text>
        <Text style={styles.heroBody}>
          Decode the clue, trust your map sense, and place one precise guess at a time.
          PinPoint turns a five-round daily ritual into a clean, competitive challenge.
        </Text>

        <View style={styles.actionRow}>
          {!alreadyPlayed ? (
            <Pressable style={({ pressed }) => [styles.playButton, pressed && styles.buttonPressed]} onPress={handlePlay}>
              <Text style={styles.playButtonText}>Play today&apos;s puzzle</Text>
              <Ionicons name="arrow-forward" size={18} color={Brand.midnight} />
            </Pressable>
          ) : (
            <View style={styles.countdownCard}>
              <Text style={styles.playedText}>Today&apos;s run is complete</Text>
              <Text style={styles.countdownLabel}>Next drop in</Text>
              <Text style={styles.countdown}>
                {String(countdown.hours).padStart(2, '0')}:
                {String(countdown.minutes).padStart(2, '0')}:
                {String(countdown.seconds).padStart(2, '0')}
              </Text>
            </View>
          )}

          {user && (
            <Pressable style={({ pressed }) => [styles.secondaryAction, pressed && styles.buttonPressed]} onPress={handlePlayModes}>
              <Text style={styles.secondaryActionText}>Explore play modes</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.featureList}>
          {featurePoints.map((point) => (
            <View key={point} style={styles.featureItem}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>{point}</Text>
            </View>
          ))}
        </View>
      </View>

      {progress && progress.gamesPlayed > 0 && (
        <View style={styles.statsSection}>
          <Text style={styles.sectionEyebrow}>Your rhythm</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{progress.streak}</Text>
              <Text style={styles.statLabel}>Streak</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{progress.gamesPlayed}</Text>
              <Text style={styles.statLabel}>Played</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{progress.highScore}</Text>
              <Text style={styles.statLabel}>Best</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.lowerGrid}>
        <View style={styles.instructionsContainer}>
          <Text style={styles.sectionEyebrow}>How it works</Text>
          <Text style={styles.instructionsTitle}>Fast, clear, and competitive.</Text>
          {howToPlaySteps.map((step, index) => (
            <View key={step} style={styles.instructionItem}>
              <Text style={styles.instructionNumber}>{index + 1}</Text>
              <Text style={styles.instructionText}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={styles.identityCard}>
          <Text style={styles.sectionEyebrow}>Identity</Text>
          <Text style={styles.identityTitle}>Modern globe energy, not classroom quiz energy.</Text>
          <Text style={styles.identityBody}>
            The new shell leans on deep ocean blues, warm sand highlights, and a monospaced title system
            to make the game feel deliberate, geographic, and premium.
          </Text>
          {!user && renderGuestLoginCta()}
        </View>
      </View>

      <View style={styles.homeLegalContainer}>
        <View style={styles.homeLegalLinksRow}>
          <Link href="/privacy-policy" asChild>
            <Text style={styles.homeLegalLink}>Privacy Policy</Text>
          </Link>
          <Text style={styles.homeLegalDivider}>•</Text>
          <Link href="/terms" asChild>
            <Text style={styles.homeLegalLink}>Terms of Use</Text>
          </Link>
        </View>
        <Text style={styles.homeLegalMeta}>© {new Date().getFullYear()} PinPoint</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  mobileContainer: {
    flex: 1,
    backgroundColor: '#06121B',
  },
  mobileContentContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 120,
    gap: 14,
  },
  mobileTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mobileDateLabel: {
    color: Brand.slate,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  mobileGreeting: {
    color: Brand.white,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
  },
  mobileIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  mobileHeroCard: {
    backgroundColor: '#0A2436',
    borderRadius: 22,
    padding: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(242, 193, 78, 0.18)',
  },
  mobileHeroGlow: {
    position: 'absolute',
    right: -40,
    top: -50,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(87, 211, 203, 0.16)',
  },
  mobileBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  mobileBrandLogo: {
    width: 44,
    height: 44,
  },
  mobileBrandTitle: {
    color: Brand.white,
    fontSize: 22,
    fontFamily: 'SpaceMono',
  },
  mobileBrandTagline: {
    color: Brand.mist,
    fontSize: 12,
  },
  mobileHeroTitle: {
    color: Brand.white,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '800',
    marginBottom: 8,
    maxWidth: 300,
  },
  mobileHeroBody: {
    color: Brand.parchment,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
  },
  mobilePrimaryButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: Brand.gold,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  mobilePrimaryButtonText: {
    color: Brand.midnight,
    fontSize: 15,
    fontWeight: '800',
  },
  mobileTimerCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(87, 211, 203, 0.24)',
    backgroundColor: 'rgba(7, 26, 38, 0.42)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  mobileTimerLabel: {
    color: Brand.slate,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  mobileTimerValue: {
    color: Brand.white,
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  mobileStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  mobileMiniCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#0A2131',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(180, 199, 206, 0.14)',
  },
  mobileMiniLabel: {
    color: Brand.slate,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  mobileMiniValue: {
    color: Brand.white,
    fontSize: 24,
    fontWeight: '800',
  },
  mobileSectionCard: {
    borderRadius: 20,
    backgroundColor: '#0A2131',
    borderWidth: 1,
    borderColor: 'rgba(180, 199, 206, 0.12)',
    padding: 16,
  },
  mobileSectionTitle: {
    color: Brand.white,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  mobileStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  mobileStepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Brand.aqua,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  mobileStepNumber: {
    color: Brand.midnight,
    fontSize: 12,
    fontWeight: '800',
  },
  mobileStepText: {
    color: Brand.mist,
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  mobileModeBody: {
    color: Brand.parchment,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  mobileSecondaryButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(7, 26, 38, 0.48)',
    borderWidth: 1,
    borderColor: 'rgba(87, 211, 203, 0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mobileSecondaryButtonText: {
    color: Brand.aqua,
    fontSize: 14,
    fontWeight: '800',
  },
  container: {
    flex: 1,
    backgroundColor: Brand.midnight,
  },
  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 42,
    alignItems: 'center',
    gap: 18,
  },
  heroPanel: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 24,
    borderRadius: 28,
    backgroundColor: Brand.ocean,
    borderWidth: 1,
    borderColor: 'rgba(231, 216, 187, 0.14)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.28,
    shadowRadius: 40,
    elevation: 18,
  },
  heroOrbLarge: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(87, 211, 203, 0.12)',
  },
  heroOrbSmall: {
    position: 'absolute',
    bottom: -30,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(242, 193, 78, 0.12)',
  },
  heroGrid: {
    position: 'absolute',
    right: 18,
    top: 26,
    width: 180,
    height: 180,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(244, 235, 221, 0.08)',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 22,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(7, 26, 38, 0.42)',
    borderWidth: 1,
    borderColor: 'rgba(242, 193, 78, 0.25)',
  },
  badgeText: {
    color: Brand.parchment,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroDate: {
    color: Brand.mist,
    fontSize: 13,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  brandMark: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogoImage: {
    width: 112,
    height: 112,
  },
  logoText: {
    color: Brand.white,
    fontSize: 36,
    fontFamily: 'SpaceMono',
    letterSpacing: 1.2,
  },
  tagline: {
    color: Brand.mist,
    fontSize: 15,
    marginTop: 4,
  },
  heroTitle: {
    color: Brand.white,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    maxWidth: 720,
    marginBottom: 12,
  },
  heroBody: {
    color: Brand.mist,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 760,
    marginBottom: 20,
  },
  actionRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
    flexWrap: 'wrap',
    marginBottom: 18,
  },
  playButton: {
    minHeight: 58,
    paddingHorizontal: 22,
    borderRadius: 18,
    backgroundColor: Brand.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  playButtonText: {
    color: Brand.midnight,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  secondaryAction: {
    minHeight: 58,
    paddingHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(244, 235, 221, 0.18)',
    backgroundColor: 'rgba(7, 26, 38, 0.28)',
    justifyContent: 'center',
  },
  secondaryActionText: {
    color: Brand.white,
    fontSize: 15,
    fontWeight: '700',
  },
  countdownCard: {
    minHeight: 58,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(7, 26, 38, 0.34)',
    borderWidth: 1,
    borderColor: 'rgba(87, 211, 203, 0.24)',
    justifyContent: 'center',
  },
  featureList: {
    gap: 10,
    maxWidth: 760,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  featureDot: {
    width: 8,
    height: 8,
    marginTop: 7,
    borderRadius: 4,
    backgroundColor: Brand.aqua,
  },
  featureText: {
    color: Brand.parchment,
    fontSize: 14,
    lineHeight: 22,
    flex: 1,
  },
  statsSection: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
  },
  sectionEyebrow: {
    color: Brand.aqua,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  statCard: {
    minWidth: 150,
    flexGrow: 1,
    padding: 18,
    borderRadius: 22,
    backgroundColor: '#0A2131',
    borderWidth: 1,
    borderColor: 'rgba(180, 199, 206, 0.12)',
  },
  statValue: {
    color: Brand.white,
    fontSize: 30,
    fontWeight: '800',
  },
  statLabel: {
    color: Brand.slate,
    fontSize: 12,
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  playedText: {
    color: Brand.aqua,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  countdownLabel: {
    color: Brand.slate,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  countdown: {
    color: Brand.white,
    fontSize: 26,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  loginCard: {
    width: '100%',
    maxWidth: 420,
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(7, 26, 38, 0.48)',
    borderWidth: 1,
    borderColor: 'rgba(87, 211, 203, 0.24)',
  },
  loginCardEyebrow: {
    color: Brand.aqua,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  loginCardTitle: {
    color: Brand.white,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  loginCardBody: {
    color: Brand.mist,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  loginCardLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loginCardLink: {
    color: Brand.aqua,
    fontSize: 14,
    fontWeight: '800',
  },
  lowerGrid: {
    width: '100%',
    maxWidth: 1120,
    gap: 18,
  },
  homeLegalContainer: {
    width: '100%',
    maxWidth: 1120,
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 10,
    gap: 6,
  },
  homeLegalLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  homeLegalLink: {
    color: Brand.slate,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  homeLegalDivider: {
    color: Brand.slate,
    fontSize: 12,
  },
  homeLegalMeta: {
    color: Brand.slate,
    fontSize: 11,
  },
  instructionsContainer: {
    backgroundColor: '#0A2131',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(180, 199, 206, 0.12)',
  },
  instructionsTitle: {
    color: Brand.white,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 18,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  instructionNumber: {
    color: Brand.midnight,
    fontSize: 14,
    fontWeight: '800',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Brand.aqua,
    textAlign: 'center',
    lineHeight: 30,
    marginRight: 12,
  },
  instructionText: {
    color: Brand.mist,
    fontSize: 14,
    lineHeight: 21,
    flex: 1,
  },
  identityCard: {
    backgroundColor: '#0B2234',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(242, 193, 78, 0.16)',
  },
  identityTitle: {
    color: Brand.white,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    marginBottom: 12,
    maxWidth: 640,
  },
  identityBody: {
    color: Brand.parchment,
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 700,
  },
  buttonPressed: {
    opacity: 0.86,
    transform: [{ translateY: 1 }],
  },
  cardPressed: {
    opacity: 0.94,
  },
});

import { useAuth } from '@/hooks/useAuth';
import { checkUserGame } from '@/services/api';
import { getTimeUntilNextPuzzle, getTodayDate, hasPlayedToday } from '@/services/puzzle';
import { getUserProgress, type UserProgress } from '@/services/storage';
import { trackTelemetryEvent } from '@/services/telemetry';
import { Href, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  const router = useRouter();
  const { user, getValidIdToken } = useAuth();
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [serverPlayedToday, setServerPlayedToday] = useState<boolean | null>(null);
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const trackedDauRef = useRef(false);

  const loadProgress = useCallback(async () => {
      setIsLoading(true);
      const userProgress = await getUserProgress();
      let resolvedServerPlayedToday: boolean | null = null;

      if (user) {
        const validToken = getValidIdToken();
        if (validToken) {
          try {
            const today = getTodayDate();
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
      setIsLoading(false);

      if (!trackedDauRef.current) {
        trackedDauRef.current = true;
        const today = getTodayDate();
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
    <Pressable style={styles.loginCard} onPress={handleGoToProfile}>
      <Text style={styles.loginCardTitle}>Want more ways to play?</Text>
      <Text style={styles.loginCardBody}>
        Sign in to unlock Play Modes and leaderboard placement.
      </Text>
      <Text style={styles.loginCardLink}>Go to Profile to log in</Text>
    </Pressable>
  );

  const alreadyPlayed = user && serverPlayedToday !== null
    ? serverPlayedToday
    : progress && hasPlayedToday(progress.lastPlayedDate);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Logo */}
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>PinPoint</Text>
        <Text style={styles.tagline}>Daily Geography Challenge</Text>
      </View>

      {/* Stats */}
      {progress && progress.gamesPlayed > 0 && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{progress.streak}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{progress.gamesPlayed}</Text>
            <Text style={styles.statLabel}>Played</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{progress.highScore}</Text>
            <Text style={styles.statLabel}>Best</Text>
          </View>
        </View>
      )}

      {/* Play button or countdown */}
      {alreadyPlayed ? (
        <View style={styles.countdownContainer}>
          <Text style={styles.playedText}>You've played today!</Text>
          <Text style={styles.countdownLabel}>Next puzzle in:</Text>
          <Text style={styles.countdown}>
            {String(countdown.hours).padStart(2, '0')}:
            {String(countdown.minutes).padStart(2, '0')}:
            {String(countdown.seconds).padStart(2, '0')}
          </Text>
          {user ? (
            <Pressable style={styles.modesButton} onPress={handlePlayModes}>
              <Text style={styles.modesButtonText}>Play Modes</Text>
            </Pressable>
          ) : (
            renderGuestLoginCta()
          )}
        </View>
      ) : (
        <View style={styles.playContainer}>
          <Pressable style={styles.playButton} onPress={handlePlay}>
            <Text style={styles.playButtonText}>Play Today's Puzzle</Text>
          </Pressable>
          {user ? (
            <Pressable style={styles.modesButton} onPress={handlePlayModes}>
              <Text style={styles.modesButtonText}>Play Modes</Text>
            </Pressable>
          ) : (
            renderGuestLoginCta()
          )}
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>
      )}

      {/* How to play */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>How to Play</Text>
        <View style={styles.instructionItem}>
          <Text style={styles.instructionNumber}>1</Text>
          <Text style={styles.instructionText}>Read the location clue</Text>
        </View>
        <View style={styles.instructionItem}>
          <Text style={styles.instructionNumber}>2</Text>
          <Text style={styles.instructionText}>Tap on the map to guess</Text>
        </View>
        <View style={styles.instructionItem}>
          <Text style={styles.instructionNumber}>3</Text>
          <Text style={styles.instructionText}>Score points based on accuracy</Text>
        </View>
        <View style={styles.instructionItem}>
          <Text style={styles.instructionNumber}>4</Text>
          <Text style={styles.instructionText}>Complete 5 rounds to finish</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A202C',
  },
  contentContainer: {
    padding: 20,
    flexGrow: 1,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoText: {
    color: '#4ECDC4',
    fontSize: 56,
    fontWeight: '800',
    letterSpacing: -2,
  },
  tagline: {
    color: '#718096',
    fontSize: 16,
    marginTop: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 40,
    paddingVertical: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
  },
  statLabel: {
    color: '#718096',
    fontSize: 12,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  playContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  playButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 48,
    paddingVertical: 20,
    borderRadius: 16,
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  playButtonText: {
    color: '#1A202C',
    fontSize: 20,
    fontWeight: '700',
  },
  dateText: {
    color: '#718096',
    fontSize: 14,
    marginTop: 16,
  },
  countdownContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  playedText: {
    color: '#4ECDC4',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  countdownLabel: {
    color: '#718096',
    fontSize: 14,
    marginBottom: 8,
  },
  countdown: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  replayButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#4A5568',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  replayButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modesButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#4A5568',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  modesButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loginCard: {
    alignSelf: 'center',
    maxWidth: 420,
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.28)',
  },
  loginCardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  loginCardBody: {
    color: '#A0AEC0',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 10,
  },
  loginCardLink: {
    color: '#4ECDC4',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  instructionsContainer: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
  },
  instructionsTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  instructionNumber: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: '700',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
    textAlign: 'center',
    lineHeight: 28,
    marginRight: 12,
  },
  instructionText: {
    color: '#A0AEC0',
    fontSize: 14,
  },
});

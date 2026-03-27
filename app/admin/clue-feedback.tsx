import { useAuth } from '@/hooks/useAuth';
import { isAllowedAdminEmail } from '@/services/admin';
import { fetchLowRatedClues, LowRatedClueSummary } from '@/services/api';
import { Href, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

const DEFAULT_LIMIT = 50;
const DEFAULT_MIN_COUNT = 1;

export default function ClueFeedbackAdminScreen() {
  const router = useRouter();
  const { user, getValidIdToken, isLoading: authLoading, isTokenValid, signIn } = useAuth();
  const [clues, setClues] = useState<LowRatedClueSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canAccessAdminTools = isAllowedAdminEmail(user?.email);

  const loadClues = useCallback(async (refresh = false) => {
    if (authLoading) return;

    if (!user) {
      setError('Sign in with your admin account to view this report.');
      setClues([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (!canAccessAdminTools) {
      setError('Your account is not allowed to access this admin report.');
      setClues([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const authToken = getValidIdToken();
    if (!authToken) {
      // Token is expired — the render will show the session-expired screen.
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const response = await fetchLowRatedClues(
        authToken,
        DEFAULT_LIMIT,
        DEFAULT_MIN_COUNT
      );

      if (response.error) {
        setError(response.error);
        setClues([]);
        return;
      }

      setClues(response.data?.clues || []);
      setError(null);
    } catch (loadError) {
      console.error('Failed to load low-rated clues:', loadError);
      setError('Failed to load low-rated clues.');
      setClues([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [authLoading, canAccessAdminTools, getValidIdToken, isTokenValid, user]);

  useEffect(() => {
    void loadClues();
  }, [loadClues]);

  const handleGoToProfile = () => {
    router.replace('/profile' as Href);
  };

  if (isLoading || authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ECDC4" />
        <Text style={styles.loadingText}>Loading low-rated clues...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.accessTitle}>Admin Sign-In Required</Text>
        <Text style={styles.accessBody}>
          Sign in with an allowed admin account to access this report.
        </Text>
        <Pressable style={styles.primaryButton} onPress={signIn}>
          <Text style={styles.primaryButtonText}>Sign In with Google</Text>
        </Pressable>
      </View>
    );
  }

  if (!canAccessAdminTools) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.accessTitle}>Access Denied</Text>
        <Text style={styles.accessBody}>
          {user.email} is not on the admin allowlist.
        </Text>
        <Pressable style={styles.secondaryButton} onPress={handleGoToProfile}>
          <Text style={styles.secondaryButtonText}>Back to Profile</Text>
        </Pressable>
      </View>
    );
  }

  if (!isTokenValid) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.accessTitle}>Session Expired</Text>
        <Text style={styles.accessBody}>
          Your session has expired. Sign in again to continue.
        </Text>
        <Pressable style={styles.primaryButton} onPress={signIn}>
          <Text style={styles.primaryButtonText}>Sign In with Google</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={() => void loadClues(true)} />
      }
    >
      <View style={styles.headerCard}>
        <Text style={styles.title}>Low-Rated Clues</Text>
        <Text style={styles.subtitle}>
          Fast review of clues with hard or unclear ratings.
        </Text>
      </View>

      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadClues(true)}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {!error && clues.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No low-rated clues found</Text>
          <Text style={styles.emptyBody}>
            Clues need at least {DEFAULT_MIN_COUNT} hard or unclear rating to appear here.
          </Text>
        </View>
      )}

      {clues.map((clue) => (
        <View key={clue.locationId} style={styles.clueCard}>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{clue.lowRatingCount} low ratings</Text>
            </View>
            {clue.lastPuzzleDate && (
              <Text style={styles.dateText}>{clue.lastPuzzleDate}</Text>
            )}
          </View>

          <Text style={styles.clueText}>{clue.clue}</Text>
          <Text style={styles.metaText}>
            {clue.answer ? `${clue.answer} • ${clue.country}` : clue.country}
          </Text>
          <Text style={styles.locationIdText}>Location ID: {clue.locationId}</Text>

          <View style={styles.metricsRow}>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>Hard</Text>
              <Text style={styles.metricValue}>{clue.hardCount}</Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>Unclear</Text>
              <Text style={styles.metricValue}>{clue.unclearCount}</Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>Easy</Text>
              <Text style={styles.metricValue}>{clue.easyCount}</Text>
            </View>
          </View>
        </View>
      ))}
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
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A202C',
    padding: 20,
  },
  loadingText: {
    color: '#A0AEC0',
    fontSize: 14,
    marginTop: 12,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A202C',
    padding: 24,
  },
  accessTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  accessBody: {
    color: '#A0AEC0',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
  },
  primaryButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#1A202C',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#4A5568',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  headerCard: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    color: '#A0AEC0',
    fontSize: 14,
    lineHeight: 20,
  },
  errorCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 101, 101, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 101, 101, 0.4)',
  },
  errorText: {
    color: '#FEB2B2',
    fontSize: 14,
    marginBottom: 12,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#4ECDC4',
  },
  retryButtonText: {
    color: '#1A202C',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptyBody: {
    color: '#A0AEC0',
    fontSize: 14,
    lineHeight: 20,
  },
  clueCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(245, 101, 101, 0.18)',
  },
  badgeText: {
    color: '#FEB2B2',
    fontSize: 12,
    fontWeight: '700',
  },
  dateText: {
    color: '#718096',
    fontSize: 12,
  },
  clueText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 8,
  },
  metaText: {
    color: '#4ECDC4',
    fontSize: 13,
    marginBottom: 4,
  },
  locationIdText: {
    color: '#718096',
    fontSize: 12,
    marginBottom: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    alignItems: 'center',
  },
  metricLabel: {
    color: '#A0AEC0',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
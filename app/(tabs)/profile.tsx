import { useAuth } from '@/hooks/useAuth';
import { getUserProgress, type UserProgress } from '@/services/storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ProfileScreen() {
  const { user, isLoading: authLoading, signIn, signOut } = useAuth();
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadProgress = async () => {
      const userProgress = await getUserProgress();
      setProgress(userProgress);
      setIsLoading(false);
    };

    loadProgress();
  }, []);

  if (isLoading || authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* User profile */}
      <View style={styles.avatarContainer}>
        {user?.picture ? (
          <Image source={{ uri: user.picture }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0).toUpperCase() || 'G'}
            </Text>
          </View>
        )}
        <Text style={styles.nameText}>
          {user?.name || 'Guest Player'}
        </Text>
        {user?.email && (
          <Text style={styles.emailText}>{user.email}</Text>
        )}
        {!user && (
          <Text style={styles.signInHint}>Sign in to sync your progress across devices</Text>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Your Stats</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{progress?.gamesPlayed || 0}</Text>
            <Text style={styles.statLabel}>Games Played</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{progress?.totalScore || 0}</Text>
            <Text style={styles.statLabel}>Total Score</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{progress?.highScore || 0}</Text>
            <Text style={styles.statLabel}>Best Game</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{progress?.streak || 0}</Text>
            <Text style={styles.statLabel}>Current Streak</Text>
          </View>
        </View>

        {progress && progress.gamesPlayed > 0 && (
          <View style={styles.averageContainer}>
            <Text style={styles.averageLabel}>Average Score</Text>
            <Text style={styles.averageValue}>
              {Math.round(progress.totalScore / progress.gamesPlayed)}
            </Text>
          </View>
        )}
      </View>

      {/* Achievements */}
      <View style={styles.achievementsCard}>
        <Text style={styles.achievementsTitle}>Achievements</Text>
        <View style={styles.achievementsList}>
          <View style={[styles.achievement, progress && progress.gamesPlayed >= 1 && styles.achievementUnlocked]}>
            <Text style={styles.achievementIcon}>🎯</Text>
            <Text style={styles.achievementText}>First Game</Text>
          </View>
          <View style={[styles.achievement, progress && progress.streak >= 3 && styles.achievementUnlocked]}>
            <Text style={styles.achievementIcon}>🔥</Text>
            <Text style={styles.achievementText}>3-Day Streak</Text>
          </View>
          <View style={[styles.achievement, progress && progress.highScore >= 400 && styles.achievementUnlocked]}>
            <Text style={styles.achievementIcon}>⭐</Text>
            <Text style={styles.achievementText}>Score 400+</Text>
          </View>
          <View style={[styles.achievement, progress && progress.gamesPlayed >= 10 && styles.achievementUnlocked]}>
            <Text style={styles.achievementIcon}>🌍</Text>
            <Text style={styles.achievementText}>10 Games</Text>
          </View>
        </View>
      </View>

      {/* Sign in/out button */}
      {user ? (
        <Pressable style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.signInButton} onPress={signIn}>
          <Text style={styles.signInButtonText}>Sign In with Google</Text>
        </Pressable>
      )}

      {user && (
        <Text style={styles.syncInfo}>
          Your progress is synced to your account
        </Text>
      )}
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A202C',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4ECDC4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  avatarText: {
    color: '#1A202C',
    fontSize: 36,
    fontWeight: '700',
  },
  nameText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  emailText: {
    color: '#718096',
    fontSize: 14,
    marginTop: 4,
  },
  signInHint: {
    color: '#718096',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  statsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  statsTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    width: '50%',
    paddingVertical: 12,
  },
  statValue: {
    color: '#4ECDC4',
    fontSize: 28,
    fontWeight: '700',
  },
  statLabel: {
    color: '#718096',
    fontSize: 12,
    marginTop: 4,
  },
  averageContainer: {
    borderTopWidth: 1,
    borderTopColor: '#2D3748',
    paddingTop: 16,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  averageLabel: {
    color: '#A0AEC0',
    fontSize: 14,
  },
  averageValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  achievementsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  achievementsTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  achievementsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  achievement: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    opacity: 0.5,
  },
  achievementUnlocked: {
    opacity: 1,
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
  },
  achievementIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  achievementText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  signInButton: {
    backgroundColor: '#4285F4',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#718096',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  signOutButtonText: {
    color: '#718096',
    fontSize: 16,
    fontWeight: '600',
  },
  syncInfo: {
    color: '#4ECDC4',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
});

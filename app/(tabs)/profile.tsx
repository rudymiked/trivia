import { Brand } from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { isAllowedAdminEmail } from '@/services/admin';
import {
  addUserAchievement,
  deleteUserAchievement,
  fetchUserAchievements,
  syncUserAchievements,
  type UserAchievement,
} from '@/services/api';
import { getUserProgress, type UserProgress } from '@/services/storage';
import { Href, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const DEFAULT_ACHIEVEMENTS: UserAchievement[] = [
  { id: 'first_game', title: 'First Game', icon: '🎯', description: 'Complete your first daily game.', unlocked: false, source: 'catalog' },
  { id: 'streak_3', title: '3-Day Streak', icon: '🔥', description: 'Keep your streak alive for 3 days.', unlocked: false, source: 'catalog' },
  { id: 'streak_7', title: '7-Day Streak', icon: '⚡', description: 'Maintain a 7-day run.', unlocked: false, source: 'catalog' },
  { id: 'games_10', title: '10 Games', icon: '🌍', description: 'Finish 10 total games.', unlocked: false, source: 'catalog' },
  { id: 'games_25', title: '25 Games', icon: '🧭', description: 'Finish 25 total games.', unlocked: false, source: 'catalog' },
  { id: 'score_400', title: 'Score 400+', icon: '⭐', description: 'Reach 400+ points in a single game.', unlocked: false, source: 'catalog' },
  { id: 'score_450', title: 'Score 450+', icon: '🏅', description: 'Reach 450+ points in a single game.', unlocked: false, source: 'catalog' },
  { id: 'total_5000', title: '5K Club', icon: '💎', description: 'Accumulate 5,000 total points.', unlocked: false, source: 'catalog' },
  { id: 'total_20000', title: '20K Club', icon: '👑', description: 'Accumulate 20,000 total points.', unlocked: false, source: 'catalog' },
];

function buildFallbackAchievements(progress: UserProgress | null): UserAchievement[] {
  if (!progress) {
    return DEFAULT_ACHIEVEMENTS;
  }

  return DEFAULT_ACHIEVEMENTS.map((achievement) => {
    let unlocked = false;

    if (achievement.id === 'first_game') unlocked = progress.gamesPlayed >= 1;
    if (achievement.id === 'streak_3') unlocked = progress.streak >= 3;
    if (achievement.id === 'streak_7') unlocked = progress.streak >= 7;
    if (achievement.id === 'games_10') unlocked = progress.gamesPlayed >= 10;
    if (achievement.id === 'games_25') unlocked = progress.gamesPlayed >= 25;
    if (achievement.id === 'score_400') unlocked = progress.highScore >= 400;
    if (achievement.id === 'score_450') unlocked = progress.highScore >= 450;
    if (achievement.id === 'total_5000') unlocked = progress.totalScore >= 5000;
    if (achievement.id === 'total_20000') unlocked = progress.totalScore >= 20000;

    return {
      ...achievement,
      unlocked,
    };
  });
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading, authError, clearAuthError, signIn, signOut, getValidIdToken } = useAuth();
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [achievements, setAchievements] = useState<UserAchievement[]>(DEFAULT_ACHIEVEMENTS);
  const [customAchievementTitle, setCustomAchievementTitle] = useState('');
  const [customAchievementIcon, setCustomAchievementIcon] = useState('🏆');
  const [customAchievementDescription, setCustomAchievementDescription] = useState('');
  const [isMutatingAchievement, setIsMutatingAchievement] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const canAccessAdminTools = isAllowedAdminEmail(user?.email);
  const customAchievements = achievements.filter((achievement) => achievement.source === 'custom');

  useEffect(() => {
    const loadProgress = async () => {
      const userProgress = await getUserProgress();
      setProgress(userProgress);

      if (user) {
        const idToken = getValidIdToken();
        if (idToken) {
          const syncResult = await syncUserAchievements(user.id, idToken);
          if (syncResult.data?.achievements) {
            setAchievements(syncResult.data.achievements);
            setIsLoading(false);
            return;
          }

          const fallbackApiResult = await fetchUserAchievements(user.id, idToken);
          if (fallbackApiResult.data?.achievements) {
            setAchievements(fallbackApiResult.data.achievements);
            setIsLoading(false);
            return;
          }
        }
      }

      setAchievements(buildFallbackAchievements(userProgress));
      setIsLoading(false);
    };

    void loadProgress();
  }, [getValidIdToken, user]);

  const handleOpenClueFeedbackAdmin = () => {
    router.push('/admin/clue-feedback' as Href);
  };

  const handleOpenPrivacyPolicy = () => {
    router.push('/privacy-policy' as Href);
  };

  const handleOpenTerms = () => {
    router.push('/terms' as Href);
  };

  const handleRetrySignIn = async () => {
    clearAuthError();
    await signIn();
  };

  const handlePlayAsGuest = () => {
    clearAuthError();
    router.push('/' as Href);
  };

  const handleCheckConnection = () => {
    Alert.alert(
      'Check Connection',
      'Make sure you are online and that Google sign-in popups are not blocked, then tap Retry.'
    );
  };

  const handleAddCustomAchievement = async () => {
    if (!user) return;

    const trimmedTitle = customAchievementTitle.trim();
    const trimmedDescription = customAchievementDescription.trim();
    const trimmedIcon = customAchievementIcon.trim() || '🏆';

    if (!trimmedTitle) {
      Alert.alert('Missing Title', 'Enter a title for the custom achievement.');
      return;
    }

    const token = getValidIdToken();
    if (!token) {
      Alert.alert('Sign In Required', 'Please sign in again to manage achievements.');
      return;
    }

    const baseId = trimmedTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 32) || 'custom';
    const achievementId = `custom_${baseId}_${Date.now()}`;

    setIsMutatingAchievement(true);
    const result = await addUserAchievement(user.id, token, {
      achievementId,
      title: trimmedTitle,
      icon: trimmedIcon,
      description: trimmedDescription || 'Custom achievement',
    });
    setIsMutatingAchievement(false);

    if (result.error) {
      Alert.alert('Unable to Add Achievement', result.error);
      return;
    }

    if (result.data?.achievements) {
      setAchievements(result.data.achievements);
    }

    setCustomAchievementTitle('');
    setCustomAchievementDescription('');
    setCustomAchievementIcon('🏆');
  };

  const handleRemoveCustomAchievement = async (achievementId: string) => {
    if (!user) return;

    Alert.alert(
      'Remove Achievement?',
      'This will permanently remove the custom achievement from this account.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const token = getValidIdToken();
            if (!token) {
              Alert.alert('Sign In Required', 'Please sign in again to manage achievements.');
              return;
            }

            setIsMutatingAchievement(true);
            const result = await deleteUserAchievement(user.id, achievementId, token);
            setIsMutatingAchievement(false);

            if (result.error) {
              Alert.alert('Unable to Remove Achievement', result.error);
              return;
            }

            if (result.data?.achievements) {
              setAchievements(result.data.achievements);
            }
          },
        },
      ]
    );
  };

  if (isLoading || authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Brand.aqua} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.guestContainer}>
        {authError && (
          <View style={styles.recoveryCard}>
            <Text style={styles.recoveryTitle}>Sign-in is unavailable right now</Text>
            <Text style={styles.recoveryBody}>{authError}</Text>
            <View style={styles.recoveryActionsRow}>
              <Pressable style={styles.secondaryRecoveryButton} onPress={handleRetrySignIn}>
                <Text style={styles.secondaryRecoveryButtonText}>Retry</Text>
              </Pressable>
              <Pressable style={styles.secondaryRecoveryButton} onPress={handleCheckConnection}>
                <Text style={styles.secondaryRecoveryButtonText}>Check connection</Text>
              </Pressable>
            </View>
            <Pressable style={styles.primaryRecoveryButton} onPress={handlePlayAsGuest}>
              <Text style={styles.primaryRecoveryButtonText}>Play as guest</Text>
            </Pressable>
          </View>
        )}

        <Pressable style={styles.signInButton} onPress={signIn}>
          <Text style={styles.signInButtonText}>Sign In with Google</Text>
        </Pressable>

        <View style={styles.legalLinksRow}>
          <Pressable onPress={handleOpenPrivacyPolicy} hitSlop={8}>
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </Pressable>
          <Text style={styles.legalDivider}>•</Text>
          <Pressable onPress={handleOpenTerms} hitSlop={8}>
            <Text style={styles.legalLink}>Terms of Use</Text>
          </Pressable>
        </View>
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
          {achievements.map((achievement) => (
            <View
              key={achievement.id}
              style={[styles.achievement, achievement.unlocked && styles.achievementUnlocked]}
            >
              <Text style={styles.achievementIcon}>{achievement.icon}</Text>
              <View style={styles.achievementContent}>
                <Text style={styles.achievementText}>{achievement.title}</Text>
                <Text style={styles.achievementDescription}>{achievement.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Sign out button */}
      {canAccessAdminTools && (
        <View style={styles.adminCard}>
          <Text style={styles.adminTitle}>Admin Tools</Text>
          <Text style={styles.adminBody}>
            Review low-rated clues and spot repeat offenders quickly.
          </Text>
          <Pressable style={styles.adminButton} onPress={handleOpenClueFeedbackAdmin}>
            <Text style={styles.adminButtonText}>Open Clue Feedback Report</Text>
          </Pressable>
        </View>
      )}

      {canAccessAdminTools && (
        <View style={styles.adminCard}>
          <Text style={styles.adminTitle}>Custom Achievements</Text>
          <Text style={styles.adminBody}>
            Add or remove custom achievements for this account.
          </Text>

          <View style={styles.customFieldGroup}>
            <Text style={styles.customFieldLabel}>Title</Text>
            <TextInput
              value={customAchievementTitle}
              onChangeText={setCustomAchievementTitle}
              placeholder="Achievement title"
              placeholderTextColor={Brand.slate}
              style={styles.customInput}
            />
          </View>

          <View style={styles.customFieldGroup}>
            <Text style={styles.customFieldLabel}>Icon</Text>
            <TextInput
              value={customAchievementIcon}
              onChangeText={setCustomAchievementIcon}
              placeholder="🏆"
              placeholderTextColor={Brand.slate}
              style={styles.customInput}
              maxLength={4}
            />
          </View>

          <View style={styles.customFieldGroup}>
            <Text style={styles.customFieldLabel}>Description</Text>
            <TextInput
              value={customAchievementDescription}
              onChangeText={setCustomAchievementDescription}
              placeholder="Short description"
              placeholderTextColor={Brand.slate}
              style={[styles.customInput, styles.customInputMultiline]}
              multiline
            />
          </View>

          <Pressable
            style={[styles.adminButton, isMutatingAchievement && styles.adminButtonDisabled]}
            onPress={handleAddCustomAchievement}
            disabled={isMutatingAchievement}
          >
            <Text style={styles.adminButtonText}>Add Custom Achievement</Text>
          </Pressable>

          <View style={styles.customAchievementsList}>
            {customAchievements.length === 0 ? (
              <Text style={styles.customEmptyText}>No custom achievements yet.</Text>
            ) : (
              customAchievements.map((achievement) => (
                <View key={achievement.id} style={styles.customAchievementRow}>
                  <Text style={styles.customAchievementTitle}>
                    {achievement.icon} {achievement.title}
                  </Text>
                  <Pressable
                    style={styles.customRemoveButton}
                    onPress={() => handleRemoveCustomAchievement(achievement.id)}
                  >
                    <Text style={styles.customRemoveButtonText}>Remove</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </View>
      )}

      <Pressable style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutButtonText}>Sign Out</Text>
      </Pressable>

      <Text style={styles.syncInfo}>
        Your progress is synced to your account
      </Text>

      <View style={styles.legalLinksRow}>
        <Pressable onPress={handleOpenPrivacyPolicy} hitSlop={8}>
          <Text style={styles.legalLink}>Privacy Policy</Text>
        </Pressable>
        <Text style={styles.legalDivider}>•</Text>
        <Pressable onPress={handleOpenTerms} hitSlop={8}>
          <Text style={styles.legalLink}>Terms of Use</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.midnight,
  },
  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 32,
    gap: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Brand.midnight,
  },
  guestContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: Brand.midnight,
  },
  recoveryCard: {
    marginBottom: 20,
    padding: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(242, 139, 91, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(242, 139, 91, 0.3)',
  },
  recoveryTitle: {
    color: Brand.white,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  recoveryBody: {
    color: Brand.mist,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  recoveryActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  secondaryRecoveryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(180, 199, 206, 0.3)',
    alignItems: 'center',
  },
  secondaryRecoveryButtonText: {
    color: Brand.white,
    fontSize: 14,
    fontWeight: '600',
  },
  primaryRecoveryButton: {
    backgroundColor: Brand.aqua,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryRecoveryButtonText: {
    color: Brand.midnight,
    fontSize: 15,
    fontWeight: '700',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 8,
    padding: 24,
    backgroundColor: 'rgba(87, 211, 203, 0.08)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(87, 211, 203, 0.15)',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Brand.aqua,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 14,
  },
  avatarText: {
    color: Brand.midnight,
    fontSize: 32,
    fontWeight: '800',
  },
  nameText: {
    color: Brand.white,
    fontSize: 22,
    fontWeight: '800',
    fontFamily: 'SpaceMono',
    letterSpacing: 0.5,
  },
  emailText: {
    color: Brand.slate,
    fontSize: 13,
    marginTop: 6,
  },
  statsCard: {
    backgroundColor: 'rgba(87, 211, 203, 0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(87, 211, 203, 0.15)',
    padding: 22,
  },
  statsTitle: {
    color: Brand.white,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'SpaceMono',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    width: '50%',
    paddingVertical: 14,
  },
  statValue: {
    color: Brand.gold,
    fontSize: 32,
    fontWeight: '800',
  },
  statLabel: {
    color: Brand.slate,
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  averageContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(87, 211, 203, 0.2)',
    paddingTop: 16,
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  averageLabel: {
    color: Brand.mist,
    fontSize: 14,
    fontWeight: '500',
  },
  averageValue: {
    color: Brand.gold,
    fontSize: 24,
    fontWeight: '800',
  },
  achievementsCard: {
    backgroundColor: 'rgba(242, 193, 78, 0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(242, 193, 78, 0.15)',
    padding: 22,
  },
  achievementsTitle: {
    color: Brand.white,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'SpaceMono',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  achievementsList: {
    gap: 10,
  },
  achievement: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(140, 161, 168, 0.1)',
    opacity: 0.45,
    borderWidth: 1,
    borderColor: 'rgba(140, 161, 168, 0.15)',
  },
  achievementUnlocked: {
    opacity: 1,
    backgroundColor: 'rgba(242, 193, 78, 0.15)',
    borderColor: 'rgba(242, 193, 78, 0.3)',
  },
  achievementIcon: {
    fontSize: 18,
    marginRight: 8,
    marginTop: 1,
  },
  achievementContent: {
    flex: 1,
  },
  achievementText: {
    color: Brand.white,
    fontSize: 13,
    fontWeight: '600',
  },
  achievementDescription: {
    color: Brand.slate,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  adminCard: {
    backgroundColor: 'rgba(87, 211, 203, 0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(87, 211, 203, 0.25)',
    padding: 22,
  },
  adminTitle: {
    color: Brand.aqua,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'SpaceMono',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  adminBody: {
    color: Brand.mist,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  adminButton: {
    backgroundColor: Brand.aqua,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  adminButtonText: {
    color: Brand.midnight,
    fontSize: 15,
    fontWeight: '800',
  },
  adminButtonDisabled: {
    opacity: 0.55,
  },
  customFieldGroup: {
    marginBottom: 10,
  },
  customFieldLabel: {
    color: Brand.mist,
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  customInput: {
    borderWidth: 1,
    borderColor: 'rgba(180, 199, 206, 0.35)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Brand.white,
    backgroundColor: 'rgba(7, 26, 38, 0.45)',
  },
  customInputMultiline: {
    minHeight: 68,
    textAlignVertical: 'top',
  },
  customAchievementsList: {
    marginTop: 12,
    gap: 8,
  },
  customEmptyText: {
    color: Brand.slate,
    fontSize: 12,
  },
  customAchievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(180, 199, 206, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  customAchievementTitle: {
    color: Brand.white,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  customRemoveButton: {
    borderWidth: 1,
    borderColor: 'rgba(242, 139, 91, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  customRemoveButtonText: {
    color: Brand.coral,
    fontSize: 12,
    fontWeight: '700',
  },
  signInButton: {
    backgroundColor: Brand.aqua,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signInButtonText: {
    color: Brand.midnight,
    fontSize: 16,
    fontWeight: '800',
  },
  signOutButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(180, 199, 206, 0.3)',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  signOutButtonText: {
    color: Brand.mist,
    fontSize: 16,
    fontWeight: '700',
  },
  legalLinksRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  legalLink: {
    color: Brand.slate,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  legalDivider: {
    color: Brand.slate,
    fontSize: 12,
  },
  syncInfo: {
    color: Brand.aqua,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
});

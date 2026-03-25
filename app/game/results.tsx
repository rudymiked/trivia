import { useAuth } from '@/hooks/useAuth';
import { useGameStore } from '@/hooks/useGame';
import { submitClueFeedback, submitScore } from '@/services/api';
import { getUserProgress, saveDailyResult, saveGameResult, type UserProgress } from '@/services/storage';
import { trackTelemetryEvent } from '@/services/telemetry';
import { ClueFeedbackRating } from '@/types/game';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

export default function ResultsScreen() {
  const router = useRouter();
  const { user, getValidIdToken, signIn } = useAuth();
  const { puzzle, results, totalScore, resetGame } = useGameStore();
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [copied, setCopied] = useState(false);
  const [synced, setSynced] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [feedbackByLocationId, setFeedbackByLocationId] = useState<Record<string, ClueFeedbackRating>>({});
  const [feedbackErrorByLocationId, setFeedbackErrorByLocationId] = useState<Record<string, string | null>>({});
  const [submittingFeedback, setSubmittingFeedback] = useState<Record<string, boolean>>({});
  const [isFeedbackModalVisible, setIsFeedbackModalVisible] = useState(false);
  const [selectedFeedbackRoundIndex, setSelectedFeedbackRoundIndex] = useState<number | null>(null);

  // Check if this is a daily puzzle (date-based ID)
  const isDailyPuzzle = puzzle && /^\d{4}-\d{2}-\d{2}$/.test(puzzle.id);
  const feedbackRoundEntries = puzzle
    ? puzzle.rounds
        .map((round, index) => ({ round, index }))
        .filter(({ round }) => round.locationId && round.category === 'questions')
    : [];
  const displayTotalScore = Number.isFinite(totalScore) ? Math.round(totalScore) : 0;

  useEffect(() => {
    const saveAndLoadProgress = async () => {
      const currentProgress = await getUserProgress();
      if (puzzle) {
        // Only save to progress/stats for daily puzzles
        if (isDailyPuzzle) {
          await saveGameResult(puzzle.date, totalScore, currentProgress.lastPlayedDate);
          // Save the full results for this daily puzzle
          await saveDailyResult(puzzle.date, totalScore, results);
        }

        // Sync to backend if logged in with valid token (daily puzzles only)
        if (user && isDailyPuzzle) {
          try {
            const roundScores = results.map(r => Math.round(r.score));
            const validToken = getValidIdToken();
            // Extract location IDs from puzzle rounds for tracking
            const locationIds = puzzle.rounds
              .map(r => r.locationId)
              .filter((id): id is string => id !== undefined);
            const submitResponse = await submitScore(
              puzzle.date,
              user.id,
              user.name,
              totalScore,
              roundScores,
              validToken || undefined,
              locationIds.length > 0 ? locationIds : undefined
            );

            if (submitResponse.error) {
              if (submitResponse.errorCode === 'DUPLICATE_SUBMISSION') {
                setSynced(true);
                setSyncError(null);
              } else {
                setSynced(false);
                setSyncError(submitResponse.error);
              }
            } else {
              setSynced(true);
              setSyncError(null);
            }
          } catch (error) {
            console.error('Failed to sync score:', error);
            setSynced(false);
            setSyncError('Network error while syncing score.');
          }
        }
      }
      const updatedProgress = await getUserProgress();
      setProgress(updatedProgress);
    };

    saveAndLoadProgress();
  }, [puzzle, totalScore, results, user, isDailyPuzzle, getValidIdToken]);

  const getScoreEmoji = (score: number, multiplier: number) => {
    const baseScore = score / multiplier;
    if (baseScore >= 90) return '🟢';
    if (baseScore >= 70) return '🟡';
    if (baseScore >= 50) return '🟠';
    return '🔴';
  };

  const generateShareText = () => {
    if (!puzzle) return '';

    const emojiGrid = results.map((r) => getScoreEmoji(r.score, r.multiplier)).join('');
    const date = new Date(puzzle.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    const appUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://pinpoint.app';

    return `PinPoint ${date}

${emojiGrid} ${totalScore}/500

Play at: ${appUrl}`;
  };

  const handleShare = async () => {
    const shareText = generateShareText();

    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      try {
        await Share.share({
          message: shareText,
        });
      } catch {
        // User cancelled
      }
    }
  };

  const handlePlayAgain = () => {
    resetGame();
    router.replace('/');
  };

  const handleSignIn = () => {
    signIn();
  };

  const handleOpenFeedbackModal = (roundIndex: number) => {
    setSelectedFeedbackRoundIndex(roundIndex);
    setIsFeedbackModalVisible(true);
  };

  const handleCloseFeedbackModal = () => {
    setIsFeedbackModalVisible(false);
    setSelectedFeedbackRoundIndex(null);
  };

  const handleClueFeedback = async (roundIndex: number, feedback: ClueFeedbackRating) => {
    if (!puzzle) return;

    const round = puzzle.rounds[roundIndex];
    const locationId = round?.locationId;
    if (!locationId || feedbackByLocationId[locationId]) return;

    setSubmittingFeedback((current) => ({ ...current, [locationId]: true }));
    setFeedbackErrorByLocationId((current) => ({ ...current, [locationId]: null }));

    try {
      const response = await submitClueFeedback({
        puzzleDate: puzzle.date,
        locationId,
        feedback,
        clue: round.clue,
        country: round.country,
        answer: round.answer,
      });

      if (response.error) {
        setFeedbackErrorByLocationId((current) => ({
          ...current,
          [locationId]: response.error || 'Failed to save feedback.',
        }));
        return;
      }

      setFeedbackByLocationId((current) => ({ ...current, [locationId]: feedback }));
      void trackTelemetryEvent('clue_feedback_submitted', {
        puzzleDate: puzzle.date,
        locationId,
        feedback,
      });
    } catch (error) {
      console.error('Failed to submit clue feedback:', error);
      setFeedbackErrorByLocationId((current) => ({
        ...current,
        [locationId]: 'Failed to save feedback.',
      }));
    } finally {
      setSubmittingFeedback((current) => ({ ...current, [locationId]: false }));
    }
  };

  if (!puzzle) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No game data found</Text>
        <Pressable style={styles.button} onPress={handlePlayAgain}>
          <Text style={styles.buttonText}>Go Home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable style={styles.topLeaveButton} onPress={handlePlayAgain}>
          <Text style={styles.topLeaveButtonText}>Back to Home</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Game Complete!</Text>

        {/* Score summary */}
        <View style={styles.scoreCard}>
          <Text style={styles.dateText}>
            {new Date(puzzle.date).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>

          <Text style={styles.totalScore}>{displayTotalScore}</Text>
          <Text style={styles.maxScore}>out of 500</Text>

          {/* Login prompt for anonymous users */}
          {!user && (
            <View style={styles.loginPrompt}>
              <Text style={styles.loginPromptTitle}>Save Your Score!</Text>
              <Text style={styles.loginPromptText}>
                Sign in to see your scores on the leaderboard and track your progress across devices.
              </Text>
              <Pressable style={styles.loginButton} onPress={handleSignIn}>
                <Text style={styles.loginButtonText}>Sign In with Google</Text>
              </Pressable>
            </View>
          )}

          {/* Round breakdown */}
          <View style={styles.roundsContainer}>
            {results.map((result, index) => {
              const round = puzzle.rounds[index];
              const locationId = round?.locationId;
              const hasLocationId = !!locationId;
              
              return (
                <View key={index} style={styles.roundBlock}>
                  <View style={styles.roundRow}>
                    <View style={styles.roundLabelContainer}>
                      <Text style={styles.roundLabel} numberOfLines={2}>
                        {round?.clue || `Round ${index + 1}`}
                      </Text>
                      {hasLocationId && (
                        <Pressable
                          style={styles.feedbackIconButton}
                          onPress={() => handleOpenFeedbackModal(index)}
                          hitSlop={8}
                        >
                          <Ionicons name="help-circle-outline" size={16} color="#A0AEC0" />
                        </Pressable>
                      )}
                    </View>
                    <View style={styles.roundScoreContainer}>
                      <Text style={styles.roundEmoji}>
                        {getScoreEmoji(result.score, result.multiplier)}
                      </Text>
                      <Text style={styles.roundScore}>
                        {Math.round(result.score / result.multiplier)}
                        {result.multiplier > 1 && (
                          <Text style={styles.multiplier}> x{result.multiplier}</Text>
                        )}
                      </Text>
                      <Text style={styles.roundDistance}>
                        {Math.round(result.distanceKm)} km
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Stats */}
        {progress && (
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

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {user && isDailyPuzzle && synced && (
            <Text style={styles.syncSuccessText}>Score synced to leaderboard</Text>
          )}
          {user && isDailyPuzzle && syncError && (
            <Text style={styles.syncErrorText}>{syncError}</Text>
          )}

          <Pressable style={styles.shareButton} onPress={handleShare}>
            <Text style={styles.shareButtonText}>
              {copied ? 'Copied!' : Platform.OS === 'web' ? 'Copy Results' : 'Share Results'}
            </Text>
          </Pressable>

          <Pressable style={styles.homeButton} onPress={handlePlayAgain}>
            <Text style={styles.homeButtonText}>Back to Home</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        transparent
        animationType="slide"
        visible={isFeedbackModalVisible}
        onRequestClose={handleCloseFeedbackModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.feedbackModalCard}>
            <View style={styles.feedbackModalHeader}>
              <Text style={styles.feedbackModalTitle}>Question Feedback</Text>
              <Pressable onPress={handleCloseFeedbackModal}>
                <Text style={styles.feedbackModalClose}>Done</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.feedbackModalScroll}>
              {selectedFeedbackRoundIndex !== null && puzzle.rounds[selectedFeedbackRoundIndex] && (
                (() => {
                  const round = puzzle.rounds[selectedFeedbackRoundIndex];
                  const locationId = round.locationId as string;

                  return (
                    <View style={styles.feedbackCard}>
                      <Text style={styles.feedbackPrompt}>{round.clue}</Text>
                      <View style={styles.feedbackButtonRow}>
                        {(['easy', 'hard', 'unclear'] as ClueFeedbackRating[]).map((option) => {
                          const isSelected = feedbackByLocationId[locationId] === option;
                          const isDisabled = !!feedbackByLocationId[locationId] || !!submittingFeedback[locationId];

                          return (
                            <Pressable
                              key={option}
                              style={[
                                styles.feedbackButton,
                                isSelected && styles.feedbackButtonSelected,
                              ]}
                              onPress={() => handleClueFeedback(selectedFeedbackRoundIndex, option)}
                              disabled={isDisabled}
                            >
                              <Text
                                style={[
                                  styles.feedbackButtonText,
                                  isSelected && styles.feedbackButtonTextSelected,
                                ]}
                              >
                                {option === 'easy' ? 'Easy' : option === 'hard' ? 'Hard' : 'Unclear'}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      {feedbackByLocationId[locationId] && (
                        <Text style={styles.feedbackThanksText}>Thanks for rating this clue.</Text>
                      )}
                      {feedbackErrorByLocationId[locationId] && (
                        <Text style={styles.feedbackErrorText}>
                          {feedbackErrorByLocationId[locationId]}
                        </Text>
                      )}
                    </View>
                  );
                })()
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A202C',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 4,
    paddingBottom: 28,
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
    alignItems: 'flex-end',
  },
  topLeaveButton: {
    borderWidth: 1,
    borderColor: '#4A5568',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topLeaveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  scoreCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  dateText: {
    color: '#A0AEC0',
    fontSize: 14,
    marginBottom: 8,
  },
  totalScore: {
    color: '#4ECDC4',
    fontSize: 72,
    fontWeight: '700',
  },
  maxScore: {
    color: '#718096',
    fontSize: 18,
    marginBottom: 24,
  },
  roundsContainer: {
    width: '100%',
  },
  roundBlock: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 8,
  },
  roundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roundLabelContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    gap: 8,
  },
  roundLabel: {
    flex: 1,
    color: '#A0AEC0',
    fontSize: 14,
    lineHeight: 18,
  },
  feedbackIconButton: {
    padding: 4,
  },
  roundScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roundEmoji: {
    fontSize: 16,
  },
  roundScore: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    minWidth: 50,
  },
  multiplier: {
    color: '#FFE66D',
    fontSize: 12,
  },
  roundDistance: {
    color: '#718096',
    fontSize: 12,
    minWidth: 60,
    textAlign: 'right',
  },
  feedbackCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  feedbackPrompt: {
    color: '#A0AEC0',
    fontSize: 13,
    marginBottom: 10,
  },
  feedbackButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  feedbackButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4A5568',
    alignItems: 'center',
  },
  feedbackButtonSelected: {
    backgroundColor: '#4ECDC4',
    borderColor: '#4ECDC4',
  },
  feedbackButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  feedbackButtonTextSelected: {
    color: '#1A202C',
  },
  feedbackThanksText: {
    color: '#4ECDC4',
    fontSize: 12,
    marginTop: 8,
  },
  feedbackErrorText: {
    color: '#FFB86B',
    fontSize: 12,
    marginTop: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 24,
    paddingVertical: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  statLabel: {
    color: '#718096',
    fontSize: 12,
    marginTop: 4,
  },
  actionsContainer: {
    marginTop: 32,
    gap: 12,
  },
  syncSuccessText: {
    color: '#4ECDC4',
    fontSize: 13,
    textAlign: 'center',
  },
  syncErrorText: {
    color: '#FFB86B',
    fontSize: 13,
    textAlign: 'center',
  },
  shareButton: {
    backgroundColor: '#4ECDC4',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#1A202C',
    fontSize: 18,
    fontWeight: '700',
  },
  homeButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#4A5568',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  homeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#4ECDC4',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#1A202C',
    fontSize: 18,
    fontWeight: '700',
  },
  loginPrompt: {
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.3)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  loginPromptTitle: {
    color: '#4ECDC4',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  loginPromptText: {
    color: '#A0AEC0',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  loginButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  loginButtonText: {
    color: '#1A202C',
    fontSize: 16,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1A202C',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.4)',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalBody: {
    color: '#A0AEC0',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  modalPrimaryButton: {
    backgroundColor: '#4ECDC4',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  modalPrimaryButtonText: {
    color: '#1A202C',
    fontSize: 15,
    fontWeight: '700',
  },
  modalSecondaryButton: {
    borderWidth: 1,
    borderColor: '#4A5568',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalSecondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  feedbackModalCard: {
    backgroundColor: '#1A202C',
    borderRadius: 18,
    maxHeight: '78%',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.35)',
  },
  feedbackModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  feedbackModalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  feedbackModalClose: {
    color: '#4ECDC4',
    fontSize: 14,
    fontWeight: '700',
  },
  feedbackModalScroll: {
    maxHeight: 440,
  },
});

import { useAuth } from '@/hooks/useAuth';
import { useGameStore } from '@/hooks/useGame';
import { submitClueFeedback, submitScore } from '@/services/api';
import { getUserProgress, saveDailyResult, saveGameResult, type UserProgress } from '@/services/storage';
import { trackTelemetryEvent } from '@/services/telemetry';
import { ClueFeedbackRating } from '@/types/game';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

// Parse a YYYY-MM-DD date string as local time to avoid UTC offset shifting the day
function parsePuzzleDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

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
  const trackedCompletionRef = useRef(false);
  const trackedSignInPromptRef = useRef(false);
  const [animatedScore, setAnimatedScore] = useState(0);
  const scoreFadeAnim = useRef(new Animated.Value(0)).current;
  const scoreScaleAnim = useRef(new Animated.Value(0.5)).current;

  // Check if this is a daily puzzle (date-based ID)
  const isDailyPuzzle = puzzle && /^\d{4}-\d{2}-\d{2}$/.test(puzzle.id);
  const feedbackRoundEntries = puzzle
    ? puzzle.rounds
        .map((round, index) => ({ round, index }))
        .filter(({ round }) => round.locationId && round.category === 'questions')
    : [];
  const displayTotalScore = Number.isFinite(totalScore) ? Math.round(totalScore) : 0;

  // Score count-up animation on mount
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scoreScaleAnim, { toValue: 1, tension: 70, friction: 8, useNativeDriver: true }),
      Animated.timing(scoreFadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    const target = displayTotalScore;
    if (target === 0) return;
    const duration = 900;
    const steps = 40;
    const interval = duration / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(eased * target));
      if (step >= steps) {
        clearInterval(timer);
        setAnimatedScore(target);
      }
    }, interval);
    return () => clearInterval(timer);
  }, [displayTotalScore]);
  const maxPossibleScore =
    results.length > 0
      ? Math.round(
          results.reduce(
            (sum, r) => sum + 100 * (Number.isFinite(r.multiplier) && r.multiplier > 0 ? r.multiplier : 1),
            0
          )
        )
      : 500;

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
            const validToken = getValidIdToken();

            // Token is expired — skip the API call and prompt re-auth immediately
            if (!validToken) {
              setSynced(false);
              setSyncError('SESSION_EXPIRED');
              void trackTelemetryEvent('score_submission_failed', {
                puzzleDate: puzzle.date,
                errorCode: 'TOKEN_EXPIRED',
                errorMessage: 'Token expired before submission',
              });
            } else {
              const roundScores = results.map(r => Math.round(r.score));
              const totalRounded = roundScores.reduce((sum, score) => sum + score, 0);
              // Extract location IDs from puzzle rounds for tracking
              const locationIds = puzzle.rounds
                .map(r => r.locationId)
                .filter((id): id is string => id !== undefined);
              const submitResponse = await submitScore(
                puzzle.date,
                user.id,
                user.name,
                totalRounded,
                roundScores,
                validToken,
                locationIds.length > 0 ? locationIds : undefined
              );

              if (submitResponse.error) {
                if (submitResponse.errorCode === 'DUPLICATE_SUBMISSION') {
                  setSynced(true);
                  setSyncError('DUPLICATE_SUBMISSION');
                } else if (
                  submitResponse.errorCode === 'AUTH_REQUIRED' ||
                  submitResponse.errorCode === 'INVALID_AUTH_TOKEN'
                ) {
                  // Token was rejected server-side — treat like an expired session
                  // so the prominent re-auth card is shown instead of small text.
                  setSynced(false);
                  setSyncError('SESSION_EXPIRED');
                  void trackTelemetryEvent('score_submission_failed', {
                    puzzleDate: puzzle.date,
                    errorCode: submitResponse.errorCode ?? null,
                    errorMessage: submitResponse.error,
                  });
                } else {
                  setSynced(false);
                  setSyncError(submitResponse.error);
                  void trackTelemetryEvent('score_submission_failed', {
                    puzzleDate: puzzle.date,
                    errorCode: submitResponse.errorCode ?? null,
                    errorMessage: submitResponse.error,
                  });
                }
              } else {
                setSynced(true);
                setSyncError(null);
              }
            }
          } catch (error) {
            console.error('Failed to sync score:', error);
            setSynced(false);
            setSyncError('Network error while syncing score.');
            void trackTelemetryEvent('score_submission_failed', {
              puzzleDate: puzzle.date,
              errorCode: 'NETWORK_ERROR',
              errorMessage: 'Network error while syncing score.',
            });
          }
        }
      }
      const updatedProgress = await getUserProgress();
      setProgress(updatedProgress);
    };

    saveAndLoadProgress();
  }, [puzzle, totalScore, results, user, isDailyPuzzle, getValidIdToken]);

  useEffect(() => {
    if (!puzzle || !isDailyPuzzle || trackedCompletionRef.current) return;

    trackedCompletionRef.current = true;
    void trackTelemetryEvent('daily_puzzle_completed', {
      puzzleDate: puzzle.date,
      totalScore: Math.round(totalScore),
      roundsCompleted: results.length,
      isAuthenticated: !!user,
    });
  }, [puzzle, isDailyPuzzle, results.length, totalScore, user]);

  useEffect(() => {
    if (!puzzle || user || !isDailyPuzzle || trackedSignInPromptRef.current) return;

    trackedSignInPromptRef.current = true;
    void trackTelemetryEvent('sign_in_prompt_viewed', {
      source: 'results_screen',
      puzzleDate: puzzle.date,
    });
  }, [puzzle, user, isDailyPuzzle]);

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
    const date = parsePuzzleDate(puzzle.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    const appUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://pinpoint.app';

    return `PinPoint ${date}\n\n${emojiGrid} ${displayTotalScore}/${maxPossibleScore}\n\nPlay at: ${appUrl}`;
  };

  const handleShare = async () => {
    const shareText = generateShareText();

    if (Platform.OS === 'web') {
      // Use native share sheet when available (mobile browsers, Chrome desktop)
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
          await navigator.share({ text: shareText });
          return;
        } catch {
          // User cancelled or share failed — fall through to clipboard
        }
      }
      // Fallback: clipboard copy
      await Clipboard.setStringAsync(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      try {
        await Share.share({ message: shareText });
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
    void trackTelemetryEvent('sign_in_prompt_clicked', {
      source: 'results_screen',
      puzzleDate: puzzle?.date ?? null,
    });
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
            {parsePuzzleDate(puzzle.date).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>

          <Animated.Text
            style={[
              styles.totalScore,
              { opacity: scoreFadeAnim, transform: [{ scale: scoreScaleAnim }] },
            ]}
          >
            {animatedScore}
          </Animated.Text>
          <Text style={styles.maxScore}>out of {maxPossibleScore}</Text>

          {/* Emoji strip preview */}
          <View style={styles.emojiStripRow}>
            {results.map((r, i) => (
              <Text key={i} style={styles.emojiStripItem}>
                {getScoreEmoji(r.score, r.multiplier)}
              </Text>
            ))}
          </View>

          {/* One-tap share — primary CTA, always visible */}
          <Pressable style={styles.shareButtonPrimary} onPress={handleShare}>
            <Text style={styles.shareButtonPrimaryText}>
              {copied
                ? 'Copied!'
                : Platform.OS === 'web' && typeof navigator !== 'undefined' && typeof navigator.share === 'function'
                  ? 'Share Results'
                  : Platform.OS === 'web'
                    ? 'Copy Results'
                    : 'Share Results'}
            </Text>
          </Pressable>

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
          {user && isDailyPuzzle && synced && syncError !== 'DUPLICATE_SUBMISSION' && (
            <Text style={styles.syncSuccessText}>Score synced to leaderboard ✓</Text>
          )}
          {user && isDailyPuzzle && syncError === 'DUPLICATE_SUBMISSION' && (
            <Text style={styles.syncSuccessText}>Your score from your first run is saved ✓</Text>
          )}
          {user && isDailyPuzzle && syncError === 'SESSION_EXPIRED' && (
            <View style={styles.syncErrorCard}>
              <Text style={styles.syncErrorCardText}>
                Your session expired. Sign in again to sync your score to the leaderboard.
              </Text>
              <Pressable style={styles.syncReauthButton} onPress={handleSignIn}>
                <Text style={styles.syncReauthButtonText}>Sign in again</Text>
              </Pressable>
            </View>
          )}
          {user && isDailyPuzzle && syncError && syncError !== 'SESSION_EXPIRED' && (
            <Text style={styles.syncErrorText}>{syncError}</Text>
          )}

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
    alignSelf: 'center',
    minWidth: 280,
    maxWidth: 520,
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
  syncErrorCard: {
    alignSelf: 'center',
    maxWidth: 460,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(237, 137, 54, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(237, 137, 54, 0.4)',
    alignItems: 'center',
    gap: 10,
  },
  syncErrorCardText: {
    color: '#FBD38D',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  syncReauthButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  syncReauthButtonText: {
    color: '#1A202C',
    fontSize: 14,
    fontWeight: '700',
  },
  emojiStripRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    marginBottom: 16,
  },
  emojiStripItem: {
    fontSize: 28,
  },
  shareButtonPrimary: {
    backgroundColor: '#4ECDC4',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 14,
    alignItems: 'center',
    alignSelf: 'center',
    minWidth: 220,
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 4,
  },
  shareButtonPrimaryText: {
    color: '#1A202C',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
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

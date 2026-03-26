import { ClueCard, RoundProgress, ScoreDisplay } from '@/components/game';
import Globe from '@/components/map';
import { useAuth } from '@/hooks/useAuth';
import { useGameStore } from '@/hooks/useGame';
import { checkUserGame } from '@/services/api';
import { generateDailyPuzzleWithSource } from '@/services/puzzle';
import {
  getDailyResult,
  hasCompletedMapWalkthrough,
  markMapWalkthroughCompleted,
  type DailyResult,
} from '@/services/storage';
import { trackTelemetryEvent } from '@/services/telemetry';
import { Coordinates, RoundResult } from '@/types/game';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type GamePhase = 'playing' | 'result' | 'complete';

interface WalkthroughStep {
  title: string;
  body: string;
}

const MAP_WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    title: 'Step 1: Read the clue',
    body: 'Start by reading the clue card at the bottom. It tells you where to search on the map.',
  },
  {
    title: 'Step 2: Tap the map',
    body: 'Drop your guess anywhere on the globe. You can move it until you are happy with the spot.',
  },
  {
    title: 'Step 3: Submit guess',
    body: 'Tap Confirm Guess to lock it in and see your distance and score for the round.',
  },
];

// Server result type (different from local DailyResult)
interface ServerGameResult {
  completed: boolean;
  date: string;
  totalScore?: number;
  rounds?: number[];
  completedAt?: string;
}

export default function GameScreen() {
  const router = useRouter();
  const { puzzleId } = useLocalSearchParams<{ puzzleId: string }>();
  const { user, getValidIdToken } = useAuth();

  const {
    puzzle,
    currentRound,
    results,
    isComplete,
    totalScore,
    startGame,
    submitGuess,
    nextRound,
    resetGame,
  } = useGameStore();

  const [phase, setPhase] = useState<GamePhase>('playing');
  const [currentGuess, setCurrentGuess] = useState<Coordinates | null>(null);
  const [currentResult, setCurrentResult] = useState<RoundResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [alreadyCompleted, setAlreadyCompleted] = useState<DailyResult | null>(null);
  const [serverCompleted, setServerCompleted] = useState<ServerGameResult | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapRetryCount, setMapRetryCount] = useState(0);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [walkthroughStepIndex, setWalkthroughStepIndex] = useState(0);
  const [walkthroughStartMs, setWalkthroughStartMs] = useState<number | null>(null);
  const [walkthroughChecked, setWalkthroughChecked] = useState(false);
  const firstGuessTrackedRef = useRef(false);

  // Check if puzzleId looks like a date (YYYY-MM-DD)
  const isDateBasedPuzzle = /^\d{4}-\d{2}-\d{2}$/.test(puzzleId || '');

  const handleExitGame = useCallback(() => {
    const confirmExit = () => {
      resetGame();
      router.replace('/');
    };

    // If showing completed state, no need to confirm
    if (alreadyCompleted || serverCompleted) {
      confirmExit();
      return;
    }

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to exit? Your progress will be lost.')) {
        confirmExit();
      }
    } else {
      Alert.alert(
        'Exit Game',
        'Are you sure you want to exit? Your progress will be lost.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Exit', style: 'destructive', onPress: confirmExit },
        ]
      );
    }
  }, [resetGame, router, alreadyCompleted, serverCompleted]);

  const dismissWalkthrough = useCallback((reason: 'skip' | 'complete') => {
    if (!showWalkthrough) return;

    const elapsedMs = walkthroughStartMs ? Date.now() - walkthroughStartMs : 0;
    setShowWalkthrough(false);
    setWalkthroughChecked(true);

    void markMapWalkthroughCompleted();
    void trackTelemetryEvent('map_walkthrough_dismissed', {
      reason,
      stepIndex: walkthroughStepIndex,
      elapsedMs,
    });
  }, [showWalkthrough, walkthroughStartMs, walkthroughStepIndex]);

  const handleWalkthroughNext = useCallback(() => {
    if (walkthroughStepIndex >= MAP_WALKTHROUGH_STEPS.length - 1) {
      dismissWalkthrough('complete');
      return;
    }
    setWalkthroughStepIndex((prev) => prev + 1);
  }, [dismissWalkthrough, walkthroughStepIndex]);

  // Load puzzle on mount
  useEffect(() => {
    const loadPuzzle = async () => {
      try {
        // If puzzle is already loaded with matching ID (from play-modes), skip loading
        if (puzzle && puzzle.id === puzzleId) {
          setIsLoading(false);
          return;
        }

        // Guard against missing puzzleId
        if (!puzzleId) {
          console.error('No puzzle ID provided');
          setIsLoading(false);
          return;
        }

        // Only fetch from API for date-based puzzles
        if (isDateBasedPuzzle) {
          // Server-side check for logged-in users
          if (user) {
            const token = getValidIdToken();
            if (token) {
              try {
                const response = await checkUserGame(user.id, puzzleId, token);
                if (response.data?.completed) {
                  setServerCompleted(response.data);
                  setIsLoading(false);
                  return;
                }
              } catch (error) {
                console.error('Failed to check server game status:', error);
                // Fall through to local check
              }
            }
          }

          // Local check for all users (fallback for logged-in, primary for anonymous)
          try {
            const previousResult = await getDailyResult(puzzleId);
            if (previousResult) {
              setAlreadyCompleted(previousResult);
              setIsLoading(false);
              return;
            }
          } catch (error) {
            console.error('Failed to get daily result:', error);
          }

          // Generate daily puzzle - works for all users (anonymous or logged in)
          const dailyPuzzleResult = await generateDailyPuzzleWithSource(puzzleId);
          startGame(dailyPuzzleResult.puzzle);

          if (dailyPuzzleResult.source === 'local') {
            void trackTelemetryEvent('daily_puzzle_fallback_used', {
              date: puzzleId,
              hasUser: !!user,
            });
            setFallbackNotice('Offline fallback active. Puzzle loaded from local data.');
          } else {
            setFallbackNotice(null);
          }
        }
      } catch (error) {
        console.error('Unexpected error loading puzzle:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPuzzle();
  }, [puzzleId, puzzle?.id, isDateBasedPuzzle, user, getValidIdToken, startGame]);

  useEffect(() => {
    setShowWalkthrough(false);
    setWalkthroughStepIndex(0);
    setWalkthroughStartMs(null);
    setWalkthroughChecked(false);
    firstGuessTrackedRef.current = false;
  }, [puzzleId]);

  useEffect(() => {
    if (walkthroughChecked || isLoading || !puzzle) return;
    if (alreadyCompleted || serverCompleted) {
      setWalkthroughChecked(true);
      return;
    }
    if (phase !== 'playing' || currentRound !== 0 || results.length > 0) {
      setWalkthroughChecked(true);
      return;
    }

    const loadWalkthroughState = async () => {
      const completed = await hasCompletedMapWalkthrough();
      if (!completed) {
        setShowWalkthrough(true);
        setWalkthroughStepIndex(0);
        setWalkthroughStartMs(Date.now());
        void trackTelemetryEvent('map_walkthrough_shown', {
          puzzleId,
          isDateBasedPuzzle,
        });
      }
      setWalkthroughChecked(true);
    };

    void loadWalkthroughState();
  }, [
    alreadyCompleted,
    currentRound,
    isDateBasedPuzzle,
    isLoading,
    phase,
    puzzle,
    puzzleId,
    results.length,
    serverCompleted,
    walkthroughChecked,
  ]);

  const retryOnlinePuzzle = useCallback(async () => {
    if (!puzzleId || !isDateBasedPuzzle) return;

    setIsLoading(true);
    try {
      const dailyPuzzleResult = await generateDailyPuzzleWithSource(puzzleId);
      startGame(dailyPuzzleResult.puzzle);

      if (dailyPuzzleResult.source === 'api') {
        void trackTelemetryEvent('daily_puzzle_retry_online_success', {
          date: puzzleId,
          hasUser: !!user,
        });
        setFallbackNotice(null);
      } else {
        void trackTelemetryEvent('daily_puzzle_retry_still_offline', {
          date: puzzleId,
          hasUser: !!user,
        });
        setFallbackNotice('Still offline. Using local puzzle data.');
      }
    } catch (error) {
      console.error('Retry failed:', error);
      void trackTelemetryEvent('daily_puzzle_retry_error', {
        date: puzzleId,
        hasUser: !!user,
        errorMessage: error instanceof Error ? error.message : 'unknown',
      });
      setFallbackNotice('Retry failed. Using local puzzle data.');
    } finally {
      setIsLoading(false);
    }
  }, [puzzleId, isDateBasedPuzzle, startGame, user]);

  const handleMapErrorChange = useCallback((message: string | null) => {
    setMapError(message);
  }, []);

  const handleRetryMap = useCallback(() => {
    setMapError(null);
    setMapRetryCount((count) => count + 1);
  }, []);

  const handleCheckConnection = useCallback(() => {
    Alert.alert(
      'Check Connection',
      'Make sure you are online. If the map still fails, confirm your Google Maps configuration is valid and then tap Retry.'
    );
  }, []);

  const handleLocationSelect = useCallback((coords: Coordinates) => {
    if (phase !== 'playing') return;

    if (showWalkthrough && walkthroughStartMs && !firstGuessTrackedRef.current) {
      firstGuessTrackedRef.current = true;
      const elapsedMs = Date.now() - walkthroughStartMs;
      void trackTelemetryEvent('new_user_time_to_first_guess', {
        elapsedMs,
        within30Seconds: elapsedMs <= 30000,
        puzzleId,
      });
    }

    setCurrentGuess(coords);
  }, [phase, puzzleId, showWalkthrough, walkthroughStartMs]);

  const handleConfirmGuess = useCallback(() => {
    if (!currentGuess || phase !== 'playing') return;

    const result = submitGuess(currentGuess);
    setCurrentResult(result);
    setPhase('result');
  }, [currentGuess, phase, submitGuess]);

  const handleNextRound = useCallback(() => {
    if (isComplete) {
      router.push('/game/results');
      return;
    }

    nextRound();
    setPhase('playing');
    setCurrentGuess(null);
    setCurrentResult(null);
  }, [isComplete, nextRound, router]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ECDC4" />
        <Text style={styles.loadingText}>Loading puzzle...</Text>
      </View>
    );
  }

  // Show completed state for server-verified games (logged-in users)
  if (serverCompleted && serverCompleted.completed) {
    const getScoreEmojiFromRoundScore = (score: number) => {
      // Assume no multiplier info from server, use raw score thresholds
      if (score >= 90) return '🟢';
      if (score >= 70) return '🟡';
      if (score >= 50) return '🟠';
      return '🔴';
    };

    return (
      <View style={styles.completedContainer}>
        <View style={styles.completedHeader}>
          <Pressable style={styles.exitButton} onPress={handleExitGame}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.completedContent}>
          <Text style={styles.completedTitle}>Already Completed!</Text>
          <Text style={styles.completedSubtitle}>
            You played this puzzle on{' '}
            {serverCompleted.completedAt
              ? new Date(serverCompleted.completedAt).toLocaleDateString()
              : 'a previous date'}
          </Text>

          <View style={styles.completedScoreCard}>
            <Text style={styles.completedScoreLabel}>Your Score</Text>
            <Text style={styles.completedScore}>{serverCompleted.totalScore}</Text>
            <Text style={styles.completedMaxScore}>out of 500</Text>

            {serverCompleted.rounds && (
              <View style={styles.completedRounds}>
                {serverCompleted.rounds.map((roundScore, index) => (
                  <View key={index} style={styles.completedRoundRow}>
                    <Text style={styles.completedRoundLabel}>Round {index + 1}</Text>
                    <View style={styles.completedRoundScore}>
                      <Text style={styles.roundEmoji}>
                        {getScoreEmojiFromRoundScore(roundScore)}
                      </Text>
                      <Text style={styles.completedRoundScoreText}>
                        {Math.round(roundScore)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          <Pressable style={styles.homeButton} onPress={handleExitGame}>
            <Text style={styles.homeButtonText}>Back to Home</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Show completed state for daily puzzles that were already played (local storage)
  if (alreadyCompleted) {
    const getScoreEmoji = (score: number, multiplier: number) => {
      const baseScore = score / multiplier;
      if (baseScore >= 90) return '🟢';
      if (baseScore >= 70) return '🟡';
      if (baseScore >= 50) return '🟠';
      return '🔴';
    };

    return (
      <View style={styles.completedContainer}>
        <View style={styles.completedHeader}>
          <Pressable style={styles.exitButton} onPress={handleExitGame}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.completedContent}>
          <Text style={styles.completedTitle}>Already Completed!</Text>
          <Text style={styles.completedSubtitle}>
            You played this puzzle on{' '}
            {new Date(alreadyCompleted.completedAt).toLocaleDateString()}
          </Text>

          <View style={styles.completedScoreCard}>
            <Text style={styles.completedScoreLabel}>Your Score</Text>
            <Text style={styles.completedScore}>{alreadyCompleted.totalScore}</Text>
            <Text style={styles.completedMaxScore}>out of 500</Text>

            <View style={styles.completedRounds}>
              {alreadyCompleted.results.map((result, index) => (
                <View key={index} style={styles.completedRoundRow}>
                  <Text style={styles.completedRoundLabel}>Round {index + 1}</Text>
                  <View style={styles.completedRoundScore}>
                    <Text style={styles.roundEmoji}>
                      {getScoreEmoji(result.score, result.multiplier)}
                    </Text>
                    <Text style={styles.completedRoundScoreText}>
                      {Math.round(result.score)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <Pressable style={styles.homeButton} onPress={handleExitGame}>
            <Text style={styles.homeButtonText}>Back to Home</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!puzzle) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ECDC4" />
        <Text style={styles.loadingText}>Loading puzzle...</Text>
      </View>
    );
  }

  const currentRoundData = puzzle.rounds[currentRound];
  const canRetryBeforeProgress = phase === 'playing' && currentRound === 0 && results.length === 0;
  const walkthroughActive = showWalkthrough && phase === 'playing';
  const highlightClue = walkthroughActive && walkthroughStepIndex === 0;
  const highlightMap = walkthroughActive && walkthroughStepIndex === 1;
  const highlightConfirm = walkthroughActive && walkthroughStepIndex === 2;

  return (
    <View style={styles.container}>
      {/* Header with exit button and progress */}
      <View style={styles.headerContainer}>
        <Pressable style={styles.exitButton} onPress={handleExitGame}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </Pressable>
        <RoundProgress
          totalRounds={puzzle.rounds.length}
          currentRound={currentRound}
          results={results}
        />
        <Text style={styles.scoreText}>{totalScore}</Text>
      </View>

      {fallbackNotice && (
        <View style={styles.fallbackBanner}>
          <Text style={styles.fallbackBannerText}>{fallbackNotice}</Text>
          <View style={styles.fallbackActions}>
            {canRetryBeforeProgress && (
              <Pressable style={styles.fallbackRetryButton} onPress={retryOnlinePuzzle}>
                <Text style={styles.fallbackRetryButtonText}>Retry</Text>
              </Pressable>
            )}
            <Pressable style={styles.fallbackCheckButton} onPress={handleCheckConnection}>
              <Text style={styles.fallbackCheckButtonText}>Check connection</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Map */}
      <View style={[
        styles.mapContainer,
        walkthroughActive && !highlightMap && styles.dimmedSurface,
        highlightMap && styles.highlightSurface,
      ]}>
        <Globe
          key={mapRetryCount}
          onLocationSelect={handleLocationSelect}
          guessMarker={currentGuess}
          targetMarker={phase === 'result' ? currentResult?.target : null}
          targetBounds={phase === 'result' && puzzle?.rounds[currentRound] ? puzzle.rounds[currentRound].bounds : null}
          showArc={phase === 'result'}
          disabled={phase !== 'playing'}
          onErrorChange={handleMapErrorChange}
        />

        {walkthroughActive && !highlightMap && <View pointerEvents="none" style={styles.surfaceScrim} />}

        {mapError && phase === 'playing' && (
          <View style={styles.mapRecoveryOverlay}>
            <View style={styles.mapRecoveryCard}>
              <Text style={styles.mapRecoveryTitle}>Map unavailable</Text>
              <Text style={styles.mapRecoveryBody}>{mapError}</Text>
              <View style={styles.mapRecoveryActions}>
                <Pressable style={styles.fallbackRetryButton} onPress={handleRetryMap}>
                  <Text style={styles.fallbackRetryButtonText}>Retry</Text>
                </Pressable>
                <Pressable style={styles.fallbackCheckButton} onPress={handleCheckConnection}>
                  <Text style={styles.fallbackCheckButtonText}>Check connection</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {walkthroughActive && (
          <View style={[
            styles.walkthroughOverlay,
            walkthroughStepIndex === 0
              ? styles.walkthroughOverlayBottom
              : styles.walkthroughOverlayTop,
          ]}>
            <View style={styles.walkthroughCard}>
              <Pressable
                style={styles.walkthroughSkipButton}
                onPress={() => dismissWalkthrough('skip')}
              >
                <Text style={styles.walkthroughSkipText}>Skip</Text>
              </Pressable>
              <Text style={styles.walkthroughTitle}>
                {MAP_WALKTHROUGH_STEPS[walkthroughStepIndex].title}
              </Text>
              <Text style={styles.walkthroughBody}>
                {MAP_WALKTHROUGH_STEPS[walkthroughStepIndex].body}
              </Text>
              <View style={styles.walkthroughFooter}>
                <Text style={styles.walkthroughProgressText}>
                  {walkthroughStepIndex + 1} / {MAP_WALKTHROUGH_STEPS.length}
                </Text>
                <Pressable style={styles.walkthroughNextButton} onPress={handleWalkthroughNext}>
                  <Text style={styles.walkthroughNextButtonText}>
                    {walkthroughStepIndex === MAP_WALKTHROUGH_STEPS.length - 1 ? 'Done' : 'Next'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Clue card */}
      {phase === 'playing' && currentRoundData && (
        <View style={[
          styles.clueContainer,
          walkthroughActive && !highlightClue && !highlightConfirm && styles.dimmedSurface,
        ]}>
          <View style={[
            styles.clueCardFrame,
            highlightClue && styles.highlightSurface,
            walkthroughActive && !highlightClue && !highlightConfirm && styles.dimmedCard,
          ]}>
            <ClueCard
              round={currentRoundData}
              roundNumber={currentRound + 1}
              totalRounds={puzzle.rounds.length}
            />
          </View>

          {currentGuess && (
            <Pressable
              style={[
                styles.confirmButton,
                highlightConfirm && styles.highlightSurface,
              ]}
              onPress={handleConfirmGuess}
            >
              <Text style={styles.confirmButtonText}>Confirm Guess</Text>
            </Pressable>
          )}

          {highlightConfirm && !currentGuess && (
            <View style={[styles.confirmHintCard, styles.highlightSurface]}>
              <Text style={styles.confirmHintText}>
                Confirm Guess appears here after you place a pin on the map.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Score display */}
      {phase === 'result' && currentResult && currentRoundData && (
        <View style={styles.resultContainer}>
          {currentRoundData.category === 'questions' && currentRoundData.answer && (
            <View style={styles.answerReveal}>
              <Text style={styles.answerLabel}>The answer was:</Text>
              <Text style={styles.answerText}>{currentRoundData.answer}</Text>
              <Text style={styles.countryText}>{currentRoundData.country}</Text>
            </View>
          )}
          <ScoreDisplay result={currentResult} />
          <Pressable style={styles.nextButton} onPress={handleNextRound}>
            <Text style={styles.nextButtonText}>
              {isComplete ? 'See Results' : 'Next Round'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A202C',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A202C',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 16,
    fontSize: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 8,
    backgroundColor: '#1A202C',
  },
  exitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  fallbackBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(237, 137, 54, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(237, 137, 54, 0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  fallbackBannerText: {
    color: '#FBD38D',
    fontSize: 13,
    flex: 1,
  },
  fallbackActions: {
    flexDirection: 'row',
    gap: 8,
  },
  fallbackRetryButton: {
    backgroundColor: '#ED8936',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  fallbackRetryButtonText: {
    color: '#1A202C',
    fontSize: 12,
    fontWeight: '700',
  },
  fallbackCheckButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  fallbackCheckButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  mapContainer: {
    flex: 1,
  },
  mapRecoveryOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(7, 10, 18, 0.35)',
    zIndex: 4,
  },
  mapRecoveryCard: {
    width: '100%',
    maxWidth: 360,
    padding: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(26, 32, 44, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(245, 101, 101, 0.35)',
  },
  mapRecoveryTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  mapRecoveryBody: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  mapRecoveryActions: {
    flexDirection: 'row',
    gap: 10,
  },
  surfaceScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 10, 18, 0.28)',
  },
  dimmedSurface: {
    opacity: 0.72,
  },
  dimmedCard: {
    opacity: 0.86,
  },
  highlightSurface: {
    borderWidth: 2,
    borderColor: 'rgba(78, 205, 196, 0.9)',
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 10,
  },
  walkthroughOverlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 5,
  },
  walkthroughOverlayTop: {
    top: 14,
  },
  walkthroughOverlayBottom: {
    bottom: 210,
  },
  walkthroughCard: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(26, 32, 44, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.5)',
  },
  walkthroughSkipButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  walkthroughSkipText: {
    color: '#A0AEC0',
    fontSize: 13,
    fontWeight: '600',
  },
  walkthroughTitle: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  walkthroughBody: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  walkthroughFooter: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walkthroughProgressText: {
    color: '#A0AEC0',
    fontSize: 12,
    fontWeight: '600',
  },
  walkthroughNextButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  walkthroughNextButtonText: {
    color: '#1A202C',
    fontSize: 14,
    fontWeight: '700',
  },
  clueContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  clueCardFrame: {
    borderRadius: 20,
    marginHorizontal: 10,
  },
  confirmButton: {
    backgroundColor: '#4ECDC4',
    marginHorizontal: 16,
    marginBottom: 32,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#1A202C',
    fontSize: 18,
    fontWeight: '700',
  },
  confirmHintCard: {
    marginHorizontal: 16,
    marginBottom: 32,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(78, 205, 196, 0.18)',
  },
  confirmHintText: {
    color: '#E6FFFA',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  resultContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 32,
  },
  answerReveal: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    alignItems: 'center',
    width: '90%',
  },
  answerLabel: {
    color: '#A0AEC0',
    fontSize: 12,
    marginBottom: 4,
  },
  answerText: {
    color: '#4ECDC4',
    fontSize: 22,
    fontWeight: '700',
  },
  countryText: {
    color: '#718096',
    fontSize: 14,
    marginTop: 4,
  },
  nextButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  nextButtonText: {
    color: '#1A202C',
    fontSize: 18,
    fontWeight: '700',
  },
  // Completed state styles
  completedContainer: {
    flex: 1,
    backgroundColor: '#1A202C',
  },
  completedHeader: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 8,
  },
  completedContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedTitle: {
    color: '#4ECDC4',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  completedSubtitle: {
    color: '#A0AEC0',
    fontSize: 14,
    marginBottom: 32,
    textAlign: 'center',
  },
  completedScoreCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 350,
  },
  completedScoreLabel: {
    color: '#A0AEC0',
    fontSize: 14,
    marginBottom: 8,
  },
  completedScore: {
    color: '#4ECDC4',
    fontSize: 64,
    fontWeight: '700',
  },
  completedMaxScore: {
    color: '#718096',
    fontSize: 16,
    marginBottom: 24,
  },
  completedRounds: {
    width: '100%',
  },
  completedRoundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  completedRoundLabel: {
    color: '#A0AEC0',
    fontSize: 14,
  },
  completedRoundScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completedRoundScoreText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  roundEmoji: {
    fontSize: 16,
  },
  homeButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 32,
  },
  homeButtonText: {
    color: '#1A202C',
    fontSize: 18,
    fontWeight: '700',
  },
});

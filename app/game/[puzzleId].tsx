import { ClueCard, RoundProgress, ScoreDisplay } from '@/components/game';
import Globe from '@/components/map';
import { useAuth } from '@/hooks/useAuth';
import { useGameStore } from '@/hooks/useGame';
import { checkUserGame } from '@/services/api';
import { generateDailyPuzzle } from '@/services/puzzle';
import { getDailyResult, type DailyResult } from '@/services/storage';
import { Coordinates, RoundResult } from '@/types/game';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type GamePhase = 'playing' | 'result' | 'complete';

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

  // Load puzzle on mount
  useEffect(() => {
    const loadPuzzle = async () => {
      // If puzzle is already loaded with matching ID (from play-modes), skip loading
      if (puzzle && puzzle.id === puzzleId) {
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
              const response = await checkUserGame(user.id, puzzleId!, token);
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
        const previousResult = await getDailyResult(puzzleId!);
        if (previousResult) {
          setAlreadyCompleted(previousResult);
          setIsLoading(false);
          return;
        }

        const dailyPuzzle = await generateDailyPuzzle(puzzleId);
        startGame(dailyPuzzle);
      }
      setIsLoading(false);
    };

    loadPuzzle();
  }, [puzzleId, puzzle?.id, isDateBasedPuzzle, user, getValidIdToken]);

  const handleLocationSelect = useCallback((coords: Coordinates) => {
    if (phase !== 'playing') return;
    setCurrentGuess(coords);
  }, [phase]);

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

      {/* Map */}
      <View style={styles.mapContainer}>
        <Globe
          onLocationSelect={handleLocationSelect}
          guessMarker={currentGuess}
          targetMarker={phase === 'result' ? currentResult?.target : null}
          showArc={phase === 'result'}
          disabled={phase !== 'playing'}
        />
      </View>

      {/* Clue card */}
      {phase === 'playing' && currentRoundData && (
        <View style={styles.clueContainer}>
          <ClueCard
            round={currentRoundData}
            roundNumber={currentRound + 1}
            totalRounds={puzzle.rounds.length}
          />

          {currentGuess && (
            <Pressable style={styles.confirmButton} onPress={handleConfirmGuess}>
              <Text style={styles.confirmButtonText}>Confirm Guess</Text>
            </Pressable>
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
  mapContainer: {
    flex: 1,
  },
  clueContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
